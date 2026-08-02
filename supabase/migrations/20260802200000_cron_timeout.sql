-- O `net.http_post` desiste de esperar em 5 segundos, e o backup leva mais.
--
-- Testei o elo `pg_cron -> pg_net -> edge function` executando o texto literal
-- guardado em `cron.job`, antes do primeiro disparo automático do projeto. O
-- resumo passou (200). O backup registrou
-- `Timeout of 5000 ms reached` em `net._http_response` — e mesmo assim
-- concluiu: 37 tabelas, zero falhas. O edge function continua rodando depois
-- que o pg_net larga a conexão.
--
-- Ou seja, o backup funciona, mas deixa para trás um erro que não aconteceu.
-- Isso é pior do que parece: quem for investigar a saúde do agendamento vai
-- encontrar "Timeout" e concluir que o backup está quebrado — ou, pior, vai se
-- acostumar a ver esse erro e ignorar o dia em que ele for de verdade. Um
-- alarme que mente é a origem de metade dos problemas que esta base já teve.
--
-- O tempo passa a caber na resposta. O backup leva ~5s hoje com pouco dado, e
-- cresce com o volume; 120s dá folga larga sem prender conexão indefinidamente.

select cron.unschedule('valvepath-weekly-export')
where exists (select 1 from cron.job where jobname = 'valvepath-weekly-export');

select cron.schedule(
  'valvepath-weekly-export',
  '15 3 * * 1',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/weekly-export',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'export_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 120000
  );
  $$
);

-- O resumo percorre todos os médicos e cresce com a base; hoje responde rápido,
-- mas o motivo de dar folga é o mesmo.
select cron.unschedule('valvepath-weekly-digest')
where exists (select 1 from cron.job where jobname = 'valvepath-weekly-digest');

select cron.schedule(
  'valvepath-weekly-digest',
  '0 4 * * 1',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'digest_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 60000
  );
  $$
);

-- O vigia faz duas consultas por tarefa vigiada; cresce com a lista.
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
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 60000
  );
  $$
);
