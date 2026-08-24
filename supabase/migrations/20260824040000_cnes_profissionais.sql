-- A base pública de profissionais, para corroborar um CRM na hora de aprovar.
--
-- **Não existe API aberta de CRM.** Medido: o portal do CFM é protegido por
-- reCAPTCHA (não é API, e contorná-lo está fora de questão) e a API oficial de
-- dados abertos do SUS tem 87 rotas, nenhuma de profissionais. O que existe é
-- a base CNES do DATASUS — ZIP mensal público, sem chave.
--
-- Varrendo `tbCargaHorariaSus` (6.696.460 linhas) e cruzando com
-- `tbDadosProfissionalSus`, a família cardiovascular tem **36.042
-- profissionais**, 100% com nome e 100% com número de registro:
--
--   225120 Cardiologista                    25.681
--   225203 Cirurgião vascular                6.575
--   225210 Cirurgião cardiovascular          4.387
--   225355 Radiologista intervencionista     1.885
--   225240 Cirurgião torácico                1.523
--
-- **O limite, e ele fica escrito na tela:** `NU_REGISTRO` no CNES é declarado
-- pelo estabelecimento ao cadastrar o profissional. Não é validado contra o
-- CFM. Serve para **corroborar**, nunca para autenticar — quem autentica é a
-- pessoa que abre o portal do CFM e marca "conferi".
--
-- Leitura só para administrador: são dados de pessoas que nunca pediram para
-- estar aqui. Nada disso aparece para paciente nem cria conta.

create table if not exists public.cnes_profissionais (
  co_profissional text primary key,
  nome text not null,
  crm text,
  crm_uf text,
  cbos text[] not null default '{}',
  especialidades text[] not null default '{}',
  -- Não há coluna de UF do estabelecimento, e a ausência é medida: só 2 de
  -- 106.984 vínculos da família cardiovascular trazem a sigla no código da
  -- unidade. Uma coluna vazia por natureza tem cara de dado e não é.
  -- A geografia útil é `crm_uf`, presente em 36.041 dos 36.042.
  competencia text not null,
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_cnes_crm on public.cnes_profissionais (crm, crm_uf);
create index if not exists idx_cnes_nome on public.cnes_profissionais (nome text_pattern_ops);

alter table public.cnes_profissionais enable row level security;

create policy "Admin reads cnes" on public.cnes_profissionais
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.cnes_profissionais is
  'Recorte da base pública CNES (DATASUS) para a família cardiovascular. Corrobora um CRM na análise de solicitação de acesso; NÃO é validação do CFM — o número é declarado pelo estabelecimento. Nunca exposta a paciente.';

-- Busca usada na tela de aprovação: por CRM+UF, e por nome quando o CRM não
-- bate. `security definer` só para não depender da RLS em cada consulta; a
-- guarda de admin está dentro.
create or replace function public.cnes_conferir(_crm text, _crm_uf text, _nome text default null)
returns table (co_profissional text, nome text, crm text, crm_uf text, especialidades text[], competencia text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.role() <> 'service_role'
     and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select c.co_profissional, c.nome, c.crm, c.crm_uf, c.especialidades, c.competencia
    from public.cnes_profissionais c
   where (_crm is not null and c.crm = _crm and (_crm_uf is null or c.crm_uf = _crm_uf))
      or (_nome is not null and length(_nome) >= 6 and c.nome ilike '%' || upper(_nome) || '%')
   limit 20;
end;
$$;

revoke all on function public.cnes_conferir(text, text, text) from public, anon;
grant execute on function public.cnes_conferir(text, text, text) to authenticated;
