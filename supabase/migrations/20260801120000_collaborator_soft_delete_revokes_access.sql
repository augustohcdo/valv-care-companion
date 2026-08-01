-- Remoção de colaborador volta a revogar o acesso de verdade.
--
-- A RLS de case_collaborators foi escrita (20260428180506) quando remover um
-- colaborador fazia DELETE: bastava checar cc.status = 'aceito', porque a linha
-- desaparecia. Depois que a tabela ganhou soft-delete (20260731000000) a linha
-- passou a ficar no banco com o status intacto, e o médico removido continuou
-- vendo o caso, comentando e recebendo notificação de comentários novos.
--
-- Esta migration acrescenta `cc.deleted_at IS NULL` aos cinco pontos que usam
-- case_collaborators como fonte de permissão. Nada mais do predicado muda.

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
            AND cc.deleted_at IS NULL
            AND d.user_id = _user_id
        )
      )
  )
$$;

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
        AND cc.deleted_at IS NULL
        AND d.user_id = _user_id
    )
$$;

DROP POLICY IF EXISTS "Collaborator views shared case" ON public.clinical_cases;
CREATE POLICY "Collaborator views shared case"
ON public.clinical_cases FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.case_collaborators cc
    JOIN public.doctors d ON d.id = cc.doctor_id
    WHERE cc.case_id = clinical_cases.id
      AND cc.status = 'aceito'
      AND cc.deleted_at IS NULL
      AND d.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Doctors of case view comments" ON public.case_comments;
CREATE POLICY "Doctors of case view comments"
ON public.case_comments FOR SELECT TO authenticated
USING (
  public.is_case_owner(case_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.case_collaborators cc
    JOIN public.doctors d ON d.id = cc.doctor_id
    WHERE cc.case_id = case_comments.case_id
      AND cc.status = 'aceito'
      AND cc.deleted_at IS NULL
      AND d.user_id = auth.uid()
  )
);

-- Colaborador removido também para de receber notificação de comentário novo.
CREATE OR REPLACE FUNCTION public.notify_new_case_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  -- Notifica colaboradores aceitos e ainda ativos (exceto autor)
  FOR rec IN
    SELECT d.user_id
    FROM public.case_collaborators cc
    JOIN public.doctors d ON d.id = cc.doctor_id
    WHERE cc.case_id = NEW.case_id
      AND cc.status = 'aceito'
      AND cc.deleted_at IS NULL
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
