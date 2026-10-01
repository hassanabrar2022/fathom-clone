-- Fathom Clone production schema.
--
-- The browser never talks to Supabase directly: every table is reachable only by
-- the server's service role, and the Worker scopes every query to the signed-in
-- user. Rows reference auth.users so deleting an account removes its data.
begin;

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  original_filename text not null check (char_length(original_filename) between 1 and 200),
  media_type text not null check (media_type in (
    'video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg',
    'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm'
  )),
  storage_key text not null unique,
  media_size bigint not null check (media_size > 0 and media_size <= 26214400),
  duration_seconds double precision not null check (duration_seconds > 0 and duration_seconds <= 600),
  status text not null default 'uploading' check (status in (
    'uploading', 'uploaded', 'transcribing', 'analyzing', 'complete', 'failed'
  )),
  processing_progress integer not null default 0 check (processing_progress between 0 and 100),
  processing_error text check (processing_error in (
    'upload_failed', 'transcription_failed', 'analysis_failed', 'processing_timeout'
  )),
  -- A lease prevents concurrent processing runs from duplicating model work.
  processing_started_at timestamptz,
  processing_lease uuid,
  processing_attempts integer not null default 0 check (processing_attempts between 0 and 6),
  media_uploaded_at timestamptz,
  transcript jsonb check (jsonb_typeof(transcript) = 'array'),
  intelligence jsonb check (jsonb_typeof(intelligence) = 'object'),
  speaker_names jsonb not null default '{}'::jsonb check (jsonb_typeof(speaker_names) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'complete' or transcript is not null),
  check (status <> 'analyzing' or transcript is not null),
  check (status <> 'failed' or processing_error is not null)
);
create index meetings_user_created on public.meetings (user_id, created_at desc);
create index meetings_status_updated on public.meetings (status, updated_at);

-- One revocable, unguessable public link per meeting, created only by its owner.
create table public.meeting_shares (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  token text not null unique check (token ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Saved ranges of a meeting. A moment is private until its owner shares it.
create table public.meeting_moments (
  id uuid primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms and end_ms - start_ms <= 60000),
  title text not null check (char_length(title) between 1 and 100),
  note text not null default '' check (char_length(note) <= 280),
  share_token text unique check (share_token ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index meeting_moments_meeting on public.meeting_moments (meeting_id, created_at);
create index meeting_moments_user on public.meeting_moments (user_id);

alter table public.meetings enable row level security;
alter table public.meeting_shares enable row level security;
alter table public.meeting_moments enable row level security;
revoke all on public.meetings, public.meeting_shares, public.meeting_moments
  from anon, authenticated;
grant select, insert, update, delete
  on public.meetings, public.meeting_shares, public.meeting_moments to service_role;

-- Creates an upload row while enforcing per-user allowances atomically.
create function public.reserve_upload(p_user uuid, p_title text, p_filename text,
  p_type text, p_size bigint, p_duration double precision)
returns setof public.meetings language plpgsql security definer
set search_path = public as $$
declare new_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if (select count(*) from meetings where user_id = p_user
      and created_at > now() - interval '1 day') >= 25 then
    raise exception 'daily_upload_limit';
  end if;
  if (select count(*) from meetings where user_id = p_user
      and status in ('uploading', 'uploaded', 'transcribing', 'analyzing')
      -- An upload abandoned mid-transfer stops counting after an hour.
      and (status <> 'uploading' or created_at > now() - interval '1 hour')) >= 5 then
    raise exception 'too_many_in_progress';
  end if;
  return query insert into meetings
    (id, user_id, title, original_filename, media_type, storage_key, media_size, duration_seconds)
    values (new_id, p_user, p_title, p_filename, p_type, 'uploads/' || new_id::text,
      p_size, p_duration) returning *;
end;
$$;
revoke all on function public.reserve_upload(uuid, text, text, text, bigint, double precision)
  from public, anon, authenticated;
grant execute on function public.reserve_upload(uuid, text, text, text, bigint, double precision)
  to service_role;

commit;
