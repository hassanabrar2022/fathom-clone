// Test/seed input only; never imported by application code.
import seeds from '../../supabase/seeds/reviewer-meetings.json' with { type: 'json' };
import { meetingSchema } from './meeting';
import { meetingSearchDocumentsSchema } from './search';
import { recordingSchema } from './recording';
export const meetings = meetingSchema
  .array()
  .parse(seeds.map((s) => s.metadata));
export const searchDocuments = meetingSearchDocumentsSchema.parse(
  seeds.map((s) => s.search_document),
);
export const fixture = recordingSchema.parse(
  seeds.find((s) => s.recording)?.recording,
);
