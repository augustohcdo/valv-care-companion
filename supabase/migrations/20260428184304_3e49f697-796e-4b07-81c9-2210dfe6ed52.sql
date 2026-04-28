-- Enum dos tipos de consentimento
CREATE TYPE public.consent_type AS ENUM (
  'terms_of_use',
  'privacy_policy',
  'medical_disclaimer',
  'data_sharing_doctor',
  'email_communications',
  'ai_processing'
);

CREATE TYPE public.consent_action AS ENUM ('granted', 'revoked');

-- Estado atual dos consentimentos
CREATE TABLE public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type public.consent_type NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  document_version TEXT NOT NULL DEFAULT '1.0',
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, consent_type)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consents"
  ON public.user_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own consents"
  ON public.user_consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own consents"
  ON public.user_consents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_consents_updated_at
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auditoria imutável
CREATE TABLE public.consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type public.consent_type NOT NULL,
  action public.consent_action NOT NULL,
  document_version TEXT NOT NULL DEFAULT '1.0',
  source TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit log"
  ON public.consent_audit_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own audit log"
  ON public.consent_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_consent_audit_user_created ON public.consent_audit_log(user_id, created_at DESC);
CREATE INDEX idx_user_consents_user ON public.user_consents(user_id);

-- Função utilitária para registrar consentimento + auditoria
CREATE OR REPLACE FUNCTION public.register_consent(
  _consent_type public.consent_type,
  _granted BOOLEAN,
  _document_version TEXT DEFAULT '1.0',
  _source TEXT DEFAULT NULL,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_id UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null';
  END IF;

  INSERT INTO public.user_consents (
    user_id, consent_type, granted,
    granted_at, revoked_at, document_version, source
  ) VALUES (
    v_user, _consent_type, _granted,
    CASE WHEN _granted THEN now() ELSE NULL END,
    CASE WHEN _granted THEN NULL ELSE now() END,
    _document_version, _source
  )
  ON CONFLICT (user_id, consent_type) DO UPDATE SET
    granted = EXCLUDED.granted,
    granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE public.user_consents.granted_at END,
    revoked_at = CASE WHEN EXCLUDED.granted THEN NULL ELSE now() END,
    document_version = EXCLUDED.document_version,
    source = EXCLUDED.source,
    updated_at = now();

  INSERT INTO public.consent_audit_log (
    user_id, consent_type, action, document_version,
    source, ip_address, user_agent, metadata
  ) VALUES (
    v_user, _consent_type,
    CASE WHEN _granted THEN 'granted'::consent_action ELSE 'revoked'::consent_action END,
    _document_version, _source, _ip_address, _user_agent, _metadata
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Backfill com base nos perfis existentes
INSERT INTO public.user_consents (user_id, consent_type, granted, granted_at, document_version, source)
SELECT user_id, 'terms_of_use'::consent_type, true, terms_accepted_at, '1.0', 'backfill'
FROM public.profiles WHERE terms_accepted_at IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_consents (user_id, consent_type, granted, granted_at, document_version, source)
SELECT user_id, 'privacy_policy'::consent_type, true, lgpd_accepted_at, '1.0', 'backfill'
FROM public.profiles WHERE lgpd_accepted_at IS NOT NULL
ON CONFLICT DO NOTHING;