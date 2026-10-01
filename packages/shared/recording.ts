import { z } from 'zod';

export const segmentSchema = z.object({
  id: z.string().min(1),
  speakerId: z.string().min(1),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  paragraphs: z.array(z.string().min(1)).min(1),
});

export const summaryTemplateKeySchema = z.enum([
  'general',
  'sales-customer',
  'recruiting-interview',
]);

const sourcedTextSchema = z.object({
  text: z.string().min(1),
  source: z.number().nonnegative(),
});

const summaryTemplateSchema = z.object({
  key: summaryTemplateKeySchema,
  label: z.string().min(1),
  descriptor: z.string().min(1),
  title: z.string().min(1),
  overview: z.string().min(1),
  sections: z
    .array(
      z.object({
        title: z.string().min(1),
        items: z.array(sourcedTextSchema),
      }),
    )
    .min(2),
});

const actionItemSchema = z.object({
  id: z.string().min(1),
  task: z.string().min(1),
  owner: z.string().min(1).nullable(),
  timing: z.string().min(1).nullable(),
  source: z.number().nonnegative(),
});

export const intelligenceSchema = z.object({
  provenance: z.literal('generated'),
  templates: z.array(summaryTemplateSchema).length(3),
  actions: z.array(actionItemSchema),
});

const generatedViewSchema = summaryTemplateSchema.omit({
  key: true,
  label: true,
  descriptor: true,
});
export const generatedAnalysisSchema = z.object({
  general: generatedViewSchema,
  sales_customer: generatedViewSchema,
  recruiting_interview: generatedViewSchema,
  actions: z.array(actionItemSchema),
});

export const meetingMomentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    meetingId: z.string().min(1),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    title: z.string().trim().min(1).max(100),
    note: z.string().trim().max(280),
    createdAt: z.string().datetime(),
  })
  .refine((moment) => moment.startMs < moment.endMs, {
    message: 'Moment end must follow its start',
    path: ['endMs'],
  });

/** Everything the meeting player needs: media, transcript, and AI notes. */
export const recordingSchema = z
  .object({
    id: z.string().min(1),
    mediaUrl: z.string().startsWith('/'),
    duration: z.number().positive(),
    speakers: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
    segments: z.array(segmentSchema),
    intelligence: intelligenceSchema.nullable(),
  })
  .superRefine((recording, context) => {
    const ids = new Set<string>();
    const speakerIds = new Set(recording.speakers.map((speaker) => speaker.id));
    recording.segments.forEach((segment, index) => {
      if (
        ids.has(segment.id) ||
        !speakerIds.has(segment.speakerId) ||
        segment.start >= segment.end ||
        segment.end > recording.duration ||
        (index > 0 && segment.start < recording.segments[index - 1].end)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['segments', index],
          message: 'Invalid transcript timing or speaker reference',
        });
      }
      ids.add(segment.id);
    });
  });

export type Recording = z.infer<typeof recordingSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type MeetingIntelligence = z.infer<typeof intelligenceSchema>;
export type SummaryTemplateKey = z.infer<typeof summaryTemplateKeySchema>;
export const persistedMomentSchema = meetingMomentSchema.safeExtend({
  sharePath: z.string().startsWith('/share/').optional(),
});
export type PersistedMoment = z.infer<typeof persistedMomentSchema>;

export type MeetingMoment = z.infer<typeof meetingMomentSchema>;

export function momentRange(
  start: number,
  duration: number,
  selectedEnd?: number,
): { startMs: number; endMs: number } {
  const safeDuration = Math.max(0.001, duration);
  const safeStart = Math.min(
    boundedTime(start, safeDuration),
    Math.max(0, safeDuration - 0.001),
  );
  const defaultEnd = Math.min(safeStart + 30, safeDuration);
  const safeEnd = Math.min(
    Math.max(selectedEnd ?? defaultEnd, safeStart + 0.001),
    safeDuration,
  );
  return {
    startMs: Math.round(safeStart * 1000),
    endMs: Math.round(safeEnd * 1000),
  };
}

export function activeSegment(
  segments: Segment[],
  time: number,
): string | null {
  return (
    segments.find((segment) => time >= segment.start && time < segment.end)
      ?.id ?? null
  );
}

export function boundedTime(time: number, duration: number): number {
  return Math.min(
    Math.max(0, Number.isFinite(time) ? time : 0),
    Math.max(0, duration),
  );
}
