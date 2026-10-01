import { z } from 'zod';
import type { IngestionEnv } from './ingestion';
import { deleteAllUserMedia } from './ingestion';
import { ApiError, json, verifiedUserHeader } from './database';
import { verifyAccessToken } from './jwt';

type AuthEnv = IngestionEnv & { SUPABASE_PUBLISHABLE_KEY?: string };
type AuthUser = { id: string; email: string };
const passwordSchema = z.string().min(8).max(128);
const credentialsSchema = z.object({
  email: z.email().max(254),
  password: passwordSchema,
});
const providerUserSchema = z.object({ id: z.uuid(), email: z.email() });
const providerSessionSchema = z.object({
  access_token: z.string().min(50),
  refresh_token: z.string().min(8),
  expires_in: z.number().positive(),
  user: providerUserSchema,
});
const callbackTokensSchema = z.object({
  access_token: z.string().min(50),
  refresh_token: z.string().min(8),
});
const accessCookie = '__Host-fathom-clone-auth';
const refreshCookie = '__Host-fathom-clone-refresh';
const signupCookie = '__Host-fathom-clone-signup';
const routes = [
  'session',
  'login',
  'signup',
  'logout',
  'complete',
  'recover',
  'recovery',
  'password',
  'delete-account',
];

function key(env: AuthEnv) {
  if (!env.SUPABASE_PUBLISHABLE_KEY)
    throw new ApiError(
      503,
      'Account sign-in is temporarily unavailable. Please try again shortly.',
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
        setCookie(refreshCookie, session.refresh_token, 2592000),
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
const unavailable = () =>
  new ApiError(
    503,
    'Account session check is temporarily unavailable. Please retry.',
  );
async function verify(env: AuthEnv, access: string): Promise<AuthUser | null> {
  try {
    const local = await verifyAccessToken(env.SUPABASE_URL, access);
    if (local !== undefined) return local;
  } catch (error) {
    console.warn('Local session check unavailable; asking Supabase', error);
  }
  const response = await provider(env, 'user', 'GET', undefined, access);
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw unavailable();
  const parsed = providerUserSchema.safeParse(await response.json());
  if (!parsed.success) throw unavailable();
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
      if (!response.ok) throw unavailable();
      const parsed = providerSessionSchema.safeParse(await response.json());
      if (!parsed.success) throw unavailable();
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
  if (user && access) return { user, access, cookies: [] as string[] };
  const refreshToken = cookie(request, refreshCookie);
  if (!refreshToken) return { user: null, access: null, cookies: [] };
  const session = await refresh(env, refreshToken);
  if (!session) return { user: null, access: null, cookies: cookieHeaders() };
  return {
    user: session.user,
    access: session.access_token,
    cookies: cookieHeaders(session),
  };
}
async function passwordGrant(env: AuthEnv, email: string, password: string) {
  return provider(env, 'token?grant_type=password', 'POST', {
    email: email.toLowerCase(),
    password,
  });
}
/** Exchanges tokens from an emailed link for this browser's session cookies. */
async function linkSession(env: AuthEnv, value: unknown) {
  const tokens = callbackTokensSchema.safeParse(value);
  if (!tokens.success)
    throw new ApiError(400, 'This link is invalid. Please request a new one.');
  const linked = await verify(env, tokens.data.access_token);
  const session = await refresh(env, tokens.data.refresh_token);
  if (!linked || !session || linked.id !== session.user.id)
    throw new ApiError(400, 'This link has expired. Please request a new one.');
  return { user: linked, session };
}
async function readJson(request: Request) {
  const text = await request.text();
  if (text.length > 4096) throw new ApiError(413, 'Request too large.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'Expected a JSON request.');
  }
}

export async function authApi(
  request: Request,
  env: AuthEnv,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const route = /^\/api\/auth\/([a-z-]+)$/.exec(url.pathname)?.[1];
    if (!route || !routes.includes(route))
      return json({ message: 'Not found.' }, 404);
    if (request.method !== 'GET') {
      if (request.headers.get('Origin') !== url.origin)
        throw new ApiError(
          403,
          'Please use Fathom Clone to make account changes.',
        );
      if (!request.headers.get('Content-Type')?.startsWith('application/json'))
        throw new ApiError(415, 'Expected a JSON request.');
    }
    if (route === 'session' && request.method === 'GET') {
      const current = await currentAccount(request, env);
      return withCookies(json({ user: current.user }), current.cookies);
    }
    if (request.method !== 'POST') return json({ message: 'Not found.' }, 404);
    const value = await readJson(request);

    if (route === 'logout') {
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

    if (route === 'complete') {
      // Only the browser that signed up may finish confirmation, so a crafted
      // link cannot silently sign someone into another account.
      const { user, session } = await linkSession(env, value);
      if (cookie(request, signupCookie) !== user.id)
        throw new ApiError(
          400,
          'Your email is confirmed. Sign in to continue.',
        );
      return withCookies(json({ user }), [
        ...cookieHeaders(session),
        setCookie(signupCookie, '', 0),
      ]);
    }

    if (route === 'recover') {
      const input = z.object({ email: z.email().max(254) }).safeParse(value);
      if (!input.success) throw new ApiError(400, 'Enter a valid email.');
      const response = await provider(
        env,
        `recover?redirect_to=${encodeURIComponent(`${url.origin}/auth/reset`)}`,
        'POST',
        { email: input.data.email.toLowerCase() },
      );
      if (response.status === 429)
        throw new ApiError(
          429,
          'Too many reset requests. Please wait a few minutes and try again.',
        );
      if (!response.ok && response.status >= 500) throw unavailable();
      // Same answer whether or not the address has an account.
      return json({ sent: true });
    }

    if (route === 'recovery') {
      const { user, session } = await linkSession(env, value);
      return withCookies(json({ user }), cookieHeaders(session));
    }

    if (route === 'password' || route === 'delete-account') {
      const current = await currentAccount(request, env);
      if (!current.user || !current.access)
        throw new ApiError(401, 'Sign in to continue.');
      if (route === 'password') {
        const input = z.object({ password: passwordSchema }).safeParse(value);
        if (!input.success)
          throw new ApiError(400, 'Use a password of at least 8 characters.');
        const response = await provider(
          env,
          'user',
          'PUT',
          { password: input.data.password },
          current.access,
        );
        if (response.status === 422)
          throw new ApiError(
            400,
            'Choose a different password than your current one.',
          );
        if (!response.ok) throw unavailable();
        return withCookies(json({ updated: true }), current.cookies);
      }
      const input = z.object({ password: passwordSchema }).safeParse(value);
      if (!input.success)
        throw new ApiError(400, 'Enter your password to delete your account.');
      const check = await passwordGrant(
        env,
        current.user.email,
        input.data.password,
      );
      if (!check.ok)
        throw new ApiError(
          check.status === 429 ? 429 : 400,
          check.status === 429
            ? 'Too many attempts. Please wait a moment and try again.'
            : 'That password is incorrect.',
        );
      await deleteAllUserMedia(env, current.user.id);
      const removed = await fetch(
        `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${current.user.id}`,
        {
          method: 'DELETE',
          signal: AbortSignal.timeout(15000),
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
      if (!removed.ok) {
        console.error('Account deletion failed', { status: removed.status });
        throw new ApiError(
          503,
          'Your recordings were removed, but the account could not be deleted. Please retry.',
        );
      }
      return withCookies(json({ deleted: true }), cookieHeaders());
    }

    const input = credentialsSchema.safeParse(value);
    if (!input.success)
      throw new ApiError(
        400,
        'Enter a valid email and a password of at least 8 characters.',
      );
    const signup = route === 'signup';
    const response = signup
      ? await provider(
          env,
          `signup?redirect_to=${encodeURIComponent(`${url.origin}/auth/confirm`)}`,
          'POST',
          { email: input.data.email.toLowerCase(), password: input.data.password },
        )
      : await passwordGrant(env, input.data.email, input.data.password);
    if (!response.ok) {
      if (response.status === 429)
        throw new ApiError(
          429,
          'Too many attempts. Please wait a moment and try again.',
        );
      throw new ApiError(
        [400, 401, 422].includes(response.status) ? 400 : 503,
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
          setCookie(signupCookie, pending.data.id, 86400),
        ]);
      throw new ApiError(503, 'Account sign-in did not complete. Please retry.');
    }
    return withCookies(json({ user: session.data.user }), [
      ...cookieHeaders(session.data),
      setCookie(signupCookie, '', 0),
    ]);
  } catch (error) {
    if (error instanceof ApiError)
      return json({ message: error.message }, error.status);
    console.error('Account request failed', error);
    return json(
      { message: 'Account service is temporarily unavailable. Please retry.' },
      503,
    );
  }
}

export async function prepareAccountRequest(request: Request, env: AuthEnv) {
  const headers = new Headers(request.headers);
  headers.delete(verifiedUserHeader);
  const current = await currentAccount(request, env);
  if (current.user) headers.set(verifiedUserHeader, current.user.id);
  return {
    request: new Request(request, { headers }),
    cookies: current.cookies,
  };
}
export function appendSessionCookies(response: Response, cookies: string[]) {
  return withCookies(response, cookies);
}
