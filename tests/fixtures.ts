// Browser tests run the real web app against a stateful, mocked /api.
// Tests can inspect `api` state or override any route with page.route().
import {
  test as base,
  expect,
  type BrowserContext,
  type Route,
} from '@playwright/test';
import { searchMeetingLibrary } from '../packages/shared/search';
import type { UploadedMeeting } from '../packages/shared/ingestion';
import type { PersistedMoment } from '../packages/shared/recording';
export { expect };
export type { Page } from '@playwright/test';

export const user = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'ada@example.com',
};
export const meetingId = '11111111-1111-4111-8111-111111111111';

const view = (key: string, label: string, overview: string) => ({
  key,
  label,
  descriptor: `${label} view`,
  title: `${label} recap`,
  overview,
  sections: [
    {
      title: 'Decisions',
      items: [{ text: 'Ship the pilot on Friday.', source: 2 }],
    },
    { title: 'Open questions', items: [] },
  ],
});
export const intelligence = {
  provenance: 'generated' as const,
  templates: [
    view('general', 'General', 'A planning call about the pilot launch.'),
    view('sales-customer', 'Sales / Customer', 'No customer is present.'),
    view('recruiting-interview', 'Recruiting / Interview', 'No hiring evidence.'),
  ],
  actions: [
    {
      id: 'action-1',
      task: 'Send the revised proposal',
      owner: null,
      timing: 'Friday',
      source: 12,
    },
  ],
};

export function meeting(overrides: Partial<UploadedMeeting> = {}): UploadedMeeting {
  return {
    id: meetingId,
    title: 'Pilot planning',
    media_type: 'audio/wav',
    media_size: 4,
    duration_seconds: 30,
    status: 'complete',
    processing_progress: 100,
    processing_error: null,
    created_at: '2026-09-30T10:00:00.000Z',
    transcript: [
      {
        id: 'segment-1',
        speakerId: 'speaker',
        start: 2,
        end: 10,
        paragraphs: ['Let’s ship the pilot on Friday.'],
      },
      {
        id: 'segment-2',
        speakerId: 'speaker',
        start: 12,
        end: 20,
        paragraphs: ['I will send the revised proposal before then.'],
      },
    ],
    speaker_names: {},
    intelligence,
    ...overrides,
  };
}

