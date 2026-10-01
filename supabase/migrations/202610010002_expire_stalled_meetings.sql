-- Meetings that stop making progress are marked failed so their owner can retry.
--   * processing that has written nothing for 45 minutes (a run that died
--     without recording its failure; workflow steps retry well within that)
--   * uploads whose file never arrived within a day (the browser closed
--     mid-transfer; storage already expires the partial file)
-- Clearing the lease also stops any straggling run from writing.
begin;

create extension if not exists pg_cron;

create function public.expire_stalled_meetings() returns void
language sql security definer set search_path = public as $$
  update meetings
     set status = 'failed',
         processing_error = 'processing_timeout',
         processing_lease = null,
         updated_at = now()
   where status in ('transcribing', 'analyzing')
     and updated_at < now() - interval '45 minutes';
  update meetings
     set status = 'failed',
         processing_error = 'upload_failed',
         updated_at = now()
   where status = 'uploading'
     and media_uploaded_at is null
     and created_at < now() - interval '1 day';
$$;
revoke all on function public.expire_stalled_meetings() from public, anon, authenticated;

select cron.schedule(
  'expire-stalled-meetings',
  '*/15 * * * *',
  'select public.expire_stalled_meetings()'
);

commit;
