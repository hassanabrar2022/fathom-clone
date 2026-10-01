// Types for seed.mjs. Only the pure helpers are declared; the seeding run itself
// happens when the file is executed as a script.
import type { SeededMeeting } from './seed-data.d.mts';

export declare function derivedUuid(...parts: string[]): string;
export declare function derivedToken(...parts: string[]): string;
export declare function silentWav(durationSeconds: number): Buffer;
export declare function readCredentials(
  withMedia: boolean,
): Record<string, string>;

export interface SeededMeetingRow {
  id: string;
  user_id: string;
  title: string;
  original_filename: string;
  media_type: string;
  storage_key: string;
  media_size: number;
  duration_seconds: number;
  status: 'complete';
  processing_progress: number;
  processing_error: null;
  source: string;
  transcript: SeededMeeting['segments'];
  intelligence: SeededMeeting['intelligence'];
  speaker_names: Record<string, string>;
  media_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeededMomentRow {
  id: string;
  meeting_id: string;
  user_id: string;
  start_ms: number;
  end_ms: number;
  title: string;
  note: string;
  share_token: string | null;
  created_at: string;
}

export declare function meetingRows(
  meeting: SeededMeeting,
  userId: string,
  mediaSize?: number,
): {
  id: string;
  meeting: SeededMeetingRow;
  moments: SeededMomentRow[];
  share: {
    meeting_id: string;
    token: string;
    enabled: boolean;
    created_at: string;
  } | null;
};
