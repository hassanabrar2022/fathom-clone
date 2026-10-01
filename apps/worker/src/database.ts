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

/** Set by the auth layer after the session is verified; never trusted from clients. */
export const verifiedUserHeader = 'X-Fathom-Clone-Verified-User';
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function currentUserId(request: Request) {
  const id = request.headers.get(verifiedUserHeader);
  return id && uuidPattern.test(id) ? id : null;
}
export function requireUser(request: Request) {
  const id = currentUserId(request);
  if (!id) throw new ApiError(401, 'Sign in to continue.');
  return id;
}
export function isUuid(value: string) {
  return uuidPattern.test(value);
}

const quotaMessages: Record<string, [number, string]> = {
  daily_upload_limit: [
    429,
    'You have reached today’s upload limit. Please try again tomorrow.',
  ],
  too_many_in_progress: [
    429,
    'Several recordings are still processing. Wait for one to finish, then upload again.',
  ],
};

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
      code?: string;
    } | null;
    const quota = problem?.message ? quotaMessages[problem.message] : undefined;
    if (quota) throw new ApiError(...quota);
    console.error('Database request failed', {
      method,
      table: path.split(/[?/]/)[0],
      status: response.status,
      code: problem?.code,
    });
    throw new ApiError(
      503,
      'Meeting storage is temporarily unavailable. Please retry.',
    );
  }
  // `return=minimal` writes answer 201 with an empty body.
  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : null;
}
