import { z } from 'zod';
import type { IngestionEnv } from './ingestion';
import { ApiError, db, json, owner } from './database';
import { meetingSchema, type Meeting } from '../../../packages/shared/meeting';
import {
  meetingMomentSchema,
  recordingSchema,
  type Recording,
} from '../../../packages/shared/recording';
import { uploadedMeetingSchema } from '../../../packages/shared/ingestion';
import {
  meetingSearchDocumentSchema,
  searchMeetingLibrary,
} from '../../../packages/shared/search';
import { sharedMeetingSchema } from '../../../packages/shared/sharing';

const seedSchema = z.object({
  id: z.string(),
  metadata: meetingSchema,
  recording: recordingSchema.nullable(),
  search_document: meetingSearchDocumentSchema,
});
const momentRowSchema = z.object({
  data: meetingMomentSchema,
  share_token: z.string().nullable(),
});
const namesSchema = z.record(z.string(), z.string());
async function inputBody(request: Request) {
  const text = await request.text();
  if (text.length > 4096) throw new ApiError(413, 'Request too large.');
  return JSON.parse(text) as unknown;
}

async function seed(env: IngestionEnv, id: string) {
  const rows = seedSchema
    .array()
    .parse(await db(env, `reviewer_meetings?id=eq.${id}&limit=1`));
  if (!rows[0]) throw new ApiError(404, 'This meeting is no longer available.');
  return rows[0];
}
function publicMeeting(row: z.infer<typeof seedSchema>) {
  if (!row.recording)
    throw new ApiError(404, 'This meeting has no shared recording.');
  return sharedMeetingSchema.parse({
    title: row.metadata.title,
    description: row.metadata.summary,
    ...row.recording,
    mediaType: 'video/webm',
  });
}
async function scope(env: IngestionEnv, id: string, hash: string | null) {
  if (z.string().uuid().safeParse(id).success) {
    if (!hash)
      throw new ApiError(
        401,
        'Open this recording in the browser used to upload it.',
      );
    const rows = uploadedMeetingSchema
      .array()
      .parse(
        await db(
          env,
          `uploaded_meetings?id=eq.${id}&owner_hash=eq.${hash}&limit=1`,
        ),
      );
    if (!rows[0])
      throw new ApiError(404, 'This recording is unavailable in this browser.');
    return { duration: rows[0].duration_seconds, private: true };
  }
  const row = await seed(env, id);
  if (!row.recording) throw new ApiError(404, 'This meeting has no recording.');
  return { duration: row.recording.duration, private: false };
}
const momentOutput = (row: z.infer<typeof momentRowSchema>) => ({
  ...row.data,
  ...(row.share_token ? { sharePath: `/share/moment-${row.share_token}` } : {}),
});

