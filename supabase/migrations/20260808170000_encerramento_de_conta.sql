-- Encerramento de conta: o caminho que a rodada anterior tornou necessário.
--
-- Impedir que apagar uma conta destruísse o prontuário deixou um buraco
-- declarado: não havia mais **nenhuma** forma de atender um pedido de
-- eliminação de titular com prontuário. O `RESTRICT` recusa, e é o que a lei
-- manda — mas recusar sem oferecer o caminho correto deixa o pedido sem
-- resposta possível, e a página do DPO promete resposta em 15 dias.
--
-- O que a lei permite apagar e o que não permite:
--   * o prontuário fica (Lei 13.787/2018, Art. 6º: 20 anos; e LGPD Art. 16, I,
--     que autoriza a guarda para cumprimento de obrigação legal);
--   * a autoria do prontuário fica (Resolução CFM nº 1.821/2007) — encerrar a
--     conta de um médico não apaga quem assinou o registro;
--   * o resto da camada de conta sai.
--
-- Decisão do responsável pelo produto: além disso, **pseudonimizar o nome do
-- titular dentro do prontuário**, guardando a correspondência em tabela
-- restrita. É pseudonimização, não anonimização: sem a correspondência, a
-- guarda de 20 anos ficaria sem titular identificável, o que descumpriria a
-- própria lei que obriga a guardar.

-- ---------------------------------------------------------------------------
-- 1. A correspondência, e por que ela é restrita de verdade
-- ---------------------------------------------------------------------------
create table if not exists public.pseudonym_map (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  origem text not null,          -- 'profiles.full_name' | 'clinical_cases.patient_name'
  origem_id uuid not null,       -- a linha de onde o valor saiu
  valor_original text not null,
  motivo text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pseudonym_map_user on public.pseudonym_map (user_id);

alter table public.pseudonym_map enable row level security;

-- **Nenhuma policy, de propósito.** RLS ativa sem policy nega tudo, então só o
-- `service_role` lê — mesmo desenho de `internal_secrets`. Uma policy de admin
-- aqui exporia justamente a correspondência que a pseudonimização existe para
-- separar; quem precisar reidentificar passa pelo processo do DPO, que deixa
-- rastro, e não por uma tela de listagem.
revoke all on public.pseudonym_map from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. O encerramento
-- ---------------------------------------------------------------------------
create or replace function public.encerrar_conta(_user_id uuid, _motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _ator uuid := auth.uid();
  _ehServico boolean := coalesce(auth.role(), '') = 'service_role';
  _codigo text;
  _paciente_id uuid;
  _casos integer := 0;
  _nome_perfil text;
  _eh_medico boolean;
  _admins integer;
begin
  -- Autorização. O `service_role` chega aqui pela edge function, que já validou
  -- o JWT e conferiu admin-ou-titular; mesmo padrão de `doctor_weekly_digest`,
  -- que também precisa distinguir chamada de serviço de chamada de usuário.
  if not _ehServico then
    if _ator is null then
      raise exception 'não autenticado' using errcode = '42501';
    end if;
    if _ator <> _user_id and not public.has_role(_ator, 'admin'::public.app_role) then
      raise exception 'só o próprio titular ou um administrador pode encerrar a conta'
        using errcode = '42501';
    end if;
  end if;

  -- Recusa deliberada: o único administrador não pode sair.
  -- Diferente da trava que removi de `admin_definir_papel` (lá o caso danoso era
  -- inalcançável), aqui ele é real — encerrar a última conta de administrador
  -- deixa o sistema sem quem o administre, e isso não se desfaz sozinho.
  if public.has_role(_user_id, 'admin'::public.app_role) then
    select count(*) into _admins from public.user_roles where role = 'admin'::public.app_role;
    if _admins <= 1 then
      raise exception 'esta é a única conta de administrador; promova outra pessoa antes de encerrá-la'
        using errcode = '42501';
    end if;
  end if;

  _codigo := upper(substr(md5(_user_id::text), 1, 6));
  select id into _paciente_id from public.patients where user_id = _user_id;
  select exists (select 1 from public.doctors where user_id = _user_id) into _eh_medico;
  select full_name into _nome_perfil from public.profiles where user_id = _user_id;

  -- 2.1 Pseudonimização dentro do prontuário.
  --
  -- Só os casos **vinculados** a este paciente. Caso digitado à mão, sem vínculo
  -- de conta, não pode ser atribuído ao titular com segurança — e fingir
  -- cobertura total seria pior que declarar o limite.
  if _paciente_id is not null then
    insert into public.pseudonym_map (user_id, origem, origem_id, valor_original, motivo)
    select _user_id, 'clinical_cases.patient_name', c.id, c.patient_name, _motivo
    from public.clinical_cases c
    where c.patient_id = _paciente_id and c.patient_name not like 'Titular removido%';

    update public.clinical_cases
       set patient_name = 'Titular removido · ' || _codigo
     where patient_id = _paciente_id and patient_name not like 'Titular removido%';
    get diagnostics _casos = row_count;
  end if;

  -- 2.2 A camada de conta.
  if _nome_perfil is not null then
    insert into public.pseudonym_map (user_id, origem, origem_id, valor_original, motivo)
    values (_user_id, 'profiles.full_name', _user_id, _nome_perfil, _motivo);
  end if;

  update public.profiles
     set full_name = 'Titular removido · ' || _codigo,
         phone = null,
         birth_date = null
   where user_id = _user_id;

  update public.patients set city = null, uf = null where user_id = _user_id;

  -- O CRM e a UF **ficam**: são a autoria do prontuário, exigida pelo CFM.
  -- Sai o que é contato e apresentação.
  update public.doctors set bio = null, institution = null, city = null
   where user_id = _user_id;

  -- 2.3 Acesso e ruído operacional.
  update public.data_access_grants set revoked_at = now()
   where patient_id = _user_id and revoked_at is null;
  delete from public.saved_filters where user_id = _user_id;
  delete from public.notifications where user_id = _user_id;

  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (coalesce(_ator, _user_id), 'account_closed', 'auth.users', _user_id,
          jsonb_build_object('codigo', _codigo, 'casos_pseudonimizados', _casos,
                             'motivo', _motivo, 'por_servico', _ehServico));

  return jsonb_build_object(
    'codigo', _codigo,
    'apagado', jsonb_build_object(
      'perfil', 'nome, telefone e data de nascimento',
      'paciente', case when _paciente_id is null then null else 'cidade e UF' end,
      'medico', case when _eh_medico then 'bio, instituição e cidade' else null end,
      'casos_pseudonimizados', _casos,
      'outros', 'filtros salvos, notificações e autorizações de acesso a dados'),
    'mantido', jsonb_build_object(
      'prontuario', 'registro clínico preservado por 20 anos — Lei 13.787/2018, Art. 6º, e LGPD Art. 16, I',
      'autoria', case when _eh_medico then 'CRM e UF preservados — Resolução CFM nº 1.821/2007' else null end,
      'trilha', 'registros de auditoria e de consentimento, como prova do que aconteceu',
      'reidentificacao', 'a correspondência do pseudônimo fica em base restrita, acessível apenas pelo processo do DPO')
  );
end;
$$;

revoke all on function public.encerrar_conta(uuid, text) from public, anon;
grant execute on function public.encerrar_conta(uuid, text) to authenticated;
