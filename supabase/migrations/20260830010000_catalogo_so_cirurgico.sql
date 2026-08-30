-- Catálogo só de válvula cirúrgica, com as fora de linha preservadas como referência
--
-- ## Três motivos diferentes para uma linha sair do catálogo
--
-- Até aqui só existia `active = false`, e ele já vinha carregando dois sentidos
-- opostos: o Miltonia 17 mm foi desativado porque **não existe** na tabela de
-- pedido da Meril, e agora precisamos desativar próteses que existem e são
-- excelentes — só não são cirúrgicas, ou não se vendem mais.
--
-- Somar isso num booleano só faria a tela tratar produto inventado e produto
-- histórico como a mesma coisa. `inactive_reason` separa os três:
--
--   · `inexistente`                 — o fabricante não vende e nunca vendeu assim
--   · `fora_do_escopo_cirurgico`    — é transcateter; este site é de cirurgia
--   · `fora_de_linha`               — vendeu-se e não se vende mais
--
-- ## Por que a fora de linha não é simplesmente apagada
--
-- Porque o dado dela continua valendo, e por dois motivos clínicos:
--
--   1. é contra a PERIMOUNT que as próteses atuais são comparadas nos estudos —
--      apagá-la apagaria o denominador da comparação;
--   2. quem operou um paciente com PERIMOUNT em 2015 precisa da EOA de
--      referência dela para dizer se o gradiente alto de hoje é mismatch ou
--      obstrução. Sem isso a ferramenta fica cega justamente para o paciente
--      que já tem prótese.
--
-- Então ela sai do CATÁLOGO — não é oferecida, não é recomendada, não entra em
-- contagem de produto — e passa a viver numa segunda função,
-- `referencia_historica()`, com a data e a fonte da retirada gravadas.

-- ---------------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------------

ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS inactive_reason text,
  ADD COLUMN IF NOT EXISTS discontinued_at date,
  ADD COLUMN IF NOT EXISTS discontinued_note text,
  ADD COLUMN IF NOT EXISTS discontinued_source_url text,
  -- Nem toda imagem oficial é fotografia: a Medtronic publica foto de estúdio e
  -- a Corcym publica renderização 3D. Chamar as duas de "foto do fabricante" na
  -- legenda diria ao médico que aquilo é o objeto retratado quando é o objeto
  -- desenhado.
  ADD COLUMN IF NOT EXISTS image_kind text;

