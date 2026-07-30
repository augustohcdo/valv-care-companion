-- Fase 5: soft delete em exames, documentos e timeline (mesmo padrão de
-- clinical_cases/patients, ver 20260721023839_...sql:40-48). Sem essas
-- colunas, excluir um exame/documento/evento/compromisso era hard delete
-- de verdade, sem rastro de auditoria e sem possibilidade de recuperação.
ALTER TABLE public.case_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.case_exams ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.case_events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.patient_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_case_documents_not_deleted ON public.case_documents (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_case_exams_not_deleted ON public.case_exams (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_case_events_not_deleted ON public.case_events (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_not_deleted ON public.appointments (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_documents_not_deleted ON public.patient_documents (id) WHERE deleted_at IS NULL;

-- clinical_cases já usa soft delete na UI desde a Fase 2 (CasoDetalhe.tsx),
-- mas ainda tinha uma policy de hard-delete viva — remove-a para igualar a
-- postura já correta de `patients` (que nunca teve policy de DELETE).
DROP POLICY IF EXISTS "Doctor manages own cases - delete" ON public.clinical_cases;
