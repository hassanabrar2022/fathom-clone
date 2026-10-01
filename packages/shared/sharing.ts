import { z } from 'zod';
import { intelligenceSchema, segmentSchema } from './recording';

export const privateShareTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const meetingShareStatusSchema = z.object({
  path: z.string().startsWith('/share/').nullable(),
});

export const sharedMeetingSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  duration: z.number().positive(),
  mediaUrl: z.string().startsWith('/'),
  mediaType: z.string(),
  posterUrl: z.string().startsWith('/media/').optional(),
  speakers: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  segments: z.array(segmentSchema),
  intelligence: intelligenceSchema.nullable(),
});

export type SharedMeeting = z.infer<typeof sharedMeetingSchema>;
