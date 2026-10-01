import { z } from 'zod';
import type { IngestionEnv } from './ingestion';
import { ApiError, db, json, owner } from './database';

type AuthEnv = IngestionEnv & { SUPABASE_PUBLISHABLE_KEY?: string };
type AuthUser = { id: string; email: string };
const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});
const providerUserSchema = z.object({ id: z.uuid(), email: z.email() });
const providerSessionSchema = z.object({
  access_token: z.string().min(50),
  refresh_token: z.string().min(8),
  expires_in: z.number().positive(),
  user: providerUserSchema,
});
const accessCookie = '__Host-fathom-clone-auth';
const refreshCookie = '__Host-fathom-clone-refresh';
const signupCookie = '__Host-fathom-clone-signup';
const internalOwnerHeader = 'X-Fathom-Clone-Verified-Owner';

function key(env: AuthEnv) {
  if (!env.SUPABASE_PUBLISHABLE_KEY)
    throw new ApiError(
      503,
      'Account sign-in is temporarily unavailable. Explore the public demo while we restore it.',
    );
  return env.SUPABASE_PUBLISHABLE_KEY;
}
function cookie(request: Request, name: string) {
  return request.headers
    .get('Cookie')
    ?.match(new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9._-]+)(?:;|$)`))?.[1];
}
function setCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function cookieHeaders(session?: z.infer<typeof providerSessionSchema>) {
  return session
    ? [
        setCookie(
          accessCookie,
          session.access_token,
          Math.min(Math.floor(session.expires_in), 3600),
        ),
        setCookie(refreshCookie, session.refresh_token, 604800),
      ]
    : [setCookie(accessCookie, '', 0), setCookie(refreshCookie, '', 0)];
}
function withCookies(response: Response, cookies: string[]) {
  for (const value of cookies) response.headers.append('Set-Cookie', value);
  return response;
}
async function provider(
  env: AuthEnv,
  path: string,
  method: string,
  body?: unknown,
  access?: string,
) {
  return fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/${path}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      apikey: key(env),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function accountHash(id: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`fathom-clone-account:${id}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
async function verify(env: AuthEnv, access: string): Promise<AuthUser | null> {
  const response = await provider(env, 'user', 'GET', undefined, access);
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok)
    throw new ApiError(
      503,
      'Account session check is temporarily unavailable. Please retry.',
    );
  const parsed = providerUserSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new ApiError(
      503,
      'Account session check is temporarily unavailable. Please retry.',
    );
  return parsed.data;
}
const refreshing = new Map<
  string,
  Promise<z.infer<typeof providerSessionSchema> | null>
