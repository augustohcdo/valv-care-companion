-- ============================================================================
-- Coluna do gradiente médio de referência — PENDENTE DE APLICAÇÃO.
--
-- ## Por que este arquivo existe separado
--
-- Os dados desta rodada (EOA de referência de 74 tamanhos, desvio-padrão, fonte
-- por linha, e a foto oficial de 17 famílias) **já estão no banco**: foram
-- gravados pelo PostgREST com a `service_role`, e o script que os grava está
-- versionado em `scripts/catalogo/` — é ele, e não um bloco de UPDATE aqui, o
-- artefato reproduzível. Rodar de novo é idempotente.
--
-- O que NÃO deu para aplicar foi DDL: o token da Management API do projeto
-- passou a devolver 401 no meio da rodada, e a `service_role` do PostgREST não
-- executa comando de esquema. Então esta migration fica escrita e entra assim
-- que o token voltar.
--
-- ## O que falta, e o remendo que está no ar enquanto isso
--
-- A ASE 2024 publica, junto da EOA, o **gradiente médio de referência** de cada
-- modelo e tamanho — o dado de "performance" que o catálogo devia mostrar. Sem
-- coluna para ele, e para não perdê-lo, o script o gravou numa frase demarcada
-- dentro de `description`:
--
--     "Gradiente médio de referência: 12,6 ± 4,7 mmHg (ASE 2024)."
--
-- Funciona para leitura, mas é dado dentro de prosa: o recomendador não
-- consegue usá-lo, e ninguém consegue ordenar ou filtrar por ele. Quando esta
-- migration entrar, o script passa a gravar na coluna e a frase sai da
-- descrição.
-- ============================================================================

ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS mean_gradient_ref numeric,
  ADD COLUMN IF NOT EXISTS mean_gradient_ref_sd numeric;

COMMENT ON COLUMN public.prosthesis_catalog.mean_gradient_ref IS
  'Gradiente médio transprotético de referência, em mmHg, para este modelo e '
  'tamanho. Mesma regra da EOA: só entra com fonte citável para o par exato, e '
  'a fonte é a mesma de eoa_source_url.';

-- A função de leitura pública passa a devolver as duas colunas novas.
CREATE OR REPLACE FUNCTION public.catalogo_proteses()
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
