import { ingestionApi, type IngestionEnv } from './ingestion';
import { appendSessionCookies, authApi, prepareAccountRequest } from './auth';
import { verifiedUserHeader } from './database';
export { ProcessMeetingWorkflow } from './workflow';
type AssetBinding = { fetch(request: Request): Promise<Response> };

export default {
  async fetch(
    request: Request,
    env: { ASSETS: AssetBinding } & Partial<IngestionEnv>,
  ): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (pathname.startsWith('/api/auth/')) {
      const headers = new Headers(request.headers);
      headers.delete(verifiedUserHeader);
      return authApi(new Request(request, { headers }), env as IngestionEnv);
    }
    try {
      const account = await prepareAccountRequest(request, env as IngestionEnv);
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
  },
};
