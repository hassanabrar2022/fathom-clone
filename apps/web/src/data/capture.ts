/**
 * Records a call from this browser: the meeting tab's audio (everyone else)
 * mixed with the microphone (you). Two recorders share the mix:
 *  - one continuous recording for playback, uploaded when the call ends;
 *  - two-minute standalone parts, uploaded during the call, that the server
 *    transcribes one by one. A crash mid-call still leaves the parts so far.
 */
import { z } from 'zod';
import { putSigned, uploadApi } from './uploads';

export const PART_SECONDS = 120;
const MIME = 'audio/webm;codecs=opus';
const BITRATE = 48000;

export type CaptureState = {
  phase: 'idle' | 'starting' | 'recording' | 'saving' | 'done' | 'error';
  microphone: boolean;
  partsUploaded: number;
  partsPending: number;
  saveProgress: number;
  meetingId?: string;
  error?: string;
};

export function captureSupported() {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined' &&
    MediaRecorder.isTypeSupported(MIME)
  );
}

async function withRetries<T>(work: () => Promise<T>, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
}

export class BrowserCapture {
  private state: CaptureState = {
    phase: 'idle',
    microphone: false,
    partsUploaded: 0,
    partsPending: 0,
    saveProgress: 0,
  };
  private streams: MediaStream[] = [];
  private context?: AudioContext;
  private mix?: MediaStream;
  private full?: MediaRecorder;
  private fullChunks: Blob[] = [];
  private part?: MediaRecorder;
  private partIndex = 0;
  private partTimer?: number;
  private startedAt = 0;
  private uploads: Promise<void> = Promise.resolve();
  private stopping?: Promise<string>;
  private discarded = false;

  constructor(
    private notetakerId: string,
    private onChange: (state: CaptureState) => void,
    /** Called when the shared tab stops on its own (call closed, sharing ended). */
    private onEnded: () => void,
  ) {}

  private update(values: Partial<CaptureState>) {
    this.state = { ...this.state, ...values };
    this.onChange(this.state);
  }

  /** Must run from a click: the browser asks which tab to share. */
  async start() {
    if (this.state.phase !== 'idle' && this.state.phase !== 'error') return;
    this.update({ phase: 'starting', error: undefined });
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { suppressLocalAudioPlayback: false },
        // Chrome options: offer tabs first, never this tab itself.
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        systemAudio: 'include',
      } as DisplayMediaStreamOptions);
      this.streams.push(display);
      const tabAudio = display.getAudioTracks()[0];
      if (!tabAudio)
        throw new Error(
          'No meeting audio was shared. Choose the meeting’s tab and turn on “Share tab audio”.',
        );
      // Only the sound is recorded; the video stream can stop right away.
      display.getVideoTracks().forEach((track) => track.stop());
      tabAudio.addEventListener('ended', () => this.onEnded());
      const microphone = await navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .catch(() => null);
      if (microphone) this.streams.push(microphone);
      this.context = new AudioContext();
      const destination = this.context.createMediaStreamDestination();
      this.context
        .createMediaStreamSource(new MediaStream([tabAudio]))
        .connect(destination);
      if (microphone)
        this.context.createMediaStreamSource(microphone).connect(destination);
      this.mix = destination.stream;
      await uploadApi(`notetakers/${this.notetakerId}/start`, 'POST');
      this.startedAt = performance.now();
      this.full = new MediaRecorder(this.mix, { mimeType: MIME, audioBitsPerSecond: BITRATE });
      this.full.ondataavailable = (event) => {
        if (event.data.size) this.fullChunks.push(event.data);
      };
      this.full.start(10000);
      this.startPart();
      this.update({ phase: 'recording', microphone: !!microphone });
    } catch (error) {
      this.release();
      this.update({
        phase: 'error',
        error:
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Screen sharing was cancelled. Choose the meeting tab to record it.'
            : error instanceof Error
              ? error.message
              : 'Recording could not start.',
      });
    }
  }

  elapsed() {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  private startPart() {
    if (!this.mix) return;
    const index = this.partIndex++;
    const start = this.elapsed();
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(this.mix, { mimeType: MIME, audioBitsPerSecond: BITRATE });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const duration = Math.max(0.1, this.elapsed() - start);
      const blob = new Blob(chunks, { type: 'audio/webm' });
      if (blob.size && !this.discarded)
        this.queuePart(index, start, Math.min(duration, 300), blob);
    };
    recorder.start();
    this.part = recorder;
    this.partTimer = window.setTimeout(() => {
      recorder.stop();
      this.startPart();
    }, PART_SECONDS * 1000);
  }

  private queuePart(index: number, start: number, duration: number, blob: Blob) {
    this.update({ partsPending: this.state.partsPending + 1 });
    this.uploads = this.uploads.then(async () => {
      try {
        await withRetries(async () => {
          const { url } = z.object({ url: z.string().url() }).parse(
            await uploadApi(`notetakers/${this.notetakerId}/parts`, 'POST', {
              index,
              start,
              duration,
              size: blob.size,
            }),
          );
          await putSigned(url, blob, 'audio/webm', () => {});
        });
        this.update({ partsUploaded: this.state.partsUploaded + 1 });
      } catch {
        // The full recording still uploads; this part just won't be transcribed.
      } finally {
        this.update({ partsPending: this.state.partsPending - 1 });
      }
    });
  }

  /** Ends the recording and uploads it. Resolves with the new meeting's id. */
  stop() {
    this.stopping ??= this.finish();
    return this.stopping;
  }

  private async finish() {
    if (this.state.phase !== 'recording') throw new Error('Not recording');
    this.update({ phase: 'saving', saveProgress: 0 });
    clearTimeout(this.partTimer);
    const duration = this.elapsed();
    const stopped = (recorder?: MediaRecorder) =>
      new Promise<void>((resolve) => {
        if (!recorder || recorder.state === 'inactive') return resolve();
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    await Promise.all([stopped(this.full), stopped(this.part)]);
    this.release();
    try {
      // Let onstop queue the last part, then wait for every part to land.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await this.uploads;
      const blob = new Blob(this.fullChunks, { type: 'audio/webm' });
      const { meetingId, uploadUrl } = z
        .object({ meetingId: z.string().uuid(), uploadUrl: z.string().url() })
        .parse(
          await uploadApi(`notetakers/${this.notetakerId}/finish`, 'POST', {
            size: blob.size,
            duration: Math.max(1, duration),
            contentType: 'audio/webm',
          }),
        );
      await withRetries(() =>
        putSigned(uploadUrl, blob, 'audio/webm', (fraction) =>
          this.update({ saveProgress: Math.round(fraction * 100) }),
        ),
      );
      await withRetries(() => uploadApi(`uploads/${meetingId}/process`, 'POST'));
      this.update({ phase: 'done', meetingId, saveProgress: 100 });
      return meetingId;
    } catch (error) {
      this.update({
        phase: 'error',
        error:
          error instanceof Error ? error.message : 'The recording could not be saved.',
      });
      throw error;
    }
  }

  private release() {
    clearTimeout(this.partTimer);
    this.streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    this.streams = [];
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }

  /** Abandons the recording without saving (page closed, call cancelled). */
  discard() {
    this.discarded = true;
    clearTimeout(this.partTimer);
    if (this.full?.state === 'recording') this.full.stop();
    if (this.part?.state === 'recording') this.part.stop();
    this.release();
  }
}
