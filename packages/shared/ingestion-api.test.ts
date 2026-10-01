import { afterEach, describe, expect, it, vi } from 'vitest';
import { ingestionApi } from '../../apps/worker/src/ingestion';
import { verifiedUserHeader } from '../../apps/worker/src/database';
import {
  apiRequest,
  createBackend,
  meetingRow,
  userA,
  userB,
} from '../../tests/support/backend';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mineId = '11111111-1111-4111-8111-111111111111';
const theirsId = '22222222-2222-4222-8222-222222222222';

function setup(options: Parameters<typeof createBackend>[0] = {}) {
  const backend = createBackend({
    meetings: [
      meetingRow({ id: mineId }),
      meetingRow({ id: theirsId, user_id: userB.id, title: 'Not yours' }),
    ],
    ...options,
  });
  vi.stubGlobal('fetch', backend.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return backend;
}
/** The auth layer has already verified the session and set this header. */
function as(
  user: { id: string } | null,
  path: string,
  init: Parameters<typeof apiRequest>[1] = {},
) {
  return apiRequest(path, {
    ...init,
    headers: { ...init.headers, ...(user ? { [verifiedUserHeader]: user.id } : {}) },
  });
}

describe('uploads API ownership', () => {
  it('requires a signed-in user', async () => {
    const backend = setup();
    const response = await ingestionApi(as(null, '/api/uploads'), backend.env);
    expect(response.status).toBe(401);
    expect(backend.log).toEqual([]);
  });

  it('lists only the signed-in user’s meetings, without transcript bodies', async () => {
    const backend = setup();
    const response = await ingestionApi(as(userA, '/api/uploads'), backend.env);
    const list = (await response.json()) as { id: string; transcript: unknown }[];
    expect(list.map((item) => item.id)).toEqual([mineId]);
    expect(list[0].transcript).toBeNull();
    expect(backend.log[0].url).toContain(`user_id=eq.${userA.id}`);
  });

  it('treats another user’s meeting as missing for every action', async () => {
    const backend = setup();
    for (const [method, suffix] of [
      ['GET', ''],
      ['DELETE', ''],
      ['POST', '/process'],
      ['GET', '/media'],
      ['POST', '/share'],
      ['PATCH', '/speakers'],
    ]) {
      const response = await ingestionApi(
        as(userA, `/api/uploads/${theirsId}${suffix}`, {
          method,
          body: { speakerId: 'speaker', name: 'Eve' },
        }),
        backend.env,
      );
      expect(response.status, `${method} ${suffix}`).toBe(404);
    }
    expect(backend.tables.meetings).toHaveLength(2);
    expect(backend.env.PROCESS_MEETING.create).not.toHaveBeenCalled();
    expect(backend.tables.meeting_shares).toEqual([]);
  });

  it('does not expose provider errors or credentials when storage fails', async () => {
    const backend = setup();
    backend.state.failTable = 'meetings';
    const response = await ingestionApi(as(userA, '/api/uploads'), backend.env);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain('boom');
    expect(text).not.toContain(backend.env.SUPABASE_SERVICE_ROLE_KEY);
  });
});

describe('creating uploads', () => {
  const input = {
    title: 'Customer call',
    filename: 'call.webm',
    contentType: 'video/webm',
    size: 1024,
    duration: 90,
  };

  it('reserves the upload for the signed-in user', async () => {
    const backend = setup();
    const response = await ingestionApi(
      as(userA, '/api/uploads', { method: 'POST', body: input }),
      backend.env,
    );
    expect(response.status).toBe(201);
    const created = (await response.json()) as Record<string, unknown>;
    expect(created).toMatchObject({ title: 'Customer call', status: 'uploading' });
    expect(created).not.toHaveProperty('storage_key');
    expect(created).not.toHaveProperty('user_id');
    expect(backend.log[0].body).toMatchObject({ p_user: userA.id });
  });

  it.each([
    ['daily_upload_limit', /today’s upload limit/],
    ['too_many_in_progress', /still processing/],
  ])('maps the %s allowance to a 429', async (error, message) => {
    const backend = setup();
    backend.state.reserveError = error;
    const response = await ingestionApi(
      as(userA, '/api/uploads', { method: 'POST', body: input }),
      backend.env,
    );
    expect(response.status).toBe(429);
    expect((await response.json()).message).toMatch(message);
  });

  it('rejects recordings over the size or duration limit', async () => {
    const backend = setup();
    for (const change of [{ size: 30 * 1024 * 1024 }, { duration: 601 }]) {
      const response = await ingestionApi(
        as(userA, '/api/uploads', { method: 'POST', body: { ...input, ...change } }),
        backend.env,
      );
      expect(response.status).toBe(400);
    }
    expect(backend.log).toEqual([]);
  });

  it('signs uploads into staging, and audio only for long recordings', async () => {
    const shortId = '33333333-3333-4333-8333-333333333333';
    const longId = '44444444-4444-4444-8444-444444444444';
    const backend = setup({
      meetings: [
        meetingRow({ id: mineId }),
        meetingRow({
          id: shortId,
          status: 'uploading',
          processing_progress: 0,
          media_uploaded_at: null,
          transcript: null,
        }),
        meetingRow({
          id: longId,
          status: 'uploading',
          duration_seconds: 300,
          processing_progress: 0,
          media_uploaded_at: null,
          transcript: null,
        }),
      ],
    });
    const media = await ingestionApi(
      as(userA, `/api/uploads/${shortId}/upload-url`, { method: 'POST' }),
      backend.env,
    );
    const { url } = (await media.json()) as { url: string };
    expect(new URL(url).pathname).toBe(`/bucket/staging/${shortId}/media`);
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('300');

    const shortAudio = await ingestionApi(
      as(userA, `/api/uploads/${shortId}/upload-url?audio=1`, { method: 'POST' }),
      backend.env,
    );
    expect(shortAudio.status).toBe(409);
    const longAudio = await ingestionApi(
      as(userA, `/api/uploads/${longId}/upload-url?audio=1`, { method: 'POST' }),
      backend.env,
    );
    expect(new URL(((await longAudio.json()) as { url: string }).url).pathname).toBe(
      `/bucket/staging/${longId}/audio`,
    );

    const done = await ingestionApi(
      as(userA, `/api/uploads/${mineId}/upload-url`, { method: 'POST' }),
      backend.env,
    );
    expect(done.status).toBe(409);
  });
});

describe('deleting meetings', () => {
  it('removes stored media and staging objects before the row', async () => {
    const backend = setup({
      objects: {
        [`uploads/${mineId}/media`]: { body: new Uint8Array(4), type: 'video/webm' },
        [`staging/${mineId}/audio`]: { body: new Uint8Array(4), type: 'audio/wav' },
      },
      shares: [{ meeting_id: mineId, token: 'c'.repeat(64), enabled: true }],
    });
    const response = await ingestionApi(
      as(userA, `/api/uploads/${mineId}`, { method: 'DELETE' }),
      backend.env,
    );
    expect(await response.json()).toEqual({ deleted: true });
    const order = backend.log
      .filter((call) => call.method === 'DELETE')
      .map((call) => new URL(call.url).pathname);
    expect(order.slice(0, 4).sort()).toEqual(
      [
        `/bucket/staging/${mineId}/audio`,
        `/bucket/staging/${mineId}/media`,
        `/bucket/uploads/${mineId}/audio-media`,
        `/bucket/uploads/${mineId}/media`,
      ].sort(),
    );
    expect(order[4]).toBe('/rest/v1/meetings');
    expect(backend.objects.size).toBe(0);
    expect(backend.tables.meetings.map((row) => row.id)).toEqual([theirsId]);
    expect(backend.tables.meeting_shares).toEqual([]);
  });

  it('keeps the meeting when storage cleanup fails', async () => {
    const backend = setup();
    backend.state.failObjectDeletes = true;
    const response = await ingestionApi(
      as(userA, `/api/uploads/${mineId}`, { method: 'DELETE' }),
      backend.env,
    );
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toMatch(/Nothing else was deleted/);
    expect(text).not.toContain('uploads/');
    expect(backend.tables.meetings).toHaveLength(2);
  });
});

describe('speaker names and playback', () => {
  it('renames a transcript speaker for the owner only', async () => {
    const backend = setup();
    const response = await ingestionApi(
      as(userA, `/api/uploads/${mineId}/speakers`, {
        method: 'PATCH',
        body: { speakerId: 'speaker', name: 'Jordan' },
      }),
      backend.env,
    );
    expect((await response.json()).speaker_names).toEqual({ speaker: 'Jordan' });
    const unknown = await ingestionApi(
      as(userA, `/api/uploads/${mineId}/speakers`, {
        method: 'PATCH',
        body: { speakerId: 'nobody', name: 'Jordan' },
      }),
      backend.env,
    );
    expect(unknown.status).toBe(404);
  });

  it('streams byte ranges of the stored recording', async () => {
    const backend = setup({
      objects: {
        [`uploads/${mineId}/media`]: {
          body: new Uint8Array([1, 2, 3, 4, 5, 6]),
          type: 'video/webm',
        },
      },
    });
    const response = await ingestionApi(
      as(userA, `/api/uploads/${mineId}/media`, { headers: { Range: 'bytes=2-3' } }),
      backend.env,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 2-3/6');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([3, 4]);
  });
});

describe('starting processing', () => {
  const pendingId = '55555555-5555-4555-8555-555555555555';
  const pending = (overrides: Record<string, unknown> = {}) =>
    meetingRow({
      id: pendingId,
      status: 'uploading',
      processing_progress: 0,
      processing_attempts: 0,
      media_uploaded_at: null,
      transcript: null,
      ...overrides,
    });
  const start = (backend: ReturnType<typeof setup>) =>
    ingestionApi(
      as(userA, `/api/uploads/${pendingId}/process`, { method: 'POST' }),
      backend.env,
    );

  it('claims the meeting with a lease and starts one workflow run', async () => {
    const backend = setup({ meetings: [pending()] });
    const response = await start(backend);
    expect(response.status).toBe(202);
    expect((await response.json()).status).toBe('transcribing');
    const row = backend.tables.meetings[0];
    expect(row).toMatchObject({ processing_attempts: 1, processing_progress: 35 });
    expect(row.processing_lease).toMatch(/^[0-9a-f-]{36}$/);
    expect(backend.env.PROCESS_MEETING.create).toHaveBeenCalledWith({
      id: `${pendingId}-1`,
      params: { meetingId: pendingId, userId: userA.id, lease: row.processing_lease },
    });
  });

  it('resumes analysis without re-transcribing a saved transcript', async () => {
    const backend = setup({
      meetings: [
        pending({
          status: 'failed',
          processing_error: 'analysis_failed',
          processing_progress: 80,
          processing_attempts: 2,
          transcript: [],
        }),
      ],
    });
    await start(backend);
    expect(backend.tables.meetings[0]).toMatchObject({
      status: 'analyzing',
      processing_progress: 80,
      processing_error: null,
      processing_attempts: 3,
    });
  });

  it('leaves a recently active run alone', async () => {
    const backend = setup({
      meetings: [pending({ status: 'transcribing', updated_at: new Date().toISOString() })],
    });
    expect((await start(backend)).status).toBe(202);
    expect(backend.env.PROCESS_MEETING.create).not.toHaveBeenCalled();
  });

  it('restarts a run that has been silent for too long', async () => {
    const backend = setup({
      meetings: [
        pending({
          status: 'transcribing',
          processing_attempts: 1,
          processing_lease: crypto.randomUUID(),
          updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        }),
      ],
    });
    expect((await start(backend)).status).toBe(202);
    expect(backend.env.PROCESS_MEETING.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: `${pendingId}-2` }),
    );
  });

  it('stops after the retry limit', async () => {
    const backend = setup({
      meetings: [pending({ status: 'failed', processing_error: 'transcription_failed', processing_attempts: 6 })],
    });
    expect((await start(backend)).status).toBe(429);
    expect(backend.env.PROCESS_MEETING.create).not.toHaveBeenCalled();
  });

  it('does not start a completed meeting again', async () => {
    const backend = setup();
    const response = await ingestionApi(
      as(userA, `/api/uploads/${mineId}/process`, { method: 'POST' }),
      backend.env,
    );
    expect(response.status).toBe(200);
    expect(backend.env.PROCESS_MEETING.create).not.toHaveBeenCalled();
  });

  it('marks the meeting retryable when the workflow cannot start', async () => {
    const backend = setup({ meetings: [pending()] });
    backend.env.PROCESS_MEETING.create.mockRejectedValueOnce(new Error('down'));
    const response = await start(backend);
    expect(response.status).toBe(503);
    expect(backend.tables.meetings[0]).toMatchObject({
      status: 'failed',
      processing_error: 'processing_timeout',
      processing_lease: null,
    });
  });
});
