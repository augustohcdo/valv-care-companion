-- Enum para status e tipo de direito
CREATE TYPE public.dpo_request_status AS ENUM ('recebido', 'em_verificacao', 'atendido', 'negado', 'parcialmente_atendido');
CREATE TYPE public.dpo_right_type AS ENUM (
  'confirmacao', 'acesso', 'correcao', 'anonimizacao',
  'portabilidade', 'eliminacao', 'compartilhamento',
  'consentimento', 'revisao'
);

CREATE TABLE public.dpo_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  right_type public.dpo_right_type NOT NULL,
  status public.dpo_request_status NOT NULL DEFAULT 'recebido',
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_cpf TEXT,
  details TEXT,
  legal_basis TEXT,
  response TEXT,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 days'),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dpo_requests ENABLE ROW LEVEL SECURITY;

-- Usuário cria sua própria solicitação
CREATE POLICY "Users insert own DPO requests"
ON public.dpo_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Usuário visualiza apenas suas solicitações
CREATE POLICY "Users view own DPO requests"
ON public.dpo_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Apenas admin pode atualizar (status, resposta etc.)
CREATE POLICY "Admins update DPO requests"
ON public.dpo_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin visualiza tudo
CREATE POLICY "Admins view all DPO requests"
ON public.dpo_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_dpo_requests_user ON public.dpo_requests(user_id, created_at DESC);
CREATE INDEX idx_dpo_requests_status ON public.dpo_requests(status);

CREATE TRIGGER update_dpo_requests_updated_at
BEFORE UPDATE ON public.dpo_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();