/** A silent mono WAV the browser can play as the meeting recording. */
export function silentWav(seconds = 30, rate = 8000) {
  const data = Buffer.alloc(seconds * rate, 128);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export type ApiState = {
  signedIn: boolean;
  meetings: UploadedMeeting[];
  moments: PersistedMoment[];
  meetingShares: Map<string, string>;
  calls: { method: string; path: string; body: unknown }[];
};

const token = () =>
  crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

async function handle(route: Route, state: ApiState, signedInHere: boolean) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();
  let body: unknown;
  try {
    body = request.postDataJSON();
  } catch {
    body = null;
  }
  state.calls.push({ method, path, body });
  const send = (json: unknown, status = 200) => route.fulfill({ json, status });
  // Serve byte ranges like the Worker does, so the player can seek.
  const media = () => {
    const file = silentWav();
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers().range ?? '');
    if (!range)
      return route.fulfill({
        body: file,
        contentType: 'audio/wav',
        headers: { 'Accept-Ranges': 'bytes' },
      });
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), file.length - 1) : file.length - 1;
    return route.fulfill({
      status: 206,
      body: file.subarray(start, end + 1),
      contentType: 'audio/wav',
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${file.length}`,
      },
    });
  };
  const signedIn = signedInHere && state.signedIn;

  if (path === '/api/auth/session') return send({ user: signedIn ? user : null });
  if (path === '/api/auth/logout') {
    state.signedIn = false;
    return send({ signedOut: true });
  }
  if (
    ['/api/auth/login', '/api/auth/signup', '/api/auth/complete', '/api/auth/recovery'].includes(
      path,
    )
  ) {
    state.signedIn = true;
    return send({ user });
  }
  if (path === '/api/auth/recover') return send({ sent: true });
  if (path === '/api/auth/password') return send({ updated: true });
  if (path === '/api/auth/delete-account') {
    state.signedIn = false;
    state.meetings = [];
    return send({ deleted: true });
  }

  const shared = /^\/api\/shares\/([a-f0-9]{64})(\/media)?$/.exec(path);
  if (shared) {
    const id = [...state.meetingShares].find(([, value]) => value === shared[1])?.[0];
    const found = state.meetings.find((item) => item.id === id);
    if (!found) return send({ message: 'This shared meeting is unavailable.' }, 404);
    if (shared[2]) return media();
    return send({
      title: found.title,
      description: found.intelligence?.templates[0].overview ?? '',
      duration: found.duration_seconds,
      mediaUrl: `${path}/media`,
      mediaType: found.media_type,
      speakers: [{ id: 'speaker', name: found.speaker_names.speaker || 'Speaker' }],
      segments: found.transcript ?? [],
      intelligence: found.intelligence,
    });
  }
  const sharedMoment = /^\/api\/moments\/([a-f0-9]{64})(\/media)?$/.exec(path);
  if (sharedMoment) {
    const moment = state.moments.find((item) =>
      item.sharePath?.endsWith(sharedMoment[1]),
    );
    const found = state.meetings.find((item) => item.id === moment?.meetingId);
    if (!moment || !found)
      return send({ message: 'This shared moment is no longer available.' }, 404);
    if (sharedMoment[2]) return media();
    return send({
      recording: {
        title: found.title,
        description: found.intelligence?.templates[0].overview ?? '',
        duration: found.duration_seconds,
        mediaUrl: `${path}/media`,
        mediaType: found.media_type,
        speakers: [{ id: 'speaker', name: found.speaker_names.speaker || 'Speaker' }],
        segments: found.transcript ?? [],
        intelligence: found.intelligence,
      },
      moment,
    });
  }

  if (!signedIn) return send({ message: 'Sign in to continue.' }, 401);
  if (path === '/api/search') {
    const query = url.searchParams.get('q') ?? '';
    const complete = state.meetings.filter((item) => item.status === 'complete');
    return send(
      searchMeetingLibrary(
        complete.map((item) => ({
          id: item.id,
          title: item.title,
          date: item.created_at,
          duration: Math.ceil(item.duration_seconds),
          participants: ['Speaker'],
          summary: item.intelligence?.templates[0].overview ?? '',
        })),
        complete.map((item) => ({
          meetingId: item.id,
          transcript: (item.transcript ?? []).map((segment) => ({
            id: segment.id,
            speaker: 'Speaker',
            start: segment.start,
            text: segment.paragraphs.join(' '),
          })),
        })),
        query,
      ),
    );
  }
  if (path === '/api/uploads' && method === 'POST') {
    const input = body as {
      title: string;
      contentType: string;
      size: number;
      duration: number;
    };
    const created = meeting({
      id: crypto.randomUUID(),
      title: input.title,
      media_type: input.contentType,
      media_size: input.size,
      duration_seconds: input.duration,
      status: 'uploading',
      processing_progress: 0,
      transcript: null,
      intelligence: null,
      created_at: new Date().toISOString(),
    });
    state.meetings.unshift(created);
    return send(created, 201);
  }
  if (path === '/api/uploads' && method === 'GET')
    return send(
      state.meetings.map((item) => ({ ...item, transcript: null, intelligence: null })),
    );
  const match =
    /^\/api\/uploads\/([0-9a-f-]{36})(?:\/([a-z-]+)(?:\/([0-9a-f-]{36})(?:\/(share))?)?)?$/.exec(
      path,
    );
  const found = match && state.meetings.find((item) => item.id === match[1]);
  if (!match || !found) return send({ message: 'This recording could not be found.' }, 404);
  const [, id, action, momentId, momentAction] = match;
  if (!action && method === 'GET') return send(found);
  if (!action && method === 'DELETE') {
    state.meetings = state.meetings.filter((item) => item.id !== id);
    return send({ deleted: true });
  }
  if (action === 'media') return media();
  if (action === 'upload-url')
    return send({ url: `https://storage.example/staging/${id}/media?signature=test` });
  if (action === 'process') {
    Object.assign(found, {
      status: 'transcribing',
      processing_progress: 35,
      processing_error: null,
    });
    return send(found, 202);
  }
  if (action === 'speakers') {
    const input = body as { speakerId: string; name: string };
    found.speaker_names = { ...found.speaker_names, [input.speakerId]: input.name };
    return send(found);
  }
  if (action === 'share') {
    if (method === 'POST' && !state.meetingShares.has(id))
      state.meetingShares.set(id, token());
    if (method === 'DELETE') state.meetingShares.delete(id);
    const value = state.meetingShares.get(id);
    return send({ path: value ? `/share/meeting-${value}` : null }, method === 'POST' ? 201 : 200);
  }
  if (action === 'moments') {
    if (!momentId && method === 'GET')
      return send(state.moments.filter((item) => item.meetingId === id));
    if (!momentId && method === 'POST') {
      const saved = body as PersistedMoment;
      state.moments.push(saved);
      return send(saved, 201);
    }
    const moment = state.moments.find((item) => item.id === momentId);
    if (!moment) return send({ message: 'Moment not found.' }, 404);
    if (!momentAction && method === 'DELETE') {
      state.moments = state.moments.filter((item) => item !== moment);
      return send({ deleted: true });
    }
    if (momentAction === 'share') {
      if (method === 'POST') moment.sharePath ??= `/share/moment-${token()}`;
      else delete moment.sharePath;
      return send(moment);
    }
  }
  return send({ message: 'Method not allowed.' }, 405);
}

export const test = base.extend<{ signedIn: boolean; api: ApiState }>({
  signedIn: [true, { option: true }],
  api: [
    async ({ context, browser, signedIn }, runFixture) => {
      const state: ApiState = {
        signedIn,
        meetings: [meeting()],
        moments: [],
        meetingShares: new Map(),
        calls: [],
      };
      const install = (ctx: BrowserContext, own: boolean) =>
        ctx.route('**/api/**', (route) => handle(route, state, own));
      await install(context, true);
      // Extra contexts stand in for other people's browsers: never signed in.
      const original = browser.newContext.bind(browser);
      browser.newContext = async (...args) => {
        const ctx = await original(...args);
        await install(ctx, false);
        return ctx;
      };
      try {
        await runFixture(state);
      } finally {
        browser.newContext = original;
      }
    },
    { auto: true },
  ],
});

/** True when nothing on the page scrolls sideways. */
export async function fitsViewport(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}
