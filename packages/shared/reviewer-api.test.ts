import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ingestionApi,
  type IngestionEnv,
} from '../../apps/worker/src/ingestion';
import { meetingSchema } from './meeting';
import seeds from '../../supabase/seeds/reviewer-meetings.json' with { type: 'json' };
const env = {
  SUPABASE_URL: 'https://database.example',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  R2_ACCOUNT_ID: 'test',
  R2_BUCKET_NAME: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  AI: { run: vi.fn() },
} satisfies IngestionEnv;
const source = seeds.find((s) => s.recording)!;
const cookie = `__Host-fathom-clone=${'a'.repeat(64)}`;
const request = (
  path: string,
  method = 'GET',
  body?: unknown,
  authenticated = true,
) =>
  new Request(`https://app.example/api/${path}`, {
    method,
    headers: {
      ...(authenticated ? { Cookie: cookie } : {}),
      ...(method === 'GET'
        ? {}
        : {
            Origin: 'https://app.example',
            'Content-Type': 'application/json',
          }),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
afterEach(() => vi.unstubAllGlobals());
describe('persisted reviewer API', () => {
  it('returns persisted metadata without downloading transcripts or private rows', async () => {
    const fetcher = vi.fn(async (input: string) => {
      expect(input).toContain('select=metadata');
      return Response.json([
        { metadata: { ...source.metadata, title: 'Updated database title' } },
      ]);
    });
    vi.stubGlobal('fetch', fetcher);
    const r = await ingestionApi(request('meetings'), env);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data).toMatchObject([{ title: 'Updated database title' }]);
    expect(JSON.stringify(data)).not.toContain('segments');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('fails explicitly when storage fails; no seed fallback or provider details escape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { message: 'SQL failure containing sensitive provider details' },
          { status: 500 },
        ),
      ),
    );
    const r = await ingestionApi(request('meetings'), env);
    expect(r.status).toBe(503);
    const text = await r.text();
    expect(text).toContain('temporarily unavailable');
    expect(text).not.toContain('SQL');
    expect(text).not.toContain(source.metadata.title);
  });
  it('searches current database content and scopes private rows to the owner', async () => {
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        paths.push(input);
        return Response.json(
          input.includes('/reviewer_meetings')
            ? [
                {
                  metadata: source.metadata,
                  search_document: {
                    meetingId: source.id,
                    transcript: [
                      {
                        id: 'changed',
                        speaker: 'Presenter',
                        start: 12,
                        text: 'Persisted audit phrase',
                      },
                    ],
                  },
                },
              ]
            : [],
        );
      }),
    );
    const r = await ingestionApi(request('search?q=Persisted%20audit'), env);
    expect(await r.json()).toMatchObject([
      { matches: [{ text: 'Persisted audit phrase', timestamp: 12 }] },
    ]);
    expect(paths.find((p) => p.includes('/uploaded_meetings'))).toMatch(
      /owner_hash=eq\.[a-f0-9]{64}/,
    );
  });
  it('normalizes database timestamps for private search results accepted by the UI', async () => {
    const row = {
      id: '77777777-7777-4777-8777-777777777777',
      title: 'Private audit recording',
      media_type: 'video/webm',
      media_size: 123,
      duration_seconds: 104,
      status: 'complete',
      processing_progress: 100,
      processing_error: null,
      created_at: '2026-09-24T06:30:00.123456+00:00',
      speaker_names: { speaker: 'Audit speaker' },
      intelligence: null,
      transcript: [
        {
          id: 'segment-1',
          speakerId: 'speaker',
          start: 2,
          end: 10,
          paragraphs: ['Review the video recording.'],
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        Response.json(input.includes('/uploaded_meetings') ? [row] : []),
      ),
    );
    const response = await ingestionApi(request('search?q=video'), env);
    expect(response.status).toBe(200);
    const results = (await response.json()) as {
      meeting: unknown;
      matches: unknown[];
    }[];
    expect(results).toHaveLength(1);
    expect(meetingSchema.parse(results[0].meeting)).toMatchObject({
      provenance: 'uploaded',
      date: '2026-09-24T06:30:00.123Z',
    });
    expect(results[0].matches).toMatchObject([
      { timestamp: 2, speaker: 'Audit speaker' },
    ]);
  });
  it('persists moments before returning success and resolves only stored random tokens', async () => {
    let stored: Record<string, unknown> | undefined;
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        paths.push(input);
        if (input.includes('/reviewer_meetings'))
          return Response.json([source]);
        if (init?.method === 'POST') {
          stored = JSON.parse(String(init.body));
          return Response.json([stored]);
        }
        if (input.includes('share_token='))
          return Response.json(stored ? [stored] : []);
        return Response.json([]);
      }),
    );
    const body = { ...source.recording!.moments[0], id: crypto.randomUUID() };
    const created = await ingestionApi(
      request(`meetings/${source.id}/moments`, 'POST', body),
      env,
    );
    expect(created.status).toBe(201);
    const result = (await created.json()) as { sharePath: string };
    expect(result.sharePath).toMatch(/^\/share\/moment-[a-f0-9]{64}$/);
    expect(stored?.owner_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.owner_hash).not.toBe('a'.repeat(64));
    const token = result.sharePath.split('moment-')[1];
    const shared = await ingestionApi(
      request(`moments/${token}`, 'GET', undefined, false),
      env,
    );
    expect(shared.status).toBe(200);
    const output = await shared.text();
    expect(output).toContain(body.title);
    expect(output).not.toContain('owner_hash');
    expect(paths.some((p) => p.includes(`share_token=eq.${token}`))).toBe(true);
  });
  it('rejects missing ownership, invalid ranges, and failed moment writes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Response('', { status: 503 })
          : Response.json(input.includes('/reviewer_meetings') ? [source] : []),
      ),
    );
    const body = { ...source.recording!.moments[0], id: crypto.randomUUID() };
    expect(
      (
        await ingestionApi(
          request(`meetings/${source.id}/moments`, 'POST', body, false),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await ingestionApi(
          request(`meetings/${source.id}/moments`, 'POST', {
            ...body,
            endMs: 999999,
          }),
          env,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await ingestionApi(
          request(`meetings/${source.id}/moments`, 'POST', body),
          env,
        )
      ).status,
    ).toBe(503);
  });
  it('never exposes another owner’s private moment or creates its public share', async () => {
    const id = crypto.randomUUID();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        calls.push(input);
        return Response.json([]);
      }),
    );
    expect(
      (
        await ingestionApi(
          request(`meetings/${id}/moments`, 'GET', undefined, false),
          env,
        )
      ).status,
    ).toBe(401);
    expect(calls).toHaveLength(0);
    expect(
      (await ingestionApi(request(`meetings/${id}/moments`), env)).status,
    ).toBe(404);
    expect(calls[0]).toContain('owner_hash=eq.');
  });
});