>();
async function refresh(env: AuthEnv, token: string) {
  let current = refreshing.get(token);
  if (!current) {
    current = (async () => {
      const response = await provider(
        env,
        'token?grant_type=refresh_token',
        'POST',
        { refresh_token: token },
      );
      if (response.status === 400 || response.status === 401) return null;
      if (!response.ok)
        throw new ApiError(
          503,
          'Account session check is temporarily unavailable. Please retry.',
        );
      const parsed = providerSessionSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new ApiError(
          503,
          'Account session check is temporarily unavailable. Please retry.',
        );
      return parsed.data;
    })();
    refreshing.set(token, current);
    setTimeout(() => refreshing.delete(token), 8000);
  }
  return current;
}
async function currentAccount(request: Request, env: AuthEnv) {
  const access = cookie(request, accessCookie);
  const user = access ? await verify(env, access) : null;
  if (user) return { user, cookies: [] as string[] };
  const refreshToken = cookie(request, refreshCookie);
  if (!refreshToken) return { user: null, cookies: cookieHeaders() };
  const session = await refresh(env, refreshToken);
  if (!session) return { user: null, cookies: cookieHeaders() };
  return { user: session.user, cookies: cookieHeaders(session) };
}
async function claimGuestData(request: Request, env: AuthEnv, userId: string) {
  const guest = await owner(request);
  if (!guest) return;
  const account = await accountHash(userId);
  if (guest === account) return;
  await db(
    env,
    `uploaded_meetings?owner_hash=eq.${guest}`,
    'PATCH',
    { owner_hash: account },
    'return=minimal',
  );
  await db(
    env,
    `meeting_moments?owner_hash=eq.${guest}`,
    'PATCH',
    { owner_hash: account },
    'return=minimal',
  );
  const guestNames = z
    .array(
      z.object({
        meeting_id: z.string(),
        names: z.record(z.string(), z.string()),
      }),
    )
    .parse(
      await db(
        env,
        `reviewer_speaker_names?owner_hash=eq.${guest}&select=meeting_id,names`,
      ),
    );
  for (const row of guestNames) {
    const current = z
      .array(z.object({ names: z.record(z.string(), z.string()) }))
      .parse(
        await db(
          env,
          `reviewer_speaker_names?owner_hash=eq.${account}&meeting_id=eq.${row.meeting_id}&select=names`,
        ),
      );
    await db(
      env,
      'reviewer_speaker_names?on_conflict=meeting_id,owner_hash',
      'POST',
      {
        meeting_id: row.meeting_id,
        owner_hash: account,
        names: { ...row.names, ...current[0]?.names },
      },
      'resolution=merge-duplicates,return=minimal',
    );
  }
  await db(
    env,
    `reviewer_speaker_names?owner_hash=eq.${guest}`,
    'DELETE',
    undefined,
    'return=minimal',
  );
}
function authResponse(message: string, status: number) {
  return json({ message }, status);
}
export async function authApi(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (
      !/^\/api\/auth\/(session|login|signup|logout|complete)$/.test(
        url.pathname,
      )
    )
      return authResponse('Not found.', 404);
    if (request.method !== 'GET') {
      if (request.headers.get('Origin') !== url.origin)
        throw new ApiError(403, 'Please use Fathom Clone to make account changes.');
      if (!request.headers.get('Content-Type')?.startsWith('application/json'))
        throw new ApiError(415, 'Expected a JSON request.');
      if (Number(request.headers.get('Content-Length')) > 4096)
        throw new ApiError(413, 'Request too large.');
    }
    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const current = await currentAccount(request, env);
      return withCookies(json({ user: current.user }), current.cookies);
    }
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const access = cookie(request, accessCookie);
      if (access) {
        const result = await provider(
          env,
          'logout?scope=local',
          'POST',
          {},
          access,
        );
        if (!result.ok && ![401, 403].includes(result.status))
          throw new ApiError(503, 'Could not sign out. Please retry.');
      }
      return withCookies(json({ signedOut: true }), cookieHeaders());
    }
    if (
      request.method !== 'POST' ||
      !['/api/auth/login', '/api/auth/signup', '/api/auth/complete'].includes(
        url.pathname,
      )
    )
      return authResponse('Not found.', 404);
    const text = await request.text();
    if (text.length > 4096) throw new ApiError(413, 'Request too large.');
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new ApiError(400, 'Enter a valid email and password.');
    }
    if (url.pathname === '/api/auth/complete') {
      const tokens = z
        .object({
          access_token: z.string().min(50),
          refresh_token: z.string().min(8),
        })
        .safeParse(value);
      if (!tokens.success)
        throw new ApiError(400, 'This confirmation link is invalid. Please sign in.');
      const confirmed = await verify(env, tokens.data.access_token);
      const session = await refresh(env, tokens.data.refresh_token);
      if (
        !confirmed ||
        !session ||
        confirmed.id !== session.user.id ||
        cookie(request, signupCookie) !== confirmed.id
      )
        throw new ApiError(400, 'This confirmation link has expired. Please sign in.');
      await claimGuestData(request, env, confirmed.id);
      return withCookies(json({ user: confirmed }), [
        ...cookieHeaders(session),
        setCookie('__Host-fathom-clone', '', 0),
        setCookie(signupCookie, '', 0),
      ]);
    }
    const input = credentialsSchema.safeParse(value);
    if (!input.success)
      throw new ApiError(
        400,
        'Enter a valid email and a password of at least 8 characters.',
      );
    const signup = url.pathname.endsWith('/signup');
    const signupPath = signup
      ? `signup?redirect_to=${encodeURIComponent(`${url.origin}/auth/confirm`)}`
      : 'token?grant_type=password';
    const response = await provider(env, signupPath, 'POST', {
      email: input.data.email.toLowerCase(),
      password: input.data.password,
    });
    if (!response.ok) {
      if (response.status === 429)
        throw new ApiError(
          429,
          'Too many attempts. Please wait a moment and try again.',
        );
      throw new ApiError(
        response.status === 400 ||
          response.status === 401 ||
          response.status === 422
          ? 400
          : 503,
        signup
          ? 'We couldn’t create your account. Check the details or use Sign in.'
          : 'Incorrect email or password, or this email has not been confirmed.',
      );
    }
    const raw: unknown = await response.json();
    const session = providerSessionSchema.safeParse(raw);
    if (!session.success) {
      const pending = providerUserSchema.safeParse(raw);
      if (signup && pending.success)
        return withCookies(json({ confirmationRequired: true }), [
          setCookie(signupCookie, pending.data.id, 3600),
        ]);
      throw new ApiError(
        503,
        'Account sign-in did not complete. Please retry.',
      );
    }
    await claimGuestData(request, env, session.data.user.id);
    return withCookies(json({ user: session.data.user }), [
      ...cookieHeaders(session.data),
      setCookie('__Host-fathom-clone', '', 0),
      setCookie(signupCookie, '', 0),
    ]);
  } catch (error) {
    if (error instanceof ApiError)
      return authResponse(error.message, error.status);
    return authResponse(
      'Account service is temporarily unavailable. Please retry.',
      503,
    );
  }
}

export async function prepareAccountRequest(request: Request, env: AuthEnv) {
  const headers = new Headers(request.headers);
  headers.delete(internalOwnerHeader);
  const current = await currentAccount(request, env);
  if (current.user)
    headers.set(internalOwnerHeader, await accountHash(current.user.id));
  return {
    request: new Request(request, { headers }),
    cookies: current.cookies,
  };
}
export function appendSessionCookies(response: Response, cookies: string[]) {
  return withCookies(response, cookies);
}
