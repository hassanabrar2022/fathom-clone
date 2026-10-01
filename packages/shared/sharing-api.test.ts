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
const momentId = '33333333-3333-4333-8333-333333333333';
const media = {
  [`uploads/${mineId}/media`]: {
    body: new Uint8Array([1, 2, 3, 4]),
    type: 'video/webm',
  },
};

function setup(options: Parameters<typeof createBackend>[0] = {}) {
  const backend = createBackend({
    meetings: [
      meetingRow({ id: mineId, speaker_names: { speaker: 'Jordan' } }),
      meetingRow({
        id: theirsId,
        user_id: userB.id,
        title: 'Private planning',
        transcript: [
          {
            id: 'segment-1',
            speakerId: 'speaker',
            start: 0,
            end: 5,
            paragraphs: ['We will send the revised proposal by Friday.'],
          },
        ],
      }),
    ],
    objects: media,
    ...options,
  });
  vi.stubGlobal('fetch', backend.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  return backend;
}
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
const call = async (backend: ReturnType<typeof setup>, request: Request) => {
  const response = await ingestionApi(request, backend.env);
  return { status: response.status, body: await response.json().catch(() => null) };
};

describe('full meeting links', () => {
  it('publishes only when the owner asks, and revoking stops data and playback', async () => {
    const backend = setup();
    expect(await call(backend, as(userA, `/api/uploads/${mineId}/share`))).toEqual({
      status: 200,
      body: { path: null },
    });
    const created = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/share`, { method: 'POST' }),
    );
    expect(created.status).toBe(201);
    const token = /meeting-([a-f0-9]{64})$/.exec(created.body.path)![1];
    const again = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/share`, { method: 'POST' }),
    );
    expect(again.body.path).toBe(created.body.path);

    const shared = await call(backend, as(null, `/api/shares/${token}`));
    expect(shared.body).toMatchObject({
      title: 'Weekly sync',
      mediaUrl: `/api/shares/${token}/media`,
      speakers: [{ id: 'speaker', name: 'Jordan' }],
    });
    expect(JSON.stringify(shared.body)).not.toMatch(/user_id|storage_key|uploads\//);
    const playback = await ingestionApi(
      as(null, `/api/shares/${token}/media`, { headers: { Range: 'bytes=0-1' } }),
      backend.env,
    );
    expect(playback.status).toBe(206);

    await call(backend, as(userA, `/api/uploads/${mineId}/share`, { method: 'DELETE' }));
    expect((await call(backend, as(null, `/api/shares/${token}`))).status).toBe(404);
    expect(
      (await ingestionApi(as(null, `/api/shares/${token}/media`), backend.env)).status,
    ).toBe(404);

    const renewed = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/share`, { method: 'POST' }),
    );
    expect(renewed.body.path).not.toBe(created.body.path);
  });

  it('cannot share a meeting that is still processing', async () => {
    const backend = setup({
      meetings: [meetingRow({ id: mineId, status: 'transcribing', transcript: null })],
    });
    const response = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/share`, { method: 'POST' }),
    );
    expect(response.status).toBe(409);
  });
});

