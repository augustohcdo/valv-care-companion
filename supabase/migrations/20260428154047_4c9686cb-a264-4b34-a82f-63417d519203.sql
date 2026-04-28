
-- ENUMS
CREATE TYPE public.valve_type AS ENUM ('aortica', 'mitral', 'tricuspide', 'pulmonar', 'multipla');
CREATE TYPE public.valve_disease AS ENUM ('estenose', 'insuficiencia', 'mista', 'prolapso', 'protese_disfuncao', 'outra');
CREATE TYPE public.severity_level AS ENUM ('leve', 'moderada', 'importante', 'critica', 'indeterminada');
CREATE TYPE public.nyha_class AS ENUM ('I', 'II', 'III', 'IV');
CREATE TYPE public.case_status AS ENUM ('avaliacao_inicial', 'em_seguimento', 'pre_intervencao', 'pos_intervencao', 'alta', 'arquivado');
CREATE TYPE public.document_type AS ENUM ('ecocardiograma', 'ressonancia', 'tomografia', 'cateterismo', 'eletrocardiograma', 'laudo_medico', 'receita', 'exame_laboratorial', 'outro');

-- CLINICAL CASES
CREATE TABLE public.clinical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_age INTEGER,
  patient_sex TEXT,
  valve_type public.valve_type NOT NULL,
  valve_disease public.valve_disease NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'indeterminada',
  nyha public.nyha_class,
  symptoms TEXT[],
  comorbidities TEXT[],
  ejection_fraction NUMERIC(4,1),
  mean_gradient NUMERIC(5,1),
  peak_gradient NUMERIC(5,1),
  valve_area NUMERIC(4,2),
  regurgitation_grade TEXT,
  proposed_management TEXT,
  clinical_notes TEXT,
  status public.case_status NOT NULL DEFAULT 'avaliacao_inicial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_cases_doctor ON public.clinical_cases(doctor_id);
CREATE INDEX idx_clinical_cases_patient ON public.clinical_cases(patient_id);
CREATE INDEX idx_clinical_cases_status ON public.clinical_cases(status);

ALTER TABLE public.clinical_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor manages own cases - select"
  ON public.clinical_cases FOR SELECT TO authenticated
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

CREATE POLICY "Doctor manages own cases - insert"
  ON public.clinical_cases FOR INSERT TO authenticated
  WITH CHECK (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

CREATE POLICY "Doctor manages own cases - update"
  ON public.clinical_cases FOR UPDATE TO authenticated
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

CREATE POLICY "Doctor manages own cases - delete"
  ON public.clinical_cases FOR DELETE TO authenticated
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

CREATE POLICY "Patient views linked cases"
  ON public.clinical_cases FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE TRIGGER update_clinical_cases_updated_at
  BEFORE UPDATE ON public.clinical_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CASE DOCUMENTS
CREATE TABLE public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.clinical_cases(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  document_type public.document_type NOT NULL DEFAULT 'outro',
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_documents_case ON public.case_documents(case_id);

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

-- Helper: pode acessar caso?
CREATE OR REPLACE FUNCTION public.can_access_case(_case_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinical_cases c
    WHERE c.id = _case_id
      AND (
        c.doctor_id IN (SELECT id FROM public.doctors WHERE user_id = _user_id)
        OR c.patient_id IN (SELECT id FROM public.patients WHERE user_id = _user_id)
      )
  )
$$;

CREATE POLICY "Case participants view documents"
  ON public.case_documents FOR SELECT TO authenticated
  USING (public.can_access_case(case_id, auth.uid()));

CREATE POLICY "Case participants upload documents"
  ON public.case_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_access_case(case_id, auth.uid())
  );

CREATE POLICY "Doctor deletes case documents"
  ON public.case_documents FOR DELETE TO authenticated
  USING (
    case_id IN (
      SELECT c.id FROM public.clinical_cases c
      JOIN public.doctors d ON d.id = c.doctor_id
      WHERE d.user_id = auth.uid()
    )
  );

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-documents', 'medical-documents', false);

-- Storage policies: path = {case_id}/{filename}
CREATE POLICY "Case participants read files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND public.can_access_case(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Case participants upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical-documents'
    AND public.can_access_case(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "Case doctor deletes files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'medical-documents'
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT c.id FROM public.clinical_cases c
      JOIN public.doctors d ON d.id = c.doctor_id
      WHERE d.user_id = auth.uid()
    )
  );
