-- O papel do usuário deixa de depender de uma proteção acidental.
--
-- `handle_new_user` converte `raw_user_meta_data->>'account_type'` — campo
-- preenchido pelo cliente no `signUp` — direto para o enum `app_role`, que
-- aceita `admin` e `hospital_admin`. Lendo só esse trecho, parece que dá para
-- se cadastrar como administrador.
--
-- NÃO DÁ, e eu confirmei tentando: `profiles.account_type` tem, desde a
-- primeira migration (20260427222208_...sql:24), a restrição
-- `CHECK (account_type IN ('medico','paciente'))`, e o INSERT no perfil vem
-- ANTES do INSERT no papel. A tentativa aborta com 23514 e a transação inteira
-- volta atrás — nenhuma conta é criada, nenhum papel é concedido.
--
-- Ou seja: o sistema está protegido, mas por acidente. Quem garante a
-- segurança é uma restrição de OUTRA coluna, valendo por causa da ORDEM dos
-- inserts. Nada no código diz que o papel não pode vir do cliente, e nada
-- avisaria se essa ordem mudasse.
--
-- Isso deixa de ser teórico agora: o cadastro de clínica e hospital está no
-- roadmap. No dia em que alguém acrescentar valores àquele CHECK para abrir a
-- frente comercial, a única barreira existente afrouxa — e `hospital_admin` já
-- está no enum, esperando.
--
-- A trava passa a ser explícita, dita no lugar onde a decisão acontece, antes
-- de qualquer escrita. Recusa em vez de rebaixar em silêncio: nenhum cadastro
-- legítimo manda outro valor (a tela envia 'medico' ou 'paciente' fixos), então
-- um valor fora da lista é bug ou tentativa — e vale falhar alto.

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

  -- A lista fechada. Fica aqui em cima, antes de qualquer INSERT, porque é
  -- aqui que o valor do cliente vira decisão nossa. Quem for abrir o cadastro
  -- de organização precisa passar por esta linha — e pensar duas vezes antes
  -- de acrescentar um valor que também exista em `app_role`.
  IF v_account_type NOT IN ('medico', 'paciente') THEN
    RAISE EXCEPTION 'account_type invalido no cadastro: %', left(v_account_type, 40)
      USING errcode = '22023';
  END IF;

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
  --
  -- Note a diferença de tratamento em relação ao account_type acima: lá o
  -- valor decide PERMISSÃO, e um valor estranho tem que parar tudo; aqui ele
  -- decide REGISTRO, e parar tudo custaria mais do que resolve.
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

-- Papel privilegiado é concessão rara e deliberada. Esta consulta alimenta o
-- vigia diário: se aparecer um `admin` que ninguém concedeu de propósito, o
-- aviso chega no dia seguinte em vez de nunca.
create or replace function public.recent_privileged_grants(_since timestamptz)
returns table (user_id uuid, role text, granted_at timestamptz)
language sql security definer set search_path to 'public'
as $$
  select ur.user_id, ur.role::text, ur.created_at
  from public.user_roles ur
  where ur.role in ('admin', 'hospital_admin')
    and ur.created_at >= _since
  order by ur.created_at desc;
$$;

revoke execute on function public.recent_privileged_grants(timestamptz) from public, anon, authenticated;
