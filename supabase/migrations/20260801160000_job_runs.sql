-- Uma tarefa agendada que para de rodar precisa gritar, não ficar quieta.
--
-- `backup_runs` resolveu isso para o export semanal, mas só para ele. O resumo
-- semanal do médico ficou desde a criação do projeto sem sair para ninguém e
-- nada no sistema registrou a ausência — o defeito só apareceu porque fui
-- procurar. Duas tarefas agendadas, uma vigiada e outra não, é meia solução.
--
-- Esta migration generaliza a mesma ideia para qualquer tarefa agendada: cada
-- uma grava a própria execução e a tela de admin cobra de todas. Os campos
-- específicos de cada tarefa (linhas exportadas, bytes) saem de colunas
-- dedicadas e vão para `details`, que é o que permite a tabela servir a
-- tarefas que ainda não existem.

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,                        -- 'weekly-export' | 'weekly-digest'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  items_ok integer not null default 0,      -- tabelas exportadas / médicos notificados
  items_failed integer not null default 0,
  details jsonb,                            -- números próprios de cada tarefa
  error text,
  triggered_by text
);

-- Preserva o histórico do backup, que já vinha sendo registrado. O guard existe
-- porque num banco recriado do zero `backup_runs` pode nunca ter existido.
do $$
begin
  if to_regclass('public.backup_runs') is not null then
    insert into public.job_runs
      (id, job, started_at, finished_at, ok, items_ok, items_failed, details, error, triggered_by)
    select id, 'weekly-export', started_at, finished_at, ok, tables_ok, tables_failed,
           jsonb_build_object('total_rows', total_rows, 'total_bytes', total_bytes),
           error, triggered_by
      from public.backup_runs
    on conflict (id) do nothing;
  end if;
end $$;

drop table if exists public.backup_runs;

alter table public.job_runs enable row level security;

drop policy if exists "Admin reads job_runs" on public.job_runs;
create policy "Admin reads job_runs"
on public.job_runs for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Sem policy de INSERT: só o service_role (as edge functions) escreve; a RLS
-- nega o resto por padrão. Mesmo desenho de client_errors.

create index if not exists idx_job_runs_job_started
  on public.job_runs (job, started_at desc);
