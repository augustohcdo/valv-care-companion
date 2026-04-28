
-- 1) Doctors public directory: criar view com colunas não sensíveis e restringir tabela
DROP POLICY IF EXISTS "Doctors public directory" ON public.doctors;

CREATE POLICY "Authenticated users view doctors"
ON public.doctors FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE VIEW public.doctors_directory
WITH (security_invoker = true)
AS
SELECT
  id,
  specialty,
  crm_uf,
  city,
  institution,
  verified,
  created_at
FROM public.doctors;

GRANT SELECT ON public.doctors_directory TO anon, authenticated;

-- 2) Revogar EXECUTE de SECURITY DEFINER internas para anon/public
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_case_event_created() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_case_created() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_patient_link() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_patient_doc_uploaded() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_document_uploaded() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_case_exam_created() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_collaborator_invited() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_appointment_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_collaborator_response() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_severe_symptoms() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_case_comment() FROM anon, public;

-- Funções de leitura usadas pelo cliente: manter authenticated, revogar anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_owner_doctor(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_case_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_case(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_comment_case(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.doctor_weekly_digest(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cases_pending_action(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_global(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.register_consent(public.consent_type, boolean, text, text, text, text, jsonb) FROM anon, public;

-- doctor_weekly_digest, cases_pending_action e search_global devem validar caller = _user_id
-- para evitar que um usuário consulte dados de outro
CREATE OR REPLACE FUNCTION public.doctor_weekly_digest(_doctor_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc UUID;
  v_new_cases INTEGER;
  v_appointments INTEGER;
  v_pending INTEGER;
  v_severe INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _doctor_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT id INTO v_doc FROM public.doctors WHERE user_id = _doctor_user_id LIMIT 1;
  IF v_doc IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT COUNT(*) INTO v_new_cases FROM public.clinical_cases
  WHERE doctor_id = v_doc AND created_at >= now() - interval '7 days';

  SELECT COUNT(*) INTO v_appointments
  FROM public.appointments a JOIN public.clinical_cases c ON c.id = a.case_id
  WHERE c.doctor_id = v_doc
    AND a.scheduled_at BETWEEN now() AND now() + interval '7 days'
    AND a.status = 'agendado';

  SELECT COUNT(*) INTO v_pending FROM public.cases_pending_action(_doctor_user_id);

  SELECT COUNT(*) INTO v_severe FROM public.clinical_cases
  WHERE doctor_id = v_doc AND severity IN ('grave', 'critica')
    AND status NOT IN ('alta', 'arquivado');

  RETURN jsonb_build_object(
    'new_cases', v_new_cases,
    'upcoming_appointments', v_appointments,
    'pending_action', v_pending,
    'active_severe', v_severe
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cases_pending_action(_doctor_user_id uuid)
RETURNS TABLE(case_id uuid, patient_name text, status case_status, severity severity_level, last_activity timestamp with time zone, days_inactive integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.patient_name, c.status, c.severity,
    GREATEST(
      c.updated_at,
      COALESCE((SELECT MAX(created_at) FROM public.case_events  WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_exams   WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_messages WHERE case_id = c.id), c.updated_at)
    ) AS last_activity,
    EXTRACT(DAY FROM (now() - GREATEST(
      c.updated_at,
      COALESCE((SELECT MAX(created_at) FROM public.case_events  WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_exams   WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_messages WHERE case_id = c.id), c.updated_at)
    )))::INTEGER AS days_inactive
  FROM public.clinical_cases c
  JOIN public.doctors d ON d.id = c.doctor_id
  WHERE d.user_id = _doctor_user_id
    AND auth.uid() = _doctor_user_id
    AND c.status NOT IN ('alta', 'arquivado')
    AND GREATEST(
      c.updated_at,
      COALESCE((SELECT MAX(created_at) FROM public.case_events  WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_exams   WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_messages WHERE case_id = c.id), c.updated_at)
    ) < now() - interval '30 days'
  ORDER BY last_activity ASC
$function$;

CREATE OR REPLACE FUNCTION public.search_global(_query text, _user_id uuid)
RETURNS TABLE(result_type text, result_id uuid, title text, subtitle text, link text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 'case'::text, c.id, c.patient_name,
         ('Caso ' || c.status::text || ' · ' || c.severity::text),
         ('/app/medico/casos/' || c.id::text)
  FROM public.clinical_cases c JOIN public.doctors d ON d.id = c.doctor_id
  WHERE d.user_id = _user_id
    AND auth.uid() = _user_id
    AND c.patient_name ILIKE '%' || _query || '%'
  UNION ALL
  SELECT 'patient'::text, p.id, COALESCE(pr.full_name, 'Paciente'),
         COALESCE(p.city || '/' || p.uf, 'Paciente vinculado'),
         ('/app/medico/pacientes/' || p.id::text)
  FROM public.patients p JOIN public.doctors d ON d.id = p.linked_doctor_id
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE d.user_id = _user_id
    AND auth.uid() = _user_id
    AND pr.full_name ILIKE '%' || _query || '%'
  LIMIT 20
$function$;

GRANT EXECUTE ON FUNCTION public.doctor_weekly_digest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cases_pending_action(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_global(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_doctor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_case_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_comment_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_consent(public.consent_type, boolean, text, text, text, text, jsonb) TO authenticated;

-- 3) UPDATE policy faltante em case_documents
CREATE POLICY "Uploader or doctor updates case_documents"
ON public.case_documents FOR UPDATE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

-- 4) Storage: política de UPDATE no bucket medical-documents (somente uploader, identificado pela 1ª pasta)
CREATE POLICY "Owner can update medical-documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'medical-documents' AND owner = auth.uid())
WITH CHECK (bucket_id = 'medical-documents' AND owner = auth.uid());

-- 5) Realtime: restringir mensagens dos canais por topic baseado no user_id do assinante
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users on own topics" ON realtime.messages;
CREATE POLICY "Authenticated users on own topics"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  -- topic é uma string definida pelo cliente; restringimos a leitura a quando o
  -- topic contém o próprio user_id ou começa com prefixos públicos do app
  (realtime.topic() LIKE 'user:' || auth.uid()::text || '%')
  OR (realtime.topic() LIKE 'public:%')
);
