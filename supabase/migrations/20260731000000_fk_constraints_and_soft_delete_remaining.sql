-- FK constraints em case_exams/case_events/appointments.case_id — hoje eram
-- UUID sem REFERENCES nenhuma, diferente de case_documents (que já tem
-- ON DELETE CASCADE). Confirmado antes de aplicar: zero linhas órfãs nas
-- 3 tabelas (SELECT ... WHERE NOT EXISTS ... = 0 nas três).
ALTER TABLE public.case_exams
  ADD CONSTRAINT case_exams_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.clinical_cases(id) ON DELETE CASCADE;

ALTER TABLE public.case_events
  ADD CONSTRAINT case_events_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.clinical_cases(id) ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.clinical_cases(id) ON DELETE CASCADE;

-- Soft delete nas 4 tabelas restantes (mesmo padrão já usado em
-- clinical_cases/patients e nas 5 tabelas da Fase 5).
ALTER TABLE public.case_comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.case_collaborators ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.symptom_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_case_comments_not_deleted ON public.case_comments (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_case_collaborators_not_deleted ON public.case_collaborators (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_symptom_entries_not_deleted ON public.symptom_entries (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_not_deleted ON public.notifications (id) WHERE deleted_at IS NULL;
