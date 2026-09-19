-- Derrubar as sessões abertas de uma conta encerrada, por id de usuário.
--
-- ## Por que isto precisa existir
--
-- O `account-close` fazia:
--
--     await admin.auth.admin.signOut(token, "global").catch(() => {});
--
-- `signOut(jwt, …)` manda `POST /logout` com aquele jwt no `Authorization`, e
-- quem é derrubado é o DONO DO TOKEN. Como `token` ali é o de quem chamou, um
-- administrador encerrando a conta de outra pessoa — o caminho formal do art.
-- 18 da LGPD, pela fila de pedidos — derrubava as próprias sessões e deixava as
-- do titular de pé. Exatamente ao contrário do que o comentário da linha dizia
-- que ela fazia.
--
-- O SDK fixado nas functions (`@supabase/supabase-js@2.45.0`) não tem API de
-- admin para derrubar sessão por id de usuário: `signOut` só aceita um jwt.
-- Quem consegue fazer isso é o banco, apagando as linhas de `auth.sessions`.
--
-- ## O que a função NÃO faz
--
-- Não apaga o usuário, não mexe em `auth.users` e não desfaz o banimento. Ela
-- só encerra sessões. O encerramento de dados continua sendo do `encerrar_conta`
-- e o banimento, da Admin API — cada um do seu lado, como já estava.
--
-- ## Enquanto isto não estiver aplicado
--
-- A função trata a ausência deste RPC como o que é: a conta fica encerrada e
-- banida, o GoTrue recusa renovar token de conta banida, e o acesso cai no fim
-- da validade do token atual em vez de na hora. A resposta devolve
-- `sessoes_derrubadas: false` com o motivo, e a tela diz isso ao usuário — em
-- vez de um "Conta encerrada" que não distingue os dois casos.

create or replace function public.derrubar_sessoes(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _sessoes integer := 0;
begin
  -- Só o service_role chama isto, e quem chama é a edge function de
  -- encerramento. Sem esta porta, uma função que apaga sessão por id de
  -- usuário seria uma ferramenta de derrubar qualquer pessoa do sistema.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'derrubar_sessoes: apenas service_role';
  end if;

  if _user_id is null then
    raise exception 'derrubar_sessoes: _user_id é obrigatório';
  end if;

  -- O cast para texto dos dois lados porque o tipo da coluna em
  -- `auth.refresh_tokens.user_id` varia entre versões do GoTrue (varchar em
  -- umas, uuid em outras). Comparar como texto funciona nas duas, e adivinhar
  -- o tipo é o jeito de descobrir que se adivinhou errado em produção.
  delete from auth.refresh_tokens where user_id::text = _user_id::text;

  delete from auth.sessions where user_id = _user_id;
  get diagnostics _sessoes = row_count;

  return _sessoes;
end;
$$;

-- Ninguém além do service_role: nem anon, nem authenticated, nem o público.
revoke all on function public.derrubar_sessoes(uuid) from public;
revoke all on function public.derrubar_sessoes(uuid) from anon;
revoke all on function public.derrubar_sessoes(uuid) from authenticated;
grant execute on function public.derrubar_sessoes(uuid) to service_role;

comment on function public.derrubar_sessoes(uuid) is
  'Encerra as sessões abertas de um usuário. Usada pelo account-close quando um '
  'administrador encerra a conta de outra pessoa — caso em que o signOut da '
  'Admin API derrubaria o administrador, não o titular. Só service_role.';
