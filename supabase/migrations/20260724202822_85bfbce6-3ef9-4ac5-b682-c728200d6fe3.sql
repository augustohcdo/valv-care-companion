-- Restringe leitura direta de knowledge_chunks a chunks revisados ou admins.
-- match_knowledge (SECURITY DEFINER) continua funcionando normalmente.
DROP POLICY IF EXISTS "Authenticated read knowledge_chunks" ON public.knowledge_chunks;

CREATE POLICY "Read reviewed chunks or admin"
  ON public.knowledge_chunks FOR SELECT
  TO authenticated
  USING (
    review_status = 'reviewed'
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );