import { z } from 'zod';
import { ApiError, db, isUuid, json } from './database';
import {
  getRow,
  mediaResponse,
  newShareToken,
  rowSchema,
  type IngestionEnv,
  type Row,
} from './ingestion';
import { meetingMomentSchema } from '../../../packages/shared/recording';
import { sharedMeetingSchema } from '../../../packages/shared/sharing';
import {
  searchMeetingLibrary,
  type MeetingSearchDocument,
} from '../../../packages/shared/search';
import type { Meeting } from '../../../packages/shared/meeting';

const momentRowSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  start_ms: z.number(),
  end_ms: z.number(),
  title: z.string(),
  note: z.string(),
  share_token: z.string().nullable(),
  created_at: z.string(),
});
type MomentRow = z.infer<typeof momentRowSchema>;
const MAX_MOMENTS_PER_MEETING = 200;

function momentOutput(row: MomentRow) {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    title: row.title,
    note: row.note,
    createdAt: new Date(row.created_at).toISOString(),
    ...(row.share_token ? { sharePath: `/share/moment-${row.share_token}` } : {}),
  };
}
async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 4096) throw new ApiError(413, 'Request too large.');
  return JSON.parse(text) as unknown;
}
function speakerName(row: Row, speakerId: string) {
  return row.speaker_names[speakerId] || 'Speaker';
}
function sharedRecording(row: Row, mediaUrl: string) {
  return sharedMeetingSchema.parse({
    title: row.title,
    description:
      row.intelligence?.templates.find((view) => view.key === 'general')
        ?.overview ?? 'Recording and transcript shared by its owner.',
    duration: row.duration_seconds,
    mediaUrl,
    mediaType: row.media_type,
    speakers: [{ id: 'speaker', name: speakerName(row, 'speaker') }],
    segments: row.transcript ?? [],
    intelligence: row.intelligence,
  });
}

/** Public, read-only moment links. Each token opens only its own meeting. */
export async function publicMomentApi(request: Request, env: IngestionEnv) {
  const match = /^\/api\/moments\/([a-f0-9]{64})(?:\/(media))?$/.exec(
    new URL(request.url).pathname,
  );
  if (!match || !['GET', 'HEAD'].includes(request.method)) return null;
  const moments = momentRowSchema
    .array()
    .parse(await db(env, `meeting_moments?share_token=eq.${match[1]}&limit=1`));
  const moment = moments[0];
  if (!moment)
    throw new ApiError(404, 'This shared moment is no longer available.');
  const rows = rowSchema
    .array()
    .parse(await db(env, `meetings?id=eq.${moment.meeting_id}&limit=1`));
  const row = rows[0];
  if (!row || row.status !== 'complete' || !row.media_uploaded_at)
    throw new ApiError(404, 'This shared moment is no longer available.');
  if (match[2] === 'media') return mediaResponse(request, env, row);
  if (request.method === 'HEAD') throw new ApiError(405, 'Method not allowed.');
  return json(
    {
      recording: sharedRecording(row, `/api/moments/${match[1]}/media`),
      moment: momentOutput(moment),
    },
    200,
    { 'Referrer-Policy': 'no-referrer' },
  );
}

function searchEntry(row: Row): [Meeting, MeetingSearchDocument] {
  const names = Object.values(row.speaker_names);
  return [
    {
      id: row.id,
      title: row.title,
      date: new Date(row.created_at).toISOString(),
      duration: Math.ceil(row.duration_seconds),
      participants: names.length ? names : ['Speaker'],
      summary:
        row.intelligence?.templates.find((view) => view.key === 'general')
          ?.overview ?? '',
    },
    {
      meetingId: row.id,
      transcript: (row.transcript ?? []).map((segment) => ({
        id: segment.id,
        speaker: speakerName(row, segment.speakerId),
        start: segment.start,
        text: segment.paragraphs.join(' '),
      })),
    },
  ];
}

