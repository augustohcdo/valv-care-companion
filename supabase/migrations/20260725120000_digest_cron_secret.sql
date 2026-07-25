
-- Seed the cron secret for weekly-digest, mirroring export_cron_secret.
insert into public.internal_secrets (key, value)
values ('digest_cron_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Schedule weekly-digest via pg_cron using the stored secret, same pattern as weekly-export.
select cron.unschedule('valvepath-weekly-digest')
where exists (select 1 from cron.job where jobname = 'valvepath-weekly-digest');

select cron.schedule(
  'valvepath-weekly-digest',
  '0 4 * * 1',
  $$
  select net.http_post(
    url := 'https://bjgzychcgaeyhfjvlsip.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'digest_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  );
  $$
);
