-- Agenda o vigia das tarefas.
--
-- Diário, não semanal: vigiar semanalmente uma tarefa semanal detectaria a
-- falha até sete dias depois — tempo suficiente para o próximo backup também
-- não acontecer. Diário detecta em um dia.
--
-- 05:00 UTC fica depois do backup (03:15) e do resumo (04:00) de segunda, então
-- na segunda ele já avalia o resultado das duas no mesmo ciclo.
--
-- A URL é montada a partir de `internal_secrets`, como as outras duas: é o
-- único lugar a mudar se o projeto Supabase for migrado de novo.

select cron.unschedule('valvepath-job-watchdog')
where exists (select 1 from cron.job where jobname = 'valvepath-job-watchdog');

select cron.schedule(
  'valvepath-job-watchdog',
  '0 5 * * *',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/job-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'export_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  );
  $$
);
