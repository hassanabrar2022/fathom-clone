import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../apps/worker/src/index';
import { authApi, prepareAccountRequest } from '../../apps/worker/src/auth';
import { owner } from '../../apps/worker/src/database';
import type { IngestionEnv } from '../../apps/worker/src/ingestion';

const env = {
  SUPABASE_URL: 'https://database.example',
  SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-test-key',
  R2_ACCOUNT_ID: 'test',
  R2_BUCKET_NAME: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  AI: { run: vi.fn() },
  ASSETS: { fetch: vi.fn() },
} as unknown as IngestionEnv & {
  SUPABASE_PUBLISHABLE_KEY: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
};
const user = {
  id: '77777777-7777-4777-8777-777777777777',
  email: 'test@example.com',
};
const session = {
  access_token: 'a'.repeat(80),
  refresh_token: 'r'.repeat(12),
  expires_in: 3600,
  user,
};
const request = (
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
) =>
  new Request(`https://app.example/api/auth/${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method === 'GET'
        ? {}
        : {
            Origin: 'https://app.example',
            'Content-Type': 'application/json',
          }),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Supabase account adapter', () => {
  it('keeps reviewer access open and rejects forged ownership headers', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('A forged header reached the database');
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await worker.fetch(
      new Request('https://app.example/api/uploads', {
        headers: { 'X-Fathom-Clone-Verified-Owner': 'f'.repeat(64) },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps pending email confirmation distinct from an authenticated session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(user)),
    );
    const response = await authApi(
      request('signup', 'POST', {
        email: user.email,
        password: 'safe-password',
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ confirmationRequired: true });
    expect(response.headers.getSetCookie().some((value) => value.startsWith('__Host-fathom-clone-signup='))).toBe(true);
    const rejected = await authApi(
      request('login', 'POST', { email: 'bad', password: 'x' }),
      env,
    );
    expect(rejected.status).toBe(400);
    expect(JSON.stringify(await rejected.json())).not.toContain(
      'safe-password',
    );
  });
  it('signs up immediately when email confirmation is disabled', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        calls.push(input);
        return input.includes('/auth/v1/signup')
          ? Response.json(session)
          : Response.json([]);
      }),
    );
    const response = await authApi(
      request('signup', 'POST', {
        email: user.email,
        password: 'safe-password',
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user });
    expect(response.headers.getSetCookie().some((value) =>
      value.startsWith('__Host-fathom-clone-auth='),
    )).toBe(true);
    expect(calls.some((url) =>
      url.includes(encodeURIComponent('https://app.example/auth/confirm')),
    )).toBe(true);
  });
  it('links guest-owned rows on login and uses the same account owner across browsers', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        calls.push({
          url: input,
          method: init?.method ?? 'GET',
          body: init?.body?.toString(),
        });
        if (input.includes('/auth/v1/token')) return Response.json(session);
        if (input.includes('/auth/v1/user')) return Response.json(user);
        return Response.json([]);
      }),
    );
    const guestCookie = `__Host-fathom-clone=${'g'.repeat(64)}`.replaceAll('g', 'a');
    const login = await authApi(
      request(
        'login',
        'POST',
        { email: user.email, password: 'safe-password' },
        guestCookie,
      ),
      env,
    );
    expect(login.status).toBe(200);
    expect((await login.json()) as unknown).toMatchObject({ user });
    const cookies = login.headers.getSetCookie();
    expect(
      cookies.some((value) => value.startsWith('__Host-fathom-clone-auth=')),
    ).toBe(true);
    expect(
      cookies.some((value) => value.startsWith('__Host-fathom-clone-refresh=')),
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.includes('uploaded_meetings?owner_hash=eq.') &&
          call.method === 'PATCH',
      ),
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.includes('meeting_moments?owner_hash=eq.') &&
          call.method === 'PATCH',
      ),
    ).toBe(true);
    const authCookie = cookies
      .filter((value) => value.startsWith('__Host-fathom-clone-auth='))
      .map((value) => value.split(';')[0])
      .join('; ');
    const first = await prepareAccountRequest(
      new Request('https://app.example/api/uploads', {
        headers: { Cookie: authCookie },
      }),
      env,
    );
    const second = await prepareAccountRequest(
      new Request('https://app.example/api/uploads', {
        headers: { Cookie: authCookie },
      }),
      env,
    );
    expect(await owner(first.request)).toMatch(/^[a-f0-9]{64}$/);
    expect(await owner(first.request)).toBe(await owner(second.request));
    expect(await owner(first.request)).not.toBe(
      await owner(
        new Request('https://app.example/api/uploads', {
          headers: { Cookie: guestCookie },
        }),
      ),
    );
  });
  it('exchanges a verified email-confirmation session for secure cookies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input.includes('/auth/v1/user')
          ? Response.json(user)
          : input.includes('/auth/v1/token')
            ? Response.json(session)
            : Response.json([]),
      ),
    );
    const completed = await authApi(
      request('complete', 'POST', {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }, `__Host-fathom-clone-signup=${user.id}`),
      env,
    );
    expect(completed.status).toBe(200);
    expect(await completed.json()).toEqual({ user });
    expect(completed.headers.getSetCookie().join(' ')).toContain('HttpOnly');
    const bad = await authApi(
      request('complete', 'POST', {
        access_token: 'bad',
        refresh_token: session.refresh_token,
      }),
      env,
    );
    expect(bad.status).toBe(400);
  });
  it('refreshes after an access cookie expires and rejects cross-site writes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input.includes('/auth/v1/token')
          ? Response.json(session)
          : Response.json(user),
      ),
    );
    const status = await authApi(
      request(
        'session',
        'GET',
        undefined,
        `__Host-fathom-clone-refresh=${'r'.repeat(12)}`,
      ),
      env,
    );
    expect(status.status).toBe(200);
    expect((await status.json()) as unknown).toMatchObject({ user });
    expect(status.headers.getSetCookie()).toHaveLength(2);
    const crossSite = await authApi(
      new Request('https://app.example/api/auth/logout', {
        method: 'POST',
        headers: {
          Origin: 'https://other.example',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
      env,
    );
    expect(crossSite.status).toBe(403);
  });
});
