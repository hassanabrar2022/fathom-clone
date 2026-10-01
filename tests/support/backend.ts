/**
 * In-memory stand-ins for Supabase (PostgREST + GoTrue) and R2's S3 API, so
 * Worker handlers can be exercised end to end in unit tests without network.
 */
import { vi } from 'vitest';
import type { IngestionEnv } from '../../apps/worker/src/ingestion';

export const SUPABASE_URL = 'https://database.example';
export const SERVICE_KEY = 'test-service-role';
export const PUBLISHABLE_KEY = 'test-publishable';
export const APP = 'https://app.example';

export const userA = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'ada@example.com',
  password: 'correct horse',
};
export const userB = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'bea@example.com',
  password: 'battery staple',
};

type Row = Record<string, unknown>;
type StoredObject = { body: Uint8Array<ArrayBuffer>; type: string };
type User = { id: string; email: string; password: string };

export function meetingRow(overrides: Row = {}): Row {
  const id = (overrides.id as string) ?? '11111111-1111-4111-8111-111111111111';
  return {
    id,
    user_id: userA.id,
    title: 'Weekly sync',
    original_filename: 'sync.webm',
    media_type: 'video/webm',
    storage_key: `uploads/${id}`,
    media_size: 4,
    duration_seconds: 30,
    status: 'complete',
    processing_progress: 100,
    processing_error: null,
    processing_started_at: null,
    processing_lease: null,
    processing_attempts: 1,
    media_uploaded_at: '2026-09-30T10:00:00.000Z',
    transcript: [
      {
        id: 'segment-1',
        speakerId: 'speaker',
        start: 1,
        end: 6,
        paragraphs: ['We will send the revised proposal by Friday.'],
      },
    ],
    intelligence: null,
    speaker_names: {},
    created_at: '2026-09-30T10:00:00.000Z',
    updated_at: '2026-09-30T10:05:00.000Z',
    ...overrides,
  };
}

function matches(row: Row, params: URLSearchParams) {
  for (const [key, condition] of params) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(key)) continue;
    const [operator, ...rest] = condition.split('.');
    const value = rest.join('.');
    if (operator === 'eq' && String(row[key]) !== value) return false;
    if (operator === 'is' && value === 'null' && row[key] != null) return false;
  }
  return true;
}

