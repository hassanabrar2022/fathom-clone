/**
 * The notetaker: gets a recording of a live call into the same pipeline as an
 * upload. Two capture providers share one record (`notetakers`):
 *
 *  - recall:  a Recall.ai bot joins the call. CaptureMeetingWorkflow follows it
 *             by polling (no public webhook needed), then imports the video and
 *             Recall's speaker-labelled transcript.
 *  - browser: the owner's browser records the meeting tab and microphone and
 *             uploads short audio parts during the call, then the full file.
 *
 * Either way the meeting row reuses the notetaker's id, highlights become saved
 * moments, and ProcessMeetingWorkflow writes the AI notes.
 */
import { z } from 'zod';
import { ApiError, db, isUuid, json } from './database';
import {
  getRow,
  objectUrl,
  rowSchema,
  s3,
  stagingKey,
  startProcessing,
  type IngestionEnv,
} from './ingestion';
import {
  activeNotetakerStatuses,
  createHighlightSchema,
  createNotetakerSchema,
  highlightRange,
  highlightSchema,
  meetingPlatform,
  notetakerSchema,
  notetakerStatusSchema,
  recallTranscriptToSegments,
  type Highlight,
  type NotetakerStatus,
} from '../../../packages/shared/notetaker';
import { storedTranscriptSchema } from '../../../packages/shared/ingestion';

export type CaptureParams = { notetakerId: string; userId: string };

export const notetakerRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  meeting_id: z.string().uuid().nullable(),
  provider: z.enum(['recall', 'browser']),
  external_id: z.string().nullable(),
  meeting_url: z.string().nullable(),
  platform: z.enum(['google_meet', 'zoom', 'teams', 'other']),
  title: z.string(),
  calendar_event_id: z.string().nullable(),
  join_at: z.string(),
  status: notetakerStatusSchema,
  status_detail: z.string().nullable(),
  recording_started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  highlights: z.array(highlightSchema),
  parts: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      key: z.string(),
      start: z.number().nonnegative(),
      duration: z.number().positive(),
      size: z.number().int().positive(),
    }),
  ),
  created_at: z.string(),
  updated_at: z.string(),
});
export type NotetakerRow = z.infer<typeof notetakerRowSchema>;

const MAX_HIGHLIGHTS = 100;
const MAX_PARTS = 1000;
/** Browser capture uploads a standalone audio file this often. */
export const PART_SECONDS = 120;
const MAX_RECORDING_BYTES = 4 * 1024 ** 3;
const MAX_RECORDING_SECONDS = 4 * 3600;
const BOT_NAME = 'Fathom Clone Notetaker';

export function botEnabled(env: IngestionEnv) {
  return Boolean(env.RECALL_API_KEY && env.CAPTURE_MEETING);
}

export function notetakerOutput(row: NotetakerRow) {
  return notetakerSchema.parse({
    id: row.id,
    provider: row.provider,
    meetingId: row.meeting_id,
    meetingUrl: row.meeting_url,
    platform: row.platform,
    title: row.title,
    calendarEventId: row.calendar_event_id,
    joinAt: new Date(row.join_at).toISOString(),
    status: row.status,
    statusDetail: row.status_detail,
    recordingStartedAt: row.recording_started_at
      ? new Date(row.recording_started_at).toISOString()
      : null,
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    highlights: row.highlights,
    serverTime: new Date().toISOString(),
  });
}

async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 4096) throw new ApiError(413, 'Request too large.');
  return JSON.parse(text || '{}') as unknown;
}

export async function getNotetaker(env: IngestionEnv, id: string, userId: string) {
  const rows = notetakerRowSchema
    .array()
    .parse(await db(env, `notetakers?id=eq.${id}&user_id=eq.${userId}&limit=1`));
  if (!rows[0]) throw new ApiError(404, 'This notetaker could not be found.');
  return rows[0];
}

export async function updateNotetaker(
  env: IngestionEnv,
  row: Pick<NotetakerRow, 'id' | 'user_id'>,
  values: Record<string, unknown>,
  filter = '',
) {
  const saved = notetakerRowSchema
    .array()
    .parse(
      await db(
        env,
        `notetakers?id=eq.${row.id}&user_id=eq.${row.user_id}${filter}`,
        'PATCH',
        { ...values, updated_at: new Date().toISOString() },
      ),
    );
  return saved[0] ?? null;
}

