-- Meeting capture: a notetaker (Recall.ai bot or this-browser capture) that
-- records a live call, mid-call highlights, and Google Calendar connections.
-- Like every other table, these are reachable only by the Worker's service role.
begin;

-- Recorded calls run far past the upload limits; uploads still enforce theirs
-- in the API. Browser captures keep their transcription audio as short parts.
alter table public.meetings
  drop constraint if exists meetings_media_size_check,
  drop constraint if exists meetings_duration_seconds_check,
  add constraint meetings_media_size_check
    check (media_size > 0 and media_size <= 4294967296),
  add constraint meetings_duration_seconds_check
    check (duration_seconds > 0 and duration_seconds <= 14400),
  add column source text not null default 'upload'
    check (source in ('upload', 'notetaker', 'browser')),
  add column audio_parts jsonb
    check (audio_parts is null or jsonb_typeof(audio_parts) = 'array'),
  add column transcribed_parts integer not null default 0
    check (transcribed_parts >= 0);

create table public.notetakers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  provider text not null check (provider in ('recall', 'browser')),
  external_id text unique,
  meeting_url text check (char_length(meeting_url) <= 500),
  platform text not null default 'other'
    check (platform in ('google_meet', 'zoom', 'teams', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  calendar_event_id text check (char_length(calendar_event_id) <= 1024),
  join_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in (
    'scheduled', 'joining', 'waiting_room', 'recording', 'processing',
    'complete', 'failed', 'cancelled'
  )),
  status_detail text check (char_length(status_detail) <= 200),
  recording_started_at timestamptz,
  ended_at timestamptz,
  -- Mid-call highlights: [{ id, at (ISO time), note }]. Converted to saved
  -- moments once the recording's own start time is known.
  highlights jsonb not null default '[]'::jsonb
    check (jsonb_typeof(highlights) = 'array'),
  -- Browser capture parts: [{ index, key, start, duration, size }].
  parts jsonb not null default '[]'::jsonb check (jsonb_typeof(parts) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notetakers_user_join on public.notetakers (user_id, join_at desc);
-- One notetaker per calendar event, so a re-sync never sends two bots.
create unique index notetakers_user_event on public.notetakers (user_id, calendar_event_id)
  where calendar_event_id is not null;

create table public.calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  email text not null check (char_length(email) <= 254),
  -- AES-GCM ciphertexts (TOKEN_ENCRYPTION_KEY); never stored in plain text.
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  auto_record boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notetakers enable row level security;
alter table public.calendar_connections enable row level security;
revoke all on public.notetakers, public.calendar_connections from anon, authenticated;
grant select, insert, update, delete
  on public.notetakers, public.calendar_connections to service_role;

commit;
