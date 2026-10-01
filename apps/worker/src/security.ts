/** Cloudflare Workers rate limiting binding (declared in wrangler.jsonc). */
export type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };
export type SecurityEnv = {
  AUTH_LIMITER?: RateLimiter;
  API_LIMITER?: RateLimiter;
};

function clientAddress(request: Request) {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

function tooMany(message: string) {
  return Response.json(
    { message },
    {
      status: 429,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
    },
  );
}

async function allowed(limiter: RateLimiter | undefined, key: string) {
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch (error) {
    // Never lock everyone out because the limiter itself is unavailable.
    console.warn('Rate limiter unavailable', error);
    return true;
  }
}

/** Sign-in, sign-up, and password endpoints: limited per client address. */
export async function limitAuth(request: Request, env: SecurityEnv) {
  if (request.method === 'GET') return null;
  const route = new URL(request.url).pathname;
  return (await allowed(env.AUTH_LIMITER, `${clientAddress(request)}:${route}`))
    ? null
    : tooMany('Too many attempts. Please wait a minute and try again.');
}

/** Changes are limited per account; public link lookups per client address. */
export async function limitApi(
  request: Request,
  env: SecurityEnv,
  userId: string | null,
) {
  const { pathname } = new URL(request.url);
  // Media byte-range requests are frequent during normal playback.
  if (pathname.endsWith('/media')) return null;
  const key =
    request.method !== 'GET'
      ? `write:${userId ?? clientAddress(request)}`
      : /^\/api\/(shares|moments)\//.test(pathname)
        ? `public:${clientAddress(request)}`
        : null;
  if (!key) return null;
  return (await allowed(env.API_LIMITER, key))
    ? null
    : tooMany('You’re going a little fast. Please wait a moment and retry.');
}

const apiSecurityHeaders: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
export function withSecurityHeaders(response: Response) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(apiSecurityHeaders))
    if (!secured.headers.has(name)) secured.headers.set(name, value);
  return secured;
}
