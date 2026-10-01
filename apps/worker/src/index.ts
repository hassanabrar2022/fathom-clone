import { ingestionApi, type IngestionEnv } from './ingestion';
import { appendSessionCookies, authApi, prepareAccountRequest } from './auth';
import { currentUserId, verifiedUserHeader } from './database';
import {
  limitApi,
  limitAuth,
  withSecurityHeaders,
  type SecurityEnv,
} from './security';
import { autoRecordSweep } from './calendar';
export { CaptureMeetingWorkflow, ProcessMeetingWorkflow } from './workflow';
type AssetBinding = { fetch(request: Request): Promise<Response> };
type Env = { ASSETS: AssetBinding } & Partial<IngestionEnv> & SecurityEnv;

async function api(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith('/api/auth/')) {
    const limited = await limitAuth(request, env);
    if (limited) return limited;
    const headers = new Headers(request.headers);
    headers.delete(verifiedUserHeader);
    return authApi(new Request(request, { headers }), env as IngestionEnv);
  }
  try {
    const account = await prepareAccountRequest(request, env as IngestionEnv);
    const limited = await limitApi(
      request,
      env,
      currentUserId(account.request),
    );
    if (limited) return limited;
    return appendSessionCookies(
      await ingestionApi(account.request, env as IngestionEnv),
      account.cookies,
    );
  } catch (error) {
    console.error('Account session check failed', error);
    return Response.json(
      { message: 'Account session is temporarily unavailable. Please retry.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith('/api/'))
      return env.ASSETS.fetch(request);
    return withSecurityHeaders(await api(request, env));
  },
  /** Cron trigger: send notetakers to meetings on auto-recorded calendars. */
  async scheduled(
    _controller: unknown,
    env: Env,
    context: { waitUntil(promise: Promise<unknown>): void },
  ) {
    context.waitUntil(autoRecordSweep(env as IngestionEnv));
  },
};
