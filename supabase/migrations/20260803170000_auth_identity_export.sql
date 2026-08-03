-- O backup passa a levar quem são as pessoas — sem levar as senhas delas.
--
-- Até aqui o `weekly-export` copiava só o schema `public`. As contas vivem em
-- `auth.users`, que ficava de fora — e quatro tabelas restauradas apontam para
-- lá por chave estrangeira (`profiles`, `doctors`, `patients`, `user_roles`).
-- Numa restauração real essas quatro nem carregariam, e mesmo que
-- carregassem ninguém conseguiria entrar: sem conta, sem senha, sem vínculo
-- de login com Google. O que voltaria seria um banco de casos clínicos órfãos.
--
-- Ou seja: o backup relatava "37 tabelas, 0 falhas" — e o relatório estava
-- certo. Ele só não respondia a pergunta que importa: isto volta a ser um
-- sistema?
--
-- O QUE ENTRA: identidade. Id (para as chaves estrangeiras fecharem), e-mail,
-- telefone, carimbos de confirmação, metadados de cadastro (que é onde moram
-- account_type, nome, CRM) e os vínculos de provedor externo.
--
-- O QUE NÃO ENTRA, e por quê: `encrypted_password`, `confirmation_token`,
-- `recovery_token`, `email_change_token_*`, `reauthentication_token`. Um
-- arquivo num bucket contendo hash de senha e token de recuperação é alvo
-- muito mais valioso que um contendo nome e e-mail — e o ganho seria só poupar
-- um "esqueci minha senha" depois de um desastre. Não paga.
--
-- A consequência disso está escrita no runbook: depois de uma restauração,
-- ninguém entra por senha até redefini-la. O caminho existe e foi provado
-- nesta sessão (captcha + SMTP do Resend + template em português).

create or replace function public.auth_users_export()
returns table (
  id uuid,
  email text,
  phone text,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb,
  is_anonymous boolean
)
language sql security definer set search_path to 'public'
as $$
  select
    u.id, u.email::text, u.phone::text,
    u.email_confirmed_at, u.phone_confirmed_at,
    u.created_at, u.last_sign_in_at,
    -- Uma conta banida precisa continuar banida depois de restaurada.
    u.banned_until,
    u.raw_user_meta_data, u.raw_app_meta_data, u.is_anonymous
  from auth.users u
  order by u.created_at;
$$;

-- `identity_data` guarda o `sub` do provedor e o e-mail — é o que relinka o
-- login com Google. Não contém segredo: é identificador público do provedor.
create or replace function public.auth_identities_export()
returns table (
  user_id uuid,
  provider text,
  provider_id text,
  identity_data jsonb,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql security definer set search_path to 'public'
as $$
  select i.user_id, i.provider::text, i.provider_id::text,
         i.identity_data, i.created_at, i.last_sign_in_at
  from auth.identities i
  order by i.created_at;
$$;

-- Só o service_role (a edge function do backup) chama. Estas listas trazem o
-- endereço de e-mail de todo mundo; nenhum usuário logado tem por que lê-las.
revoke execute on function public.auth_users_export() from public, anon, authenticated;
revoke execute on function public.auth_identities_export() from public, anon, authenticated;
