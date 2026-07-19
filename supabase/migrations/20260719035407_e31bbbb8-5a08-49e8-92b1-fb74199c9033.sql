
-- Private table: no grants to anon/authenticated. Only service_role reads.
create table if not exists public.internal_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.internal_secrets from public, anon, authenticated;
grant all on public.internal_secrets to service_role;

alter table public.internal_secrets enable row level security;
-- No policies = fully locked to non-service_role via PostgREST.

-- Seed the cron secret if missing.
insert into public.internal_secrets (key, value)
values ('export_cron_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Re-schedule using the stored secret. pg_cron runs as postgres, which can read the table directly.
select cron.unschedule('valvepath-weekly-export')
where exists (select 1 from cron.job where jobname = 'valvepath-weekly-export');

select cron.schedule(
  'valvepath-weekly-export',
  '15 3 * * 1',
  $$
  select net.http_post(
    url := 'https://bjgzychcgaeyhfjvlsip.supabase.co/functions/v1/weekly-export',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'export_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  );
  $$
);