// ---------------------------------------------------------------- Recall.ai

const recallBotSchema = z.object({
  id: z.string(),
  status_changes: z
    .array(
      z.object({
        code: z.string(),
        sub_code: z.string().nullable().optional(),
        created_at: z.string(),
      }),
    )
    .default([]),
  recordings: z
    .array(
      z.object({
        id: z.string(),
        started_at: z.string().nullable().optional(),
        completed_at: z.string().nullable().optional(),
        status: z.object({ code: z.string() }).optional(),
        media_shortcuts: z
          .object({
            video_mixed: z
              .object({
                status: z.object({ code: z.string() }).optional(),
                data: z.object({ download_url: z.string().url().nullable() }).nullable().optional(),
              })
              .nullable()
              .optional(),
            transcript: z
              .object({
                status: z.object({ code: z.string() }).optional(),
                data: z.object({ download_url: z.string().url().nullable() }).nullable().optional(),
              })
              .nullable()
              .optional(),
          })
          .nullable()
          .optional(),
      }),
    )
    .default([]),
});
type RecallBot = z.infer<typeof recallBotSchema>;

export class RecallError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function recall(
  env: IngestionEnv,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  if (!env.RECALL_API_KEY) throw new RecallError(503, 'Recall.ai is not configured');
  const region = (env.RECALL_REGION || 'us-west-2').replace(/[^a-z0-9-]/g, '');
  const response = await fetch(`https://${region}.recall.ai/api/v1/${path}`, {
    method,
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: env.RECALL_API_KEY,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    console.error('Recall request failed', { method, path: path.split('/')[0], status: response.status, detail });
    throw new RecallError(response.status, detail || `Recall.ai returned ${response.status}`);
  }
  return response.status === 204 ? null : ((await response.json()) as unknown);
}

async function recallBot(env: IngestionEnv, id: string) {
  return recallBotSchema.parse(await recall(env, `bot/${encodeURIComponent(id)}/`));
}

/** Recall needs ten minutes' notice to guarantee a scheduled bot is on time. */
const SCHEDULE_NOTICE_MS = 10 * 60 * 1000;

async function sendBot(env: IngestionEnv, row: NotetakerRow) {
  const joinAt = Date.parse(row.join_at);
  const bot = recallBotSchema.parse(
    await recall(env, 'bot/', 'POST', {
      meeting_url: row.meeting_url,
      bot_name: BOT_NAME,
      ...(joinAt - Date.now() > SCHEDULE_NOTICE_MS
        ? { join_at: new Date(joinAt).toISOString() }
        : {}),
      metadata: { notetaker_id: row.id },
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              mode: 'prioritize_accuracy',
              language_code: 'auto',
            },
          },
          diarization: { use_separate_streams_when_available: true },
        },
      },
      chat: {
        on_bot_join: {
          send_to: 'everyone',
          message:
            'Fathom Clone is taking notes on this call. The recording and transcript go to the person who invited it.',
        },
      },
    }),
  );
  return bot.id;
}

