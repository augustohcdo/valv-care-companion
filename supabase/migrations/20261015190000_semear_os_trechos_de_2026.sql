-- ---------------------------------------------------------------------------
-- Semear os trechos brasileiros da edição de 2026
-- ---------------------------------------------------------------------------
--
-- ## Por que é preciso disparar, e não esperar
--
-- A migração anterior (`20261015180000`) apagou os doze trechos de edições
-- antigas e deixou a fonte brasileira com ZERO trechos — estado honesto (a IA
-- responde que não encontrou o assunto na base) e temporário por construção.
--
-- Só que ele não termina sozinho. O agendamento que semeia a base é de UMA VEZ
-- SÓ: a migração `20260905030000` criou `valvepath-seed-unico` com
-- `cron.unschedule` dentro do próprio comando, justamente para não deixar
-- tarefa recorrente esquecida no banco. Quer dizer que não há cron diário para
-- recuperar isto — sem este arquivo, a base fica sem a diretriz brasileira até
-- alguém clicar em "Popular / atualizar base RAG" na administração.
--
-- Então repete-se aqui o mesmo mecanismo, pelo mesmo motivo: passo manual
-- repetido é passo que uma hora não acontece.
--
-- ## Nenhum segredo passa por aqui
--
-- A chamada lê `seed_cron_secret` e `functions_base_url` de
-- `public.internal_secrets` DENTRO do SQL, no servidor. Nada é impresso, nada
-- vai para o log do workflow, nada entra no repositório — que é público. É o
-- mesmo desenho da migração de setembro.
--
-- ## Idempotente
--
-- Rodar duas vezes agenda a mesma tarefa de novo (o `unschedule` inicial
-- garante que não há duplicata) e o seed em si pula o que já existe. O pior
-- caso de rodar duas vezes é o seed responder `inserted: 0, skipped: 6`.

select cron.unschedule('valvepath-seed-2026')
where exists (select 1 from cron.job where jobname = 'valvepath-seed-2026');

select cron.schedule(
  'valvepath-seed-2026',
  '* * * * *',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/knowledge-seed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'seed_cron_secret')
    ),
    body := jsonb_build_object('source', 'migration-2026', 'at', now())
  );
  select cron.unschedule('valvepath-seed-2026');
  $$
);

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
--
-- Esta roda ANTES de a tarefa disparar — ela não pode provar que os trechos
-- entraram, e dizer que prova seria o defeito que este projeto persegue. O que
-- ela prova é que a tarefa está agendada e que os dois segredos de que ela
-- depende existem na base. Sem qualquer um dos dois, a chamada sairia com
-- cabeçalho vazio e o seed recusaria — e ninguém veria.
--
-- Para conferir o RESULTADO, rode depois, pelo workflow "Banco de dados":
--   arquivo = scripts/sql/listar-trechos-da-sbc.sql
-- Devem aparecer seis trechos, todos com "(SBC 2026" no título da section.

select
  (select count(*) from cron.job where jobname = 'valvepath-seed-2026')            as tarefa_agendada,
  (select count(*) from public.internal_secrets where key = 'seed_cron_secret')    as tem_segredo_do_cron,
  (select count(*) from public.internal_secrets where key = 'functions_base_url')  as tem_url_das_functions,
  (select count(*) from public.knowledge_chunks c
     join public.knowledge_sources s on s.id = c.source_id
    where s.slug = 'sbc-valvopatias-2024')                                         as trechos_agora;