export async function reviewerApi(
  request: Request,
  env: IngestionEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const isRoute = /^\/api\/(meetings(?:\/|$)|search$|moments\/|shares\/)/.test(
    url.pathname,
  );
  if (!isRoute) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new ApiError(
      503,
      'Meeting storage is temporarily unavailable. Please retry.',
    );
  const hash = await owner(request);
  const shared = /^\/api\/shares\/([a-f0-9]{64})$/.exec(url.pathname);
  if (shared && request.method === 'GET') {
    const rows = z
      .array(z.object({ meeting_id: z.string() }))
      .parse(
        await db(
          env,
          `reviewer_meeting_shares?token=eq.${shared[1]}&enabled=eq.true&limit=1`,
        ),
      );
    return rows[0]
      ? json(publicMeeting(await seed(env, rows[0].meeting_id)))
      : null;
  }
  const sharedMoment = /^\/api\/moments\/([a-f0-9]{64})$/.exec(url.pathname);
  if (sharedMoment && request.method === 'GET') {
    const rows = momentRowSchema
      .array()
      .parse(
        await db(
          env,
          `meeting_moments?share_token=eq.${sharedMoment[1]}&limit=1`,
        ),
      );
    const moment = rows[0];
    if (!moment)
      throw new ApiError(404, 'This shared moment is no longer available.');
    const row = await seed(env, moment.data.meetingId);
    return json({
      meeting: row.metadata,
      recording: row.recording,
      moment: momentOutput(moment),
    });
  }
  if (url.pathname === '/api/meetings' && request.method === 'GET') {
    const rows = z
      .array(z.object({ metadata: meetingSchema }))
      .parse(await db(env, 'reviewer_meetings?select=metadata&order=id'));
    return json(
      rows.map((r) => r.metadata).sort((a, b) => b.date.localeCompare(a.date)),
    );
  }
  if (url.pathname === '/api/search' && request.method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim();
    if (!query) return json([]);
    if (query.length > 200)
      throw new ApiError(400, 'Use a shorter search phrase.');
    const rows = z
      .array(seedSchema.pick({ metadata: true, search_document: true }))
      .parse(
        await db(env, 'reviewer_meetings?select=metadata,search_document'),
      );
    const meetings: Meeting[] = rows.map((r) => r.metadata);
    const documents = rows.map((r) => r.search_document);
    if (hash) {
      const uploads = uploadedMeetingSchema
        .array()
        .parse(
          await db(env, `uploaded_meetings?owner_hash=eq.${hash}&limit=100`),
        );
      for (const row of uploads) {
        meetings.push({
          id: row.id,
          title: row.title,
          category: 'Product',
          date: new Date(row.created_at).toISOString(),
          duration: Math.ceil(row.duration_seconds),
          participants: Object.values(row.speaker_names).length
            ? Object.values(row.speaker_names)
            : ['Speaker'],
          summary:
            row.intelligence?.templates.map((t) => t.overview).join(' ') ||
            'No summary available',
          takeaways: [],
          actions: [],
          provenance: 'uploaded',
        });
        documents.push({
          meetingId: row.id,
          transcript: (row.transcript || []).map((s) => ({
            id: s.id,
            speaker: row.speaker_names[s.speakerId] || 'Speaker',
            start: s.start,
            text: s.paragraphs.join(' '),
          })),
        });
      }
    }
    return json(
      searchMeetingLibrary(
        meetings,
        documents,
        query,
        url.searchParams.get('category') || 'All meetings',
      ),
    );
  }
  const match =
    /^\/api\/meetings\/([a-z0-9-]+)(?:\/(recording|share|moments|speakers))?$/.exec(
      url.pathname,
    );
  if (!match) return null;
  const [, id, action] = match;
  if (action === 'moments') {
    const meetingScope = await scope(env, id, hash);
    if (request.method === 'GET') {
      const filter = hash
        ? `or=(owner_hash.eq.${hash},owner_hash.is.null)`
        : 'owner_hash=is.null';
      const rows = momentRowSchema
        .array()
        .parse(
          await db(
            env,
            `meeting_moments?meeting_key=eq.${id}&${filter}&order=created_at&limit=100`,
          ),
        );
      return json(rows.map(momentOutput));
    }
    if (request.method === 'POST') {
      if (!hash)
        throw new ApiError(401, 'Refresh the page and try saving again.');
      const input = meetingMomentSchema.parse(await inputBody(request));
      if (
        !z.string().uuid().safeParse(input.id).success ||
        input.meetingId !== id ||
        input.endMs > meetingScope.duration * 1000 ||
        input.endMs - input.startMs > 60000
      )
        throw new ApiError(
          400,
          'Choose a valid moment range up to 60 seconds.',
        );
      const existing = momentRowSchema
        .array()
        .parse(
          await db(
            env,
            `meeting_moments?meeting_key=eq.${id}&owner_hash=eq.${hash}&id=eq.${input.id}`,
          ),
        );
      if (existing[0]) return json(momentOutput(existing[0]));
      const count = z
        .array(z.object({ id: z.string() }))
        .parse(
          await db(
            env,
            `meeting_moments?select=id&owner_hash=eq.${hash}&limit=100`,
          ),
        );
      if (count.length >= 100)
        throw new ApiError(
          429,
          'This browser has reached the demo saved-moment limit.',
        );
      const token = meetingScope.private
        ? null
        : [...crypto.getRandomValues(new Uint8Array(32))]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
      const rows = momentRowSchema.array().parse(
        await db(env, 'meeting_moments', 'POST', {
          id: input.id,
          meeting_key: id,
          owner_hash: hash,
          data: { ...input, createdAt: new Date().toISOString() },
          share_token: token,
        }),
      );
      return json(momentOutput(rows[0]), 201);
    }
    throw new ApiError(405, 'Method not allowed.');
  }
  const row = await seed(env, id);
  if (!action && request.method === 'GET')
    return json({ meeting: row.metadata, searchDocument: row.search_document });
  if (action === 'recording' && request.method === 'GET') {
    if (!row.recording)
      throw new ApiError(404, 'This meeting has no recording.');
    let recording: Recording = row.recording;
    if (hash) {
      const names = z
        .array(z.object({ names: namesSchema }))
        .parse(
          await db(
            env,
            `reviewer_speaker_names?meeting_id=eq.${id}&owner_hash=eq.${hash}`,
          ),
        );
      if (names[0])
        recording = {
          ...recording,
          speakers: recording.speakers.map((s) => ({
            ...s,
            name: names[0].names[s.id] || s.name,
          })),
        };
    }
    return json(recording);
  }
  if (action === 'share' && request.method === 'GET') {
    const rows = z
      .array(z.object({ token: z.string() }))
      .parse(
        await db(
          env,
          `reviewer_meeting_shares?meeting_id=eq.${id}&enabled=eq.true&limit=1`,
        ),
      );
    if (!rows[0])
      throw new ApiError(404, 'This meeting has no public share link.');
    return json({ path: `/share/meeting-${rows[0].token}` });
  }
  if (action === 'speakers' && request.method === 'PATCH') {
    if (!hash) throw new ApiError(401, 'Refresh the page and retry.');
    const input = z
      .object({
        speakerId: z.string().min(1).max(80),
        name: z
          .string()
          .trim()
          .min(1)
          .max(60)
          .refine((v) => ![...v].some((c) => c.charCodeAt(0) < 32)),
      })
      .parse(await inputBody(request));
    if (!row.recording?.speakers.some((s) => s.id === input.speakerId))
      throw new ApiError(404, 'Speaker not found.');
    const old = z
      .array(z.object({ names: namesSchema }))
      .parse(
        await db(
          env,
          `reviewer_speaker_names?meeting_id=eq.${id}&owner_hash=eq.${hash}`,
        ),
      );
    await db(
      env,
      'reviewer_speaker_names?on_conflict=meeting_id,owner_hash',
      'POST',
      {
        meeting_id: id,
        owner_hash: hash,
        names: { ...old[0]?.names, [input.speakerId]: input.name },
      },
      'resolution=merge-duplicates,return=representation',
    );
    return json({ saved: true });
  }
  throw new ApiError(405, 'Method not allowed.');
}
