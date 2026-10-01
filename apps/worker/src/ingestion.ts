import { ApiError, db, isUuid, json, requireUser } from './database';
import { libraryApi, publicMomentApi } from './library';
import { LONG_RECORDING_SECONDS, type ProcessParams } from './processing';
import { notetakerApi, type CaptureParams } from './capture';
import { calendarApi } from './calendar';
import { AwsClient } from 'aws4fetch';
import { z } from 'zod';
import {
  createUploadSchema,
  deleteMeetingResultSchema,
  uploadedMeetingSchema,
} from '../../../packages/shared/ingestion';
import {
  privateShareTokenSchema,
  sharedMeetingSchema,
} from '../../../packages/shared/sharing';
import { transcriptSpeakers } from '../../../packages/shared/notetaker';

export type IngestionEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  AI: { run(model: string, input: unknown): Promise<unknown> };
  PROCESS_MEETING: {
    create(options: { id: string; params: ProcessParams }): Promise<unknown>;
  };
  /** Follows a notetaker through its call; see capture.ts. */
  CAPTURE_MEETING?: {
    create(options: { id: string; params: CaptureParams }): Promise<unknown>;
  };
  RECALL_API_KEY?: string;
  /** Recall.ai region host prefix, e.g. us-west-2 (default) or eu-central-1. */
  RECALL_REGION?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** 32 random bytes, base64. Encrypts stored calendar tokens. */
  TOKEN_ENCRYPTION_KEY?: string;
};
/** Browser captures: short standalone audio files, transcribed one by one. */
export const audioPartsSchema = z
  .array(
    z.object({
      index: z.number().int().nonnegative(),
      key: z.string().regex(/^captures\/[0-9a-f-]{36}\/part-\d+$/),
      start: z.number().nonnegative(),
      duration: z.number().positive().max(300),
      size: z.number().int().positive(),
    }),
  )
  .max(1000);
export const rowSchema = uploadedMeetingSchema.extend({
  user_id: z.string().uuid(),
  storage_key: z.string(),
  media_size: z.number(),
  processing_lease: z.string().nullable(),
  processing_started_at: z.string().nullable(),
  processing_attempts: z.number(),
  media_uploaded_at: z.string().nullable(),
  updated_at: z.string(),
  audio_parts: audioPartsSchema.nullable().default(null),
  transcribed_parts: z.number().int().nonnegative().default(0),
});
export type Row = z.infer<typeof rowSchema>;
export type AudioPart = z.infer<typeof audioPartsSchema>[number];
const shareRowSchema = z.object({
  meeting_id: z.string().uuid(),
  token: privateShareTokenSchema,
  enabled: z.boolean(),
});
const renameSpeakerSchema = z.object({
  speakerId: z.string().min(1).max(80),
  name: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine(
      (name) => [...name].every((character) => character.charCodeAt(0) >= 32),
      'Use a plain speaker name',
    ),
});
export function s3(env: IngestionEnv) {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 1,
  });
}
/**
 * Browser uploads land under staging/ and are copied to the meeting's key once
 * verified. A bucket lifecycle rule expires anything left in staging/.
 */