export function createBackend(
  options: {
    meetings?: Row[];
    shares?: Row[];
    moments?: Row[];
    objects?: Record<string, StoredObject>;
    users?: User[];
    confirmSignup?: boolean;
  } = {},
) {
  const tables: Record<string, Row[]> = {
    meetings: (options.meetings ?? []).map((row) => ({ ...row })),
    meeting_shares: (options.shares ?? []).map((row) => ({ ...row })),
    meeting_moments: (options.moments ?? []).map((row) => ({ ...row })),
  };
  const objects = new Map(Object.entries(options.objects ?? {}));
  const users = new Map(
    (options.users ?? [userA, userB]).map((user) => [user.email, { ...user }]),
  );
  const sessions = new Map<string, User>();
  const refreshTokens = new Map<string, User>();
  const log: { method: string; url: string; body?: unknown }[] = [];
  const state = {
    reserveError: null as string | null,
    failTable: null as string | null,
    failObjectDeletes: false,
  };

  function issueSession(account: User) {
    const user = users.get(account.email) ?? account;
    const access = `access-${crypto.randomUUID()}-${'x'.repeat(20)}`;
    const refresh = `refresh-${crypto.randomUUID()}`;
    sessions.set(access, user);
    refreshTokens.set(refresh, user);
    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: 3600,
      user: { id: user.id, email: user.email },
    };
  }

  async function database(url: URL, method: string, body: unknown) {
    const [, , , table, fn] = url.pathname.split('/');
    if (table === 'rpc' && fn === 'reserve_upload') {
      if (state.reserveError)
        return Response.json({ message: state.reserveError }, { status: 400 });
      const input = body as Record<string, string | number>;
      const id = crypto.randomUUID();
      const row = meetingRow({
        id,
        user_id: input.p_user,
        title: input.p_title,
        original_filename: input.p_filename,
        media_type: input.p_type,
        media_size: input.p_size,
        duration_seconds: input.p_duration,
        status: 'uploading',
        processing_progress: 0,
        processing_attempts: 0,
        media_uploaded_at: null,
        transcript: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      tables.meetings.push(row);
      return Response.json([row]);
    }
    if (state.failTable === table)
      return Response.json({ message: 'boom', code: 'XX000' }, { status: 500 });
    const rows = tables[table];
    if (!rows) return Response.json({ message: 'no table' }, { status: 404 });
    const params = url.searchParams;
    const found = rows.filter((row) => matches(row, params));
    if (method === 'GET') {
      const limit = Number(params.get('limit') ?? Infinity);
      return Response.json(found.slice(0, limit));
    }
    if (method === 'POST') {
      const inserted = (Array.isArray(body) ? body : [body]).map((item) => ({
        created_at: new Date().toISOString(),
        share_token: null,
        note: '',
        ...(item as Row),
      }));
      rows.push(...inserted);
      return Response.json(inserted, { status: 201 });
    }
    if (method === 'PATCH') {
      for (const row of found) Object.assign(row, body as Row);
      return Response.json(found);
    }
    if (method === 'DELETE') {
      tables[table] = rows.filter((row) => !found.includes(row));
      if (table === 'meetings') {
        const ids = new Set(found.map((row) => row.id));
        tables.meeting_shares = tables.meeting_shares.filter(
          (row) => !ids.has(row.meeting_id),
        );
        tables.meeting_moments = tables.meeting_moments.filter(
          (row) => !ids.has(row.meeting_id),
        );
      }
      return Response.json(found);
    }
    return new Response(null, { status: 405 });
  }

  async function auth(url: URL, request: Request, body: unknown) {
    const path = url.pathname.replace('/auth/v1/', '');
    const bearer = request.headers.get('Authorization')?.slice(7) ?? '';
    const input = (body ?? {}) as Record<string, string>;
    if (path === 'user' && request.method === 'GET') {
      const user = sessions.get(bearer);
      return user
        ? Response.json({ id: user.id, email: user.email })
        : Response.json({ message: 'invalid' }, { status: 401 });
    }
    if (path === 'user' && request.method === 'PUT') {
      const user = sessions.get(bearer);
      if (!user) return new Response(null, { status: 401 });
      if (input.password === user.password)
        return Response.json({ message: 'same' }, { status: 422 });
      user.password = input.password;
      return Response.json({ id: user.id, email: user.email });
    }
    if (path === 'token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const user = users.get(input.email);
        return user && user.password === input.password
          ? Response.json(issueSession(user))
          : Response.json({ message: 'invalid' }, { status: 400 });
      }
      const user = refreshTokens.get(input.refresh_token);
      if (!user) return Response.json({ message: 'invalid' }, { status: 400 });
      refreshTokens.delete(input.refresh_token);
      return Response.json(issueSession(user));
    }
    if (path === 'signup') {
      if (users.has(input.email))
        return Response.json({ message: 'exists' }, { status: 422 });
      const user = {
        id: crypto.randomUUID(),
        email: input.email,
        password: input.password,
      };
      users.set(user.email, user);
      return options.confirmSignup
        ? Response.json({ id: user.id, email: user.email })
        : Response.json(issueSession(user));
    }
    if (path === 'recover') return Response.json({});
    if (path === 'logout') {
      sessions.delete(bearer);
      return new Response(null, { status: 204 });
    }
    const admin = /^admin\/users\/(.+)$/.exec(path);
    if (admin && request.method === 'DELETE') {
      if (bearer !== SERVICE_KEY) return new Response(null, { status: 401 });
      for (const [email, user] of users)
        if (user.id === admin[1]) users.delete(email);
      for (const table of Object.keys(tables))
        tables[table] = tables[table].filter((row) => row.user_id !== admin[1]);
      return Response.json({});
    }
    return new Response(null, { status: 404 });
  }

  async function storage(url: URL, request: Request) {
    const key = decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
    const method = request.method;
    if (method === 'DELETE') {
      if (state.failObjectDeletes) return new Response(null, { status: 500 });
      objects.delete(key);
      return new Response(null, { status: 204 });
    }
    if (method === 'PUT') {
      const source = request.headers.get('x-amz-copy-source');
      if (source) {
        const from = objects.get(source.split('/').slice(2).join('/'));
        if (!from) return new Response('<Error>NoSuchKey</Error>', { status: 404 });
        objects.set(key, { ...from });
        return new Response('<CopyObjectResult/>');
      }
      objects.set(key, {
        body: new Uint8Array(await request.arrayBuffer()) as Uint8Array<ArrayBuffer>,
        type: request.headers.get('Content-Type') ?? '',
      });
      return new Response(null);
    }
    const stored = objects.get(key);
    if (!stored) return new Response(null, { status: 404 });
    const size = stored.body.length;
    const headers = { 'Content-Type': stored.type };
    if (method === 'HEAD')
      return new Response(null, {
        headers: { ...headers, 'Content-Length': String(size) },
      });
    const range = /^bytes=(\d+)-(\d+)?$/.exec(request.headers.get('Range') ?? '');
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(Number(range[2] ?? size - 1), size - 1);
      if (start >= size)
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${size}` },
        });
      return new Response(stored.body.slice(start, end + 1), {
        status: 206,
        headers: {
          ...headers,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
        },
      });
    }
    return new Response(stored.body, {
      headers: { ...headers, 'Content-Length': String(size) },
    });
  }

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const text = ['GET', 'HEAD'].includes(request.method)
      ? ''
      : await request.clone().text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    log.push({ method: request.method, url: request.url, body });
    if (url.origin === SUPABASE_URL && url.pathname.startsWith('/rest/v1/'))
      return database(url, request.method, body);
    if (url.origin === SUPABASE_URL && url.pathname.startsWith('/auth/v1/'))
      return auth(url, request, body);
    if (url.hostname.endsWith('.r2.cloudflarestorage.com'))
      return storage(url, request);
    throw new Error(`Unexpected fetch ${request.method} ${request.url}`);
  });

  const env = {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
    R2_ACCOUNT_ID: 'account',
    R2_BUCKET_NAME: 'bucket',
    R2_ACCESS_KEY_ID: 'key-id',
    R2_SECRET_ACCESS_KEY: 'key-secret',
    AI: { run: vi.fn<(model: string, input: unknown) => Promise<unknown>>() },
    PROCESS_MEETING: {
      create: vi.fn<
        (options: {
          id: string;
          params: { meetingId: string; userId: string; lease: string };
        }) => Promise<unknown>
      >(async () => ({ id: 'instance' })),
    },
  } satisfies IngestionEnv & { SUPABASE_PUBLISHABLE_KEY: string };

  return {
    env,
    fetch: fetchMock,
    tables,
    objects,
    users,
    log,
    state,
    /** Signs a user in and returns the auth cookie header for requests. */
    sessionCookie(user: User) {
      const session = issueSession(user);
      return `__Host-fathom-clone-auth=${session.access_token}`;
    },
    issueSession,
  };
}

export type Backend = ReturnType<typeof createBackend>;

/** A same-origin JSON request, as the web app would send it. */
export function apiRequest(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const method = init.method ?? 'GET';
  const write = !['GET', 'HEAD'].includes(method);
  return new Request(`${APP}${path}`, {
    method,
    headers: {
      ...(write ? { Origin: APP, 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    body: write ? JSON.stringify(init.body ?? {}) : undefined,
  });
}
