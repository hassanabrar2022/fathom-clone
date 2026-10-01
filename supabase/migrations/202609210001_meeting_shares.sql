-- A meeting owner may explicitly publish one revocable, unguessable link.
-- Browser roles cannot read either the link or the private meeting directly.
begin;

create table public.uploaded_meeting_shares (
  meeting_id uuid primary key references public.uploaded_meetings(id) on delete cascade,
  token text not null unique check (token ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.uploaded_meeting_shares enable row level security;
revoke all on public.uploaded_meeting_shares from anon, authenticated;
grant select, insert, update, delete on public.uploaded_meeting_shares to service_role;

commit;