/** Our status for a bot, from the latest of Recall's status changes. */
export function botState(bot: RecallBot): {
  status: NotetakerStatus;
  detail: string | null;
  recordingStartedAt: string | null;
  ready: boolean;
} {
  const changes = bot.status_changes;
  const latest = changes.at(-1);
  const recorded = changes.find((change) => change.code === 'in_call_recording');
  const recordingStartedAt =
    bot.recordings[0]?.started_at ?? recorded?.created_at ?? null;
  const base = { recordingStartedAt, ready: false, detail: null };
  switch (latest?.code) {
    case undefined:
    case 'ready':
      return { ...base, status: 'scheduled' };
    case 'joining_call':
      return { ...base, status: 'joining', detail: 'Joining the call' };
    case 'in_waiting_room':
      return { ...base, status: 'waiting_room', detail: 'Waiting to be let in' };
    case 'in_call_not_recording':
    case 'recording_permission_allowed':
      return { ...base, status: 'joining', detail: 'In the call, starting to record' };
    case 'recording_permission_denied':
      return { ...base, status: 'failed', detail: 'The host did not allow recording' };
    case 'in_call_recording':
      return { ...base, status: 'recording', detail: 'Recording' };
    case 'recording_done':
    case 'call_ended':
      return recorded
        ? { ...base, status: 'processing', detail: 'Call ended, preparing the recording' }
        : { ...base, status: 'failed', detail: callEndedReason(latest.sub_code) };
    case 'done':
    case 'analysis_done':
    case 'analysis_failed':
      return recorded
        ? { ...base, status: 'processing', detail: 'Importing the recording', ready: true }
        : { ...base, status: 'failed', detail: callEndedReason(latest.sub_code) };
    case 'fatal':
      // A bot that fails mid-call still delivers what it recorded with "done".
      return recorded
        ? { ...base, status: 'processing', detail: 'Call interrupted, saving what was recorded' }
        : { ...base, status: 'failed', detail: callEndedReason(latest.sub_code) };
    case 'media_expired':
      return { ...base, status: 'failed', detail: 'The recording expired before import' };
    default:
      return { ...base, status: 'joining', detail: null };
  }
}

function callEndedReason(code: string | null | undefined) {
  const reasons: Record<string, string> = {
    timeout_exceeded_waiting_room: 'Nobody let the notetaker in',
    timeout_exceeded_noone_joined: 'Nobody joined the call',
    timeout_exceeded_everyone_left: 'Everyone left the call',
    bot_kicked_from_waiting_room: 'The notetaker was declined at the door',
    bot_kicked_from_call: 'The notetaker was removed from the call',
    call_ended_by_host: 'The host ended the call',
    meeting_not_found: 'The meeting link did not work',
    meeting_not_started: 'The meeting had not started',
    google_meet_sign_in_required: 'This Meet only admits signed-in guests',
    google_meet_login_required: 'This Meet only admits signed-in guests',
    bot_removed: 'The notetaker was removed',
  };
  return (code && reasons[code]) || 'The notetaker could not record this call';
}

// ---------------------------------------------------------- creating notetakers

export async function createNotetaker(
  env: IngestionEnv,
  userId: string,
  input: {
    provider: 'recall' | 'browser';
    title?: string;
    meetingUrl?: string;
    joinAt?: string;
    calendarEventId?: string;
  },
) {
  if (input.provider === 'recall' && !botEnabled(env))
    throw new ApiError(
      409,
      'The notetaker bot is not set up on this server. Record from this browser instead.',
    );
  const active = notetakerRowSchema
    .array()
    .parse(
      await db(
        env,
        `notetakers?user_id=eq.${userId}&status=in.(${activeNotetakerStatuses.join(',')})&limit=50`,
      ),
    );
  if (active.length >= 20)
    throw new ApiError(429, 'You have too many notetakers scheduled. Cancel one first.');
  const platform = input.meetingUrl ? meetingPlatform(input.meetingUrl) : null;
  const joinAt = input.joinAt && Date.parse(input.joinAt) > Date.now() ? input.joinAt : new Date().toISOString();
  const now = new Date().toISOString();
  const inserted = notetakerRowSchema.array().parse(
    await db(env, 'notetakers', 'POST', {
      id: crypto.randomUUID(),
      user_id: userId,
      provider: input.provider,
      meeting_url: input.meetingUrl ?? null,
      platform: platform ?? 'other',
      title: input.title || `${platform === 'google_meet' ? 'Google Meet' : platform === 'zoom' ? 'Zoom' : platform === 'teams' ? 'Teams' : 'Meeting'} call`,
      calendar_event_id: input.calendarEventId ?? null,
      join_at: joinAt,
      status: input.provider === 'recall' && Date.parse(joinAt) - Date.now() < 60000 ? 'joining' : 'scheduled',
      status_detail: input.provider === 'recall' ? 'Sending the notetaker' : null,
      highlights: [],
      parts: [],
      created_at: now,
      updated_at: now,
    }),
  );
  let row = inserted[0];
  if (input.provider === 'browser') return row;
  try {
    const botId = await sendBot(env, row);
    row =
      (await updateNotetaker(env, row, {
        external_id: botId,
        status_detail: row.status === 'scheduled' ? 'Scheduled to join' : 'Joining the call',
      })) ?? row;
    await env.CAPTURE_MEETING!.create({
      id: `capture-${row.id}`,
      params: { notetakerId: row.id, userId },
    });
  } catch (error) {
    console.error('Could not send the notetaker', error instanceof Error ? error.message : error);
    await updateNotetaker(env, row, {
      status: 'failed',
      status_detail: 'The notetaker could not be sent',
    });
    throw new ApiError(
      502,
      error instanceof RecallError && error.status === 400
        ? 'The notetaker service rejected this meeting link. Check it and try again.'
        : 'The notetaker could not be sent. Please try again.',
    );
  }
  return row;
}

