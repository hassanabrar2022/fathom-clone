// Long recordings are sent to transcription as audio, not as an entire video.
// This PCM file is uploaded privately alongside the original playback media.
export const longRecordingSeconds = 120;
const sampleRate = 16000;

export async function transcriptionAudio(file: File): Promise<Blob> {
  const decoder = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error(
      'This browser could not prepare the recording audio. Try an MP4, WebM, MP3, or WAV file.',
    );
  } finally {
    await decoder.close();
  }
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * sampleRate),
    sampleRate,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const label = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  label(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  label(8, 'WAVE');
  label(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(
      44 + index * 2,
      sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767),
      true,
    );
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
