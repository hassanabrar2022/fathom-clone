-- Private uploads are distinct from the deliberately public showcase fixtures.
-- Only the server's service role may access this table. The API must additionally
-- scope every operation to a SHA-256 digest of the opaque HttpOnly guest cookie.
begin;

create table public.uploaded_meetings (
  id uuid primary key default gen_random_uuid(),
  owner_hash text not null check (owner_hash ~ '^[a-f0-9]{64}$'),
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
  -- A lease prevents concurrent retry requests from duplicating model work.
  processing_started_at timestamptz,
  processing_lease uuid,
  processing_attempts integer not null default 0 check (processing_attempts between 0 and 3),
  media_uploaded_at timestamptz,
  transcript jsonb check (jsonb_typeof(transcript) = 'array'),
  intelligence jsonb check (jsonb_typeof(intelligence) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'complete' or transcript is not null),
  check (status <> 'analyzing' or transcript is not null),
  check (status <> 'failed' or processing_error is not null)
);

create index uploaded_meetings_owner_created
  on public.uploaded_meetings (owner_hash, created_at desc);

alter table public.uploaded_meetings enable row level security;
revoke all on public.uploaded_meetings from anon, authenticated;
grant select, insert, update, delete on public.uploaded_meetings to service_role;
-- Deliberately no public RLS policy: uploaded media/transcripts are never public
-- fixtures, and direct browser access to Supabase is prohibited.

create function public.reserve_upload(p_owner text, p_title text, p_filename text,
  p_type text, p_size bigint, p_duration double precision)
returns setof public.uploaded_meetings language plpgsql security definer
set search_path = public as $$
declare new_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(873241);
  if (select count(*) from uploaded_meetings) >= 100
    or (select count(*) from uploaded_meetings where created_at > now() - interval '1 day') >= 20
    or (select count(*) from uploaded_meetings where owner_hash = p_owner
      and created_at > now() - interval '1 day') >= 3 then
    raise exception 'upload_quota_reached';
  end if;
  return query insert into uploaded_meetings
    (id, owner_hash, title, original_filename, media_type, storage_key, media_size, duration_seconds)
    values (new_id, p_owner, p_title, p_filename, p_type, 'uploads/' || new_id::text,
      p_size, p_duration) returning *;
end;
$$;
revoke all on function public.reserve_upload(text, text, text, text, bigint, double precision) from public, anon, authenticated;
grant execute on function public.reserve_upload(text, text, text, text, bigint, double precision) to service_role;

commit;