/** Stops a notetaker: unschedules it, or asks the bot to leave and keep what it has. */
export async function cancelNotetaker(env: IngestionEnv, row: NotetakerRow) {
  if (!activeNotetakerStatuses.includes(row.status) || row.status === 'processing')
    return row;
  if (row.provider === 'recall' && row.external_id) {
    try {
      if (row.status === 'scheduled')
        await recall(env, `bot/${encodeURIComponent(row.external_id)}/`, 'DELETE');
      else await recall(env, `bot/${encodeURIComponent(row.external_id)}/leave_call/`, 'POST');
    } catch (error) {
      // A scheduled bot that already started joining can't be deleted; make it leave.
      if (error instanceof RecallError && error.status === 405)
        await recall(env, `bot/${encodeURIComponent(row.external_id)}/leave_call/`, 'POST').catch(() => null);
      else if (!(error instanceof RecallError && error.status === 404))
        throw new ApiError(502, 'The notetaker could not be stopped. Please retry.');
    }
  }
  // A bot that is already recording finishes like any call: its workflow imports it.
  if (row.provider === 'recall' && row.status === 'recording')
    return (
      (await updateNotetaker(env, row, {
        status: 'processing',
        status_detail: 'Leaving the call, preparing the recording',
      })) ?? row
    );
  return (
    (await updateNotetaker(env, row, {
      status: 'cancelled',
      status_detail: row.status === 'recording' ? 'Recording discarded' : 'Cancelled',
      ended_at: new Date().toISOString(),
    })) ?? row
  );
}

// --------------------------------------------------------- capture workflow

export type CaptureCheck =
  | { next: 'sleep'; until: string }
  | { next: 'wait'; delay: number }
  | { next: 'import' }
  | { next: 'stop' };

/** One look at the bot: records its status and says what the workflow does next. */
export async function checkNotetaker(env: IngestionEnv, p: CaptureParams): Promise<CaptureCheck> {
  const row = await getNotetaker(env, p.notetakerId, p.userId);
  if (['cancelled', 'failed', 'complete'].includes(row.status) || !row.external_id)
    return { next: 'stop' };
  const joinAt = Date.parse(row.join_at);
  if (row.status === 'scheduled' && joinAt - Date.now() > 3 * 60 * 1000)
    return { next: 'sleep', until: new Date(joinAt - 2 * 60 * 1000).toISOString() };
  const bot = await recallBot(env, row.external_id);
  const state = botState(bot);
  const values: Record<string, unknown> = {};
  // A stopped notetaker stays "processing" until the bot reports done.
  if (!(row.status === 'processing' && state.status === 'recording')) {
    if (state.status !== row.status) values.status = state.status;
    if (state.detail !== row.status_detail) values.status_detail = state.detail;
  }
  if (state.recordingStartedAt && !row.recording_started_at)
    values.recording_started_at = state.recordingStartedAt;
  if (state.status === 'failed') values.ended_at = new Date().toISOString();
  if (Object.keys(values).length) await updateNotetaker(env, row, values);
  if (state.status === 'failed') return { next: 'stop' };
  if (state.ready) return { next: 'import' };
  return { next: 'wait', delay: state.status === 'recording' ? 30 : 15 };
}

function doneRecording(bot: RecallBot) {
  const recordings = bot.recordings.filter(
    (recording) => recording.media_shortcuts?.video_mixed?.data?.download_url,
  );
  return recordings.sort(
    (a, b) =>
      Date.parse(b.completed_at ?? '') - Date.parse(b.started_at ?? '') -
      (Date.parse(a.completed_at ?? '') - Date.parse(a.started_at ?? '')),
  )[0];
}

