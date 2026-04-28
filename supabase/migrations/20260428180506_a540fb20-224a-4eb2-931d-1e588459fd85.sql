-- ============= ENUMs =============
CREATE TYPE public.collaborator_access AS ENUM ('leitura', 'comentar');
CREATE TYPE public.collaborator_status AS ENUM ('pendente', 'aceito', 'recusado', 'removido');

-- ============= TABELA case_collaborators =============
CREATE TABLE public.case_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  access_level public.collaborator_access NOT NULL DEFAULT 'comentar',
  status public.collaborator_status NOT NULL DEFAULT 'pendente',
  message TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, doctor_id)
);

CREATE INDEX idx_case_collab_case ON public.case_collaborators(case_id);
CREATE INDEX idx_case_collab_doctor ON public.case_collaborators(doctor_id);

ALTER TABLE public.case_collaborators ENABLE ROW LEVEL SECURITY;

-- Função helper: doctor_id pertence ao usuário?
CREATE OR REPLACE FUNCTION public.is_owner_doctor(_doctor_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.doctors WHERE id = _doctor_id AND user_id = _user_id)
$$;

-- Função helper: caso pertence ao médico (usuário)?
CREATE OR REPLACE FUNCTION public.is_case_owner(_case_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE c.id = _case_id AND d.user_id = _user_id
  )
$$;

-- RLS case_collaborators
CREATE POLICY "Owner doctor manages collaborators - select"
ON public.case_collaborators FOR SELECT TO authenticated
USING (
  public.is_case_owner(case_id, auth.uid())
  OR public.is_owner_doctor(doctor_id, auth.uid())
);

CREATE POLICY "Owner doctor manages collaborators - insert"
ON public.case_collaborators FOR INSERT TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND public.is_case_owner(case_id, auth.uid())
);

CREATE POLICY "Owner doctor or invitee updates collaborator"
ON public.case_collaborators FOR UPDATE TO authenticated
USING (
  public.is_case_owner(case_id, auth.uid())
  OR public.is_owner_doctor(doctor_id, auth.uid())
);

CREATE POLICY "Owner doctor removes collaborator"
ON public.case_collaborators FOR DELETE TO authenticated
USING (public.is_case_owner(case_id, auth.uid()));

CREATE TRIGGER update_case_collab_updated_at
BEFORE UPDATE ON public.case_collaborators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= ATUALIZA can_access_case PARA INCLUIR COLABORADORES =============
CREATE OR REPLACE FUNCTION public.can_access_case(_case_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinical_cases c
    WHERE c.id = _case_id
      AND (
        c.doctor_id IN (SELECT id FROM public.doctors WHERE user_id = _user_id)
        OR c.patient_id IN (SELECT id FROM public.patients WHERE user_id = _user_id)
        OR EXISTS (
          SELECT 1 FROM public.case_collaborators cc
          JOIN public.doctors d ON d.id = cc.doctor_id
          WHERE cc.case_id = _case_id
            AND cc.status = 'aceito'
            AND d.user_id = _user_id
        )
      )
  )
$$;

-- Permite colaborador aceito ver o caso (RLS adicional, sem afetar políticas existentes)
CREATE POLICY "Collaborator views shared case"
ON public.clinical_cases FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.case_collaborators cc
    JOIN public.doctors d ON d.id = cc.doctor_id
    WHERE cc.case_id = clinical_cases.id
      AND cc.status = 'aceito'
      AND d.user_id = auth.uid()
  )
);

-- ============= TABELA case_comments =============
CREATE TABLE public.case_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL,
  author_id UUID NOT NULL,
  author_doctor_id UUID,
  body TEXT NOT NULL,
  is_heart_team_decision BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_comments_case ON public.case_comments(case_id, created_at DESC);

ALTER TABLE public.case_comments ENABLE ROW LEVEL SECURITY;

