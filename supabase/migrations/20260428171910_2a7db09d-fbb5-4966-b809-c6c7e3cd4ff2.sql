
-- 1) Tipos
CREATE TYPE public.event_type AS ENUM (
  'consulta',
  'exame',
  'cirurgia',
  'internacao',
  'alta',
  'mudanca_nyha',
  'mudanca_severidade',
  'observacao',
  'medicacao'
);

CREATE TYPE public.appointment_type AS ENUM (
  'consulta_retorno',
  'exame',
  'procedimento',
  'cirurgia',
  'teleconsulta'
);

CREATE TYPE public.appointment_status AS ENUM (
  'agendado',
  'realizado',
  'cancelado',
  'remarcado',
  'faltou'
);

-- 2) case_events
CREATE TABLE public.case_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  created_by UUID NOT NULL,
  event_type public.event_type NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_events_case_date ON public.case_events(case_id, event_date DESC);

ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants view events"
ON public.case_events FOR SELECT TO authenticated
USING (can_access_case(case_id, auth.uid()));

CREATE POLICY "Doctor inserts case events"
ON public.case_events FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Doctor updates case events"
ON public.case_events FOR UPDATE TO authenticated
USING (
  case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Doctor deletes case events"
ON public.case_events FOR DELETE TO authenticated
USING (
  case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

-- 3) appointments
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  created_by UUID NOT NULL,
  appointment_type public.appointment_type NOT NULL DEFAULT 'consulta_retorno',
  status public.appointment_status NOT NULL DEFAULT 'agendado',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_case_date ON public.appointments(case_id, scheduled_at);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants view appointments"
ON public.appointments FOR SELECT TO authenticated
USING (can_access_case(case_id, auth.uid()));

CREATE POLICY "Doctor manages appointments - insert"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Doctor manages appointments - update"
ON public.appointments FOR UPDATE TO authenticated
USING (
  case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE POLICY "Doctor manages appointments - delete"
ON public.appointments FOR DELETE TO authenticated
USING (
  case_id IN (
    SELECT c.id FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE d.user_id = auth.uid()
  )
);

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Trigger: novo evento → notifica paciente
CREATE OR REPLACE FUNCTION public.notify_case_event_created()
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
      'Novo evento clínico registrado',
      NEW.title,
      '/app/paciente/jornada'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_event_created
AFTER INSERT ON public.case_events
FOR EACH ROW EXECUTE FUNCTION public.notify_case_event_created();

REVOKE EXECUTE ON FUNCTION public.notify_case_event_created() FROM anon, authenticated, PUBLIC;

-- 5) Trigger: appointment criado/alterado → notifica paciente
CREATE OR REPLACE FUNCTION public.notify_appointment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user UUID;
  v_when TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT p.user_id INTO v_patient_user
  FROM public.clinical_cases c
  LEFT JOIN public.patients p ON p.id = c.patient_id
  WHERE c.id = NEW.case_id;

  IF v_patient_user IS NULL OR v_patient_user = NEW.created_by THEN
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');

  IF TG_OP = 'INSERT' THEN
    v_title := 'Novo compromisso agendado';
    v_body := 'Seu médico agendou um compromisso para ' || v_when || '.';
  ELSIF NEW.status = 'cancelado' AND OLD.status <> 'cancelado' THEN
    v_title := 'Compromisso cancelado';
    v_body := 'O compromisso de ' || v_when || ' foi cancelado.';
  ELSIF NEW.scheduled_at <> OLD.scheduled_at THEN
    v_title := 'Compromisso remarcado';
    v_body := 'Nova data: ' || v_when || '.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    v_patient_user, 'case_updated',
    v_title, v_body, '/app/paciente/jornada'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_appointment_change
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_change();

REVOKE EXECUTE ON FUNCTION public.notify_appointment_change() FROM anon, authenticated, PUBLIC;
