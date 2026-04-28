-- Tipos
DO $$ BEGIN CREATE TYPE public.hospital_status AS ENUM ('pendente','ativo','suspenso','encerrado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.hospital_member_role AS ENUM ('admin_ti','medico_responsavel','operador'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.access_request_status AS ENUM ('pendente','aprovado','recusado','expirado','revogado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.access_purpose AS ENUM ('continuidade_cuidado','segunda_opiniao','pre_operatorio','pos_operatorio','emergencia','pesquisa_consentida','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fhir_resource_type AS ENUM ('Patient','Condition','Observation','DiagnosticReport','Encounter','Procedure','MedicationStatement','AllergyIntolerance','CarePlan','DocumentReference'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.audit_action AS ENUM ('request_created','request_approved','request_rejected','request_expired','grant_created','grant_revoked','grant_expired','resource_received','resource_sent','api_key_created','api_key_rotated','api_key_revoked','auth_failed','rate_limited','invalid_signature'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HOSPITALS
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL, trade_name TEXT,
  cnpj TEXT NOT NULL UNIQUE, cnes TEXT, city TEXT, uf TEXT,
  technical_responsible_name TEXT NOT NULL,
  technical_responsible_crm TEXT NOT NULL,
  technical_responsible_uf TEXT NOT NULL,
  contact_email TEXT NOT NULL, contact_phone TEXT,
  status public.hospital_status NOT NULL DEFAULT 'pendente',
  approved_at TIMESTAMPTZ, approved_by UUID, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hospitals_status ON public.hospitals(status);
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

-- HOSPITAL MEMBERS
CREATE TABLE public.hospital_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.hospital_member_role NOT NULL DEFAULT 'operador',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, user_id)
);
CREATE INDEX idx_hospital_members_user ON public.hospital_members(user_id) WHERE active;
ALTER TABLE public.hospital_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_hospital_member(_user_id UUID, _hospital_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hospital_members
                 WHERE user_id = _user_id AND hospital_id = _hospital_id AND active = true)
$$;

-- Policies hospitals (após is_hospital_member existir)
CREATE POLICY "Admins manage hospitals" ON public.hospitals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Members view own hospital" ON public.hospitals FOR SELECT TO authenticated
  USING (public.is_hospital_member(auth.uid(), id));

-- Policies members
CREATE POLICY "Members view own memberships" ON public.hospital_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage memberships" ON public.hospital_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- API KEYS
CREATE TABLE public.hospital_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['fhir.read','fhir.write']::TEXT[],
  ip_allowlist INET[],
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '180 days'),
  last_used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_hospital ON public.hospital_api_keys(hospital_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_prefix ON public.hospital_api_keys(key_prefix);
ALTER TABLE public.hospital_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage api keys" ON public.hospital_api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Hospital members view api keys" ON public.hospital_api_keys FOR SELECT TO authenticated
  USING (public.is_hospital_member(auth.uid(), hospital_id));

-- DATA ACCESS REQUESTS
CREATE TABLE public.data_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  requesting_doctor_name TEXT,
  requesting_doctor_crm TEXT,
  purpose public.access_purpose NOT NULL,
  purpose_details TEXT,
  resource_scopes public.fhir_resource_type[] NOT NULL DEFAULT ARRAY['Condition','Observation','MedicationStatement']::public.fhir_resource_type[],
  direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (direction IN ('inbound','outbound','bidirectional')),
  validity_days INTEGER NOT NULL DEFAULT 90 CHECK (validity_days BETWEEN 1 AND 365),
  status public.access_request_status NOT NULL DEFAULT 'pendente',
  patient_message TEXT,
  decision_at TIMESTAMPTZ,
  decision_note TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dar_patient ON public.data_access_requests(patient_id, status);
CREATE INDEX idx_dar_hospital ON public.data_access_requests(hospital_id, status);
ALTER TABLE public.data_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stakeholders view requests" ON public.data_access_requests FOR SELECT TO authenticated
  USING (patient_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.is_hospital_member(auth.uid(), hospital_id));
CREATE POLICY "Hospital members create requests" ON public.data_access_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_member(auth.uid(), hospital_id) AND requested_by = auth.uid());
CREATE POLICY "Patient or hospital update requests" ON public.data_access_requests FOR UPDATE TO authenticated
  USING (patient_id = auth.uid()
         OR public.is_hospital_member(auth.uid(), hospital_id)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- DATA ACCESS GRANTS
CREATE TABLE public.data_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.data_access_requests(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  resource_scopes public.fhir_resource_type[] NOT NULL,
  direction TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ, revoked_by UUID, revoke_reason TEXT
);
CREATE INDEX idx_grants_patient ON public.data_access_grants(patient_id);
CREATE INDEX idx_grants_hospital ON public.data_access_grants(hospital_id);
CREATE INDEX idx_grants_active ON public.data_access_grants(hospital_id, patient_id) WHERE revoked_at IS NULL;
ALTER TABLE public.data_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stakeholders view grants" ON public.data_access_grants FOR SELECT TO authenticated
  USING (patient_id = auth.uid()
         OR public.is_hospital_member(auth.uid(), hospital_id)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Patient revokes grants" ON public.data_access_grants FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.active_data_access_grants AS
  SELECT * FROM public.data_access_grants WHERE revoked_at IS NULL AND expires_at > now();

-- FHIR INBOUND
CREATE TABLE public.fhir_resources_inbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL,
  grant_id UUID REFERENCES public.data_access_grants(id) ON DELETE SET NULL,
  resource_type public.fhir_resource_type NOT NULL,
  fhir_id TEXT, payload JSONB NOT NULL, summary TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  case_id UUID, processed BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_inbound_patient ON public.fhir_resources_inbound(patient_id, received_at DESC);
CREATE INDEX idx_inbound_hospital ON public.fhir_resources_inbound(hospital_id, received_at DESC);
ALTER TABLE public.fhir_resources_inbound ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stakeholders view inbound" ON public.fhir_resources_inbound FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_hospital_member(auth.uid(), hospital_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.patients p
               JOIN public.doctors d ON d.id = p.linked_doctor_id
               WHERE p.user_id = fhir_resources_inbound.patient_id AND d.user_id = auth.uid())
  );

