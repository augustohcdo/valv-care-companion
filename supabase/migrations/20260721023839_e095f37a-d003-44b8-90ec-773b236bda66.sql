-- 1) Enum de tipo de prótese
DO $$ BEGIN
  CREATE TYPE public.prosthesis_type AS ENUM (
    'biologica_aortica', 'biologica_mitral', 'anel_anuloplastia', 'tavi', 'mecanica'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Catálogo neutro de próteses
CREATE TABLE IF NOT EXISTS public.prosthesis_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  type public.prosthesis_type NOT NULL,
  model_name text NOT NULL,
  size integer,
  effective_orifice_area numeric,
  display_order integer NOT NULL DEFAULT 999,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prosthesis_catalog TO authenticated;
GRANT ALL ON public.prosthesis_catalog TO service_role;

ALTER TABLE public.prosthesis_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read catalog" ON public.prosthesis_catalog;
CREATE POLICY "Authenticated can read catalog"
  ON public.prosthesis_catalog FOR SELECT
  TO authenticated USING (active = true);

CREATE INDEX IF NOT EXISTS idx_prosthesis_catalog_order
  ON public.prosthesis_catalog (display_order ASC, manufacturer ASC, model_name ASC);

DROP TRIGGER IF EXISTS trg_prosthesis_updated ON public.prosthesis_catalog;
CREATE TRIGGER trg_prosthesis_updated
  BEFORE UPDATE ON public.prosthesis_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Soft delete em Casos e Pacientes
ALTER TABLE public.clinical_cases ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.clinical_cases ADD COLUMN IF NOT EXISTS prosthesis_id uuid REFERENCES public.prosthesis_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_cases_not_deleted
  ON public.clinical_cases (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_not_deleted
  ON public.patients (id) WHERE deleted_at IS NULL;

-- 4) Audit logs (append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id uuid,
  metadata jsonb,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can append own audit logs" ON public.audit_logs;
CREATE POLICY "Users can append own audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
  ON public.audit_logs (user_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs (target_table, target_id);

-- 5) Seed do catálogo (isenção comercial: ordenação por display_order)
INSERT INTO public.prosthesis_catalog (manufacturer, type, model_name, size, effective_orifice_area, display_order) VALUES
  ('Edwards',   'biologica_aortica', 'Inspiris Resilia', 21, 1.5,  1),
  ('Edwards',   'biologica_aortica', 'Inspiris Resilia', 23, 1.8,  1),
  ('Edwards',   'biologica_aortica', 'Inspiris Resilia', 25, 2.1,  1),
  ('Edwards',   'biologica_aortica', 'Magna Ease',       21, 1.4,  1),
  ('Edwards',   'biologica_aortica', 'Magna Ease',       23, 1.7,  1),
  ('Edwards',   'biologica_aortica', 'Magna Ease',       25, 2.0,  1),
  ('Medtronic', 'biologica_aortica', 'Avalus',           21, 1.4,  2),
  ('Medtronic', 'biologica_aortica', 'Avalus',           23, 1.6,  2),
  ('Medtronic', 'biologica_aortica', 'Avalus',           25, 1.9,  2),
  ('Abbott',    'biologica_aortica', 'Epic',             21, 1.3,  3),
  ('Abbott',    'biologica_aortica', 'Epic',             23, 1.5,  3),
  ('Abbott',    'biologica_aortica', 'Epic',             25, 1.8,  3)
ON CONFLICT DO NOTHING;
