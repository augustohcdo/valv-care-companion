-- Médico não cria mais conta sozinho: solicita, e o responsável libera.
--
-- Até aqui qualquer pessoa com um e-mail criava conta de médico e digitava um
-- CRM que ninguém conferia. Num sistema que organiza prontuário e sugere
-- conduta, isso é a porta mais larga que existe. Passa a ser: solicitação →
-- e-mail para o responsável → aprovação ou recusa, com a conferência do CRM
-- registrada por quem conferiu e quando.
--
-- **Não há policy de INSERT.** Quem preenche o formulário é visitante anônimo,
-- e uma policy para `anon` seria convite para inundar a tabela. Quem grava é o
-- service_role, pela edge function `access-request`, que exige captcha —
-- mesmo desenho de `client_errors`.

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),

  -- Quem está pedindo
  tipo text not null default 'medico',
  nome text not null,
  email text not null,
  telefone text,
  crm text,
  crm_uf text,
  especialidade text,
  rqe text,
  instituicao text,
  cidade text,
  uf text,
  mensagem text,

  -- A anuência de aparecer no diretório é colhida aqui, no ato do pedido, e
  -- não depois: a Resolução CFM nº 2.336/2023 define publicidade médica como
  -- divulgação com "iniciativa, participação e/ou anuência do médico".
  consent_diretorio boolean not null default false,

  -- A decisão
  status text not null default 'recebido',
  motivo_recusa text,
  decidido_por uuid,
  decidido_em timestamptz,

  -- A conferência do CRM: quem conferiu e quando, não só "sim".
  crm_conferido_por uuid,
  crm_conferido_em timestamptz,

  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.access_requests
    add constraint access_requests_tipo_check check (tipo in ('medico', 'clinica'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.access_requests
    add constraint access_requests_status_check
    check (status in ('recebido', 'em_analise', 'aprovado', 'recusado'));
exception when duplicate_object then null; end $$;

create index if not exists idx_access_requests_status
  on public.access_requests (status, created_at desc);

alter table public.access_requests enable row level security;

create policy "Admin reads access requests" on public.access_requests
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admin updates access requests" on public.access_requests
  for update to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.access_requests is
  'Pedidos de acesso profissional. Sem policy de INSERT de propósito: quem grava é a edge function access-request, com captcha.';
comment on column public.access_requests.crm_conferido_em is
  'Quando o CRM foi conferido no portal do CFM. Nulo = ninguém conferiu — a tela mostra isso, não presume.';