-- Helper: usuário pode comentar (responsável OU colaborador com nível 'comentar')
CREATE OR REPLACE FUNCTION public.can_comment_case(_case_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_case_owner(_case_id, _user_id)
    OR EXISTS (
      SELECT 1 FROM public.case_collaborators cc
      JOIN public.doctors d ON d.id = cc.doctor_id
      WHERE cc.case_id = _case_id
        AND cc.status = 'aceito'
        AND cc.access_level = 'comentar'
        AND d.user_id = _user_id
    )
$$;

-- RLS comentários: visíveis a médico responsável e colaboradores aceitos (paciente NÃO vê)
CREATE POLICY "Doctors of case view comments"
ON public.case_comments FOR SELECT TO authenticated
USING (
  public.is_case_owner(case_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.case_collaborators cc
    JOIN public.doctors d ON d.id = cc.doctor_id
    WHERE cc.case_id = case_comments.case_id
      AND cc.status = 'aceito'
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Authorized doctors insert comments"
ON public.case_comments FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.can_comment_case(case_id, auth.uid())
);

CREATE POLICY "Author updates own comment"
ON public.case_comments FOR UPDATE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Author or owner deletes comment"
ON public.case_comments FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR public.is_case_owner(case_id, auth.uid())
);

CREATE TRIGGER update_case_comments_updated_at
BEFORE UPDATE ON public.case_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= TRIGGERS DE NOTIFICAÇÃO =============

-- Convite criado: notifica médico convidado
CREATE OR REPLACE FUNCTION public.notify_collaborator_invited()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doctor_user UUID;
  v_inviter_name TEXT;
BEGIN
  SELECT user_id INTO v_doctor_user FROM public.doctors WHERE id = NEW.doctor_id;
  SELECT full_name INTO v_inviter_name FROM public.profiles WHERE user_id = NEW.invited_by;
  IF v_doctor_user IS NOT NULL AND v_doctor_user <> NEW.invited_by THEN
    PERFORM public.create_notification(
      v_doctor_user, 'system',
      'Convite para discutir caso',
      COALESCE(v_inviter_name, 'Um colega') || ' convidou você para discutir um caso clínico.',
      '/app/medico/casos/' || NEW.case_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_collab_invited
AFTER INSERT ON public.case_collaborators
FOR EACH ROW EXECUTE FUNCTION public.notify_collaborator_invited();

-- Convite respondido: notifica médico responsável
CREATE OR REPLACE FUNCTION public.notify_collaborator_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_user UUID;
  v_collab_name TEXT;
  v_status_label TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('aceito', 'recusado') THEN RETURN NEW; END IF;

  SELECT d.user_id INTO v_owner_user
  FROM public.clinical_cases c
  JOIN public.doctors d ON d.id = c.doctor_id
  WHERE c.id = NEW.case_id;

  SELECT pr.full_name INTO v_collab_name
  FROM public.doctors d
  JOIN public.profiles pr ON pr.user_id = d.user_id
  WHERE d.id = NEW.doctor_id;

  v_status_label := CASE WHEN NEW.status = 'aceito' THEN 'aceitou' ELSE 'recusou' END;

  IF v_owner_user IS NOT NULL THEN
    PERFORM public.create_notification(
      v_owner_user, 'system',
      'Resposta ao convite de colaboração',
      COALESCE(v_collab_name, 'Um colega') || ' ' || v_status_label || ' o convite para discutir o caso.',
      '/app/medico/casos/' || NEW.case_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_collab_response
AFTER UPDATE ON public.case_collaborators
FOR EACH ROW EXECUTE FUNCTION public.notify_collaborator_response();

-- Novo comentário: notifica todos os médicos do caso (exceto autor)
CREATE OR REPLACE FUNCTION public.notify_new_case_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec RECORD;
  v_link TEXT;
BEGIN
  v_link := '/app/medico/casos/' || NEW.case_id::text;

  -- Notifica responsável (se não for o autor)
  FOR rec IN
    SELECT d.user_id
    FROM public.clinical_cases c
    JOIN public.doctors d ON d.id = c.doctor_id
    WHERE c.id = NEW.case_id AND d.user_id <> NEW.author_id
  LOOP
    PERFORM public.create_notification(
      rec.user_id, 'system',
      'Novo comentário no caso',
      substring(NEW.body from 1 for 120),
      v_link
    );
  END LOOP;

  -- Notifica colaboradores aceitos (exceto autor)
  FOR rec IN
    SELECT d.user_id
    FROM public.case_collaborators cc
    JOIN public.doctors d ON d.id = cc.doctor_id
    WHERE cc.case_id = NEW.case_id
      AND cc.status = 'aceito'
      AND d.user_id <> NEW.author_id
  LOOP
    PERFORM public.create_notification(
      rec.user_id, 'system',
      'Novo comentário no caso',
      substring(NEW.body from 1 for 120),
      v_link
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_case_comment
AFTER INSERT ON public.case_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_case_comment();

-- Realtime para discussão ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_collaborators;