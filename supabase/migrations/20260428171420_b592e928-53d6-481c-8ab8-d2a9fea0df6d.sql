
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_patient_link() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_case_created() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_document_uploaded() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_patient_doc_uploaded() FROM anon, authenticated, PUBLIC;
