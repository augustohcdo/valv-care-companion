-- Contador de audiência sem identificar ninguém, e as métricas do painel.
--
-- A pergunta era "quantas pessoas entraram no site". A resposta honesta exige
-- dizer o que este contador NÃO faz: ele não sabe quem é ninguém. Sem cookie de
-- rastreio, sem IP, sem impressão digital do navegador — a linha guarda dia,
-- caminho e dois inteiros, e nada mais. Não dá para reconstruir uma pessoa a
-- partir dela, e é por isso que ela não depende de consentimento.
--
-- Em troca, o número não é "visitantes únicos". São duas contagens diferentes,
-- e o painel precisa chamá-las pelo nome certo:
--
--   views  — quantas telas foram abertas;
--   visits — quantas sessões de navegador começaram (o cliente marca a
--            primeira tela da sessão; a marca vive no sessionStorage, morre com
--            a aba e não contém identificador nenhum).
--
-- Uma pessoa que volta amanhã conta como duas visitas. Chamar isso de
-- "visitantes" seria um número verdadeiro respondendo a pergunta errada — o
-- defeito que mais apareceu nesta base.

create table if not exists public.page_views (
  day date not null default (now() at time zone 'utc')::date,
  path text not null,
  views integer not null default 0,
  visits integer not null default 0,
  primary key (day, path)
);

alter table public.page_views enable row level security;

-- Leitura só para admin. O incremento não passa por policy: vai pelo RPC
-- SECURITY DEFINER abaixo, que é a única porta de escrita.
create policy "Admin reads page_views"
on public.page_views for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists idx_page_views_day on public.page_views (day desc);

-- O caminho chega do navegador, então precisa ser domado antes de virar chave:
--   * a querystring pode carregar qualquer coisa (inclusive dado pessoal em um
--     link colado de fora) e não interessa para audiência;
--   * identificadores no caminho (`/casos/<uuid>`) explodiriam a cardinalidade
--     e apontariam para um registro clínico específico.
-- Vira `:id` e o tamanho é cortado. O que sobra é a rota, não a navegação de
-- uma pessoa.
create or replace function public.normalize_path(_path text)
returns text
language sql immutable
as $$
  select left(
    regexp_replace(
      regexp_replace(
        coalesce(split_part(split_part(_path, '?', 1), '#', 1), '/'),
        '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '/:id', 'g'
      ),
      '/[0-9]{3,}', '/:id', 'g'
    ), 120);
$$;

create or replace function public.record_page_view(_path text, _new_visit boolean default false)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_path text;
begin
  v_path := public.normalize_path(_path);
  if v_path is null or v_path = '' then
    return;
  end if;

  insert into public.page_views (day, path, views, visits)
  values ((now() at time zone 'utc')::date, v_path, 1, case when _new_visit then 1 else 0 end)
  on conflict (day, path) do update set
    views = public.page_views.views + 1,
    visits = public.page_views.visits + case when _new_visit then 1 else 0 end;
end;
$$;

-- Chamável por quem ainda não entrou — é justamente o visitante que queremos
-- contar. Assumo conscientemente que alguém pode inflar o número chamando isto
-- em laço: é contador de volume, não métrica de faturamento, e blindar custaria
-- mais do que o número vale.
grant execute on function public.record_page_view(text, boolean) to anon, authenticated;

-- As métricas do painel, num RPC só. Vão por função e não por consulta direta
-- porque `auth.users` não é legível pelo PostgREST e porque contar linha a
-- linha no cliente traria dado de paciente para o navegador do admin sem
-- necessidade — aqui só o número atravessa.
create or replace function public.admin_site_metrics()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_desde date := ((now() at time zone 'utc')::date - 29);
  v_result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'unauthorized';
  end if;

  select jsonb_build_object(
    'medicos',            (select count(*) from public.doctors),
    'medicos_30d',        (select count(*) from public.doctors where created_at >= now() - interval '30 days'),
    'pacientes',          (select count(*) from public.patients where deleted_at is null),
    'pacientes_30d',      (select count(*) from public.patients where deleted_at is null and created_at >= now() - interval '30 days'),
    'casos',              (select count(*) from public.clinical_cases where deleted_at is null),
    'casos_30d',          (select count(*) from public.clinical_cases where deleted_at is null and created_at >= now() - interval '30 days'),
    -- Conta confirmada é conta que existe de verdade; sem confirmar, o cadastro
    -- pode ser endereço de outra pessoa digitado por engano.
    'contas_confirmadas', (select count(*) from auth.users where email_confirmed_at is not null),
    'contas_pendentes',   (select count(*) from auth.users where email_confirmed_at is null),
    'views_30d',          (select coalesce(sum(views), 0) from public.page_views where day >= v_desde),
    'visitas_30d',        (select coalesce(sum(visits), 0) from public.page_views where day >= v_desde),
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
