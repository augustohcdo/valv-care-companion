CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type TEXT;
  v_full_name TEXT;
  v_meta JSONB;
  v_doctor_id UUID;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_account_type := COALESCE(v_meta->>'account_type', 'paciente');
  v_full_name := COALESCE(v_meta->>'full_name', NEW.email);

  INSERT INTO public.profiles (user_id, full_name, account_type, terms_accepted_at, lgpd_accepted_at)
  VALUES (NEW.id, v_full_name, v_account_type, now(), now());

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

  RETURN NEW;
END;
$$;