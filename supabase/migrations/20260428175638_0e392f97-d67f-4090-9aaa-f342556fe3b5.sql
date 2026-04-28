-- Tipo do exame
CREATE TYPE public.exam_type AS ENUM (
  'eco', 'ecg', 'bnp', 'ergometria', 'hemodinamica', 'ressonancia', 'tomografia', 'outro'
);

-- Tabela de exames seriados
CREATE TABLE public.case_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  created_by UUID NOT NULL,
  exam_type public.exam_type NOT NULL DEFAULT 'eco',
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT,
  -- Parâmetros ecocardiográficos
  ejection_fraction NUMERIC,
  mean_gradient NUMERIC,
  peak_gradient NUMERIC,
  valve_area NUMERIC,
  regurgitation_grade TEXT,
  psap NUMERIC,
  lv_diameter NUMERIC,
  septal_thickness NUMERIC,
  -- Biomarcadores e funcionais
  bnp NUMERIC,
  nt_probnp NUMERIC,
  six_min_walk NUMERIC,
  -- Outros
  notes TEXT,
  document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_exams_case_date ON public.case_exams(case_id, exam_date DESC);

ALTER TABLE public.case_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants view exams"
ON public.case_exams FOR SELECT TO authenticated
USING (public.can_access_case(case_id, auth.uid()));

CREATE POLICY "Doctor inserts exams"
ON public.case_exams FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Doctor updates exams"
ON public.case_exams FOR UPDATE TO authenticated
USING (
  case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Doctor deletes exams"
ON public.case_exams FOR DELETE TO authenticated
USING (
  case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE TRIGGER update_case_exams_updated_at
BEFORE UPDATE ON public.case_exams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifica paciente quando médico adiciona um novo exame
CREATE OR REPLACE FUNCTION public.notify_case_exam_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user UUID;
BEGIN
  SELECT p.user_id INTO v_patient_user
  FROM public.clinical_cases c
  LEFT JOIN public.patients p ON p.id = c.patient_id
  WHERE c.id = NEW.case_id;

  IF v_patient_user IS NOT NULL AND v_patient_user <> NEW.created_by THEN
    PERFORM public.create_notification(
      v_patient_user, 'case_updated',
      'Novo exame registrado',
      'Seu médico adicionou um novo exame ao seu caso.',
      '/app/paciente/jornada'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_case_exam_created
AFTER INSERT ON public.case_exams
FOR EACH ROW EXECUTE FUNCTION public.notify_case_exam_created();