/**
 * Google Calendar: OAuth connection, upcoming meetings with their notetaker
 * state, per-event notetaker toggles, and the auto-record sweep that the cron
 * trigger runs. Tokens are encrypted at rest (tokens.ts) and never reach the
 * browser.
 */
import { z } from 'zod';
import { ApiError, db, json } from './database';
import type { IngestionEnv } from './ingestion';
import {
  botEnabled,
  cancelNotetaker,
  createNotetaker,
  notetakerOutput,
  notetakerRowSchema,
  type NotetakerRow,
} from './capture';
import { seal, unseal } from './tokens';
import {
  activeNotetakerStatuses,
  calendarStateSchema,
  findMeetingLink,
  meetingPlatform,
} from '../../../packages/shared/notetaker';

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];
const stateCookie = '__Host-fathom-clone-oauth';
const connectionSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string(),
  refresh_token: z.string(),
  access_token: z.string().nullable(),
  access_token_expires_at: z.string().nullable(),
  auto_record: z.boolean(),
});
type Connection = z.infer<typeof connectionSchema>;

const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
});
const googleEventSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  hangoutLink: z.string().optional(),
  start: z.object({ dateTime: z.string().optional(), date: z.string().optional() }),
  end: z.object({ dateTime: z.string().optional(), date: z.string().optional() }),
  attendees: z
    .array(z.object({ self: z.boolean().optional(), responseStatus: z.string().optional() }))
    .optional(),
  conferenceData: z
    .object({
      entryPoints: z
        .array(z.object({ entryPointType: z.string().optional(), uri: z.string().optional() }))
        .optional(),
    })
    .optional(),
});
type GoogleEvent = z.infer<typeof googleEventSchema>;

