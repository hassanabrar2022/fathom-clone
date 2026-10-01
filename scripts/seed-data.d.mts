// Types for seed-data.mjs. The module itself is plain JS so scripts/seed.mjs can
// run it with no build step; this is what the tests type-check against.
import type {
  Segment,
  MeetingIntelligence,
} from '../packages/shared/recording';

export declare const demoAccount: { email: string; password: string };

export interface SeededMoment {
  title: string;
  note: string;
  startMs: number;
  endMs: number;
}

export interface SeededMeeting {
  key: string;
  title: string;
  filename: string;
  source: 'upload' | 'notetaker' | 'browser';
  mediaType: string;
  durationSeconds: number;
  createdAt: string;
  speakerNames: Record<string, string>;
  share: boolean;
  segments: Segment[];
  intelligence: MeetingIntelligence;
  moments: SeededMoment[];
}

export declare function buildSegments(
  turns: [string, string][],
  duration: number,
): Segment[];

export declare function buildSeedMeetings(now?: Date): SeededMeeting[];
