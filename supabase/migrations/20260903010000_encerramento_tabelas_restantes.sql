-- Encerramento de conta: as tabelas que ficavam para trás
--
-- ## O que motivou
--
-- Uma varredura das migrations mostrou que **14 tabelas guardam `user_id` e o
-- `encerrar_conta` tocava 5**. As outras nove ficavam com a linha intacta depois
-- de a conta ser encerrada.
--
-- Nem todas são defeito. Quatro sobrevivem por decisão registrada:
--
--   · `audit_logs` e `consent_audit_log` — trilha legal, protegida também pelo
--     `retencao.test.ts`, que recusa colocá-las em qualquer lista de expurgo;
--   · `user_consents` — prova de consentimento, que é defesa da própria empresa;
--   · `pseudonym_map` — a base restrita de reidentificação do processo do DPO.
--     Apagá-la seria destruir a prova, não proteger o titular. Ela já nasce com
--     RLS ligada e `revoke all` para `authenticated` e `anon`.
--
-- Sobram cinco, e é o que esta migration trata.
--
-- ## Por que três destinos, e não dois
--
-- "Apagar ou preservar" não dá conta. O pedido ao DPO é o exemplo: apagá-lo
-- destruiria a prova de que o direito à exclusão foi exercido e atendido — mas
-- o CPF do requerente não precisa continuar lá para isso. Então existe um
-- terceiro destino, **anonimizar**: o registro fica, a identificação sai.
--
-- ## A que não é LGPD
--
-- `user_roles` entrou por outro motivo. Uma conta encerrada continuava
-- carregando o papel dela — inclusive `admin`. Privilégio que sobrevive ao
-- titular é problema de segurança antes de ser de privacidade.
--
-- ## Nada aqui muda o que a função já fazia
--
-- O corpo abaixo é o texto atual da função com um bloco acrescentado e o retorno
-- estendido. Foi gerado a partir do arquivo existente, não redigitado, para que
-- as partes que não mudam fiquem idênticas.

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

  -- 2.4 O que ficava para trás — acrescentado depois que uma varredura mostrou
  -- que 9 das 14 tabelas com `user_id` não eram tocadas por esta função.
  --
  -- Três destinos, não dois. "Apagar ou preservar" não dá conta: há linha cujo
  -- REGISTRO precisa sobreviver e cuja IDENTIFICAÇÃO não.

  -- Apagar: sem titular, não têm função nenhuma.
  --
  -- `user_roles` é a mais importante das duas, e não é só LGPD: uma conta
  -- encerrada continuava carregando o papel dela. Dado de privilégio que
  -- sobrevive ao titular é problema de segurança antes de ser de privacidade.
  -- A trava do único administrador continua acima, e roda antes disto.
  delete from public.user_roles where user_id = _user_id;
  delete from public.hospital_members where user_id = _user_id;

  -- Anonimizar: o registro fica, a identificação sai.
  --
  -- O pedido de acesso guarda a decisão administrativa (status, motivo, quem
  -- decidiu e quando), que é registro de governança e continua valendo. Nome,
  -- e-mail, telefone e CRM não precisam sobreviver para isso.
  update public.access_requests
     set nome = 'Titular removido · ' || _codigo,
         email = null, telefone = null, crm = null, crm_uf = null,
         instituicao = null, cidade = null, uf = null, rqe = null, mensagem = null
   where user_id = _user_id;

  -- O pedido ao DPO é a PROVA de que o direito foi exercido e atendido —
  -- apagá-lo destruiria justamente o que demonstra conformidade. O CPF, o nome
  -- e o e-mail do requerente, não: saem.
  update public.dpo_requests
     set requester_name = 'Titular removido · ' || _codigo,
         requester_email = null, requester_cpf = null
   where user_id = _user_id;

  -- Telemetria de erro serve como estatística; o vínculo com a pessoa, não.
  -- Aqui basta soltar o `user_id` — a mensagem e a pilha ficam.
  update public.client_errors set user_id = null where user_id = _user_id;

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
      'outros', 'filtros salvos, notificações e autorizações de acesso a dados',
      'papeis', 'papéis de acesso e vínculos hospitalares removidos',
      'anonimizado', 'pedidos de acesso, pedidos ao DPO e relatórios de erro perdem a identificação e mantêm o registro'),
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
