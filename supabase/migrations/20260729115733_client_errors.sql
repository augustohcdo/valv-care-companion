-- Monitoramento de erros em produção: captura falhas client-side (via
-- report-error) e de edge functions (via helper logError), visível só a
-- admins. Sem policy de INSERT: apenas service_role escreve (RLS nega
-- authenticated/anon por padrão), evitando abuso de escrita direta na tabela.
CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  context text NOT NULL,
  message text NOT NULL,
  stack text,
  user_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.client_errors TO authenticated;
GRANT ALL ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads client_errors"
  ON public.client_errors FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_client_errors_created ON public.client_errors (created_at DESC);
