import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ingestionApi,
  type IngestionEnv,
} from '../../apps/worker/src/ingestion';

const meetingId = '77777777-7777-4777-8777-777777777777';
const cookie = `__Host-fathom-clone=${'a'.repeat(64)}`;
const env = {
  SUPABASE_URL: 'https://database.example',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  R2_ACCOUNT_ID: 'test',
  R2_BUCKET_NAME: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  AI: { run: vi.fn() },
} satisfies IngestionEnv;

afterEach(() => vi.unstubAllGlobals());

describe('full meeting share API', () => {
  it('publishes only after an owner acts, supports byte-range media, and revokes both data and playback', async () => {
    const row = {
      id: meetingId,
      title: 'Fictional planning call',
      original_filename: 'private.webm',
      media_type: 'video/webm',
      media_size: 4,
      duration_seconds: 32,
      status: 'complete',
      processing_progress: 100,
      processing_error: null,
      created_at: '2026-09-14T12:00:00Z',
      transcript: [
        {
          id: 'segment-1',
          speakerId: 'speaker',
          start: 2,
          end: 6,
          paragraphs: ['We will review the plan.'],
        },
      ],
      intelligence: null,
      owner_hash: 'b'.repeat(64),
      storage_key: 'uploads/private-key',
      processing_lease: null,
      processing_started_at: null,
      processing_attempts: 0,
      media_uploaded_at: '2026-09-14T12:00:00Z',
    };
    let share: { meeting_id: string; token: string; enabled: boolean } | null =
      null;
    const storageRanges: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | Request, init?: RequestInit) => {
        const address = new URL(typeof input === 'string' ? input : input.url);
        const method = init?.method ?? 'GET';
        if (address.origin === env.SUPABASE_URL) {
          if (address.pathname.endsWith('/reviewer_meeting_shares')) return Response.json([]);
          if (address.pathname.endsWith('/uploaded_meetings'))
            return Response.json([row]);
          if (address.pathname.endsWith('/uploaded_meeting_shares')) {
            if (method === 'POST')
              share = JSON.parse(String(init?.body)) as typeof share;
            if (method === 'PATCH')
              share = { ...share!, ...JSON.parse(String(init?.body)) };
            const token = address.searchParams.get('token')?.slice(3);
            const enabled = address.searchParams.get('enabled');
            return Response.json(
              share &&
                (!token || token === share.token) &&
                (!enabled || share.enabled)
                ? [share]
                : [],
            );
          }
        }
        const range =
          new Headers(init?.headers).get('Range') ||
          (input instanceof Request ? input.headers.get('Range') : null);
        if (range) storageRanges.push(range);
        return new Response(new Uint8Array([1, 2]), {
          status: range ? 206 : 200,
          headers: range
            ? { 'Content-Range': 'bytes 0-1/4', 'Content-Length': '2' }
            : { 'Content-Length': '2' },
        });
      }),
    );
    const ownerRequest = (method: string) =>
      new Request(`https://app.example/api/uploads/${meetingId}/share`, {
        method,
        headers: {
          Cookie: cookie,
          ...(method === 'GET'
            ? {}
            : {
                Origin: 'https://app.example',
                'Content-Type': 'application/json',
              }),
        },
      });

    const unshared = await ingestionApi(ownerRequest('GET'), env);
    expect(await unshared.json()).toEqual({ path: null });
    const created = await ingestionApi(ownerRequest('POST'), env);
    expect(created.status).toBe(201);
    const { path } = (await created.json()) as { path: string };
    expect(path).toMatch(/^\/share\/meeting-[a-f0-9]{64}$/);
    const token = path.slice('/share/meeting-'.length);
    const visitor = await ingestionApi(
      new Request(`https://app.example/api/shares/${token}`),
      env,
    );
    expect(visitor.status).toBe(200);
    const payload = await visitor.json();
    expect(payload).toMatchObject({
      title: row.title,
      mediaUrl: `/api/shares/${token}/media`,
      segments: row.transcript,
    });
    expect(JSON.stringify(payload)).not.toContain(row.storage_key);
    expect(JSON.stringify(payload)).not.toContain(row.owner_hash);
    expect(JSON.stringify(payload)).not.toContain(row.original_filename);

    const media = await ingestionApi(
      new Request(`https://app.example/api/shares/${token}/media`, {
        headers: { Range: 'bytes=0-1' },
      }),
      env,
    );
    expect(media.status).toBe(206);
    expect(media.headers.get('Content-Range')).toBe('bytes 0-1/4');
    expect(media.headers.get('Cache-Control')).toContain('no-store');
    expect(storageRanges).toEqual(['bytes=0-1']);

    const revoked = await ingestionApi(ownerRequest('DELETE'), env);
    expect(await revoked.json()).toEqual({ path: null });
    expect(
      (
        await ingestionApi(
          new Request(`https://app.example/api/shares/${token}`),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await ingestionApi(
          new Request(`https://app.example/api/shares/${token}/media`),
          env,
        )
      ).status,
    ).toBe(404);
    const reshared = await ingestionApi(ownerRequest('POST'), env);
    const next = (await reshared.json()) as { path: string };
    expect(next.path).not.toBe(path);
  });

  it('rejects non-owner writes and cannot share a meeting still processing', async () => {
    const forbidden = await ingestionApi(
      new Request(`https://app.example/api/uploads/${meetingId}/share`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: 'https://other.example',
          'Content-Type': 'application/json',
        },
      }),
      env,
    );
    expect(forbidden.status).toBe(403);
    const visitor = await ingestionApi(
      new Request(`https://app.example/api/uploads/${meetingId}/share`),
      env,
    );
    expect(visitor.status).toBe(401);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | Request) =>
        Response.json(
          new URL(
            typeof input === 'string' ? input : input.url,
          ).pathname.endsWith('/uploaded_meeting_shares')
            ? []
            : [
                {
                  id: meetingId,
                  title: 'Still processing',
                  media_type: 'video/webm',
                  media_size: 4,
                  duration_seconds: 32,
                  status: 'transcribing',
                  processing_progress: 60,
                  processing_error: null,
                  created_at: '2026-09-14T12:00:00Z',
                  transcript: null,
                  intelligence: null,
                  owner_hash: 'b'.repeat(64),
                  storage_key: 'uploads/private-key',
                  processing_lease: null,
                  processing_started_at: null,
                  processing_attempts: 0,
                  media_uploaded_at: '2026-09-14T12:00:00Z',
                },
              ],
        ),
      ),
    );
    const response = await ingestionApi(
      new Request(`https://app.example/api/uploads/${meetingId}/share`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: 'https://app.example',
          'Content-Type': 'application/json',
        },
      }),
      env,
    );
    expect(response.status).toBe(409);
  });
});
