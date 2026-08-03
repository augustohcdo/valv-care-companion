-- As métricas do admin passam a servir também ao resumo por e-mail.
--
-- Duas mudanças, pelo mesmo motivo: o número que chega na caixa de entrada tem
-- que ser o mesmo que aparece no painel. Duas consultas contando a mesma coisa
-- divergem — foi assim que a lista de tabelas do backup ficou quinze tabelas
-- atrás do banco sem ninguém notar.
--
-- 1. A guarda passa a reconhecer o service_role. Sem isso a edge function
--    receberia `unauthorized`, exatamente o que aconteceu com
--    `doctor_weekly_digest`: a função chamava, o RPC recusava, o erro era
--    engolido e o resumo semanal respondia "0 enviados" por meses. A proteção
--    do usuário final não muda — quem está logado continua precisando do papel.
--
-- 2. Entram os números de 7 dias e a fila de LGPD. O prazo da LGPD é de 15
--    dias corridos: um pedido parado é problema jurídico com relógio correndo,
--    e hoje só apareceria para quem abrisse o painel.

create or replace function public.admin_site_metrics()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_desde date := ((now() at time zone 'utc')::date - 29);
  v_semana date := ((now() at time zone 'utc')::date - 6);
  v_result jsonb;
begin
  if auth.role() <> 'service_role'
     and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'unauthorized';
  end if;

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
    -- Conta confirmada é conta que existe de verdade; sem confirmar, o cadastro
    -- pode ser endereço de outra pessoa digitado por engano.
    'contas_confirmadas', (select count(*) from auth.users where email_confirmed_at is not null),
    'contas_pendentes',   (select count(*) from auth.users where email_confirmed_at is null),
    'views_30d',          (select coalesce(sum(views), 0) from public.page_views where day >= v_desde),
    'visitas_30d',        (select coalesce(sum(visits), 0) from public.page_views where day >= v_desde),
    'views_7d',           (select coalesce(sum(views), 0) from public.page_views where day >= v_semana),
    'visitas_7d',         (select coalesce(sum(visits), 0) from public.page_views where day >= v_semana),
    -- Erros: o que voltou a acontecer na semana, não o que foi criado nela —
    -- um erro antigo que reapareceu ontem importa mais que um novo de uma vez.
    'erros_7d',           (select count(*) from public.client_errors where last_seen_at >= now() - interval '7 days'),
    'erros_ocorrencias_7d',(select coalesce(sum(occurrences), 0) from public.client_errors where last_seen_at >= now() - interval '7 days'),
    -- Fila LGPD: prazo legal de 15 dias corridos.
    'dpo_abertos',        (select count(*) from public.dpo_requests where status in ('recebido','em_verificacao')),
    'dpo_vencidos',       (select count(*) from public.dpo_requests where status in ('recebido','em_verificacao') and due_at < now()),
    'dpo_vence_3d',       (select count(*) from public.dpo_requests where status in ('recebido','em_verificacao') and due_at >= now() and due_at < now() + interval '3 days'),
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

-- Quem recebe a notificação do resumo dentro do app. Lista pequena e estável;
-- vem por RPC porque `auth.users` não é legível pelo PostgREST e o e-mail é
-- necessário para o envio.
create or replace function public.admin_recipients()
returns table (user_id uuid, email text)
language sql security definer set search_path to 'public'
as $$
  select ur.user_id, u.email::text
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  where ur.role = 'admin';
$$;

revoke execute on function public.admin_recipients() from public, anon, authenticated;

insert into public.watched_jobs (job, label, stale_after_days, enabled)
values ('admin-digest', 'Resumo semanal do administrador', 8, true)
on conflict (job) do update set
  label = excluded.label,
  stale_after_days = excluded.stale_after_days,
  enabled = excluded.enabled;

-- Segunda-feira 06:00 UTC: depois do backup (03:15), do resumo do médico
-- (04:00), do vigia (05:00) e da varredura de boas-vindas (04:30), para que o
-- e-mail já reflita o resultado de todos eles.
select cron.unschedule('valvepath-admin-digest')
where exists (select 1 from cron.job where jobname = 'valvepath-admin-digest');

select cron.schedule(
  'valvepath-admin-digest',
  '0 6 * * 1',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/admin-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'export_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 60000
  );
  $$
);
