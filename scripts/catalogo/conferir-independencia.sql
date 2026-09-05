-- ===========================================================================
-- VALVEPATH — o banco de produção não fala com o projeto do Lovable (SÓ LEITURA)
-- ===========================================================================
--
-- ## Por que existe
--
-- Quando o banco foi recriado no projeto atual, três migrations de 2026-07
-- reagendaram o `pg_cron` com a URL do projeto Supabase do Lovable ESCRITA NO
-- CORPO do comando. O agendamento ficava "ativo" e nunca produzia um arquivo —
-- e, na primeira execução, mandaria o nosso segredo de cron, no cabeçalho, para
-- um projeto de terceiro. A migration `20260801130000` corrigiu isso movendo a
-- URL para `internal_secrets`.
--
-- Isto aqui não confia na migration: pergunta ao banco. Migration aplicada é
-- promessa; `cron.job` é o estado.
--
-- ## Só de leitura, e sem imprimir segredo
--
-- Nenhum `insert`, `update`, `delete`, `cron.*` ou `net.*`. E NENHUM valor de
-- `internal_secrets` sai daqui: o resultado deste arquivo vai para o log de uma
-- Action, que fica gravado. O que sai é o HOST extraído do comando (público,
-- aparece na URL de qualquer edge function) e booleanos.
--
-- ## O que cada campo prova
--
--   base_das_functions_e_a_nossa .. true  ← `functions_base_url` aponta para o
--                                           projeto de produção. É a linha que
--                                           todo agendamento usa para montar a
--                                           URL; errada ali, erram todos.
--   jobs_citando_outro_projeto .... 0     ← nenhum comando de cron carrega uma
--                                           URL de projeto diferente do nosso.
--                                           Este é o número que não pode subir.
--   jobs ..........................       ← cada tarefa, com o host para onde
--                                           ela chama. `null` em `host` é o
--                                           caso BOM: o comando monta a URL a
--                                           partir de `internal_secrets` em vez
--                                           de trazê-la embutida.

with alvo as (
  select
    jobname,
    schedule,
    active,
    substring(command from 'https://([a-z0-9]+)\.supabase\.co') as host
  from cron.job
)
select
  (select value like 'https://qwiojyfxzvdcfbbexyxg.supabase.co%'
     from public.internal_secrets
    where key = 'functions_base_url')                    as base_das_functions_e_a_nossa,
  (select count(*) from alvo
    where host is not null
      and host <> 'qwiojyfxzvdcfbbexyxg')                as jobs_citando_outro_projeto,
  (select count(*) from alvo)                            as total_de_jobs,
  (select jsonb_agg(jsonb_build_object(
            'tarefa', jobname, 'quando', schedule,
            'ativa', active, 'host', host) order by jobname)
     from alvo)                                          as jobs;