export function calendarEnabled(env: IngestionEnv) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.TOKEN_ENCRYPTION_KEY);
}
function requireCalendar(env: IngestionEnv) {
  if (!calendarEnabled(env))
    throw new ApiError(503, 'Google Calendar is not set up on this server yet.');
}
function redirectUri(request: Request) {
  return `${new URL(request.url).origin}/api/calendar/callback`;
}
function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}
function cookie(request: Request, name: string) {
  return request.headers
    .get('Cookie')
    ?.match(new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9._-]+)(?:;|$)`))?.[1];
}

async function googleToken(env: IngestionEnv, form: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      ...form,
    }),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new GoogleAuthError(problem?.error ?? `status ${response.status}`);
  }
  return tokenSchema.parse(await response.json());
}
class GoogleAuthError extends Error {}

async function getConnection(env: IngestionEnv, userId: string) {
  const rows = connectionSchema
    .array()
    .parse(await db(env, `calendar_connections?user_id=eq.${userId}&limit=1`));
  return rows[0] ?? null;
}

async function accessToken(env: IngestionEnv, connection: Connection) {
  const expires = Date.parse(connection.access_token_expires_at ?? '');
  if (connection.access_token && expires - Date.now() > 60000)
    return unseal(env, connection.access_token);
  let token: z.infer<typeof tokenSchema>;
  try {
    token = await googleToken(env, {
      grant_type: 'refresh_token',
      refresh_token: await unseal(env, connection.refresh_token),
    });
  } catch (error) {
    if (error instanceof GoogleAuthError)
      throw new ApiError(
        409,
        'Google Calendar access has expired. Disconnect and connect your calendar again.',
      );
    throw error;
  }
  await db(env, `calendar_connections?user_id=eq.${connection.user_id}`, 'PATCH', {
    access_token: await seal(env, token.access_token),
    access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  return token.access_token;
}

async function google(env: IngestionEnv, connection: Connection, path: string) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${await accessToken(env, connection)}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    console.error('Google Calendar request failed', { status: response.status });
    throw new ApiError(502, 'Google Calendar did not respond. Please retry.');
  }
  return (await response.json()) as unknown;
}

function eventLink(event: GoogleEvent) {
  const video = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video' && entry.uri && meetingPlatform(entry.uri),
  )?.uri;
  return (
    (event.hangoutLink && meetingPlatform(event.hangoutLink) ? event.hangoutLink : null) ??
    video ??
    findMeetingLink(event.location, event.description)
  );
}

function eventTimes(event: GoogleEvent) {
  return {
    start: event.start.dateTime ?? event.start.date ?? '',
    end: event.end.dateTime ?? event.end.date ?? '',
  };
}

async function upcomingEvents(
  env: IngestionEnv,
  connection: Connection,
  from: Date,
  to: Date,
) {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const result = z
    .object({ items: z.array(googleEventSchema).default([]) })
    .parse(await google(env, connection, `calendars/primary/events?${params}`));
  return result.items.filter(
    (event) =>
      event.status !== 'cancelled' &&
      event.start.dateTime &&
      !event.attendees?.some((attendee) => attendee.self && attendee.responseStatus === 'declined'),
  );
}

async function eventNotetakers(env: IngestionEnv, userId: string) {
  const rows = notetakerRowSchema
    .array()
    .parse(
      await db(
        env,
        `notetakers?user_id=eq.${userId}&calendar_event_id=not.is.null&join_at=gte.${new Date(Date.now() - 86400000).toISOString()}&limit=200`,
      ),
    );
  return new Map(rows.map((row) => [row.calendar_event_id!, row]));
}

async function scheduleForEvent(
  env: IngestionEnv,
  userId: string,
  event: GoogleEvent,
  existing: NotetakerRow | undefined,
) {
  const link = eventLink(event);
  if (!link) throw new ApiError(409, 'This event has no Google Meet, Zoom, or Teams link.');
  if (existing && activeNotetakerStatuses.includes(existing.status)) return existing;
  if (existing?.meeting_id)
    throw new ApiError(409, 'This event has already been recorded.');
  if (existing) await db(env, `notetakers?id=eq.${existing.id}&user_id=eq.${userId}`, 'DELETE');
  const { start } = eventTimes(event);
  return createNotetaker(env, userId, {
    provider: 'recall',
    title: (event.summary || 'Untitled meeting').slice(0, 120),
    meetingUrl: link,
    joinAt: new Date(Date.parse(start) - 60000).toISOString(),
    calendarEventId: event.id,
  });
}

/** /api/calendar routes for the signed-in user; null for other routes. */
export async function calendarApi(request: Request, env: IngestionEnv, userId: string) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/calendar')) return null;

  if (url.pathname === '/api/calendar/connect' && request.method === 'GET') {
    requireCalendar(env);
    const state = [...crypto.getRandomValues(new Uint8Array(24))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    consent.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri(request),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    }).toString();
    return redirect(consent.toString(), [
      `${stateCookie}=${state}.${userId.replace(/-/g, '')}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    ]);
  }

  if (url.pathname === '/api/calendar/callback' && request.method === 'GET') {
    const clear = `${stateCookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
    const back = (result: string) => redirect(`/app/record?${result}`, [clear]);
    const saved = cookie(request, stateCookie)?.split('.');
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error')) return back('calendar=denied');
    if (
      !saved ||
      saved[0] !== url.searchParams.get('state') ||
      saved[1] !== userId.replace(/-/g, '') ||
      !code
    )
      return back('calendar=expired');
    requireCalendar(env);
    try {
      const token = await googleToken(env, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(request),
      });
      const previous = await getConnection(env, userId);
      const refresh = token.refresh_token
        ? await seal(env, token.refresh_token)
        : previous?.refresh_token;
      if (!refresh) return back('calendar=failed');
      // The ID token came straight from Google's token endpoint over TLS.
      const claims = z
        .object({ email: z.string().email() })
        .safeParse(
          token.id_token
            ? JSON.parse(atob(token.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
            : {},
        );
      const values = {
        email: claims.success ? claims.data.email : 'Google Calendar',
        refresh_token: refresh,
        access_token: await seal(env, token.access_token),
        access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (previous)
        await db(env, `calendar_connections?user_id=eq.${userId}`, 'PATCH', values);
      else await db(env, 'calendar_connections', 'POST', { user_id: userId, ...values });
      return back('calendar=connected');
    } catch (error) {
      console.error('Calendar connection failed', error instanceof Error ? error.message : error);
      return back('calendar=failed');
    }
  }

  if (url.pathname === '/api/calendar' && request.method === 'GET') {
    const connection = calendarEnabled(env) ? await getConnection(env, userId) : null;
    if (!connection)
      return json(calendarStateSchema.parse({ connected: false, email: null, autoRecord: false, events: [] }));
    const now = Date.now();
    const [events, notetakers] = await Promise.all([
      upcomingEvents(env, connection, new Date(now - 3600000), new Date(now + 7 * 86400000)),
      eventNotetakers(env, userId),
    ]);
    return json(
      calendarStateSchema.parse({
        connected: true,
        email: connection.email,
        autoRecord: connection.auto_record,
        events: events
          .filter((event) => Date.parse(eventTimes(event).end) > now)
          .map((event) => {
            const link = eventLink(event);
            const notetaker = notetakers.get(event.id);
            return {
              id: event.id,
              title: event.summary || 'Untitled meeting',
              ...eventTimes(event),
              meetingUrl: link,
              platform: link ? meetingPlatform(link) : null,
              attendees: event.attendees?.length ?? 1,
              notetaker: notetaker ? notetakerOutput(notetaker) : null,
            };
          }),
      }),
    );
  }

  if (url.pathname === '/api/calendar' && request.method === 'PATCH') {
    const input = z
      .object({ autoRecord: z.boolean() })
      .strict()
      .parse(JSON.parse((await request.text()) || '{}'));
    if (input.autoRecord && !botEnabled(env))
      throw new ApiError(409, 'Auto-record needs the notetaker bot, which is not set up on this server.');
    const connection = await getConnection(env, userId);
    if (!connection) throw new ApiError(409, 'Connect Google Calendar first.');
    await db(env, `calendar_connections?user_id=eq.${userId}`, 'PATCH', {
      auto_record: input.autoRecord,
      updated_at: new Date().toISOString(),
    });
    if (input.autoRecord) await autoRecordFor(env, { ...connection, auto_record: true });
    return json({ autoRecord: input.autoRecord });
  }

  if (url.pathname === '/api/calendar' && request.method === 'DELETE') {
    const connection = await getConnection(env, userId);
    if (connection) {
      const token = await unseal(env, connection.refresh_token).catch(() => null);
      if (token)
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
        }).catch(() => null);
      await db(env, `calendar_connections?user_id=eq.${userId}`, 'DELETE');
    }
    return json({ connected: false });
  }

  const toggle = /^\/api\/calendar\/events\/([A-Za-z0-9_-]{1,1024})\/notetaker$/.exec(url.pathname);
  if (toggle && request.method === 'POST') {
    const input = z
      .object({ enabled: z.boolean() })
      .strict()
      .parse(JSON.parse((await request.text()) || '{}'));
    const connection = await getConnection(env, userId);
    if (!connection) throw new ApiError(409, 'Connect Google Calendar first.');
    const existing = (await eventNotetakers(env, userId)).get(toggle[1]);
    if (!input.enabled) {
      if (!existing) return json(null);
      return json(notetakerOutput(await cancelNotetaker(env, existing)));
    }
    const event = googleEventSchema
      .nullable()
      .parse(await google(env, connection, `calendars/primary/events/${encodeURIComponent(toggle[1])}`));
    if (!event || event.status === 'cancelled' || !event.start.dateTime)
      throw new ApiError(404, 'This calendar event could not be found.');
    if (Date.parse(eventTimes(event).end) < Date.now())
      throw new ApiError(409, 'This meeting has already ended.');
    return json(notetakerOutput(await scheduleForEvent(env, userId, event, existing)), 201);
  }

  throw new ApiError(404, 'Not found.');
}

/** Sends notetakers to this user's meetings starting within the next half hour. */
async function autoRecordFor(env: IngestionEnv, connection: Connection) {
  const now = Date.now();
  const [events, notetakers] = await Promise.all([
    upcomingEvents(env, connection, new Date(now - 5 * 60000), new Date(now + 30 * 60000)),
    eventNotetakers(env, connection.user_id),
  ]);
  for (const event of events) {
    // Respect a notetaker the owner cancelled, and meetings already underway.
    if (notetakers.has(event.id) || !eventLink(event)) continue;
    if (Date.parse(eventTimes(event).start) < now - 5 * 60000) continue;
    await scheduleForEvent(env, connection.user_id, event, undefined).catch((error) =>
      console.error('Auto-record failed for an event', error instanceof Error ? error.message : error),
    );
  }
}

/** Cron: the auto-record sweep for every connected calendar that asked for it. */
export async function autoRecordSweep(env: IngestionEnv) {
  if (!calendarEnabled(env) || !botEnabled(env)) return;
  const connections = connectionSchema
    .array()
    .parse(await db(env, 'calendar_connections?auto_record=eq.true&limit=500'));
  for (const connection of connections)
    await autoRecordFor(env, connection).catch((error) =>
      console.error('Auto-record sweep failed', error instanceof Error ? error.message : error),
    );
}
