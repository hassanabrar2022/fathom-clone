import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authApi,
  prepareAccountRequest,
} from '../../apps/worker/src/auth';
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

function setup(options: Parameters<typeof createBackend>[0] = {}) {
  const backend = createBackend(options);
  vi.stubGlobal('fetch', backend.fetch);
  return backend;
}
const cookies = (response: Response) => response.headers.getSetCookie();
const cookieValue = (response: Response, name: string) =>
  cookies(response)
    .find((value) => value.startsWith(`${name}=`))
    ?.split(';')[0]
    .slice(name.length + 1);

describe('account API', () => {
  it('signs in with HttpOnly cookies and reports the session', async () => {
    const backend = setup();
    const login = await authApi(
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: 'ADA@example.com', password: userA.password },
      }),
      backend.env,
    );
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({
      user: { id: userA.id, email: userA.email },
    });
    for (const value of cookies(login).filter((c) => !c.includes('Max-Age=0')))
      expect(value).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    const access = cookieValue(login, '__Host-fathom-clone-auth');
    const session = await authApi(
      apiRequest('/api/auth/session', {
        headers: { Cookie: `__Host-fathom-clone-auth=${access}` },
      }),
      backend.env,
    );
    expect(await session.json()).toEqual({
      user: { id: userA.id, email: userA.email },
    });
  });

  it('rejects wrong passwords without revealing which part was wrong', async () => {
    const backend = setup();
    const response = await authApi(
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: userA.email, password: 'not the password' },
      }),
      backend.env,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/Incorrect email or password/);
    expect(cookies(response)).toEqual([]);
  });

  it('requires same-origin JSON for account changes', async () => {
    const backend = setup();
    const crossSite = new Request('https://app.example/api/auth/login', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: userA.password }),
    });
    expect((await authApi(crossSite, backend.env)).status).toBe(403);
    expect(backend.log).toEqual([]);
  });

  it('refreshes an expired access token from the refresh cookie', async () => {
    const backend = setup();
    const { refresh_token } = backend.issueSession(userA);
    const response = await authApi(
      apiRequest('/api/auth/session', {
        headers: {
          Cookie: `__Host-fathom-clone-auth=expired; __Host-fathom-clone-refresh=${refresh_token}`,
        },
      }),
      backend.env,
    );
    expect((await response.json()).user.id).toBe(userA.id);
    expect(cookieValue(response, '__Host-fathom-clone-refresh')).not.toBe(
      refresh_token,
    );
  });

  it('holds signup for email confirmation and completes it only in the same browser', async () => {
    const backend = setup({ confirmSignup: true });
    const signup = await authApi(
      apiRequest('/api/auth/signup', {
        method: 'POST',
        body: { email: 'new@example.com', password: 'a fresh password' },
      }),
      backend.env,
    );
    expect(await signup.json()).toEqual({ confirmationRequired: true });
    const pending = cookieValue(signup, '__Host-fathom-clone-signup');
    const redirect = backend.log.find((call) => call.url.includes('/signup'));
    expect(new URL(redirect!.url).searchParams.get('redirect_to')).toBe(
      'https://app.example/auth/confirm',
    );

    const created = backend.users.get('new@example.com')!;
    const link = backend.issueSession(created);
    const body = {
      access_token: link.access_token,
      refresh_token: link.refresh_token,
    };
    const otherBrowser = await authApi(
      apiRequest('/api/auth/complete', { method: 'POST', body }),
      backend.env,
    );
    expect(otherBrowser.status).toBe(400);
    expect((await otherBrowser.json()).message).toMatch(/Sign in to continue/);

    const again = backend.issueSession(created);
    const sameBrowser = await authApi(
      apiRequest('/api/auth/complete', {
        method: 'POST',
        body: {
          access_token: again.access_token,
          refresh_token: again.refresh_token,
        },
        headers: { Cookie: `__Host-fathom-clone-signup=${pending}` },
      }),
      backend.env,
    );
    expect(sameBrowser.status).toBe(200);
    expect(cookieValue(sameBrowser, '__Host-fathom-clone-auth')).toBeTruthy();
  });

  it('sends reset links with the same answer for unknown addresses', async () => {
    const backend = setup();
    for (const email of [userA.email, 'nobody@example.com']) {
      const response = await authApi(
        apiRequest('/api/auth/recover', { method: 'POST', body: { email } }),
        backend.env,
      );
      expect(await response.json()).toEqual({ sent: true });
    }
    const recover = backend.log.find((call) => call.url.includes('/recover'));
    expect(new URL(recover!.url).searchParams.get('redirect_to')).toBe(
      'https://app.example/auth/reset',
    );
  });

  it('turns a recovery link into a session, then sets a new password', async () => {
    const backend = setup();
    const link = backend.issueSession(userA);
    const recovery = await authApi(
      apiRequest('/api/auth/recovery', {
        method: 'POST',
        body: {
          access_token: link.access_token,
          refresh_token: link.refresh_token,
        },
      }),
      backend.env,
    );
    expect(recovery.status).toBe(200);
    const access = cookieValue(recovery, '__Host-fathom-clone-auth');
    const update = await authApi(
      apiRequest('/api/auth/password', {
        method: 'POST',
        body: { password: 'a brand new password' },
        headers: { Cookie: `__Host-fathom-clone-auth=${access}` },
      }),
      backend.env,
    );
    expect(await update.json()).toEqual({ updated: true });
    expect(backend.users.get(userA.email)!.password).toBe('a brand new password');

    const expired = await authApi(
      apiRequest('/api/auth/recovery', {
        method: 'POST',
        body: { access_token: 'x'.repeat(60), refresh_token: 'unknown-token' },
      }),
      backend.env,
    );
    expect(expired.status).toBe(400);
  });

  it('requires a session to change the password', async () => {
    const backend = setup();
    const response = await authApi(
      apiRequest('/api/auth/password', {
        method: 'POST',
        body: { password: 'whatever password' },
      }),
      backend.env,
    );
    expect(response.status).toBe(401);
  });

  it('deletes the account, its rows, and its stored media only with the right password', async () => {
    const mine = meetingRow({ id: '11111111-1111-4111-8111-111111111111' });
    const theirs = meetingRow({
      id: '22222222-2222-4222-8222-222222222222',
      user_id: userB.id,
    });
    const backend = setup({
      meetings: [mine, theirs],
      objects: {
        [`uploads/${mine.id}/media`]: { body: new Uint8Array(4), type: 'video/webm' },
        [`uploads/${theirs.id}/media`]: { body: new Uint8Array(4), type: 'video/webm' },
      },
    });
    const cookie = backend.sessionCookie(userA);
    const wrong = await authApi(
      apiRequest('/api/auth/delete-account', {
        method: 'POST',
        body: { password: 'definitely wrong' },
        headers: { Cookie: cookie },
      }),
      backend.env,
    );
    expect(wrong.status).toBe(400);
    expect(backend.users.has(userA.email)).toBe(true);
    expect(backend.objects.has(`uploads/${mine.id}/media`)).toBe(true);

    const deleted = await authApi(
      apiRequest('/api/auth/delete-account', {
        method: 'POST',
        body: { password: userA.password },
        headers: { Cookie: cookie },
      }),
      backend.env,
    );
    expect(await deleted.json()).toEqual({ deleted: true });
    expect(backend.users.has(userA.email)).toBe(false);
    expect(backend.tables.meetings.map((row) => row.id)).toEqual([theirs.id]);
    expect(backend.objects.has(`uploads/${mine.id}/media`)).toBe(false);
    expect(backend.objects.has(`uploads/${theirs.id}/media`)).toBe(true);
    expect(cookies(deleted).every((value) => value.includes('Max-Age=0'))).toBe(
      true,
    );
  });

  it('never passes a client-supplied user header through to the API', async () => {
    const backend = setup();
    const forged = await prepareAccountRequest(
      apiRequest('/api/uploads', { headers: { [verifiedUserHeader]: userB.id } }),
      backend.env,
    );
    expect(forged.request.headers.get(verifiedUserHeader)).toBeNull();

    const signedIn = await prepareAccountRequest(
      apiRequest('/api/uploads', {
        headers: {
          [verifiedUserHeader]: userB.id,
          Cookie: backend.sessionCookie(userA),
        },
      }),
      backend.env,
    );
    expect(signedIn.request.headers.get(verifiedUserHeader)).toBe(userA.id);
  });
});
