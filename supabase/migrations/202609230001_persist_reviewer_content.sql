begin;
-- Explicitly public, permissioned/synthetic reviewer content, stored in the same
-- Supabase database and served by the same server-only REST data layer as uploads.
create table if not exists public.reviewer_meetings (
 id text primary key check (id ~ '^[a-z0-9-]+$'),
 metadata jsonb not null,
 recording jsonb,
 search_document jsonb not null
);
create table if not exists public.reviewer_meeting_shares (
 meeting_id text primary key references public.reviewer_meetings(id) on delete cascade,
 token text not null unique default encode(gen_random_bytes(32), 'hex'),
 enabled boolean not null default true
);
create table if not exists public.meeting_moments (
 id text primary key,
 meeting_key text not null,
 owner_hash text check (owner_hash ~ '^[a-f0-9]{64}$'),
 data jsonb not null,
 share_token text unique check (share_token ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
create index if not exists meeting_moments_owner on public.meeting_moments(meeting_key, owner_hash);
create table if not exists public.reviewer_speaker_names (
 meeting_id text not null references public.reviewer_meetings(id) on delete cascade,
 owner_hash text not null check (owner_hash ~ '^[a-f0-9]{64}$'),
 names jsonb not null default '{}',
 primary key(meeting_id, owner_hash)
);
-- Private moments have the same lifetime as their owning recording.
create or replace function public.cleanup_meeting_moments() returns trigger
language plpgsql set search_path = public as $$
begin
 delete from meeting_moments where meeting_key = old.id::text;
 return old;
end;
$$;
drop trigger if exists clean_upload_moments on public.uploaded_meetings;
create trigger clean_upload_moments after delete on public.uploaded_meetings
 for each row execute function public.cleanup_meeting_moments();
drop trigger if exists clean_reviewer_moments on public.reviewer_meetings;
create trigger clean_reviewer_moments after delete on public.reviewer_meetings
 for each row execute function public.cleanup_meeting_moments();
alter table public.reviewer_meetings enable row level security;
alter table public.reviewer_meeting_shares enable row level security;
alter table public.meeting_moments enable row level security;
alter table public.reviewer_speaker_names enable row level security;
revoke all on public.reviewer_meetings, public.reviewer_meeting_shares, public.meeting_moments, public.reviewer_speaker_names from anon, authenticated;
grant select, insert, update, delete on public.reviewer_meetings, public.reviewer_meeting_shares, public.meeting_moments, public.reviewer_speaker_names to service_role;
commit;
