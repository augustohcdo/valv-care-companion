-- saved_filters não tinha índice em user_id (diferente das demais FKs do schema).
-- Toda leitura do painel filtra por auth.uid() = user_id via RLS; sem índice, isso é seq scan.
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id
  ON public.saved_filters (user_id);
