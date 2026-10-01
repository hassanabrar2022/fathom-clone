import { z } from 'zod';

export const meetingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(['Product', 'Customer', 'Design']),
  date: z.string().datetime(),
  duration: z.number().int().positive(),
  participants: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
  takeaways: z.array(z.string()),
  actions: z.array(z.object({ task: z.string(), owner: z.string() })),
  posterUrl: z.string().startsWith('/media/').optional(),
  provenance: z.enum(['synthetic', 'reference-recording', 'uploaded']),
});

export type Meeting = z.infer<typeof meetingSchema>;

export function hasRecording(meeting: Meeting): boolean {
  return meeting.provenance !== 'synthetic';
}

export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function filterMeetings(
  meetings: Meeting[],
  query: string,
  category: string,
): Meeting[] {
  const normalized = query.trim().toLocaleLowerCase();
  return meetings.filter(
    (meeting) =>
      (category === 'All meetings' || category === meeting.category) &&
      `${meeting.title} ${meeting.summary} ${meeting.participants.join(' ')}`
        .toLocaleLowerCase()
        .includes(normalized),
  );
}
