-- Editable speaker labels are separate from the timestamped transcript.
begin;

alter table public.uploaded_meetings
  add column speaker_names jsonb not null default '{}'::jsonb
  check (jsonb_typeof(speaker_names) = 'object');

commit;
