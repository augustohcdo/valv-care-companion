ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hospital_admin';
ALTER TYPE public.consent_type ADD VALUE IF NOT EXISTS 'integracao_hospitalar';