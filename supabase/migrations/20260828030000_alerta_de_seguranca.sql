-- ============================================================================
-- Alerta de segurança por prótese.
--
-- ## O que motivou
--
-- O catálogo listava a **Abbott Trifecta GT** com EOA de referência em seis
-- tamanhos, e o recomendador a indicava ativamente — medido: para uma paciente
-- de 1,55 m ele sugeria "Trifecta GT 19 mm".
--
-- A Abbott **retirou a família Trifecta do mercado dos EUA em 31/07/2023** por
-- deterioração estrutural precoce (menos de cinco anos). A carta da própria
-- Abbott nomeia os modelos TF-19A a TF-29A e **TFGT-19A a TFGT-29A** — a "GT" é
-- a Glide Technology, exatamente a linha do nosso catálogo. A FDA havia
-- comunicado o risco em 27/02/2023.
--
-- Ou seja: a ferramenta recomendava a um cirurgião uma válvula retirada do
-- mercado por falhar cedo. É a família de defeito desta sessão inteira, no seu
-- pior formato — não uma tela dizendo algo falso, mas uma tela induzindo uma
-- decisão cirúrgica.
--
-- ## Por que não basta `active = false`
--
-- Esconder a prótese resolveria o recomendador e quebraria outra coisa: o
-- cirurgião precisa consultar a Trifecta justamente **porque há pacientes com
-- ela implantada** — para planejar valve-in-valve, para interpretar um
-- ecocardiograma de seguimento, para saber o que procurar. Sumir com ela do
-- catálogo tiraria a informação de quem mais precisa dela.
--
-- Então a prótese continua no catálogo, com o alerta colado nela, e sai do
-- caminho de quem está **escolhendo** uma prótese nova.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.prosthesis_advisory AS ENUM (
    'retirada_do_mercado',   -- o fabricante parou de vender e recolheu estoque
    'alerta_de_seguranca',   -- comunicado de risco, sem retirada
    'descontinuada'          -- saiu de linha por decisão comercial, sem risco
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS advisory public.prosthesis_advisory,
  ADD COLUMN IF NOT EXISTS advisory_note text,
  ADD COLUMN IF NOT EXISTS advisory_url text,
  ADD COLUMN IF NOT EXISTS advisory_date date;

COMMENT ON COLUMN public.prosthesis_catalog.advisory IS
  'Situação regulatória/comercial que o médico precisa saber ANTES de escolher '
  'esta prótese. Nunca use `active = false` para isso: a prótese retirada ainda '
  'precisa ser consultável por causa dos pacientes que já a têm implantada.';

-- Um alerta sem fonte é boato. Nenhum dos três estados entra sem link e sem data.
ALTER TABLE public.prosthesis_catalog
  DROP CONSTRAINT IF EXISTS prosthesis_catalog_alerta_com_fonte;
ALTER TABLE public.prosthesis_catalog
  ADD CONSTRAINT prosthesis_catalog_alerta_com_fonte
  CHECK (
    advisory IS NULL
    OR (advisory_url IS NOT NULL AND advisory_date IS NOT NULL AND advisory_note IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- O alerta da Trifecta
-- ---------------------------------------------------------------------------
UPDATE public.prosthesis_catalog
   SET advisory = 'retirada_do_mercado',
       advisory_date = DATE '2023-07-31',
       advisory_url = 'https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/pdf/reports/US-Abbott-Trifecta-Customer-Letter-July-2023-v3.pdf',
       advisory_note =
         'A Abbott retirou a família Trifecta do mercado dos EUA em 31/07/2023 e '
         'recolheu o estoque, por risco de deterioração estrutural precoce (em '
         'menos de cinco anos). A carta ao cliente nomeia os modelos TF-19A a '
         'TF-29A e TFGT-19A a TFGT-29A. A FDA havia comunicado o risco em '
         '27/02/2023. Não indicar para novo implante. As medidas seguem no '
         'catálogo porque o seguimento de quem já tem a prótese depende delas.'
 WHERE manufacturer = 'Abbott' AND model_name = 'Trifecta GT';

-- ---------------------------------------------------------------------------
-- A função de leitura devolve o alerta
-- ---------------------------------------------------------------------------
-- `DROP` antes do `CREATE`: muda o tipo de retorno, e o Postgres recusa o
-- `CREATE OR REPLACE` nesse caso.
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
  display_order integer,
  advisory text,
  advisory_note text,
  advisory_url text,
  advisory_date date
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
         c.description, c.reference_url, c.image_url, c.display_order,
         c.advisory::text, c.advisory_note, c.advisory_url, c.advisory_date
    FROM public.prosthesis_catalog c
   WHERE c.active = true
   ORDER BY c.display_order, c.manufacturer, c.model_name, c.size;
$$;

REVOKE ALL ON FUNCTION public.catalogo_proteses() FROM public;
GRANT EXECUTE ON FUNCTION public.catalogo_proteses() TO anon, authenticated;
