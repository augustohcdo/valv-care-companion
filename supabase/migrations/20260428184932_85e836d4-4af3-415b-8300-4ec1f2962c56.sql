CREATE TABLE public.saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  scope TEXT NOT NULL DEFAULT 'cases',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved_filters - select"
  ON public.saved_filters FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own saved_filters - insert"
  ON public.saved_filters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own saved_filters - update"
  ON public.saved_filters FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own saved_filters - delete"
  ON public.saved_filters FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_saved_filters_updated_at
  BEFORE UPDATE ON public.saved_filters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.cases_pending_action(_doctor_user_id UUID)
RETURNS TABLE (
  case_id UUID,
  patient_name TEXT,
  status case_status,
  severity severity_level,
  last_activity TIMESTAMP WITH TIME ZONE,
  days_inactive INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    AND c.status NOT IN ('alta', 'arquivado')
    AND GREATEST(
      c.updated_at,
      COALESCE((SELECT MAX(created_at) FROM public.case_events  WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_exams   WHERE case_id = c.id), c.updated_at),
      COALESCE((SELECT MAX(created_at) FROM public.case_messages WHERE case_id = c.id), c.updated_at)
    ) < now() - interval '30 days'
  ORDER BY last_activity ASC
$$;

CREATE OR REPLACE FUNCTION public.doctor_weekly_digest(_doctor_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc UUID;
  v_new_cases INTEGER;
  v_appointments INTEGER;
  v_pending INTEGER;
  v_severe INTEGER;
BEGIN
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
$$;

CREATE OR REPLACE FUNCTION public.search_global(_query TEXT, _user_id UUID)
RETURNS TABLE (result_type TEXT, result_id UUID, title TEXT, subtitle TEXT, link TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'case'::text, c.id, c.patient_name,
         ('Caso ' || c.status::text || ' · ' || c.severity::text),
         ('/app/medico/casos/' || c.id::text)
  FROM public.clinical_cases c JOIN public.doctors d ON d.id = c.doctor_id
  WHERE d.user_id = _user_id AND c.patient_name ILIKE '%' || _query || '%'
  UNION ALL
  SELECT 'patient'::text, p.id, COALESCE(pr.full_name, 'Paciente'),
         COALESCE(p.city || '/' || p.uf, 'Paciente vinculado'),
         ('/app/medico/pacientes/' || p.id::text)
  FROM public.patients p JOIN public.doctors d ON d.id = p.linked_doctor_id
  JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE d.user_id = _user_id AND pr.full_name ILIKE '%' || _query || '%'
  LIMIT 20
$$;