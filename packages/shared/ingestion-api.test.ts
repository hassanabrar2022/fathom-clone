import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ingestionApi,
  type IngestionEnv,
} from '../../apps/worker/src/ingestion';

const env = {
  SUPABASE_URL: 'https://database.example',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  R2_ACCOUNT_ID: 'test',
  R2_BUCKET_NAME: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  AI: { run: vi.fn() },
} satisfies IngestionEnv;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('private ingestion API', () => {
  it('deletes both stored objects before the owner-scoped row and invalidates its share', async () => {
    const id = '77777777-7777-4777-8777-777777777777';
    const token = 'c'.repeat(64);
    const row = {
      id,
      title: 'Private meeting to delete',
      media_type: 'video/webm',
      media_size: 4,
      duration_seconds: 32,
      status: 'complete',
      processing_progress: 100,
      processing_error: null,
      created_at: '2026-09-14T12:00:00Z',
      transcript: [],
      speaker_names: { speaker: 'Jordan' },
      intelligence: null,
      owner_hash: 'b'.repeat(64),
      storage_key: `uploads/${id}`,
      processing_lease: null,
      processing_started_at: null,
      processing_attempts: 0,
      media_uploaded_at: '2026-09-14T12:00:00Z',
    };
    let deleted = false;
    const operations: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        const method =
          init?.method ?? (input instanceof Request ? input.method : 'GET');
        if (url.origin === env.SUPABASE_URL) {
          if (url.pathname.endsWith('/reviewer_meeting_shares'))
            return Response.json([]);
          if (url.pathname.endsWith('/uploaded_meeting_shares'))
            return Response.json(
              deleted ? [] : [{ meeting_id: id, token, enabled: true }],
            );
          if (method === 'DELETE') {
            operations.push('database');
            deleted = true;
            return Response.json([row]);
          }
          return Response.json(deleted ? [] : [row]);
        }
        if (method === 'DELETE') {
          operations.push(url.pathname.split('/').at(-1) ?? '');
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 404 });
      }),
    );
    const response = await ingestionApi(
      new Request(`https://app.example/api/uploads/${id}`, {
        method: 'DELETE',
        headers: {
          Cookie: `__Host-fathom-clone=${'a'.repeat(64)}`,
          Origin: 'https://app.example',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(new Set(operations.slice(0, 4))).toEqual(
      new Set(['staging', 'media', 'audio-staging', 'audio-media']),
    );
    expect(operations[4]).toBe('database');
    const calls = vi.mocked(fetch).mock.calls;
    const databaseDelete = calls.find(
      ([input, init]) =>
        String(input).includes('/uploaded_meetings?') &&
        init?.method === 'DELETE',
    );
    expect(String(databaseDelete?.[0])).toMatch(/owner_hash=eq\.[a-f0-9]{64}$/);
    expect(String(databaseDelete?.[0])).not.toContain('a'.repeat(64));
    expect(
      (
        await ingestionApi(
          new Request(`https://app.example/api/shares/${token}`),
          env,
        )
      ).status,
    ).toBe(404);
  });

  it('keeps database content when R2 cleanup fails and exposes no storage key', async () => {
    const id = '77777777-7777-4777-8777-777777777777';
    const row = {
      id,
      title: 'Private meeting to preserve',
      media_type: 'video/webm',
      media_size: 4,
      duration_seconds: 32,
      status: 'complete',
      processing_progress: 100,
      processing_error: null,
      created_at: '2026-09-14T12:00:00Z',
      transcript: [],
      speaker_names: {},
      intelligence: null,
      owner_hash: 'b'.repeat(64),
      storage_key: `uploads/${id}`,
      processing_lease: null,
      processing_started_at: null,
      processing_attempts: 0,
      media_uploaded_at: '2026-09-14T12:00:00Z',
    };
    let databaseDeletes = 0;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        if (url.origin === env.SUPABASE_URL) {
          if (init?.method === 'DELETE') databaseDeletes += 1;
          return Response.json([row]);
        }
        return new Response(null, { status: 503 });
      }),
    );
    const response = await ingestionApi(
      new Request(`https://app.example/api/uploads/${id}`, {
        method: 'DELETE',
        headers: {
          Cookie: `__Host-fathom-clone=${'a'.repeat(64)}`,
          Origin: 'https://app.example',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
      env,
    );
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain('Nothing else was deleted');
    expect(body).not.toContain(row.storage_key);
    expect(databaseDeletes).toBe(0);
  });

  it('stores speaker labels separately, scopes writes to the owner, and includes labels in an existing share', async () => {
    const id = '77777777-7777-4777-8777-777777777777';
    const token = 'c'.repeat(64);
    const originalTranscript = [
      {
        id: 'one',
        speakerId: 'speaker',
        start: 2,
        end: 6,
        paragraphs: ['Review the plan.'],
      },
      {
        id: 'two',
        speakerId: 'speaker',
        start: 8,
        end: 12,
        paragraphs: ['Agree on a date.'],
      },
    ];
    let row: Record<string, unknown> = {
      id,
      title: 'Planning call',
      media_type: 'video/webm',
      media_size: 4,
      duration_seconds: 32,
      status: 'complete',
      processing_progress: 100,
      processing_error: null,
      created_at: '2026-09-14T12:00:00Z',
      transcript: originalTranscript,
      speaker_names: {},
      intelligence: null,
      owner_hash: 'b'.repeat(64),
      storage_key: 'uploads/private',
      processing_lease: null,
      processing_started_at: null,
      processing_attempts: 0,
      media_uploaded_at: '2026-09-14T12:00:00Z',
    };
    const fetcher = vi.fn(
      async (input: string | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        if (url.pathname.endsWith('/reviewer_meeting_shares'))
          return Response.json([]);
        if (url.pathname.endsWith('/uploaded_meeting_shares'))
          return Response.json([{ meeting_id: id, token, enabled: true }]);
        if (init?.method === 'PATCH')
          row = { ...row, ...JSON.parse(String(init.body)) };
        return Response.json([row]);
      },
    );
    vi.stubGlobal('fetch', fetcher);
    const rename = (name: string, speakerId = 'speaker') =>
      new Request(`https://app.example/api/uploads/${id}/speakers`, {
        method: 'PATCH',
        headers: {
          Cookie: `__Host-fathom-clone=${'a'.repeat(64)}`,
          Origin: 'https://app.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerId, name }),
      });
    expect((await ingestionApi(rename('Jordan', 'unknown'), env)).status).toBe(
      404,
    );
    expect((await ingestionApi(rename('   '), env)).status).toBe(400);
    const saved = await ingestionApi(rename('Jordan'), env);
    expect(saved.status).toBe(200);
    expect((await saved.json()) as object).toMatchObject({
      speaker_names: { speaker: 'Jordan' },
      transcript: originalTranscript,
    });
    expect(row.transcript).toEqual(originalTranscript);
    const privateCalls = fetcher.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/uploaded_meetings?'));
    expect(
      privateCalls.every((url) => /owner_hash=eq\.[a-f0-9]{64}/.test(url)),
    ).toBe(true);
    expect(privateCalls.every((url) => !url.includes('a'.repeat(64)))).toBe(
      true,
    );
    const shared = await ingestionApi(
      new Request(`https://app.example/api/shares/${token}`),
      env,
    );
    expect((await shared.json()) as object).toMatchObject({
      speakers: [{ id: 'speaker', name: 'Jordan' }],
    });
    expect(
      (
        await ingestionApi(
          new Request(`https://app.example/api/uploads/${id}/speakers`, {
            method: 'PATCH',
            headers: {
              Origin: 'https://app.example',
              'Content-Type': 'application/json',
            },
            body: '{}',
          }),
          env,
        )
      ).status,
    ).toBe(401);
  });
  it('persists transcription before analysis and retries only the failed analysis step', async () => {
    let row: Record<string, unknown> = {
      id: '77777777-7777-4777-8777-777777777777',
      title: 'Test conversation',
      media_type: 'video/webm',
      media_size: 4,
      duration_seconds: 104,
      status: 'uploaded',
      processing_progress: 30,
      processing_error: null,
      created_at: '2026-09-14T12:00:00Z',
      transcript: null,
      intelligence: null,
      owner_hash: 'b'.repeat(64),
      storage_key: 'uploads/test',
      processing_lease: null,
      processing_started_at: null,
      processing_attempts: 0,
      media_uploaded_at: '2026-09-14T12:00:00Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.startsWith(env.SUPABASE_URL)) {
          if (init?.method === 'PATCH')
            row = { ...row, ...JSON.parse(String(init.body)) };
          return Response.json([row]);
        }
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'Content-Length': '4' },
        });
      }),
    );
    let analysisFails = true;
    let successfulAnalysisCalls = 0;
    const run = vi.fn(async (model: string) => {
      if (model.includes('whisper'))
        return {
          text: 'We will review the plan.',
          segments: [{ start: 2.7, end: 8, text: 'We will review the plan.' }],
        };
      expect(row.transcript).not.toBeNull();
      expect(row.status).toBe('analyzing');
      if (analysisFails) throw new Error('Provider failure');
      successfulAnalysisCalls++;
      return {
        response: {
          actions: [],
          ...Object.fromEntries(
            ['general', 'sales_customer', 'recruiting_interview'].map((key) => [
              key,
              {
                title: 'Plan review',
                overview:
                  successfulAnalysisCalls === 1
                    ? 'This view is inapplicable.'
                    : {
                        general: 'A plan review was discussed.',
                        sales_customer:
                          'No customer needs or commercial commitments were discussed.',
                        recruiting_interview:
                          'No candidate or hiring evidence was discussed.',
                      }[key],
                sections: ['Discussion', 'Next step'].map((title) => ({
                  title,
                  items:
                    key === 'recruiting_interview'
                      ? []
                      : [{ text: 'Review the plan.', source: 2.7 }],
                })),
              },
            ]),
          ),
        },
      };
    });
    const request = () =>
      new Request(
        'https://app.example/api/uploads/77777777-7777-4777-8777-777777777777/process',
        {
          method: 'POST',
          headers: {
            Cookie: `__Host-fathom-clone=${'a'.repeat(64)}`,
            Origin: 'https://app.example',
            'Content-Type': 'application/json',
          },
          body: '{}',
        },
      );
    const failed = await ingestionApi(request(), { ...env, AI: { run } });
    const result = (await failed.json()) as {
      status: string;
      processing_error: string;
      transcript: unknown[];
    };
    expect(result.status).toBe('failed');
    expect(result.processing_error).toBe('analysis_failed');
    expect(result.transcript).toHaveLength(1);
    analysisFails = false;
    const recovered = await ingestionApi(request(), { ...env, AI: { run } });
    expect(((await recovered.json()) as { status: string }).status).toBe(
      'complete',
    );
    expect(successfulAnalysisCalls).toBe(2);
    expect(
      run.mock.calls.filter(([model]) => model.includes('whisper')),
    ).toHaveLength(1);
  });

  it('transcribes long audio in bounded ranges and keeps source timestamps across chunks', async () => {
    const id = '77777777-7777-4777-8777-777777777777';
    const audioSize = 44 + 121 * 16000 * 2;
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);
    for (const [offset, word] of [
      [0, 'RIFF'],
      [8, 'WAVE'],
      [12, 'fmt '],
      [36, 'data'],
    ] as const) {
      for (let index = 0; index < word.length; index++)
        view.setUint8(offset + index, word.charCodeAt(index));
    }
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint16(34, 16, true);
    view.setUint32(40, audioSize - 44, true);
    let row: Record<string, unknown> = {
      id,
      title: 'Long meeting',
      media_type: 'video/webm',
      media_size: 8,
      duration_seconds: 121,
      status: 'transcribing',
      processing_progress: 35,
      processing_error: null,
      created_at: '2026-09-14T12:00:00Z',
      transcript: null,
      speaker_names: {},
      intelligence: null,
      owner_hash: 'b'.repeat(64),
      storage_key: 'uploads/test',
      processing_lease: null,
      processing_started_at: null,
      processing_attempts: 0,
      media_uploaded_at: '2026-09-14T12:00:00Z',
    };
    const ranges: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | Request, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        const method =
          init?.method ?? (input instanceof Request ? input.method : 'GET');
        if (url.origin === env.SUPABASE_URL) {
          if (method === 'PATCH')
            row = { ...row, ...JSON.parse(String(init?.body)) };
          return Response.json([row]);
        }
        if (url.pathname.endsWith('/audio-staging'))
          return new Response(null, { status: 404 });
        const range =
          input instanceof Request
            ? input.headers.get('Range')
            : new Headers(init?.headers).get('Range');
        if (method === 'HEAD')
          return new Response(null, {
            headers: {
              'Content-Length': String(audioSize),
              'Content-Type': 'audio/wav',
            },
          });
        if (!range) throw new Error('The full recording must not be buffered');
        ranges.push(range);
        if (range === 'bytes=0-43')
          return new Response(header, { status: 206 });
        const [, start, end] = /^bytes=(\d+)-(\d+)$/.exec(range) ?? [];
        return new Response(new Uint8Array(Number(end) - Number(start) + 1), {
          status: 206,
        });
      }),
    );
    const run = vi.fn(async (model: string) => {
      if (!model.includes('whisper')) throw new Error('Analysis unavailable');
      return {
        text: 'Review the plan.',
        segments: [{ start: 0, end: 1, text: 'Review the plan.' }],
      };
    });
    const response = await ingestionApi(
      new Request(`https://app.example/api/uploads/${id}/process`, {
        method: 'POST',
        headers: {
          Cookie: `__Host-fathom-clone=${'a'.repeat(64)}`,
          Origin: 'https://app.example',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
      { ...env, AI: { run } },
    );
    const result = (await response.json()) as {
      transcript: { start: number }[];
      processing_error: string;
    };
    expect(result.processing_error).toBe('analysis_failed');
    expect(result.transcript.map((segment) => segment.start)).toEqual([0, 120]);
    expect(ranges).toEqual([
      'bytes=0-43',
      'bytes=44-3840043',
      'bytes=3840044-3872043',
    ]);
    expect(
      run.mock.calls.filter(([model]) => model.includes('whisper')),
    ).toHaveLength(2);
  });
  it('leaves the public demo independent of credentials or guest authentication', async () => {
    const response = await ingestionApi(
      new Request('https://app.example/api/uploads'),
      {} as IngestionEnv,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('creates an HttpOnly secure guest cookie without returning its value as JSON', async () => {
    const response = await ingestionApi(
      new Request('https://app.example/api/session', {
        method: 'POST',
        headers: {
          Origin: 'https://app.example',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toMatch(
      /^__Host-fathom-clone=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict;/,
    );
    expect(await response.json()).toEqual({ ready: true });
  });
  it('rejects cross-origin writes and unauthenticated private media', async () => {
    const external = await ingestionApi(
      new Request('https://app.example/api/session', {
        method: 'POST',
        headers: {
          Origin: 'https://elsewhere.example',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
      env,
    );
    expect(external.status).toBe(403);
    const media = await ingestionApi(
      new Request(
        'https://app.example/api/uploads/77777777-7777-4777-8777-777777777777/media',
      ),
      env,
    );
    expect(media.status).toBe(401);
  });
  it('scopes database reads to a cookie digest and never returns another visitor’s row', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetcher);
    const response = await ingestionApi(
      new Request(
        'https://app.example/api/uploads/77777777-7777-4777-8777-777777777777',
        {
          headers: { Cookie: `__Host-fathom-clone=${'a'.repeat(64)}` },
        },
      ),
      env,
    );
    expect(response.status).toBe(404);
    expect(fetcher.mock.calls[0][0]).toMatch(/owner_hash=eq\.[a-f0-9]{64}$/);
    expect(fetcher.mock.calls[0][0]).not.toContain('a'.repeat(64));
  });
  it('does not expose provider errors or service credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: 'private-provider-diagnostic' },
            { status: 500 },
          ),
        ),
    );
    const response = await ingestionApi(
      new Request('https://app.example/api/uploads', {
        headers: { Cookie: `__Host-fathom-clone=${'a'.repeat(64)}` },
      }),
      env,
    );
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain('private-provider-diagnostic');
    expect(text).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
  });
});
