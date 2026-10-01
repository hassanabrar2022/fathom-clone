import type { IngestionEnv } from './ingestion';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}
export async function owner(request: Request) {
  const account = request.headers.get('X-Fathom-Clone-Verified-Owner');
  if (account && /^[a-f0-9]{64}$/.test(account)) return account;
  const token = request.headers
    .get('Cookie')
    ?.match(/(?:^|;\s*)__Host-fathom-clone=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function db(
  env: IngestionEnv,
  path: string,
  method = 'GET',
  body?: unknown,
  prefer = 'return=representation',
): Promise<unknown> {
  const response = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`,
    {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (problem?.message === 'upload_quota_reached')
      throw new ApiError(
        429,
        'The demo upload allowance has been reached. Please try again tomorrow.',
      );
    throw new ApiError(
      503,
      'Meeting storage is temporarily unavailable. Please retry.',
    );
  }
  return response.status === 204 ? null : response.json();
}
