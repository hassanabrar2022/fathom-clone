import { z } from 'zod';

/** A meeting as listed in search results. */
export const meetingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().datetime(),
  duration: z.number().int().positive(),
  participants: z.array(z.string().min(1)).min(1),
  summary: z.string(),
});

export type Meeting = z.infer<typeof meetingSchema>;

export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = String(value % 60).padStart(2, '0');
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
    : `${minutes}:${rest}`;
}
