-- ============================================================================
-- A trilha de auditoria registrava três eventos que não aconteceram
-- ============================================================================
--
-- ## O que foi medido
--
-- Oito funções deste banco fazem DML e gravam na trilha. Seis condicionam o
-- registro ao trabalho ter acontecido — `responder_vinculo` recusa um pedido já
-- respondido, `encerrar_conta` confere as linhas, `revisar_trecho` também.
-- Duas não: `desvincular_medico` e `admin_definir_papel`.
--
-- E `desvincular_medico` está no MESMO ARQUIVO que `responder_vinculo`.
--
-- ## A prova, rodada num Postgres 16 de verdade
--
--   1. `desvincular_medico()` de um paciente SEM médico vinculado devolve
--      `{"ok": true}` e grava `doctor_patient_unlinked` com `doctor_id: null`;
--   2. `admin_definir_papel(u, 'medico', false)` sobre quem NUNCA teve o papel
--      apaga zero linhas e grava `role_revoked`;
--   3. conceder o mesmo papel duas vezes grava DOIS `role_granted` — o
--      `on conflict do nothing` engole a segunda inserção, o registro não.
--
-- Quatro linhas na trilha, três afirmando o que não ocorreu.
--
-- ## Por que isto importa mais do que parece
--
-- A trilha é o documento que prova o que aconteceu na conta de alguém: é ela
-- que responde "quem tirou o papel de administrador daquele usuário, e quando".
-- Uma trilha incompleta faz quem a lê procurar em outro lugar. Uma trilha que
-- AFIRMA o que não houve faz quem a lê parar de procurar — e concluir errado.
--
-- Pior no caso do papel: numa investigação, `role_revoked` sem revogação
-- nenhuma esconde quem de fato removeu o papel por outro caminho.
--
-- ## O que muda
--
-- Nada de exceção nova. "Já estava assim" é estado final legítimo — levantar
-- erro puniria quem clicou duas vezes ou tentou de novo numa conexão ruim, e
-- guarda que pune quem fez certo é guarda que alguém desliga.
--
-- As duas passam a dizer a verdade no retorno, e a gravar a trilha só quando há
-- o que gravar. `admin_definir_papel` muda de `void` para `jsonb` — `void` não
-- tem como distinguir "removi" de "não havia o que remover", e era por isso que
-- a tela de administração dizia sucesso nos dois casos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. desvincular_medico
-- ----------------------------------------------------------------------------
create or replace function public.desvincular_medico()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_patient uuid; v_doctor uuid;
begin
  select id, linked_doctor_id into v_patient, v_doctor
    from public.patients where user_id = auth.uid() and deleted_at is null;
  if v_patient is null then raise exception 'paciente não encontrado' using errcode = '42704'; end if;

  -- Sem médico vinculado não há desvinculação. Antes daqui a função seguia em
  -- frente, gravava `doctor_patient_unlinked` com `doctor_id: null` e devolvia
  -- `ok: true` — a trilha registrando um desvínculo que nunca houve.
  --
  -- Não é exceção: para o paciente, "não tenho médico vinculado" é exatamente o
  -- estado que ele queria. O que muda é a tela deixar de anunciar uma ação que
  -- não ocorreu, e a trilha deixar de afirmá-la.
  if v_doctor is null then
    return jsonb_build_object('ok', true, 'desvinculado', false, 'motivo', 'sem_vinculo');
  end if;

  update public.patients set linked_doctor_id = null, linked_at = null, updated_at = now()
   where id = v_patient;
  -- O pedido aceito volta a 'cancelado' para o paciente poder pedir de novo:
  -- o índice único só permite um pendente por par.
  update public.patient_link_requests set status = 'cancelado', decidido_em = now()
   where patient_id = v_patient and doctor_id = v_doctor and status = 'aceito';

  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'doctor_patient_unlinked', 'patients', v_patient,
          jsonb_build_object('doctor_id', v_doctor));
  return jsonb_build_object('ok', true, 'desvinculado', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. admin_definir_papel
-- ----------------------------------------------------------------------------
-- `returns void` vira `returns jsonb`, e o Postgres não troca o tipo de retorno
-- num `create or replace`: o `drop` precisa vir antes, com a assinatura inteira.
drop function if exists public.admin_definir_papel(uuid, public.app_role, boolean);

create or replace function public.admin_definir_papel(
  _user_id uuid,
  _role public.app_role,
  _conceder boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_linhas integer;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'apenas administradores podem alterar papeis'
      using errcode = '42501';
  end if;

  if _role = 'admin'::public.app_role and not _conceder
     and _user_id = auth.uid() then
    raise exception 'voce nao pode remover o proprio papel de administrador'
      using errcode = '22023';
  end if;

  if _conceder then
    insert into public.user_roles (user_id, role)
    values (_user_id, _role)
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = _role;
  end if;

  -- `ROW_COUNT` depois do INSERT ... ON CONFLICT DO NOTHING vale 0 quando a
  -- linha já existia. É essa a diferença entre "concedi" e "já tinha" — e era
  -- ela que faltava: sem isto, conceder duas vezes deixava DUAS linhas de
  -- `role_granted` na trilha para uma concessão só.
  get diagnostics v_linhas = ROW_COUNT;

  if v_linhas > 0 then
    insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
    values (
      auth.uid(),
      case when _conceder then 'role_granted' else 'role_revoked' end,
      'user_roles',
      _user_id,
      jsonb_build_object('role', _role::text)
    );
  end if;

  -- O retorno diz o que aconteceu. A tela de administração dizia "papel
  -- removido" sobre um `void` que não tinha como significar outra coisa.
  return jsonb_build_object(
    'alterado', v_linhas > 0,
    'papel', _role::text,
    'concedido', _conceder
  );
end;
$$;

-- As permissões que a função tinha antes do `drop` não sobrevivem a ele.
revoke all on function public.admin_definir_papel(uuid, public.app_role, boolean) from public;
grant execute on function public.admin_definir_papel(uuid, public.app_role, boolean) to authenticated;
