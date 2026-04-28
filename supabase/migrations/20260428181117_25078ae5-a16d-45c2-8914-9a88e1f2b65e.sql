-- ============= ENUMs =============
CREATE TYPE public.medication_log_status AS ENUM ('tomado', 'atrasado', 'esquecido', 'pulado');

-- ============= symptom_entries =============
CREATE TABLE public.symptom_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dyspnea INTEGER CHECK (dyspnea BETWEEN 0 AND 10),
  fatigue INTEGER CHECK (fatigue BETWEEN 0 AND 10),
  chest_pain INTEGER CHECK (chest_pain BETWEEN 0 AND 10),
  palpitations INTEGER CHECK (palpitations BETWEEN 0 AND 10),
  edema BOOLEAN NOT NULL DEFAULT false,
  syncope BOOLEAN NOT NULL DEFAULT false,
  orthopnea BOOLEAN NOT NULL DEFAULT false,
  weight_kg NUMERIC,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, entry_date)
);

CREATE INDEX idx_symptom_entries_patient_date ON public.symptom_entries(patient_id, entry_date DESC);

ALTER TABLE public.symptom_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own symptoms - select"
ON public.symptom_entries FOR SELECT TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own symptoms - insert"
ON public.symptom_entries FOR INSERT TO authenticated
WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own symptoms - update"
ON public.symptom_entries FOR UPDATE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own symptoms - delete"
ON public.symptom_entries FOR DELETE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Linked doctor views symptoms"
ON public.symptom_entries FOR SELECT TO authenticated
USING (
  patient_id IN (
    SELECT p.id FROM public.patients p
    JOIN public.doctors d ON d.id = p.linked_doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE TRIGGER update_symptom_entries_updated_at
BEFORE UPDATE ON public.symptom_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= medications =============
CREATE TABLE public.medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  prescribed_by UUID,
  name TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  times TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medications_patient ON public.medications(patient_id, active);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own meds - select"
ON public.medications FOR SELECT TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own meds - insert"
ON public.medications FOR INSERT TO authenticated
WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own meds - update"
ON public.medications FOR UPDATE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own meds - delete"
ON public.medications FOR DELETE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Linked doctor views meds"
ON public.medications FOR SELECT TO authenticated
USING (
  patient_id IN (
    SELECT p.id FROM public.patients p
    JOIN public.doctors d ON d.id = p.linked_doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Linked doctor prescribes med"
ON public.medications FOR INSERT TO authenticated
WITH CHECK (
  patient_id IN (
    SELECT p.id FROM public.patients p
    JOIN public.doctors d ON d.id = p.linked_doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE TRIGGER update_medications_updated_at
BEFORE UPDATE ON public.medications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= medication_logs =============
CREATE TABLE public.medication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time TEXT NOT NULL,
  status public.medication_log_status NOT NULL DEFAULT 'tomado',
  taken_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (medication_id, log_date, scheduled_time)
);

CREATE INDEX idx_med_logs_patient_date ON public.medication_logs(patient_id, log_date DESC);

ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own med logs - select"
ON public.medication_logs FOR SELECT TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own med logs - insert"
ON public.medication_logs FOR INSERT TO authenticated
WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own med logs - update"
ON public.medication_logs FOR UPDATE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own med logs - delete"
ON public.medication_logs FOR DELETE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Linked doctor views med logs"
ON public.medication_logs FOR SELECT TO authenticated
USING (
  patient_id IN (
    SELECT p.id FROM public.patients p
    JOIN public.doctors d ON d.id = p.linked_doctor_id
    WHERE d.user_id = auth.uid()
  )
);

-- ============= Notificação: paciente reporta sintomas graves =============
CREATE OR REPLACE FUNCTION public.notify_severe_symptoms()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doctor_user UUID;
  v_patient_name TEXT;
  v_alerts TEXT[];
BEGIN
  -- Coleta alertas
  v_alerts := ARRAY[]::TEXT[];
  IF NEW.dyspnea >= 7 THEN v_alerts := array_append(v_alerts, 'dispneia intensa'); END IF;
  IF NEW.chest_pain >= 7 THEN v_alerts := array_append(v_alerts, 'dor torácica intensa'); END IF;
  IF NEW.syncope THEN v_alerts := array_append(v_alerts, 'síncope'); END IF;
  IF NEW.orthopnea AND NEW.dyspnea >= 5 THEN v_alerts := array_append(v_alerts, 'ortopneia'); END IF;

  IF array_length(v_alerts, 1) IS NULL THEN RETURN NEW; END IF;

  SELECT d.user_id, pr.full_name
  INTO v_doctor_user, v_patient_name
  FROM public.patients p
  LEFT JOIN public.doctors d ON d.id = p.linked_doctor_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.id = NEW.patient_id;

  IF v_doctor_user IS NOT NULL THEN
    PERFORM public.create_notification(
      v_doctor_user, 'system',
      'Alerta clínico — sintomas relatados',
      COALESCE(v_patient_name, 'Um paciente') || ' reportou: ' || array_to_string(v_alerts, ', ') || '.',
      '/app/medico/pacientes'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_severe_symptoms
AFTER INSERT OR UPDATE ON public.symptom_entries
FOR EACH ROW EXECUTE FUNCTION public.notify_severe_symptoms();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.symptom_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_logs;