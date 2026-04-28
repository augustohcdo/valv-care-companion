DROP VIEW IF EXISTS public.active_data_access_grants;
CREATE VIEW public.active_data_access_grants
WITH (security_invoker = true) AS
  SELECT * FROM public.data_access_grants
  WHERE revoked_at IS NULL AND expires_at > now();