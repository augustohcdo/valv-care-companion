
-- 1) Tipo de notificação
CREATE TYPE public.notification_type AS ENUM (
  'patient_linked',
  'patient_unlinked',
  'case_created',
  'case_updated',
  'document_uploaded',
  'document_shared',
  'system'
);

-- 2) Tabela de notificações
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Inserts feitos por triggers SECURITY DEFINER, então bloqueamos insert direto.

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 3) Helper para criar notificação
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _type public.notification_type,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _link TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_user_id, _type, _title, _body, _link, _metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4) Trigger: vínculo paciente → médico
CREATE OR REPLACE FUNCTION public.notify_patient_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_user UUID;
  v_patient_name TEXT;
  v_doctor_name TEXT;
BEGIN
  -- Vínculo criado/alterado
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.linked_doctor_id IS DISTINCT FROM OLD.linked_doctor_id) THEN
    IF NEW.linked_doctor_id IS NOT NULL THEN
      SELECT d.user_id INTO v_doctor_user FROM public.doctors d WHERE d.id = NEW.linked_doctor_id;
      SELECT p.full_name INTO v_patient_name FROM public.profiles p WHERE p.user_id = NEW.user_id;
      SELECT p.full_name INTO v_doctor_name FROM public.profiles p WHERE p.user_id = v_doctor_user;

      -- Notifica médico
      IF v_doctor_user IS NOT NULL THEN
        PERFORM public.create_notification(
          v_doctor_user,
          'patient_linked',
          'Novo paciente vinculado',
          COALESCE(v_patient_name, 'Um paciente') || ' vinculou-se ao seu CRM.',
          '/app/medico/pacientes'
        );
      END IF;

      -- Notifica paciente
      PERFORM public.create_notification(
        NEW.user_id,
        'patient_linked',
        'Médico vinculado com sucesso',
        'Você está vinculado(a) a ' || COALESCE(v_doctor_name, 'seu médico') || '.',
        '/app/paciente/medico'
      );
    END IF;

    -- Desvínculo
    IF TG_OP = 'UPDATE' AND OLD.linked_doctor_id IS NOT NULL AND NEW.linked_doctor_id IS NULL THEN
      SELECT d.user_id INTO v_doctor_user FROM public.doctors d WHERE d.id = OLD.linked_doctor_id;
      SELECT p.full_name INTO v_patient_name FROM public.profiles p WHERE p.user_id = NEW.user_id;
      IF v_doctor_user IS NOT NULL THEN
        PERFORM public.create_notification(
          v_doctor_user,
          'patient_unlinked',
          'Paciente desvinculou',
          COALESCE(v_patient_name, 'Um paciente') || ' encerrou o vínculo.',
          '/app/medico/pacientes'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_link
AFTER INSERT OR UPDATE OF linked_doctor_id ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.notify_patient_link();

-- 5) Trigger: novo caso → notifica paciente vinculado
CREATE OR REPLACE FUNCTION public.notify_case_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_user UUID;
BEGIN
  IF NEW.patient_id IS NOT NULL THEN
    SELECT user_id INTO v_patient_user FROM public.patients WHERE id = NEW.patient_id;
    IF v_patient_user IS NOT NULL THEN
      PERFORM public.create_notification(
        v_patient_user,
        'case_created',
        'Novo caso clínico registrado',
        'Seu médico registrou um novo caso clínico em sua jornada.',
        '/app/paciente/jornada'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_created
AFTER INSERT ON public.clinical_cases
FOR EACH ROW EXECUTE FUNCTION public.notify_case_created();

-- 6) Trigger: documento enviado → notifica a outra parte
CREATE OR REPLACE FUNCTION public.notify_document_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_user UUID;
  v_patient_user UUID;
BEGIN
  SELECT d.user_id, p.user_id
    INTO v_doctor_user, v_patient_user
  FROM public.clinical_cases c
  LEFT JOIN public.doctors d ON d.id = c.doctor_id
  LEFT JOIN public.patients p ON p.id = c.patient_id
  WHERE c.id = NEW.case_id;

  -- Quem subiu não recebe notificação
  IF NEW.uploaded_by <> v_doctor_user AND v_doctor_user IS NOT NULL THEN
    PERFORM public.create_notification(
      v_doctor_user, 'document_uploaded',
      'Novo documento no caso',
      'Um novo documento foi anexado ao caso clínico.',
      '/app/medico/casos/' || NEW.case_id::text
    );
  END IF;
  IF NEW.uploaded_by <> v_patient_user AND v_patient_user IS NOT NULL THEN
    PERFORM public.create_notification(
      v_patient_user, 'document_uploaded',
      'Novo documento compartilhado',
      'Seu médico anexou um novo documento à sua jornada.',
      '/app/paciente/jornada'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_document_uploaded
AFTER INSERT ON public.case_documents
FOR EACH ROW EXECUTE FUNCTION public.notify_document_uploaded();

-- 7) Permitir paciente VINCULADO criar caso? Não. Mas permitir paciente fazer upload em casos onde é parte (já permitido por can_access_case).
-- Garantir que paciente vinculado consegue ver médico (já existe Doctors public directory = true).

-- 8) Bucket separado para documentos do paciente (uploads avulsos sem caso)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Tabela patient_documents (uploads avulsos do paciente)
CREATE TABLE public.patient_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  document_type TEXT NOT NULL DEFAULT 'outro',
  description TEXT,
  shared_with_doctor BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_documents_patient ON public.patient_documents(patient_id, created_at DESC);

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own documents - select"
ON public.patient_documents FOR SELECT TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own documents - insert"
ON public.patient_documents FOR INSERT TO authenticated
WITH CHECK (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Patient manages own documents - delete"
ON public.patient_documents FOR DELETE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Patient manages own documents - update"
ON public.patient_documents FOR UPDATE TO authenticated
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Linked doctor views patient documents"
ON public.patient_documents FOR SELECT TO authenticated
USING (
  shared_with_doctor = true
  AND patient_id IN (
    SELECT p.id FROM public.patients p
    JOIN public.doctors d ON d.id = p.linked_doctor_id
    WHERE d.user_id = auth.uid()
  )
);

-- Storage policies para patient-documents (path: {auth.uid}/...)
CREATE POLICY "Patient uploads own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Patient reads own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Patient deletes own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Linked doctor reads patient files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1 FROM public.patient_documents pd
    JOIN public.patients p ON p.id = pd.patient_id
    JOIN public.doctors d ON d.id = p.linked_doctor_id
    WHERE pd.storage_path = name
      AND pd.shared_with_doctor = true
      AND d.user_id = auth.uid()
  )
);

-- Trigger: documento avulso do paciente notifica médico vinculado
CREATE OR REPLACE FUNCTION public.notify_patient_doc_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_user UUID;
  v_patient_name TEXT;
BEGIN
  IF NEW.shared_with_doctor THEN
    SELECT d.user_id, pr.full_name INTO v_doctor_user, v_patient_name
    FROM public.patients p
    LEFT JOIN public.doctors d ON d.id = p.linked_doctor_id
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.id = NEW.patient_id;
    IF v_doctor_user IS NOT NULL THEN
      PERFORM public.create_notification(
        v_doctor_user, 'document_shared',
        'Paciente compartilhou documento',
        COALESCE(v_patient_name, 'Um paciente') || ' enviou um novo exame/documento.',
        '/app/medico/pacientes'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_doc_uploaded
AFTER INSERT ON public.patient_documents
FOR EACH ROW EXECUTE FUNCTION public.notify_patient_doc_uploaded();