describe('moments', () => {
  const moment = {
    id: momentId,
    meetingId: mineId,
    startMs: 1000,
    endMs: 6000,
    title: 'The commitment',
    note: 'Proposal by Friday',
    createdAt: '2026-09-30T10:10:00.000Z',
  };

  it('saves private moments and lists them for the owner only', async () => {
    const backend = setup();
    const saved = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/moments`, { method: 'POST', body: moment }),
    );
    expect(saved.status).toBe(201);
    expect(saved.body).toMatchObject({ id: momentId, title: 'The commitment' });
    expect(saved.body).not.toHaveProperty('sharePath');
    const repeat = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/moments`, { method: 'POST', body: moment }),
    );
    expect(repeat.status).toBe(200);
    expect(backend.tables.meeting_moments).toHaveLength(1);

    const listed = await call(backend, as(userA, `/api/uploads/${mineId}/moments`));
    expect(listed.body.map((m: { id: string }) => m.id)).toEqual([momentId]);
    const stranger = await call(backend, as(userB, `/api/uploads/${mineId}/moments`));
    expect(stranger.status).toBe(404);
  });

  it('rejects ranges past the recording or longer than a minute', async () => {
    const backend = setup();
    for (const range of [
      { startMs: 1000, endMs: 31000 + 1000 },
      { startMs: 0, endMs: 61000 },
    ]) {
      const response = await call(
        backend,
        as(userA, `/api/uploads/${mineId}/moments`, {
          method: 'POST',
          body: { ...moment, ...range },
        }),
      );
      expect(response.status).toBe(400);
    }
  });

  it('shares and revokes a moment link that opens only that meeting', async () => {
    const backend = setup({
      moments: [
        {
          id: momentId,
          meeting_id: mineId,
          user_id: userA.id,
          start_ms: 1000,
          end_ms: 6000,
          title: 'The commitment',
          note: '',
          share_token: null,
          created_at: '2026-09-30T10:10:00.000Z',
        },
      ],
    });
    const shared = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/moments/${momentId}/share`, { method: 'POST' }),
    );
    const token = /moment-([a-f0-9]{64})$/.exec(shared.body.sharePath)![1];

    const view = await call(backend, as(null, `/api/moments/${token}`));
    expect(view.body.moment).toMatchObject({ id: momentId, startMs: 1000 });
    expect(view.body.recording).toMatchObject({
      title: 'Weekly sync',
      mediaUrl: `/api/moments/${token}/media`,
    });
    const playback = await ingestionApi(as(null, `/api/moments/${token}/media`), backend.env);
    expect(playback.status).toBe(200);

    const stranger = await call(
      backend,
      as(userB, `/api/uploads/${mineId}/moments/${momentId}/share`, { method: 'DELETE' }),
    );
    expect(stranger.status).toBe(404);

    const revoked = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/moments/${momentId}/share`, { method: 'DELETE' }),
    );
    expect(revoked.body).not.toHaveProperty('sharePath');
    expect((await call(backend, as(null, `/api/moments/${token}`))).status).toBe(404);
  });

  it('deletes a moment', async () => {
    const backend = setup({
      moments: [
        {
          id: momentId,
          meeting_id: mineId,
          user_id: userA.id,
          start_ms: 0,
          end_ms: 1000,
          title: 'Gone soon',
          note: '',
          share_token: null,
        },
      ],
    });
    const response = await call(
      backend,
      as(userA, `/api/uploads/${mineId}/moments/${momentId}`, { method: 'DELETE' }),
    );
    expect(response.body).toEqual({ deleted: true });
    expect(backend.tables.meeting_moments).toEqual([]);
  });
});

describe('search', () => {
  it('searches only the signed-in user’s finished meetings', async () => {
    const backend = setup();
    const results = await call(backend, as(userA, '/api/search?q=proposal'));
    expect(results.body).toHaveLength(1);
    expect(results.body[0].meeting).toMatchObject({
      id: mineId,
      participants: ['Jordan'],
    });
    expect(results.body[0].matches[0]).toMatchObject({
      kind: 'transcript',
      speaker: 'Jordan',
      timestamp: 1,
    });
    const searchCall = backend.log.find((entry) => entry.url.includes('/meetings?'));
    expect(searchCall!.url).toContain(`user_id=eq.${userA.id}`);
    expect(searchCall!.url).toContain('status=eq.complete');

    expect((await call(backend, as(userA, '/api/search?q='))).body).toEqual([]);
    expect(
      (await call(backend, as(userA, `/api/search?q=${'x'.repeat(201)}`))).status,
    ).toBe(400);
    expect((await call(backend, as(null, '/api/search?q=proposal'))).status).toBe(401);
  });
});
