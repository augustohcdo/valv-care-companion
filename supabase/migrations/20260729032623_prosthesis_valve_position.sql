-- Adiciona posição valvar explícita ao catálogo de próteses, substituindo a
-- inferência por string-match no nome do modelo (que classificava errado
-- anéis tricúspide sem a palavra "tricusp" no nome, ex.: Contour 3D).
DO $$ BEGIN
  CREATE TYPE public.valve_position_type AS ENUM ('aortica', 'mitral', 'tricuspide');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS valve_position public.valve_position_type;

UPDATE public.prosthesis_catalog SET valve_position = 'aortica'
  WHERE type IN ('biologica_aortica', 'tavi');

UPDATE public.prosthesis_catalog SET valve_position = 'mitral'
  WHERE type = 'biologica_mitral';

UPDATE public.prosthesis_catalog SET valve_position = 'tricuspide'
  WHERE type = 'anel_anuloplastia' AND model_name IN ('MC3 Tricuspid (4900)', 'Contour 3D');

UPDATE public.prosthesis_catalog SET valve_position = 'mitral'
  WHERE type = 'anel_anuloplastia' AND valve_position IS NULL;

UPDATE public.prosthesis_catalog SET valve_position = 'mitral'
  WHERE type = 'mecanica' AND description ILIKE '%(mitral)%';

UPDATE public.prosthesis_catalog SET valve_position = 'aortica'
  WHERE type = 'mecanica' AND valve_position IS NULL;

ALTER TABLE public.prosthesis_catalog ALTER COLUMN valve_position SET NOT NULL;