/** Streams the bot's video into storage and creates the meeting (same id). */
export async function importRecording(env: IngestionEnv, p: CaptureParams) {
  const row = await getNotetaker(env, p.notetakerId, p.userId);
  const existing = rowSchema
    .array()
    .parse(await db(env, `meetings?id=eq.${row.id}&user_id=eq.${row.user_id}`));
  if (existing[0]?.media_uploaded_at) return true;
  const bot = await recallBot(env, row.external_id!);
  const recording = doneRecording(bot);
  const url = recording?.media_shortcuts?.video_mixed?.data?.download_url;
  if (!recording || !url) throw new Error('Recording not available yet');
  const media = await fetch(url);
  const size = Number(media.headers.get('Content-Length'));
  if (!media.ok || !media.body || !size) throw new Error('Recording download failed');
  if (size > MAX_RECORDING_BYTES) throw new Error('Recording too large');
  const key = `uploads/${row.id}`;
  const stored = await s3(env).fetch(objectUrl(env, `${key}/media`), {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) },
    body: media.body,
  });
  if (!stored.ok) throw new Error('Recording storage failed');
  const started = Date.parse(recording.started_at ?? row.recording_started_at ?? '');
  const ended = Date.parse(recording.completed_at ?? '');
  const duration = Math.min(
    MAX_RECORDING_SECONDS,
    Math.max(1, Number.isFinite(started) && Number.isFinite(ended) ? (ended - started) / 1000 : 1),
  );
  const values = {
    title: row.title,
    original_filename: `${row.title.replace(/[\\/]/g, '-').slice(0, 190)}.mp4`,
    media_type: 'video/mp4',
    storage_key: key,
    media_size: size,
    duration_seconds: duration,
    status: 'transcribing',
    processing_progress: 35,
    media_uploaded_at: new Date().toISOString(),
    source: 'notetaker',
    updated_at: new Date().toISOString(),
  };
  if (existing[0])
    await db(env, `meetings?id=eq.${row.id}&user_id=eq.${row.user_id}`, 'PATCH', values);
  else
    await db(env, 'meetings', 'POST', {
      id: row.id,
      user_id: row.user_id,
      ...values,
      created_at: row.join_at,
    });
  await updateNotetaker(env, row, {
    meeting_id: row.id,
    recording_started_at: recording.started_at ?? row.recording_started_at,
    ended_at: recording.completed_at ?? new Date().toISOString(),
    status: 'processing',
    status_detail: 'Transcribing',
  });
  return true;
}

export class TranscriptPending extends Error {}

/** Saves Recall's speaker-labelled transcript, with participants' names. */
export async function importTranscript(env: IngestionEnv, p: CaptureParams) {
  const row = await getNotetaker(env, p.notetakerId, p.userId);
  const meeting = await getRow(env, row.id, row.user_id);
  if (meeting.transcript) return true;
  const bot = await recallBot(env, row.external_id!);
  const recording = doneRecording(bot);
  const transcript = recording?.media_shortcuts?.transcript;
  const code = transcript?.status?.code;
  if (transcript && code !== 'done' && code !== 'failed')
    throw new TranscriptPending('Transcript still processing');
  const url = code === 'done' ? transcript?.data?.download_url : null;
  let segments: z.infer<typeof storedTranscriptSchema> = [];
  let speakerNames: Record<string, string> = {};
  if (url) {
    const download = await fetch(url);
    if (!download.ok) throw new Error('Transcript download failed');
    const converted = recallTranscriptToSegments(
      await download.json(),
      meeting.duration_seconds,
    );
    segments = storedTranscriptSchema.parse(converted.segments.slice(0, 5000));
    speakerNames = converted.speakerNames;
  }
  await db(env, `meetings?id=eq.${row.id}&user_id=eq.${row.user_id}`, 'PATCH', {
    transcript: segments,
    speaker_names: speakerNames,
    status: segments.length ? 'analyzing' : 'complete',
    processing_progress: segments.length ? 80 : 100,
    updated_at: new Date().toISOString(),
  });
  if (!segments.length)
    await updateNotetaker(env, row, {
      status: 'complete',
      status_detail: 'Recorded, but nobody was heard',
    });
  return true;
}

