-- O backup semanal nunca rodou: apontava para o projeto Supabase antigo.
--
-- Quando o banco foi recriado no projeto novo, as migrations que agendam o
-- pg_cron foram reaplicadas com a URL do projeto do Lovable hardcoded no corpo
-- do comando (20260719035328, 20260719035407, 20260725120000). O agendamento
-- ficou "ativo" e nunca produziu um único arquivo — e o projeto antigo ainda
-- responde, então na primeira execução o nosso segredo de cron seria enviado,
-- no cabeçalho, para um projeto que não controlamos mais.
--
-- A correção tira a URL do corpo do comando. Ela passa a viver numa linha de
-- `internal_secrets`, que é o único lugar a mudar se o projeto for migrado de
-- novo — em vez de três migrations com o valor embutido.

-- 1. Base das edge functions. ESTE é o valor a atualizar numa migração de
--    projeto; nenhuma outra parte do agendamento precisa ser tocada.
insert into public.internal_secrets (key, value)
values ('functions_base_url', 'https://qwiojyfxzvdcfbbexyxg.supabase.co/functions/v1')
on conflict (key) do update set value = excluded.value;

-- 2. Rotaciona os segredos de cron. Não houve transmissão (nenhuma execução
--    aconteceu), mas eles estavam a dois dias de sair para um endpoint de
--    terceiro; trocar é barato. Gerados dentro do banco, para não passarem por
--    arquivo nenhum.
update public.internal_secrets
   set value = encode(gen_random_bytes(32), 'hex')
 where key in ('export_cron_secret', 'digest_cron_secret');

-- 3. Reagenda as duas tarefas montando a URL a partir do segredo.
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
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  );
  $$
);

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
    body := jsonb_build_object('source', 'pg_cron', 'at', now())
  );
  $$
);

-- 4. Registro das execuções do backup.
--
-- Sem isto, uma falha do export é invisível: foi exatamente o que permitiu que
-- o backup ficasse quebrado sem ninguém perceber. A própria função grava a
-- linha ao terminar, e a tela de admin usa a data da última execução bem
-- sucedida para avisar quando o backup envelhece.
create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  tables_ok integer not null default 0,
  tables_failed integer not null default 0,
  total_rows bigint not null default 0,
  total_bytes bigint not null default 0,
  error text,
  triggered_by text
);

alter table public.backup_runs enable row level security;

drop policy if exists "Admin reads backup_runs" on public.backup_runs;
create policy "Admin reads backup_runs"
on public.backup_runs for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Sem policy de INSERT: só o service_role (a edge function) escreve; a RLS
-- nega o resto por padrão. Mesmo desenho de client_errors.

create index if not exists idx_backup_runs_started
  on public.backup_runs (started_at desc);
