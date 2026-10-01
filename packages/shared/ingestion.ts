import { z } from 'zod';
import { intelligenceSchema, segmentSchema } from './recording';

// Conservative demo limits; enforced again before transcription on the server.
export const uploadLimits = { bytes: 25 * 1024 * 1024, seconds: 10 * 60 };
export const uploadMimeTypes = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
] as const;

export const createUploadSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    filename: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(
        (name) =>
          !/[\\/]/.test(name) &&
          [...name].every((character) => character.charCodeAt(0) >= 32),
        'Use a plain filename',
      ),
    contentType: z.enum(uploadMimeTypes),
    size: z.number().int().positive().max(uploadLimits.bytes),
    duration: z.number().positive().max(uploadLimits.seconds),
  })
  .strict();

export const ingestionStatusSchema = z.enum([
  'uploading',
  'uploaded',
  'transcribing',
  'analyzing',
  'complete',
  'failed',
]);
export type IngestionStatus = z.infer<typeof ingestionStatusSchema>;

export const processingFailureSchema = z.enum([
  'upload_failed',
  'transcription_failed',
  'analysis_failed',
  'processing_timeout',
]);

export const storedTranscriptSchema = z
  .array(segmentSchema)
  .max(5000)
  .superRefine((segments, context) => {
    const ids = new Set<string>();
    segments.forEach((segment, index) => {
      if (
        ids.has(segment.id) ||
        segment.start >= segment.end ||
        (index > 0 && segment.start < segments[index - 1].end)
      ) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: 'Invalid transcript order or timing',
        });
      }
      ids.add(segment.id);
    });
  });

const providerResultSchema = z.object({
  text: z.string(),
  segments: z
    .array(
      z.object({
        start: z.number().finite().nonnegative(),
        end: z.number().finite().nonnegative(),
        text: z.string(),
      }),
    )
    .max(5000),
});

/** Preserve provider timestamps; do not fabricate evenly-spaced speaker turns. */
export function normalizeTranscription(value: unknown, duration: number) {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > uploadLimits.seconds
  )
    throw new Error('Invalid media duration');
  const response = providerResultSchema.parse(value);
  const segments: z.infer<typeof segmentSchema>[] = [];
  for (const item of response.segments) {
    const text = item.text.trim();
    if (!text) continue;
    // A provider can round the last segment beyond the media's actual end.
    const start = Math.max(item.start, segments.at(-1)?.end ?? 0);
    const end = Math.min(item.end, duration);
    if (start >= end) continue;
    segments.push({
      id: `segment-${segments.length + 1}`,
      speakerId: 'speaker',
      start,
      end,
      paragraphs: [text],
    });
  }
  if (response.text.trim() && !segments.length)
    throw new Error('Transcription did not include usable timestamps');
  return storedTranscriptSchema.parse(segments);
}

const transitions: Record<IngestionStatus, readonly IngestionStatus[]> = {
  uploading: ['uploaded', 'failed'],
  uploaded: ['transcribing', 'failed'],
  transcribing: ['analyzing', 'complete', 'failed'],
  analyzing: ['complete', 'failed'],
  complete: [],
  failed: ['uploading', 'transcribing', 'analyzing'],
};

export function canTransition(from: IngestionStatus, to: IngestionStatus) {
  return transitions[from].includes(to);
}

export function retryStage(
  hasUploadedMedia: boolean,
  hasStoredTranscript: boolean,
) {
  if (hasStoredTranscript) return 'analyzing' as const;
  return hasUploadedMedia ? ('transcribing' as const) : ('uploading' as const);
}

export const processingMessages = {
  upload_failed:
    'The upload did not finish. Choose the recording again to retry.',
  transcription_failed:
    'We couldn’t transcribe this recording. Your uploaded media is saved; try again.',
  analysis_failed:
    'Transcript complete. AI analysis failed. You can use the transcript or retry analysis.',
  processing_timeout:
    'Processing took too long. Retry to continue from the last saved step.',
} satisfies Record<z.infer<typeof processingFailureSchema>, string>;

export const uploadedMeetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  media_type: z.string(),
  media_size: z.number(),
  duration_seconds: z.number().positive(),
  status: ingestionStatusSchema,
  processing_progress: z.number(),
  processing_error: processingFailureSchema.nullable(),
  created_at: z.string(),
  transcript: storedTranscriptSchema.nullable(),
  speaker_names: z.record(z.string(), z.string()).default({}),
  intelligence: intelligenceSchema.nullable(),
});
export type UploadedMeeting = z.infer<typeof uploadedMeetingSchema>;

export const deleteMeetingResultSchema = z.object({
  deleted: z.literal(true),
});
