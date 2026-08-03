-- Os consentimentos aceitos no cadastro nunca chegavam ao banco.
--
-- A confirmação de e-mail é obrigatória neste projeto, e nesse modo o `signUp`
-- devolve `session: null`. O cliente gravava os consentimentos logo depois do
-- cadastro, mas a RLS de `user_consents` exige `auth.uid() = user_id` — sem
-- sessão, a gravação era negada. Como a chamada estava dentro de
-- `if (signupData.session)`, ela sequer era tentada: falhava em silêncio.
--
-- Prova nos dados: o único usuário real confirmou o e-mail 37 segundos após
-- criar a conta e tem zero consentimentos de cadastro. O que existe é um
-- `ai_processing` gravado 19 horas depois, por outra tela.
--
-- Os carimbos `terms_accepted_at`/`lgpd_accepted_at` do perfil estavam certos,
-- porque quem os grava é o gatilho abaixo. O que faltava era a trilha
-- granular — justamente a que serve de prova num pedido LGPD.
--
-- A correção não cabe no navegador: sem sessão ele não pode escrever. Vai para
-- o gatilho, que roda como SECURITY DEFINER no mesmo instante da criação da
-- conta. Assim não existe janela em que a conta exista sem o consentimento.

-- 1. O miolo do registro de consentimento, recebendo o usuário em vez de
--    depender de auth.uid(). Existia só dentro de `register_consent`, que
--    agora passa a ser uma casca fina sobre ele — para o gatilho e o portal
--    gravarem exatamente a mesma coisa, sem duas implementações divergindo.
create or replace function public.record_consent_for(
  _user uuid,
  _consent_type consent_type,
  _granted boolean,
  _document_version text default '1.0',
  _source text default null,
  _ip_address text default null,
  _user_agent text default null,
  _metadata jsonb default null
) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid;
begin
  insert into public.user_consents (
    user_id, consent_type, granted, granted_at, revoked_at, document_version, source
  ) values (
    _user, _consent_type, _granted,
    case when _granted then now() else null end,
    case when _granted then null else now() end,
    _document_version, _source
  )
  on conflict (user_id, consent_type) do update set
    granted = excluded.granted,
    granted_at = case when excluded.granted then now() else public.user_consents.granted_at end,
    revoked_at = case when excluded.granted then null else now() end,
    document_version = excluded.document_version,
    source = excluded.source,
    updated_at = now();

  insert into public.consent_audit_log (
    user_id, consent_type, action, document_version, source, ip_address, user_agent, metadata
  ) values (
    _user, _consent_type,
    case when _granted then 'granted'::consent_action else 'revoked'::consent_action end,
    _document_version, _source, _ip_address, _user_agent, _metadata
  ) returning id into v_id;

  return v_id;
end;
$$;

-- 2. O RPC do portal continua idêntico visto de fora: exige sessão e delega.
create or replace function public.register_consent(
  _consent_type consent_type,
  _granted boolean,
  _document_version text default '1.0',
  _source text default null,
  _ip_address text default null,
  _user_agent text default null,
  _metadata jsonb default null
) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_user uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'auth.uid() is null';
  end if;
  return public.record_consent_for(
    v_user, _consent_type, _granted, _document_version,
    _source, _ip_address, _user_agent, _metadata
  );
end;
$$;

-- 3. O gatilho passa a gravar os consentimentos e o telefone.
--
-- A versão do documento vem dos metadados (`consent_version`), não fixada
-- aqui: quem manda nela é `CONSENT_VERSION` em src/lib/consent.ts, e um número
-- repetido no SQL envelheceria sem ninguém perceber — foi assim que a lista de
-- tabelas do backup ficou para trás.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
DECLARE
  v_account_type TEXT;
  v_full_name TEXT;
  v_meta JSONB;
  v_doctor_id UUID;
  v_consent TEXT;
  v_version TEXT;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_account_type := COALESCE(v_meta->>'account_type', 'paciente');
  v_full_name := COALESCE(v_meta->>'full_name', NEW.email);

  INSERT INTO public.profiles (user_id, full_name, account_type, phone, terms_accepted_at, lgpd_accepted_at)
  VALUES (NEW.id, v_full_name, v_account_type, NULLIF(v_meta->>'phone', ''), now(), now());

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_account_type::public.app_role);

  IF v_account_type = 'medico' AND v_meta->>'crm' IS NOT NULL THEN
    INSERT INTO public.doctors (user_id, crm, crm_uf, specialty, institution)
    VALUES (
      NEW.id,
      v_meta->>'crm',
      COALESCE(v_meta->>'crm_uf', 'SP'),
      COALESCE(v_meta->>'specialty', 'Não informada'),
      v_meta->>'institution'
    );
  END IF;

  IF v_account_type = 'paciente' THEN
    v_doctor_id := NULL;
    IF v_meta->>'doctor_crm' IS NOT NULL AND v_meta->>'doctor_crm_uf' IS NOT NULL THEN
      SELECT id INTO v_doctor_id FROM public.doctors
      WHERE crm = v_meta->>'doctor_crm' AND crm_uf = v_meta->>'doctor_crm_uf'
      LIMIT 1;
    END IF;
    INSERT INTO public.patients (user_id, linked_doctor_id, linked_at)
    VALUES (NEW.id, v_doctor_id, CASE WHEN v_doctor_id IS NOT NULL THEN now() ELSE NULL END);
  END IF;

  -- Consentimentos aceitos no formulário. Um tipo desconhecido é ignorado em
  -- vez de derrubar a criação da conta: perder o cadastro inteiro por causa de
  -- um rótulo errado seria pior que perder um registro de consentimento — e a
  -- falha ficaria visível na ausência da linha.
  v_version := COALESCE(v_meta->>'consent_version', '1.0');
  IF jsonb_typeof(v_meta->'consents') = 'array' THEN
    FOR v_consent IN SELECT jsonb_array_elements_text(v_meta->'consents') LOOP
      BEGIN
        PERFORM public.record_consent_for(
          NEW.id, v_consent::public.consent_type, true, v_version, 'signup', NULL, NULL, NULL
        );
      EXCEPTION WHEN others THEN
        RAISE WARNING 'consentimento ignorado no cadastro: % (%)', v_consent, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