export function stagingKey(row: { id: string }, kind: 'media' | 'audio') {
  return `staging/${row.id}/${kind}`;
}
export function objectUrl(env: IngestionEnv, key: string) {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;
}
async function deleteStoredMedia(env: IngestionEnv, row: Row) {
  try {
    const keys = [
      `${row.storage_key}/media`,
      `${row.storage_key}/audio-media`,
      stagingKey(row, 'media'),
      stagingKey(row, 'audio'),
      ...(row.audio_parts ?? []).map((part) => part.key),
    ];
    const responses = await Promise.all(
      keys.map((key) =>
        s3(env).fetch(objectUrl(env, key), { method: 'DELETE' }),
      ),
    );
    if (responses.some((response) => !response.ok)) {
      console.error(
        'R2 meeting cleanup failed',
        responses.map((response) => response.status),
      );
      throw new ApiError(
        503,
        'The stored recording could not be removed. Nothing else was deleted; please retry.',
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('R2 meeting cleanup request failed');
    throw new ApiError(
      503,
      'The stored recording could not be removed. Nothing else was deleted; please retry.',
    );
  }
}

/** Removes every stored recording before an account is deleted. */
export async function deleteAllUserMedia(env: IngestionEnv, userId: string) {
  const rows = rowSchema
    .array()
    .parse(await db(env, `meetings?user_id=eq.${userId}&limit=10000`));
  for (let index = 0; index < rows.length; index += 10)
    await Promise.all(
      rows.slice(index, index + 10).map((row) => deleteStoredMedia(env, row)),
    );
}

export async function getRow(env: IngestionEnv, id: string, userId: string) {
  const rows = rowSchema
    .array()
    .parse(await db(env, `meetings?id=eq.${id}&user_id=eq.${userId}`));
  if (!rows[0]) throw new ApiError(404, 'This recording could not be found.');
  return rows[0];
}
export async function update(
  env: IngestionEnv,
  row: Row,
  values: Record<string, unknown>,
  filter = '',
) {
  return rowSchema
    .array()
    .parse(
      await db(
        env,
        `meetings?id=eq.${row.id}&user_id=eq.${row.user_id}${filter}`,
        'PATCH',
        { ...values, updated_at: new Date().toISOString() },
      ),
    );
}
export function publicRow(row: Row) {
  return uploadedMeetingSchema.parse(row);
}

export function newShareToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function findShare(env: IngestionEnv, filter: string) {
  const shares = shareRowSchema
    .array()
    .parse(await db(env, `meeting_shares?${filter}&limit=1`));
  return shares[0] ?? null;
}

async function sharedRow(env: IngestionEnv, token: string) {
  const share = await findShare(env, `token=eq.${token}&enabled=eq.true`);
  if (!share) throw new ApiError(404, 'This shared meeting is unavailable.');
  const rows = rowSchema
    .array()
    .parse(await db(env, `meetings?id=eq.${share.meeting_id}`));
  const row = rows[0];
  if (!row || row.status !== 'complete' || !row.media_uploaded_at)
    throw new ApiError(404, 'This shared meeting is unavailable.');
  return row;
}

export async function mediaResponse(
  request: Request,
  env: IngestionEnv,
  row: Row,
) {
  if (!row.media_uploaded_at)
    throw new ApiError(404, 'Recording upload has not finished.');
  const range = request.headers.get('Range');
  const media = await s3(env).fetch(
    objectUrl(env, `${row.storage_key}/media`),
    {
      method: request.method,
      headers: range ? { Range: range } : {},
    },
  );
  if (!media.ok && media.status !== 416)
    throw new ApiError(503, 'Recording temporarily unavailable.');
  const headers = new Headers({
    'Content-Type': row.media_type,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Referrer-Policy': 'no-referrer',
  });
  for (const name of ['Content-Length', 'Content-Range']) {
    const value = media.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(media.body, { status: media.status, headers });
}

const MAX_PROCESSING_ATTEMPTS = 6;
// A run that has not written progress for this long is treated as stuck.
const STALE_PROCESSING_MS = 20 * 60 * 1000;

/** Claims the meeting for a new run and hands it to the durable workflow. */
export async function startProcessing(
  env: IngestionEnv,
  original: Row,
  /** The caller knows no run holds this meeting (a notetaker handing over). */
  handover = false,
) {
  if (original.status === 'complete') return json(publicRow(original));
  if (!handover && ['transcribing', 'analyzing'].includes(original.status)) {
    const idle = Date.now() - Date.parse(original.updated_at);
    if (Number.isFinite(idle) && idle < STALE_PROCESSING_MS)
      return json(publicRow(original), 202);
  }
  if (original.processing_attempts >= MAX_PROCESSING_ATTEMPTS)
    throw new ApiError(
      429,
      'This recording has reached the processing retry limit. Your saved transcript remains available.',
    );
  const lease = crypto.randomUUID();
  const claimed = await update(
    env,
    original,
    {
      status: original.processing_progress < 80 ? 'transcribing' : 'analyzing',
      processing_progress:
        original.processing_progress < 80
          ? Math.max(35, original.processing_progress)
          : 80,
      processing_lease: lease,
      processing_started_at: new Date().toISOString(),
      processing_error: null,
      processing_attempts: original.processing_attempts + 1,
    },
    `&processing_attempts=eq.${original.processing_attempts}`,
  );
  if (!claimed[0])
    throw new ApiError(409, 'This recording is already processing.');
  try {
    await env.PROCESS_MEETING.create({
      id: `${original.id}-${claimed[0].processing_attempts}`,
      params: { meetingId: original.id, userId: original.user_id, lease },
    });
  } catch (error) {
    console.error('Could not start processing', error);
    const failed = await update(
      env,
      claimed[0],
      {
        status: 'failed',
        processing_error: 'processing_timeout',
        processing_lease: null,
      },
      `&processing_lease=eq.${lease}`,
    );
    return json(publicRow(failed[0] ?? claimed[0]), 503);
  }
  return json(publicRow(claimed[0]), 202);
}

export async function ingestionApi(request: Request, env: IngestionEnv) {
  try {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (request.headers.get('Origin') !== url.origin)
        throw new ApiError(
          403,
          'Please use the Fathom Clone application to make changes.',
        );
      if (!request.headers.get('Content-Type')?.startsWith('application/json'))
        throw new ApiError(415, 'Expected a JSON request.');
      if (Number(request.headers.get('Content-Length')) > 4096)
        throw new ApiError(413, 'Request too large.');
    }
    const momentResponse = await publicMomentApi(request, env);
    if (momentResponse) return momentResponse;
    const publicShare = /^\/api\/shares\/([a-f0-9]{64})(?:\/(media))?$/.exec(
      url.pathname,
    );
    if (publicShare && ['GET', 'HEAD'].includes(request.method)) {
      if (!env.SUPABASE_URL || !env.R2_ACCESS_KEY_ID)
        throw new ApiError(503, 'Shared meetings are temporarily unavailable.');
      const row = await sharedRow(env, publicShare[1]);
      if (publicShare[2] === 'media')
        return await mediaResponse(request, env, row);
      if (request.method === 'HEAD')
        throw new ApiError(405, 'Method not allowed.');
      return json(
        sharedMeetingSchema.parse({
          title: row.title,
          description:
            row.intelligence?.templates.find((view) => view.key === 'general')
              ?.overview ??
            'Full recording and transcript shared by its owner.',
          duration: row.duration_seconds,
          mediaUrl: `/api/shares/${publicShare[1]}/media`,
          mediaType: row.media_type,
          speakers: transcriptSpeakers(row.transcript, row.speaker_names),
          segments: row.transcript ?? [],
          intelligence: row.intelligence,
        }),
        200,
        { 'Referrer-Policy': 'no-referrer' },
      );
    }
    const userId = requireUser(request);
    if (!env.SUPABASE_URL || !env.R2_ACCESS_KEY_ID || !env.AI)
      throw new ApiError(
        503,
        'Uploads are temporarily unavailable. Please retry shortly.',
      );
    const libraryResponse =
      (await libraryApi(request, env, userId)) ??
      (await notetakerApi(request, env, userId)) ??
      (await calendarApi(request, env, userId));
    if (libraryResponse) return libraryResponse;
    if (url.pathname === '/api/uploads') {
      if (request.method === 'GET') {
        const rows = rowSchema
          .array()
          .parse(
            await db(
              env,
              `meetings?user_id=eq.${userId}&order=created_at.desc&limit=500`,
            ),
          );
        return json(
          rows.map((row) => ({
            ...publicRow(row),
            transcript: null,
            intelligence: null,
          })),
        );
      }
      if (request.method === 'POST') {
        const body = await request.text();
        if (body.length > 4096) throw new ApiError(413, 'Request too large.');
        const input = createUploadSchema.parse(JSON.parse(body));
        const rows = rowSchema.array().parse(
          await db(env, 'rpc/reserve_upload', 'POST', {
            p_user: userId,
            p_title: input.title,
            p_filename: input.filename,
            p_type: input.contentType,
            p_size: input.size,
            p_duration: input.duration,
          }),
        );
        return json(publicRow(rows[0]), 201);
      }
    }
    const match =
      /^\/api\/uploads\/([a-f0-9-]{36})(?:\/(upload-url|process|media|share|speakers))?$/.exec(
        url.pathname,
      );
    if (!match || !isUuid(match[1]))
      throw new ApiError(404, 'Recording not found.');
    const row = await getRow(env, match[1], userId);
    if (!match[2] && request.method === 'GET') return json(publicRow(row));
    if (!match[2] && request.method === 'DELETE') {
      await deleteStoredMedia(env, row);
      const deleted = rowSchema
        .array()
        .parse(
          await db(
            env,
            `meetings?id=eq.${row.id}&user_id=eq.${row.user_id}`,
            'DELETE',
          ),
        );
      if (!deleted[0])
        throw new ApiError(409, 'This meeting could not be deleted. Retry.');
      return json(deleteMeetingResultSchema.parse({ deleted: true }));
    }
    if (match[2] === 'speakers' && request.method === 'PATCH') {
      if (row.transcript === null)
        throw new ApiError(
          409,
          'Wait for the transcript before naming its speaker.',
        );
      const body = await request.text();
      if (body.length > 4096) throw new ApiError(413, 'Request too large.');
      const input = renameSpeakerSchema.parse(JSON.parse(body));
      if (
        !row.transcript.some((segment) => segment.speakerId === input.speakerId)
      )
        throw new ApiError(404, 'Speaker not found in this transcript.');
      const saved = await update(env, row, {
        speaker_names: { ...row.speaker_names, [input.speakerId]: input.name },
      });
      if (!saved[0])
        throw new ApiError(409, 'The speaker name could not be saved. Retry.');
      return json(publicRow(saved[0]));
    }
    if (match[2] === 'share') {
      const existing = await findShare(env, `meeting_id=eq.${row.id}`);
      if (request.method === 'GET')
        return json({
          path: existing?.enabled ? `/share/meeting-${existing.token}` : null,
        });
      if (request.method === 'POST') {
        if (row.status !== 'complete' || !row.media_uploaded_at)
          throw new ApiError(
            409,
            'Finish processing before sharing this meeting.',
          );
        if (existing?.enabled)
          return json({ path: `/share/meeting-${existing.token}` });
        const token = newShareToken();
        const method = existing ? 'PATCH' : 'POST';
        const path = existing
          ? `meeting_shares?meeting_id=eq.${row.id}`
          : 'meeting_shares';
        const saved = shareRowSchema.array().parse(
          await db(env, path, method, {
            ...(existing ? {} : { meeting_id: row.id }),
            token,
            enabled: true,
          }),
        );
        if (!saved[0])
          throw new ApiError(503, 'Could not create a share link.');
        return json({ path: `/share/meeting-${token}` }, 201);
      }
      if (request.method === 'DELETE') {
        if (existing?.enabled)
          await db(
            env,
            `meeting_shares?meeting_id=eq.${row.id}`,
            'PATCH',
            { enabled: false },
          );
        return json({ path: null });
      }
    }
    if (match[2] === 'upload-url' && request.method === 'POST') {
      if (url.searchParams.get('audio') === '1') {
        if (
          row.duration_seconds <= LONG_RECORDING_SECONDS ||
          row.processing_progress >= 80 ||
          row.status === 'complete'
        )
          throw new ApiError(
            409,
            'Transcription audio is not needed for this recording.',
          );
        const signed = await s3(env).sign(
          `${objectUrl(env, stagingKey(row, 'audio'))}?X-Amz-Expires=300`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'audio/wav' },
            aws: { signQuery: true, allHeaders: true },
          },
        );
        return json({ url: signed.url });
      }
      if (
        row.media_uploaded_at ||
        !['uploading', 'failed'].includes(row.status)
      )
        throw new ApiError(409, 'This recording has already been uploaded.');
      const signed = await s3(env).sign(
        `${objectUrl(env, stagingKey(row, 'media'))}?X-Amz-Expires=300`,
        {
          method: 'PUT',
          headers: { 'Content-Type': row.media_type },
          aws: { signQuery: true, allHeaders: true },
        },
      );
      return json({ url: signed.url });
    }
    if (match[2] === 'process' && request.method === 'POST')
      return await startProcessing(env, row);
    if (match[2] === 'media' && ['GET', 'HEAD'].includes(request.method))
      return await mediaResponse(request, env, row);
    throw new ApiError(405, 'Method not allowed.');
  } catch (error) {
    if (error instanceof ApiError)
      return json({ message: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json(
        {
          message:
            'The recording details are invalid. Check the file type, size, and duration.',
        },
        400,
      );
    return json(
      { message: 'This request could not finish. Please try again.' },
      503,
    );
  }
}