-- FHIR OUTBOUND
CREATE TABLE public.fhir_resources_outbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL,
  grant_id UUID NOT NULL REFERENCES public.data_access_grants(id) ON DELETE RESTRICT,
  resource_type public.fhir_resource_type NOT NULL,
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requester_ip INET
);
CREATE INDEX idx_outbound_patient ON public.fhir_resources_outbound(patient_id, sent_at DESC);
CREATE INDEX idx_outbound_hospital ON public.fhir_resources_outbound(hospital_id, sent_at DESC);
ALTER TABLE public.fhir_resources_outbound ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stakeholders view outbound" ON public.fhir_resources_outbound FOR SELECT TO authenticated
  USING (patient_id = auth.uid()
         OR public.is_hospital_member(auth.uid(), hospital_id)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- AUDIT LOG (append-only)
CREATE TABLE public.integration_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  patient_id UUID,
  actor_user_id UUID,
  api_key_id UUID REFERENCES public.hospital_api_keys(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  resource_type public.fhir_resource_type,
  resource_id UUID,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  ip_address INET, user_agent TEXT, metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_hospital ON public.integration_audit_log(hospital_id, created_at DESC);
CREATE INDEX idx_audit_patient ON public.integration_audit_log(patient_id, created_at DESC);
CREATE INDEX idx_audit_action ON public.integration_audit_log(action, created_at DESC);
ALTER TABLE public.integration_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit readable by stakeholders" ON public.integration_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR patient_id = auth.uid()
         OR (hospital_id IS NOT NULL AND public.is_hospital_member(auth.uid(), hospital_id)));

CREATE OR REPLACE FUNCTION public.log_integration_event(
  _hospital_id UUID, _patient_id UUID, _actor UUID, _api_key UUID,
  _action public.audit_action, _resource_type public.fhir_resource_type,
  _resource_id UUID, _success BOOLEAN, _error TEXT, _ip INET, _ua TEXT, _meta JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.integration_audit_log (
    hospital_id, patient_id, actor_user_id, api_key_id, action,
    resource_type, resource_id, success, error_message, ip_address, user_agent, metadata
  ) VALUES (_hospital_id,_patient_id,_actor,_api_key,_action,_resource_type,_resource_id,_success,_error,_ip,_ua,_meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE TRIGGER trg_hospitals_updated BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dar_updated BEFORE UPDATE ON public.data_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_access_request_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    INSERT INTO public.data_access_grants (request_id,hospital_id,patient_id,resource_scopes,direction,expires_at)
    VALUES (NEW.id,NEW.hospital_id,NEW.patient_id,NEW.resource_scopes,NEW.direction,
            now() + (NEW.validity_days || ' days')::INTERVAL);
    NEW.decision_at := now();
    PERFORM public.log_integration_event(NEW.hospital_id,NEW.patient_id,auth.uid(),NULL,
      'request_approved'::public.audit_action,NULL,NEW.id,true,NULL,NULL,NULL,
      jsonb_build_object('validity_days',NEW.validity_days));
  ELSIF NEW.status = 'recusado' AND (OLD.status IS DISTINCT FROM 'recusado') THEN
    NEW.decision_at := now();
    PERFORM public.log_integration_event(NEW.hospital_id,NEW.patient_id,auth.uid(),NULL,
      'request_rejected'::public.audit_action,NULL,NEW.id,true,NULL,NULL,NULL,NULL);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_access_request_decision BEFORE UPDATE ON public.data_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_access_request_approval();

CREATE OR REPLACE FUNCTION public.notify_access_request_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hospital_name TEXT;
BEGIN
  SELECT COALESCE(trade_name, legal_name) INTO v_hospital_name FROM public.hospitals WHERE id = NEW.hospital_id;
  PERFORM public.create_notification(
    NEW.patient_id,'system'::public.notification_type,
    'Pedido de acesso aos seus dados',
    COALESCE(v_hospital_name,'Um hospital parceiro') || ' solicitou acesso aos seus dados de saúde. Revise e decida.',
    '/app/paciente/integracoes'
  );
  PERFORM public.log_integration_event(NEW.hospital_id,NEW.patient_id,NEW.requested_by,NULL,
    'request_created'::public.audit_action,NULL,NEW.id,true,NULL,NULL,NULL,NULL);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_access_request_created AFTER INSERT ON public.data_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_access_request_created();