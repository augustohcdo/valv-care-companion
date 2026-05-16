
-- Revoga EXECUTE público de TODAS as funções SECURITY DEFINER do schema public
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_access_request_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_access_request_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_appointment_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_case_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_case_event_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_case_exam_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collaborator_invited() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collaborator_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_document_uploaded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_case_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_patient_doc_uploaded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_patient_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_severe_symptoms() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, notification_type, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_integration_event(uuid, uuid, uuid, uuid, audit_action, fhir_resource_type, uuid, boolean, text, inet, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Helpers de RLS: revoga público, mantém para authenticated (RLS as authenticated chama essas funções)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_case(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_case(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_comment_case(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_comment_case(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_case_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_case_owner(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_owner_doctor(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_owner_doctor(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_hospital_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_hospital_member(uuid, uuid) TO authenticated;

-- RPCs explícitas chamadas pelo app — apenas authenticated
REVOKE EXECUTE ON FUNCTION public.register_consent(consent_type, boolean, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.register_consent(consent_type, boolean, text, text, text, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_global(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.search_global(text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cases_pending_action(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cases_pending_action(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.doctor_weekly_digest(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.doctor_weekly_digest(uuid) TO authenticated;
