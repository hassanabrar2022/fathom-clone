import { z } from 'zod';
import {
  createUploadSchema,
  uploadedMeetingSchema,
  uploadLimits,
  type UploadedMeeting,
} from '../../../../packages/shared/ingestion';
import { reportSignedOut } from '../auth-state';
import {
  longRecordingSeconds,
  transcriptionAudio,
} from './transcription-audio';

export async function uploadApi(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(
      method === 'POST' && path.endsWith('/process') ? 175000 : 20000,
    ),
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  if (response.status === 401) reportSignedOut();
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      error?.message ??
        'We couldn’t reach your recordings. Check your connection and retry.',
    );
  }
  return response.json() as Promise<unknown>;
}

export async function inspectMedia(file: File) {
  if (file.size > uploadLimits.bytes || file.size === 0)
    throw new Error('Choose a non-empty recording up to 25 MB.');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const types: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    webm: 'video/webm',
  };
  const contentType = file.type || types[extension ?? ''] || '';
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const element = document.createElement('video');
      element.preload = 'metadata';
      const cleanup = () => {
        clearTimeout(timer);
        element.removeAttribute('src');
        element.load();
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'We couldn’t read this recording. Try an MP4, WebM, MP3, M4A, or WAV file.',
          ),
        );
      }, 15000);
      element.onloadedmetadata = () => {
        const value = element.duration;
        cleanup();
        resolve(value);
      };
      element.onerror = () => {
        cleanup();
        reject(
          new Error(
            'This browser cannot read the recording. Try MP4, WebM, MP3, M4A, or WAV.',
          ),
        );
      };
      element.src = objectUrl;
    });
    const input = createUploadSchema.safeParse({
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
      filename: file.name,
      size: file.size,
      contentType,
      duration,
    });
    if (!input.success)
      throw new Error(
        'Use a supported recording up to 25 MB and 10 minutes with a plain filename.',
      );
    return input.data;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type Transfer = { progress: number; confirmed?: boolean; error?: string };
const transfers = new Map<string, Transfer>();
export function transferStatus(id: string) {
  return transfers.get(id);
}
function emit(id: string, state: Transfer) {
  transfers.set(id, state);
  window.dispatchEvent(new CustomEvent('fathom-clone-transfer', { detail: id }));
}
async function putSigned(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error('Upload failed. Choose the recording again to retry.'),
          );
    xhr.onerror = xhr.ontimeout = () =>
      reject(
        new Error(
          'The upload connection was interrupted. Choose the recording again to retry.',
        ),
      );
    xhr.send(body);
  });
}

export async function transferRecording(
  file: File,
  meeting: UploadedMeeting,
  preparedAudio?: Blob,
) {
  emit(meeting.id, { progress: 0 });
  try {
    if (file.size !== meeting.media_size)
      throw new Error('Choose the same recording to retry this upload.');
    const long = meeting.duration_seconds > longRecordingSeconds;
    try {
      const { url } = z
        .object({ url: z.string().url() })
        .parse(await uploadApi(`uploads/${meeting.id}/upload-url`, 'POST'));
      await putSigned(url, file, meeting.media_type, (fraction) => {
        emit(meeting.id, {
          progress: Math.round(fraction * (long ? 65 : 100)),
        });
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== 'This recording has already been uploaded.'
      )
        throw error;
    }
    if (long) {
      emit(meeting.id, { progress: 65 });
      const audio = preparedAudio ?? (await transcriptionAudio(file));
      if (audio.size > uploadLimits.bytes)
        throw new Error('The audio track is too large to process.');
      const { url } = z
        .object({ url: z.string().url() })
        .parse(
          await uploadApi(`uploads/${meeting.id}/upload-url?audio=1`, 'POST'),
        );
      await putSigned(url, audio, 'audio/wav', (fraction) => {
        emit(meeting.id, { progress: 65 + Math.round(fraction * 35) });
      });
    }
    emit(meeting.id, { progress: 100, confirmed: true });
    await uploadApi(`uploads/${meeting.id}/process`, 'POST');
    transfers.delete(meeting.id);
    window.dispatchEvent(
      new CustomEvent('fathom-clone-transfer', { detail: meeting.id }),
    );
  } catch (error) {
    emit(meeting.id, {
      progress: transferStatus(meeting.id)?.progress ?? 0,
      confirmed: transferStatus(meeting.id)?.confirmed,
      error:
        error instanceof Error
          ? error.message
          : 'Upload interrupted. Please retry.',
    });
  }
}

export async function createUpload(
  file: File,
  title: string,
  onCreated: (id: string) => void,
) {
  const input = await inspectMedia(file);
  const audio =
    input.duration > longRecordingSeconds
      ? await transcriptionAudio(file)
      : undefined;
  const meeting = uploadedMeetingSchema.parse(
    await uploadApi('uploads', 'POST', { ...input, title }),
  );
  onCreated(meeting.id);
  await transferRecording(file, meeting, audio);
}
