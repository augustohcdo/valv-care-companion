
-- 1. Extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Storage policies for the private clinical-exports bucket.
--    Only admins can read objects; writes are done via service_role (edge function).
drop policy if exists "Admins can read clinical exports" on storage.objects;
create policy "Admins can read clinical exports"
on storage.objects for select
to authenticated
using (
  bucket_id = 'clinical-exports'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. Schedule: weekly export every Monday 03:15 UTC.
--    Uses vault-less inline call; the cron secret authenticates the request.
select cron.unschedule('valvepath-weekly-export') where exists (
  select 1 from cron.job where jobname = 'valvepath-weekly-export'
);

select cron.schedule(
  'valvepath-weekly-export',
  '15 3 * * 1',
  $$
  select net.http_post(
    url := 'https://bjgzychcgaeyhfjvlsip.supabase.co/functions/v1/weekly-export',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.export_cron_secret', true)
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  );
  $$
);
