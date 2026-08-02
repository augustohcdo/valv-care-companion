-- Quem precisa dar sinal de vida, e a partir de quando o silêncio é alarme.
--
-- Esta lista já existia, hardcoded na tela de admin. O vigia que está sendo
-- criado precisa exatamente da mesma lista — e duplicar uma lista escrita à mão
-- é como a lista de tabelas do backup ficou 15 tabelas atrasada sem ninguém
-- perceber. Uma fonte só, no banco, onde os dois leem e onde dá para ajustar o
-- prazo sem publicar nada.

create table if not exists public.watched_jobs (
  job text primary key,                 -- casa com job_runs.job
  label text not null,
  stale_after_days integer not null default 8,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- As duas rodam toda segunda-feira; 8 dias dá uma folga de um dia sobre o ciclo.
insert into public.watched_jobs (job, label, stale_after_days) values
  ('weekly-export', 'Backup semanal', 8),
  ('weekly-digest', 'Resumo semanal do médico', 8),
  -- O vigia entra na própria lista: se ele parar, o painel mostra. Roda todo
  -- dia, então 2 dias já é atraso.
  ('job-watchdog',  'Vigia das tarefas agendadas', 2)
on conflict (job) do nothing;

alter table public.watched_jobs enable row level security;

drop policy if exists "Admin reads watched_jobs" on public.watched_jobs;
create policy "Admin reads watched_jobs"
on public.watched_jobs for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Sem policy de escrita: a lista muda por migration, e o service_role (o vigia)
-- só lê. Mesmo desenho de job_runs e client_errors.
