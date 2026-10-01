// Deterministic browser fixtures exist only in tests. Deployed audits use real APIs.
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {
  meetings,
  searchDocuments,
  fixture,
} from '../packages/shared/reviewer-fixture';
import { searchMeetingLibrary } from '../packages/shared/search';
import type { PersistedMoment } from '../packages/shared/recording';
export { expect };
export const test = base.extend<{ reviewerApi: void }>({
  reviewerApi: [
    async ({ context, browser }, runFixture) => {
      if (process.env.FATHOM_CLONE_VERIFY_URL) {
        await runFixture();
        return;
      }
      const shares = new Map<string, PersistedMoment>();
      const seeded = {
        ...fixture.moments[0],
        sharePath: `/share/moment-${'a'.repeat(64)}`,
      };
      shares.set('a'.repeat(64), seeded);
      const install = async (ctx: BrowserContext) => {
        const moments: PersistedMoment[] = [seeded];
        const names: Record<string, string> = {};
        await ctx.route('**/api/**', async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          const path = url.pathname;
          const method = request.method();
          const send = (json: unknown, status = 200) =>
            route.fulfill({ json, status });
          if (path === '/api/auth/session') return send({ user: null });
          if (path === '/api/session') return send({ ready: true });
          if (path === '/api/meetings') return send(meetings);
          if (path === '/api/search')
            return send(
              searchMeetingLibrary(
                meetings,
                searchDocuments,
                url.searchParams.get('q') || '',
                url.searchParams.get('category') || 'All meetings',
              ),
            );
          const match = /^\/api\/meetings\/([^/]+)(?:\/(.+))?$/.exec(path);
          if (match) {
            const [, id, action] = match;
            const meeting = meetings.find((m) => m.id === id);
            if (action === 'moments') {
              if (method === 'GET') return send(meeting ? moments : []);
              const input = request.postDataJSON();
              const token =
                crypto.randomUUID().replaceAll('-', '') +
                crypto.randomUUID().replaceAll('-', '');
              const saved = {
                ...input,
                ...(meeting ? { sharePath: `/share/moment-${token}` } : {}),
              };
              moments.push(saved);
              if (meeting) shares.set(token, saved);
              return send(saved, 201);
            }
            if (!meeting) return send({ message: 'Meeting unavailable' }, 404);
            if (!action)
              return send({
                meeting,
                searchDocument: searchDocuments.find((d) => d.meetingId === id),
              });
            if (action === 'recording')
              return send({
                ...fixture,
                speakers: fixture.speakers.map((s) => ({
                  ...s,
                  name: names[s.id] || s.name,
                })),
              });
            if (action === 'share')
              return send({ path: `/share/meeting-${'b'.repeat(64)}` });
            if (action === 'speakers') {
              const input = request.postDataJSON();
              names[input.speakerId] = input.name;
              return send({ saved: true });
            }
          }
          if (path === `/api/shares/${'b'.repeat(64)}`)
            return send({
              title: meetings[0].title,
              description: meetings[0].summary,
              ...fixture,
              mediaType: 'video/webm',
            });
          if (path.startsWith('/api/moments/')) {
            const moment = shares.get(path.split('/').at(-1)!);
            return moment
              ? send({ meeting: meetings[0], recording: fixture, moment })
              : send({ message: 'Unavailable' }, 404);
          }
          if (path === '/api/uploads' && method === 'GET') return send([]);
          if (/^\/api\/uploads\/[^/]+\/share$/.test(path) && method === 'GET')
            return send({ path: null });
          return route.fallback();
        });
      };
      await install(context);
      const original = browser.newContext.bind(browser);
      browser.newContext = async (...args) => {
        const ctx = await original(...args);
        await install(ctx);
        return ctx;
      };
      try {
        await runFixture();
      } finally {
        browser.newContext = original;
      }
    },
    { auto: true },
  ],
});

export async function publicPaths(page: Page) {
  await page.goto('/app');
  return page.evaluate(async () => {
    const all = await fetch('/api/meetings').then((r) => r.json());
    const meeting = all.find(
      (m: { provenance: string }) => m.provenance === 'reference-recording',
    );
    const share = await fetch(`/api/meetings/${meeting.id}/share`).then((r) =>
      r.json(),
    );
    const moments = await fetch(`/api/meetings/${meeting.id}/moments`).then(
      (r) => r.json(),
    );
    return {
      meeting: share.path as string,
      moment: moments[0].sharePath as string,
    };
  });
}

export type { Page } from '@playwright/test';
