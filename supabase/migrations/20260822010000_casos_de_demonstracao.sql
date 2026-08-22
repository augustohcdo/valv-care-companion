-- Dado fictício de demonstração passa a ser distinguível do dado real.
--
-- A conta de teste vai receber uma base fictícia para demonstrar o produto a
-- médicos. Sem marca, duas coisas quebram ao mesmo tempo:
--
--   1. O painel de administração e o resumo semanal contariam paciente e caso
--      inventados como uso real. `admin_site_metrics()` faz `count(*)` sobre
--      `clinical_cases` e `doctors` inteiros — diria "13 casos" com um real, e
--      o relatório estaria "correto" sobre a pergunta errada.
--   2. Um médico assistindo à demonstração não teria como saber que aquele
--      paciente não existe. Num sistema de prontuário isso não é detalhe.
--
-- A marca é coluna, não convenção de nome: apagar tudo vira uma condição, e a
-- interface consegue exibir o selo sem adivinhar pelo texto.

alter table public.clinical_cases
  add column if not exists is_demo boolean not null default false;

alter table public.doctors
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_clinical_cases_demo
  on public.clinical_cases (id) where is_demo;

comment on column public.clinical_cases.is_demo is
  'Caso fictício de demonstração. Fora das métricas de uso real; exibido com selo na interface e nos documentos exportados.';
comment on column public.doctors.is_demo is
  'Médico fictício de demonstração. A conta correspondente em auth.users é banida e nunca consegue entrar.';

-- ---------------------------------------------------------------------------
-- As métricas do administrador voltam a responder "quanto disso é real?"
--
-- Corpo idêntico ao de 20260806..., com três diferenças: as contagens de caso
-- e de médico excluem a demonstração, as contas confirmadas descontam os
-- usuários dos médicos fictícios, e entram `casos_demo`/`medicos_demo` — o
-- volume fictício aparece, separado, em vez de sumir. Esconder seria trocar um
-- número errado por um número ausente.
create or replace function public.admin_site_metrics()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_desde date := ((now() at time zone 'utc')::date - 29);
  v_semana date := ((now() at time zone 'utc')::date - 6);
  v_docs record;
  v_result jsonb;
begin
  if auth.role() <> 'service_role'
     and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'unauthorized';
  end if;

  select * into v_docs from public.documentos_sem_arquivo();

  select jsonb_build_object(
    'medicos',            (select count(*) from public.doctors where not is_demo),
    'medicos_30d',        (select count(*) from public.doctors where not is_demo and created_at >= now() - interval '30 days'),
    'medicos_7d',         (select count(*) from public.doctors where not is_demo and created_at >= now() - interval '7 days'),
    'medicos_demo',       (select count(*) from public.doctors where is_demo),
    'pacientes',          (select count(*) from public.patients where deleted_at is null),
    'pacientes_30d',      (select count(*) from public.patients where deleted_at is null and created_at >= now() - interval '30 days'),
    'pacientes_7d',       (select count(*) from public.patients where deleted_at is null and created_at >= now() - interval '7 days'),
    'casos',              (select count(*) from public.clinical_cases where deleted_at is null and not is_demo),
    'casos_30d',          (select count(*) from public.clinical_cases where deleted_at is null and not is_demo and created_at >= now() - interval '30 days'),
    'casos_7d',           (select count(*) from public.clinical_cases where deleted_at is null and not is_demo and created_at >= now() - interval '7 days'),
    'casos_demo',         (select count(*) from public.clinical_cases where deleted_at is null and is_demo),
    'contas_confirmadas', (select count(*) from auth.users u where u.email_confirmed_at is not null
                             and not exists (select 1 from public.doctors d where d.user_id = u.id and d.is_demo)),
    'contas_pendentes',   (select count(*) from auth.users u where u.email_confirmed_at is null
                             and not exists (select 1 from public.doctors d where d.user_id = u.id and d.is_demo)),
    'views_30d',          (select coalesce(sum(views), 0) from public.page_views where day >= v_desde),
    'visitas_30d',        (select coalesce(sum(visits), 0) from public.page_views where day >= v_desde),
    'views_7d',           (select coalesce(sum(views), 0) from public.page_views where day >= v_semana),
    'visitas_7d',         (select coalesce(sum(visits), 0) from public.page_views where day >= v_semana),
    'erros_7d',           (select count(*) from public.client_errors where last_seen_at >= now() - interval '7 days'),
    'erros_ocorrencias_7d',(select coalesce(sum(occurrences), 0) from public.client_errors where last_seen_at >= now() - interval '7 days'),
    'dpo_abertos',        (select count(*) from public.dpo_requests where status in ('recebido','em_verificacao')),
    'dpo_vencidos',       (select count(*) from public.dpo_requests where status in ('recebido','em_verificacao') and due_at < now()),
    'dpo_vence_3d',       (select count(*) from public.dpo_requests where status in ('recebido','em_verificacao') and due_at >= now() and due_at < now() + interval '3 days'),
    'documentos_ausentes', v_docs.documentos_ausentes,
    'arquivos_orfaos',     v_docs.arquivos_orfaos,
    'desde',              v_desde,
    'top_paths',          (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select path, sum(views)::int as views
        from public.page_views where day >= v_desde
        group by path order by sum(views) desc limit 8
      ) t
    )
  ) into v_result;

  return v_result;
end;
$function$;
