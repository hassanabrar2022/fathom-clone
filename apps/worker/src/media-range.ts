export const PUBLIC_MEDIA_PATH = '/media/recording-walkthrough-optimized.webm';

type ByteRange = { start: number; end: number } | 'invalid' | null;

export function parseRange(value: string | null, size: number): ByteRange {
  if (!value || !value.startsWith('bytes=') || value.includes(',')) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return 'invalid';
  if (!match[1]) {
    const suffix = Number(match[2]);
    return Number.isSafeInteger(suffix) && suffix > 0
      ? { start: Math.max(0, size - suffix), end: size - 1 }
      : 'invalid';
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    end < start
  )
    return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}
