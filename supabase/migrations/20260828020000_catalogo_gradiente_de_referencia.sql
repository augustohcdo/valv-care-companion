-- ============================================================================
-- Coluna própria para o gradiente médio de referência.
--
-- A ASE 2024 publica, junto da EOA, o gradiente médio de cada modelo e tamanho —
-- o dado de "performance" que o catálogo devia mostrar. Ele existe para 80 dos
-- 87 tamanhos que têm EOA.
--
-- ## Por que esta migration nasceu separada
--
-- Os dados da rodada foram gravados pelo PostgREST com a `service_role`, e o
-- script que os grava está versionado em `scripts/catalogo/` — é ele, e não um
-- bloco de UPDATE aqui, o artefato reproduzível.
--
-- O que não deu para aplicar na hora foi DDL: o token da Management API do
-- projeto expirou no meio da rodada, e a `service_role` não executa comando de
-- esquema. Enquanto isso o gradiente ficou numa frase demarcada dentro de
-- `description` — dava para ler, mas o recomendador não conseguia usá-lo e
-- ninguém conseguia filtrar por ele. Com o token novo a coluna entrou, e os
-- scripts passaram a limpar aquela sobra.
--
-- ## O que a aplicação ensinou
--
-- `CREATE OR REPLACE` **não** muda tipo de retorno, e é isso que esta migration
-- faz na função de leitura. Na primeira tentativa o Postgres recusou com
-- "cannot change return type of existing function" e a transação inteira
-- reverteu — inclusive as colunas. Daí o `DROP FUNCTION` abaixo.
-- ============================================================================

ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS mean_gradient_ref numeric,
  ADD COLUMN IF NOT EXISTS mean_gradient_ref_sd numeric;

COMMENT ON COLUMN public.prosthesis_catalog.mean_gradient_ref IS
  'Gradiente médio transprotético de referência, em mmHg, para este modelo e '
  'tamanho. Mesma regra da EOA: só entra com fonte citável para o par exato, e '
  'a fonte é a mesma de eoa_source_url.';

-- A função de leitura pública passa a devolver as duas colunas novas.
--
-- `DROP` antes do `CREATE`: o Postgres recusa `CREATE OR REPLACE` quando o tipo
-- de retorno muda ("cannot change return type of existing function"), e mudar o
-- retorno é exatamente o que esta migration faz. Medido ao aplicar — a
-- transação inteira reverteu, inclusive as colunas, o que é o comportamento
-- certo: ou entra tudo, ou nada.
DROP FUNCTION IF EXISTS public.catalogo_proteses();

CREATE FUNCTION public.catalogo_proteses()
RETURNS TABLE (
  id uuid,
  manufacturer text,
  model_name text,
  type text,
  valve_position text,
  size numeric,
  effective_orifice_area numeric,
  eoa_reference_sd numeric,
  eoa_source_label text,
  eoa_source_url text,
  mean_gradient_ref numeric,
  mean_gradient_ref_sd numeric,
  annulus_min_mm numeric,
  annulus_max_mm numeric,
  description text,
  reference_url text,
  image_url text,
  display_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.manufacturer, c.model_name, c.type::text, c.valve_position::text,
         c.size, c.effective_orifice_area, c.eoa_reference_sd,
         c.eoa_source_label, c.eoa_source_url,
         c.mean_gradient_ref, c.mean_gradient_ref_sd,
         c.annulus_min_mm, c.annulus_max_mm,
         c.description, c.reference_url, c.image_url, c.display_order
    FROM public.prosthesis_catalog c
   WHERE c.active = true
   ORDER BY c.display_order, c.manufacturer, c.model_name, c.size;
$$;

REVOKE ALL ON FUNCTION public.catalogo_proteses() FROM public;
GRANT EXECUTE ON FUNCTION public.catalogo_proteses() TO anon, authenticated;
