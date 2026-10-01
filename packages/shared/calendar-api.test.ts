import { afterEach, describe, expect, it, vi } from 'vitest';
import { ingestionApi } from '../../apps/worker/src/ingestion';
import { verifiedUserHeader } from '../../apps/worker/src/database';
import { APP, apiRequest, createBackend, userA } from '../../tests/support/backend';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const soon = new Date(Date.now() + 3 * 3600000);
const later = new Date(soon.getTime() + 1800000);
const events = [
  {
    id: 'evtmeet',
    summary: 'Launch review',
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    start: { dateTime: soon.toISOString() },
    end: { dateTime: later.toISOString() },
    attendees: [{ self: true, responseStatus: 'accepted' }, {}, {}],
  },
  {
    id: 'evtzoom',
    summary: 'Customer call',
    location: 'https://acme.zoom.us/j/123456789',
    start: { dateTime: soon.toISOString() },
    end: { dateTime: later.toISOString() },
  },
  {
    id: 'evtdeclined',
    summary: 'Declined',
    hangoutLink: 'https://meet.google.com/zzz-zzzz-zzz',
    start: { dateTime: soon.toISOString() },
    end: { dateTime: later.toISOString() },
    attendees: [{ self: true, responseStatus: 'declined' }],
  },
];

function setup() {
  const google: { url: string; body?: string }[] = [];
  const backend = createBackend({
    external: async (request) => {
      const url = new URL(request.url);
      google.push({ url: request.url, body: request.method === 'POST' ? await request.clone().text() : undefined });
      if (url.href === 'https://oauth2.googleapis.com/token') {
        const form = new URLSearchParams(await request.text());
        if (form.get('code') === 'bad') return Response.json({ error: 'invalid_grant' }, { status: 400 });
        const claims = btoa(JSON.stringify({ email: 'ada@calendar.example' }));
        return Response.json({
          access_token: 'google-access',
          refresh_token: 'google-refresh',
          expires_in: 3600,
          id_token: `x.${claims}.y`,
        });
      }
      if (url.pathname === '/calendar/v3/calendars/primary/events')
        return Response.json({ items: events });
      const single = /\/calendar\/v3\/calendars\/primary\/events\/(.+)$/.exec(url.pathname);
      if (single) {
        const event = events.find((item) => item.id === single[1]);
        return event ? Response.json(event) : new Response(null, { status: 404 });
      }
      if (url.hostname.endsWith('.recall.ai'))
        return Response.json({ id: 'bot-1', status_changes: [], recordings: [] }, { status: 201 });
      throw new Error(`Unexpected ${request.url}`);
    },
  });
  vi.stubGlobal('fetch', backend.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const env = {
    ...backend.env,
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    TOKEN_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
    RECALL_API_KEY: 'recall-key',
  };
  return { backend, env, google };
}
function as(path: string, init: Parameters<typeof apiRequest>[1] = {}) {
  return apiRequest(path, {
    ...init,
    headers: { ...init.headers, [verifiedUserHeader]: userA.id },
  });
}

async function connect(env: ReturnType<typeof setup>['env'], code = 'good') {
  const start = await ingestionApi(as('/api/calendar/connect'), env);
  const consent = new URL(start.headers.get('Location')!);
  const cookie = start.headers.get('Set-Cookie')!.split(';')[0];
  return ingestionApi(
    as(`/api/calendar/callback?code=${code}&state=${consent.searchParams.get('state')}`, {
      headers: { Cookie: cookie },
    }),
    env,
  );
}

describe('Google Calendar', () => {
  it('asks Google for offline, read-only calendar access', async () => {
    const { env } = setup();
    const response = await ingestionApi(as('/api/calendar/connect'), env);
    expect(response.status).toBe(302);
    const consent = new URL(response.headers.get('Location')!);
    expect(consent.origin).toBe('https://accounts.google.com');
    expect(consent.searchParams.get('redirect_uri')).toBe(`${APP}/api/calendar/callback`);
    expect(consent.searchParams.get('scope')).toContain('calendar.events.readonly');
    expect(consent.searchParams.get('access_type')).toBe('offline');
    expect(response.headers.get('Set-Cookie')).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });

  it('rejects a callback whose state does not match this user’s sign-in', async () => {
    const { env, backend } = setup();
    const response = await ingestionApi(
      as('/api/calendar/callback?code=good&state=forged', {
        headers: { Cookie: '__Host-fathom-clone-oauth=other.aaaa' },
      }),
      env,
    );
    expect(response.headers.get('Location')).toBe('/app/record?calendar=expired');
    expect(backend.tables.calendar_connections).toHaveLength(0);
  });

  it('stores only encrypted tokens and lists meetings with video links', async () => {
    const { env, backend } = setup();
    const callback = await connect(env);
    expect(callback.headers.get('Location')).toBe('/app/record?calendar=connected');
    const stored = backend.tables.calendar_connections[0];
    expect(stored).toMatchObject({ user_id: userA.id, email: 'ada@calendar.example' });
    expect(JSON.stringify(stored)).not.toContain('google-refresh');
    expect(JSON.stringify(stored)).not.toContain('google-access');

    const state = (await (await ingestionApi(as('/api/calendar'), env)).json()) as {
      connected: boolean;
      events: { id: string; platform: string; meetingUrl: string; attendees: number }[];
    };
    expect(state.connected).toBe(true);
    expect(state.events.map((event) => [event.id, event.platform, event.attendees])).toEqual([
      ['evtmeet', 'google_meet', 3],
      ['evtzoom', 'zoom', 1],
    ]);
  });

  it('turns the notetaker on for one event, scheduled a minute before it starts', async () => {
    const { env, backend, google } = setup();
    await connect(env);
    const response = await ingestionApi(
      as('/api/calendar/events/evtmeet/notetaker', { method: 'POST', body: { enabled: true } }),
      env,
    );
    expect(response.status).toBe(201);
    expect(backend.tables.notetakers[0]).toMatchObject({
      calendar_event_id: 'evtmeet',
      title: 'Launch review',
      status: 'scheduled',
      join_at: new Date(soon.getTime() - 60000).toISOString(),
    });
    const bot = google.find((call) => call.url.includes('.recall.ai/'));
    expect(JSON.parse(bot!.body!)).toMatchObject({
      meeting_url: 'https://meet.google.com/abc-defg-hij',
      join_at: new Date(soon.getTime() - 60000).toISOString(),
    });
    // Turning it on twice keeps one notetaker.
    await ingestionApi(
      as('/api/calendar/events/evtmeet/notetaker', { method: 'POST', body: { enabled: true } }),
      env,
    );
    expect(backend.tables.notetakers).toHaveLength(1);
  });

  it('reports a failed code exchange without storing anything', async () => {
    const { env, backend } = setup();
    const response = await connect(env, 'bad');
    expect(response.headers.get('Location')).toBe('/app/record?calendar=failed');
    expect(backend.tables.calendar_connections).toHaveLength(0);
  });
});
