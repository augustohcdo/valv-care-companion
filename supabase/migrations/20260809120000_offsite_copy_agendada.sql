-- A cópia externa do backup entra no mesmo trilho das outras tarefas agendadas.
--
-- O backup semanal já é conferido contra manifesto e já foi ensaiado numa
-- restauração real — mas mora dentro do projeto que ele protege. Esta tarefa
-- espelha a pasta mais recente num provedor S3-compatível fora do Supabase.
--
-- Nasce **inerte**: sem as variáveis `OFFSITE_*` configuradas nos segredos do
-- projeto, a função registra a execução com o motivo e não finge ter copiado.
-- Mesmo desenho do alerta por e-mail e do captcha, que ficaram prontos e
-- desligados até a chave existir.

-- Segunda-feira 03:45 UTC: depois do `weekly-export` (03:15), com folga
-- suficiente para a pasta do dia já existir.
select cron.unschedule('valvepath-offsite-copy')
where exists (select 1 from cron.job where jobname = 'valvepath-offsite-copy');

select cron.schedule(
  'valvepath-offsite-copy',
  '45 3 * * 1',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/offsite-copy',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'export_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 120000
  );
  $$
);

-- E entra na lista do vigia diário. Esta é a parte que impede a cópia externa de
-- repetir a história do backup: uma tarefa que ninguém cobra pode passar meses
-- sem rodar, e só se descobre no dia em que ela era a única coisa que importava.
-- 8 dias, como as outras semanais: um dia de folga sobre o ciclo.
--
-- Entra **desabilitada**, e isso é parte do desenho, não esquecimento: enquanto
-- não há credencial, cobrar sinal de vida faria o vigia mandar e-mail todo dia
-- sobre um recurso que ainda não foi ligado — e alarme que toca sem motivo é o
-- caminho mais curto para ninguém mais olhar alarme nenhum. Ligar esta linha é
-- o último passo da configuração, junto com gravar os segredos `OFFSITE_*`.
insert into public.watched_jobs (job, label, stale_after_days, enabled)
values ('offsite-copy', 'Cópia externa do backup', 8, false)
on conflict (job) do update set
  label = excluded.label,
  stale_after_days = excluded.stale_after_days;