DO $$ BEGIN
  ALTER TABLE public.prosthesis_catalog
    ADD CONSTRAINT prosthesis_inactive_reason_valido
    CHECK (inactive_reason IS NULL OR inactive_reason IN
           ('inexistente', 'fora_do_escopo_cirurgico', 'fora_de_linha'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.prosthesis_catalog
    ADD CONSTRAINT prosthesis_image_kind_valido
    CHECK (image_kind IS NULL OR image_kind IN ('foto', 'ilustracao'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fora de linha sem data seria afirmação sem prova; data sem motivo seria data
-- sem sentido. Os dois andam juntos ou nenhum entra.
DO $$ BEGIN
  ALTER TABLE public.prosthesis_catalog
    ADD CONSTRAINT prosthesis_fora_de_linha_com_data
    CHECK ((inactive_reason = 'fora_de_linha') = (discontinued_at IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2) O que já estava desativado ganha o motivo que sempre teve
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog
   SET inactive_reason = 'inexistente'
 WHERE active = false AND inactive_reason IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Transcateter sai: este site é de válvula cirúrgica
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog
   SET active = false,
       inactive_reason = 'fora_do_escopo_cirurgico'
 WHERE type = 'tavi' AND active = true;

-- ---------------------------------------------------------------------------
-- 4) Fora de linha, com a fonte de cada retirada
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog
   SET active = false,
       inactive_reason = 'fora_de_linha',
       discontinued_at = DATE '2026-08-30',
       discontinued_note =
         'A página de aórticas cirúrgicas da Edwards lista Inspiris Resilia, Konect Resilia, '
         || 'Intuity Elite e Magna Ease; a PERIMOUNT clássica não aparece mais. Os valores '
         || 'continuam aqui porque é contra ela que as próteses atuais são comparadas nos '
         || 'estudos, e porque quem já a tem implantada precisa da EOA de referência para ler '
         || 'o ecocardiograma de seguimento.',
       discontinued_source_url =
         'https://www.edwards.com/healthcare-professionals/products-services/surgical-heart/aortic'
 WHERE manufacturer = 'Edwards' AND model_name = 'Perimount';

UPDATE public.prosthesis_catalog
   SET active = false,
       inactive_reason = 'fora_de_linha',
       discontinued_at = DATE '2023-07-31',
       discontinued_note =
         'Retirada do mercado pela Abbott em 31/07/2023 por deterioração estrutural precoce, e '
         || 'hoje ausente da página de soluções valvares cirúrgicas deles. Não indicar para novo '
         || 'implante; os valores ficam para seguimento de quem já a tem e para planejamento de '
         || 'valve-in-valve.',
       discontinued_source_url =
         'https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valve-solutions.html'
 WHERE manufacturer = 'Abbott' AND model_name = 'Trifecta GT';

-- O anel da Abbott some por um motivo mais fraco, e o texto diz isso: não é
-- "descobri que saiu de linha", é "não consegui confirmar que continua". As
-- duas coisas não são a mesma, e tratá-las igual seria inventar certeza.
UPDATE public.prosthesis_catalog
   SET active = false,
       inactive_reason = 'inexistente'
 WHERE manufacturer = 'Abbott' AND model_name = 'Rigid Saddle Ring';

-- ---------------------------------------------------------------------------
-- 5) Nomenclatura: um nome comercial = uma família
-- ---------------------------------------------------------------------------
--
-- "Abbott | Epic" cobria aórtica e mitral como se fosse um produto só. A Abbott
-- vende Epic Plus Supra na aórtica (ESP200-19 a ESP200-27) e Epic Plus na mitral
-- (E200-25M a E200-33M) — códigos de pedido diferentes. Nome errado no catálogo
-- faz o cirurgião pedir o produto errado.

UPDATE public.prosthesis_catalog
   SET model_name = 'Epic Plus Supra'
 WHERE manufacturer = 'Abbott' AND model_name = 'Epic' AND valve_position = 'aortica';

UPDATE public.prosthesis_catalog
   SET model_name = 'Epic Plus'
 WHERE manufacturer = 'Abbott' AND model_name = 'Epic' AND valve_position = 'mitral';

-- A aórtica da Abbott termina em 27 nos dois produtos atuais. O 29 mm era da
-- geração anterior e não está na tabela de pedido de hoje.
UPDATE public.prosthesis_catalog
   SET active = false,
       inactive_reason = 'inexistente'
 WHERE manufacturer = 'Abbott' AND model_name = 'Epic Plus Supra' AND size = 29;

-- ---------------------------------------------------------------------------
-- 6) Função que serve as fora de linha — e SÓ elas
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.referencia_historica();

CREATE FUNCTION public.referencia_historica()
RETURNS TABLE (
  manufacturer text,
  model_name text,
  valve_position text,
  size numeric,
  effective_orifice_area numeric,
  eoa_reference_sd numeric,
  eoa_source_label text,
  eoa_source_url text,
  mean_gradient_ref numeric,
  mean_gradient_ref_sd numeric,
  discontinued_at date,
  discontinued_note text,
  discontinued_source_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.manufacturer, c.model_name, c.valve_position::text, c.size,
         c.effective_orifice_area, c.eoa_reference_sd,
         c.eoa_source_label, c.eoa_source_url,
         c.mean_gradient_ref, c.mean_gradient_ref_sd,
         c.discontinued_at, c.discontinued_note, c.discontinued_source_url
    FROM public.prosthesis_catalog c
   WHERE c.inactive_reason = 'fora_de_linha'
   ORDER BY c.manufacturer, c.model_name, c.valve_position, c.size;
$$;

REVOKE ALL ON FUNCTION public.referencia_historica() FROM public;
GRANT EXECUTE ON FUNCTION public.referencia_historica() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) O catálogo passa a dizer se a imagem é foto ou desenho
-- ---------------------------------------------------------------------------

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
  image_kind text,
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
         c.description, c.reference_url, c.image_url, c.image_kind, c.display_order,
         c.advisory::text, c.advisory_note, c.advisory_url, c.advisory_date
    FROM public.prosthesis_catalog c
   WHERE c.active = true
   ORDER BY c.display_order, c.manufacturer, c.model_name, c.size;
$$;

REVOKE ALL ON FUNCTION public.catalogo_proteses() FROM public;
GRANT EXECUTE ON FUNCTION public.catalogo_proteses() TO anon, authenticated;
