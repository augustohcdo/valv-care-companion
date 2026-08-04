-- As métricas passam a incluir a conferência entre registro e arquivo.
-- Mesma fonte para o painel e para o e-mail: recontar em dois lugares é como a
-- lista de tabelas do backup ficou quinze tabelas atrás do banco.
create or replace function public.admin_site_metrics()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
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
    'medicos',            (select count(*) from public.doctors),
    'medicos_30d',        (select count(*) from public.doctors where created_at >= now() - interval '30 days'),
    'medicos_7d',         (select count(*) from public.doctors where created_at >= now() - interval '7 days'),
    'pacientes',          (select count(*) from public.patients where deleted_at is null),
    'pacientes_30d',      (select count(*) from public.patients where deleted_at is null and created_at >= now() - interval '30 days'),
    'pacientes_7d',       (select count(*) from public.patients where deleted_at is null and created_at >= now() - interval '7 days'),
    'casos',              (select count(*) from public.clinical_cases where deleted_at is null),
    'casos_30d',          (select count(*) from public.clinical_cases where deleted_at is null and created_at >= now() - interval '30 days'),
    'casos_7d',           (select count(*) from public.clinical_cases where deleted_at is null and created_at >= now() - interval '7 days'),
    'contas_confirmadas', (select count(*) from auth.users where email_confirmed_at is not null),
    'contas_pendentes',   (select count(*) from auth.users where email_confirmed_at is null),
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
$$;

revoke execute on function public.admin_site_metrics() from public, anon;
grant execute on function public.admin_site_metrics() to authenticated;