/** Turns mid-call highlights into saved moments on the finished meeting. */
export async function saveHighlights(
  env: IngestionEnv,
  row: NotetakerRow,
  duration: number,
) {
  const started = Date.parse(row.recording_started_at ?? '');
  if (!row.highlights.length || !Number.isFinite(started)) return;
  const existing = new Set(
    z
      .array(z.object({ id: z.string() }))
      .parse(await db(env, `meeting_moments?select=id&meeting_id=eq.${row.id}&limit=500`))
      .map((moment) => moment.id),
  );
  const moments = row.highlights
    .filter((highlight) => !existing.has(highlight.id))
    .map((highlight) => {
      const range = highlightRange((Date.parse(highlight.at) - started) / 1000, duration);
      return range
        ? {
            id: highlight.id,
            meeting_id: row.id,
            user_id: row.user_id,
            start_ms: range.startMs,
            end_ms: range.endMs,
            title: highlight.note || 'Highlight',
            note: 'Highlighted during the call',
          }
        : null;
    })
    .filter((moment) => moment !== null);
  if (moments.length) await db(env, 'meeting_moments', 'POST', moments, 'return=minimal');
}

export async function importHighlights(env: IngestionEnv, p: CaptureParams) {
  const row = await getNotetaker(env, p.notetakerId, p.userId);
  const meeting = await getRow(env, row.id, row.user_id);
  await saveHighlights(env, row, meeting.duration_seconds);
  return true;
}

export async function beginAnalysis(env: IngestionEnv, p: CaptureParams) {
  const row = await getNotetaker(env, p.notetakerId, p.userId);
  const meeting = await getRow(env, row.id, row.user_id);
  if (meeting.status === 'analyzing' && !meeting.processing_lease)
    await startProcessing(env, meeting, true);
  await updateNotetaker(env, row, {
    status: 'complete',
    status_detail: meeting.transcript?.length ? 'Writing notes' : row.status_detail,
  });
  return true;
}

export async function failCapture(env: IngestionEnv, p: CaptureParams, detail: string) {
  const row = await getNotetaker(env, p.notetakerId, p.userId).catch(() => null);
  if (row && !['complete', 'cancelled'].includes(row.status))
    await updateNotetaker(env, row, {
      status: 'failed',
      status_detail: detail.slice(0, 200),
      ended_at: row.ended_at ?? new Date().toISOString(),
    });
  return true;
}

// ------------------------------------------------------------------- API

const partSchema = z
  .object({
    index: z.number().int().nonnegative().max(MAX_PARTS - 1),
    start: z.number().nonnegative().max(MAX_RECORDING_SECONDS),
    duration: z.number().positive().max(300),
    size: z.number().int().positive().max(25 * 1024 * 1024),
  })
  .strict();
const finishSchema = z
  .object({
    size: z.number().int().positive().max(MAX_RECORDING_BYTES),
    duration: z.number().positive().max(MAX_RECORDING_SECONDS),
    contentType: z.enum(['audio/webm', 'video/webm']),
  })
  .strict();

