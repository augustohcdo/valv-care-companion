-- Semear a base da IA deixa de depender de alguém clicar
--
-- ## Por que existe
--
-- Sete trechos da ESC/EACTS 2025 estão cadastrados no código e não estão na
-- base que a IA consulta. Entrariam com um clique em Administração → Base da IA
-- e FHIR — e é justamente esse clique que o usuário pediu para não existir:
-- "não quero ter ações".
--
-- O pedido não é comodidade. Passo manual repetido é passo que uma hora não
-- acontece: foi assim que as edge functions passaram semanas sem ser
-- publicadas, com a IA respondendo por uma diretriz anterior à que o painel de
-- conduta anunciava. Tirar o humano do caminho é a correção estrutural.
--
-- ## Como
--
-- O mesmo mecanismo que o `weekly-export`, o `admin-digest` e o `job-watchdog`
-- já usam: o banco chama a função por `pg_net`, com um segredo lido de
-- `internal_secrets` — tabela que só o `service_role` enxerga. A função
-- `knowledge-seed` passou a aceitar esse segredo, SEM perder o caminho do
-- administrador logado.
--
-- Nada de novo em superfície de ataque: quem consegue ler `internal_secrets` já
-- é `service_role` e escreve na tabela direto.
--
-- ## Idempotente nos dois níveis
--
-- O segredo só é criado se não existir (`on conflict do nothing`) — recriá-lo
-- invalidaria um agendamento em curso. E o próprio seed pula trecho que já
-- está na base, comparando pela seção: rodar de novo não duplica nada.

-- ---------------------------------------------------------------------------
-- 1. O segredo, gerado dentro do banco
-- ---------------------------------------------------------------------------
--
-- `gen_random_bytes` para o valor não passar por arquivo, commit nem conversa —
-- a mesma razão pela qual os outros segredos de cron nasceram assim.

insert into public.internal_secrets (key, value)
values ('seed_cron_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. A chamada
-- ---------------------------------------------------------------------------
--
-- Agendada para daqui a um minuto, e não executada aqui, por um motivo prático:
-- `net.http_post` é assíncrono e a resposta não voltaria para esta transação de
-- qualquer forma. Agendando, o trabalho acontece mesmo que a conexão que rodou
-- esta migration caia — e o `unschedule` no fim do próprio comando garante que
-- é uma vez só, não uma tarefa recorrente esquecida no banco.

select cron.unschedule('valvepath-seed-unico')
where exists (select 1 from cron.job where jobname = 'valvepath-seed-unico');

select cron.schedule(
  'valvepath-seed-unico',
  '* * * * *',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/knowledge-seed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'seed_cron_secret')
    ),
    body := jsonb_build_object('source', 'migration', 'at', now())
  );
  select cron.unschedule('valvepath-seed-unico');
  $$
);

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------
--
-- Roda ANTES do seed terminar, então não conta trechos: conta o que já dá para
-- afirmar agora — que o segredo existe e que a tarefa está na fila. A prova de
-- que os trechos entraram é a contagem em `knowledge_chunks`, alguns minutos
-- depois.

select
  (select count(*) from public.internal_secrets
    where key = 'seed_cron_secret')                          as segredo_criado,
  (select count(*) from public.internal_secrets
    where key = 'functions_base_url')                        as url_base_existe,
  (select count(*) from cron.job
    where jobname = 'valvepath-seed-unico')                  as seed_agendado,
  (select count(*) from public.knowledge_chunks)             as trechos_agora;
