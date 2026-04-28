
-- Tabela de mensagens do chat por caso
CREATE TABLE public.case_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('medico', 'paciente')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_messages_case ON public.case_messages(case_id, created_at);
CREATE INDEX idx_case_messages_unread ON public.case_messages(case_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;

-- Participantes do caso podem ver
CREATE POLICY "Case participants view messages"
ON public.case_messages FOR SELECT TO authenticated
USING (public.can_access_case(case_id, auth.uid()));

-- Participantes podem inserir suas próprias mensagens
CREATE POLICY "Case participants send messages"
ON public.case_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.can_access_case(case_id, auth.uid())
);

-- Permite marcar como lida (apenas atualiza read_at de mensagens recebidas)
CREATE POLICY "Recipient marks as read"
ON public.case_messages FOR UPDATE TO authenticated
USING (
  public.can_access_case(case_id, auth.uid())
  AND sender_id <> auth.uid()
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_messages;
ALTER TABLE public.case_messages REPLICA IDENTITY FULL;

-- Notificação quando recebe mensagem
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_user UUID;
  v_patient_user UUID;
  v_recipient UUID;
  v_link TEXT;
BEGIN
  SELECT d.user_id, p.user_id
    INTO v_doctor_user, v_patient_user
  FROM public.clinical_cases c
  LEFT JOIN public.doctors d ON d.id = c.doctor_id
  LEFT JOIN public.patients p ON p.id = c.patient_id
  WHERE c.id = NEW.case_id;

  IF NEW.sender_role = 'medico' THEN
    v_recipient := v_patient_user;
    v_link := '/app/paciente/jornada';
  ELSE
    v_recipient := v_doctor_user;
    v_link := '/app/medico/casos/' || NEW.case_id::text;
  END IF;

  IF v_recipient IS NOT NULL AND v_recipient <> NEW.sender_id THEN
    PERFORM public.create_notification(
      v_recipient, 'system',
      'Nova mensagem',
      substring(NEW.body from 1 for 120),
      v_link
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.case_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Coluna para evitar lembretes duplicados em appointments
ALTER TABLE public.appointments
  ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE;