async function signedPut(env: IngestionEnv, key: string, contentType: string) {
  const signed = await s3(env).sign(`${objectUrl(env, key)}?X-Amz-Expires=900`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

/** /api/notetakers and /api/capabilities for the signed-in user; null for other routes. */
export async function notetakerApi(request: Request, env: IngestionEnv, userId: string) {
  const url = new URL(request.url);
  if (url.pathname === '/api/capabilities' && request.method === 'GET')
    return json({
      bot: botEnabled(env),
      calendar: Boolean(
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.TOKEN_ENCRYPTION_KEY,
      ),
    });
  if (url.pathname === '/api/notetakers') {
    if (request.method === 'GET') {
      const filter =
        url.searchParams.get('active') === '1'
          ? `&status=in.(${activeNotetakerStatuses.join(',')})&order=join_at.asc`
          : '&order=join_at.desc';
      const rows = notetakerRowSchema
        .array()
        .parse(await db(env, `notetakers?user_id=eq.${userId}${filter}&limit=50`));
      return json(rows.map(notetakerOutput));
    }
    if (request.method === 'POST') {
      const input = createNotetakerSchema.parse(await readBody(request));
      return json(notetakerOutput(await createNotetaker(env, userId, input)), 201);
    }
    throw new ApiError(405, 'Method not allowed.');
  }
  const match = /^\/api\/notetakers\/([0-9a-f-]{36})(?:\/(highlights|start|parts|finish))?$/.exec(
    url.pathname,
  );
  if (!match) return null;
  if (!isUuid(match[1])) throw new ApiError(404, 'This notetaker could not be found.');
  const row = await getNotetaker(env, match[1], userId);
  const action = match[2];
  if (!action && request.method === 'GET') return json(notetakerOutput(row));
  if (!action && request.method === 'DELETE')
    return json(notetakerOutput(await cancelNotetaker(env, row)));

  if (action === 'highlights' && request.method === 'POST') {
    if (row.status !== 'recording' || !row.recording_started_at)
      throw new ApiError(409, 'Highlights can be added while the call is recording.');
    if (row.highlights.length >= MAX_HIGHLIGHTS)
      throw new ApiError(429, 'This call has reached its highlight limit.');
    const input = createHighlightSchema.parse(await readBody(request));
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      note: input.note,
    };
    // Guarded by the current count so two quick clicks can't drop one.
    const saved = await updateNotetaker(
      env,
      row,
      { highlights: [...row.highlights, highlight] },
      `&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
    );
    if (!saved) throw new ApiError(409, 'Another highlight was just added. Try again.');
    return json(notetakerOutput(saved), 201);
  }

  if (row.provider !== 'browser' && action)
    throw new ApiError(405, 'Method not allowed.');
  if (action === 'start' && request.method === 'POST') {
    if (row.status === 'recording') return json(notetakerOutput(row));
    if (row.status !== 'scheduled')
      throw new ApiError(409, 'This recording has already finished.');
    const saved = await updateNotetaker(env, row, {
      status: 'recording',
      status_detail: 'Recording from this browser',
      recording_started_at: new Date().toISOString(),
    });
    return json(notetakerOutput(saved ?? row));
  }
  if (action === 'parts' && request.method === 'POST') {
    if (row.status !== 'recording')
      throw new ApiError(409, 'This recording is not in progress.');
    const input = partSchema.parse(await readBody(request));
    const key = `captures/${row.id}/part-${input.index}`;
    const parts = [
      ...row.parts.filter((part) => part.index !== input.index),
      { ...input, key },
    ].sort((a, b) => a.index - b.index);
    await updateNotetaker(env, row, { parts });
    return json({ url: await signedPut(env, key, 'audio/webm') });
  }
  if (action === 'finish' && request.method === 'POST') {
    const input = finishSchema.parse(await readBody(request));
    if (row.meeting_id) {
      const meeting = await getRow(env, row.meeting_id, userId);
      if (meeting.media_uploaded_at)
        throw new ApiError(409, 'This recording has already been saved.');
      return json({
        meetingId: meeting.id,
        uploadUrl: await signedPut(env, stagingKey(meeting, 'media'), meeting.media_type),
      });
    }
    if (row.status !== 'recording')
      throw new ApiError(409, 'This recording is not in progress.');
    const now = new Date().toISOString();
    const meeting = rowSchema.array().parse(
      await db(env, 'meetings', 'POST', {
        id: row.id,
        user_id: userId,
        title: row.title,
        original_filename: `${row.title.replace(/[\\/]/g, '-').slice(0, 190)}.webm`,
        media_type: input.contentType,
        storage_key: `uploads/${row.id}`,
        media_size: input.size,
        duration_seconds: input.duration,
        status: 'uploading',
        source: 'browser',
        audio_parts: row.parts,
        created_at: row.recording_started_at ?? now,
        updated_at: now,
      }),
    )[0];
    await saveHighlights(env, row, input.duration);
    await updateNotetaker(env, row, {
      meeting_id: row.id,
      status: 'complete',
      status_detail: 'Uploading the recording',
      ended_at: now,
    });
    return json(
      {
        meetingId: meeting.id,
        uploadUrl: await signedPut(env, stagingKey(meeting, 'media'), input.contentType),
      },
      201,
    );
  }
  throw new ApiError(405, 'Method not allowed.');
}