/** Moments and search for the signed-in user. Returns null for other routes. */
export async function libraryApi(
  request: Request,
  env: IngestionEnv,
  userId: string,
) {
  const url = new URL(request.url);
  if (url.pathname === '/api/search' && request.method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim();
    if (!query) return json([]);
    if (query.length > 200)
      throw new ApiError(400, 'Use a shorter search phrase.');
    const rows = rowSchema
      .array()
      .parse(
        await db(
          env,
          `meetings?user_id=eq.${userId}&status=eq.complete&order=created_at.desc&limit=500`,
        ),
      );
    const entries = rows.map(searchEntry);
    return json(
      searchMeetingLibrary(
        entries.map(([meeting]) => meeting),
        entries.map(([, document]) => document),
        query,
      ),
    );
  }

  const match =
    /^\/api\/uploads\/([0-9a-f-]{36})\/moments(?:\/([0-9a-f-]{36})(?:\/(share))?)?$/.exec(
      url.pathname,
    );
  if (!match) return null;
  const [, meetingId, momentId, action] = match;
  if (!isUuid(meetingId) || (momentId && !isUuid(momentId)))
    throw new ApiError(404, 'Moment not found.');
  const row = await getRow(env, meetingId, userId);
  const scope = `meeting_id=eq.${row.id}&user_id=eq.${userId}`;

  if (!momentId) {
    if (request.method === 'GET') {
      const moments = momentRowSchema
        .array()
        .parse(
          await db(
            env,
            `meeting_moments?${scope}&order=created_at&limit=${MAX_MOMENTS_PER_MEETING}`,
          ),
        );
      return json(moments.map(momentOutput));
    }
    if (request.method === 'POST') {
      const input = meetingMomentSchema.parse(await readBody(request));
      if (
        !isUuid(input.id) ||
        input.meetingId !== row.id ||
        input.endMs > row.duration_seconds * 1000 ||
        input.endMs - input.startMs > 60000
      )
        throw new ApiError(
          400,
          'Choose a valid moment range up to 60 seconds.',
        );
      const existing = momentRowSchema
        .array()
        .parse(await db(env, `meeting_moments?${scope}&id=eq.${input.id}`));
      if (existing[0]) return json(momentOutput(existing[0]));
      const count = z
        .array(z.object({ id: z.string() }))
        .parse(
          await db(
            env,
            `meeting_moments?select=id&${scope}&limit=${MAX_MOMENTS_PER_MEETING}`,
          ),
        );
      if (count.length >= MAX_MOMENTS_PER_MEETING)
        throw new ApiError(
          429,
          'This meeting has reached its saved-moment limit.',
        );
      const saved = momentRowSchema.array().parse(
        await db(env, 'meeting_moments', 'POST', {
          id: input.id,
          meeting_id: row.id,
          user_id: userId,
          start_ms: input.startMs,
          end_ms: input.endMs,
          title: input.title,
          note: input.note,
        }),
      );
      return json(momentOutput(saved[0]), 201);
    }
    throw new ApiError(405, 'Method not allowed.');
  }

  const momentFilter = `meeting_moments?${scope}&id=eq.${momentId}`;
  if (!action && request.method === 'DELETE') {
    await db(env, momentFilter, 'DELETE', undefined, 'return=minimal');
    return json({ deleted: true });
  }
  if (action === 'share' && ['POST', 'DELETE'].includes(request.method)) {
    if (request.method === 'POST' && row.status !== 'complete')
      throw new ApiError(409, 'Finish processing before sharing a moment.');
    const current = momentRowSchema
      .array()
      .parse(await db(env, `${momentFilter}&limit=1`));
    if (!current[0]) throw new ApiError(404, 'Moment not found.');
    if (request.method === 'POST' && current[0].share_token)
      return json(momentOutput(current[0]));
    const saved = momentRowSchema.array().parse(
      await db(env, momentFilter, 'PATCH', {
        share_token: request.method === 'POST' ? newShareToken() : null,
      }),
    );
    if (!saved[0]) throw new ApiError(404, 'Moment not found.');
    return json(momentOutput(saved[0]));
  }
  throw new ApiError(405, 'Method not allowed.');
}
