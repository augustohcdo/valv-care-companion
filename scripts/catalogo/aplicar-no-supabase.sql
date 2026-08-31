-- ===========================================================================
-- CATÁLOGO DE PRÓTESES — aplicação manual, 2026-08-31
-- ===========================================================================
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do painel do Supabase e execute.
--
-- Ele é a concatenação, na ordem, das migrations que estão no repositório e
-- ainda não foram aplicadas. Não há pipeline que as aplique neste projeto: a CI
-- só roda os checks, e a chave service_role não executa DDL.
--
-- É SEGURO RODAR DUAS VEZES. Toda alteração é idempotente: as colunas usam
-- ADD COLUMN IF NOT EXISTS, as restrições ignoram duplicata, os INSERT têm
-- WHERE NOT EXISTS e os UPDATE são por fabricante e modelo, não por posição.
--
-- O QUE ELE FAZ, em uma linha cada:
--
--   1. separa os três motivos de uma prótese sair do catálogo — não existe,
--      é transcateter, ou saiu de linha — e cria a função referencia_historica()
--   2. aplica as 19 imagens oficiais conferidas uma a uma e cadastra Avalus
--      Ultra, Mosaic mitral e Epic Max
--   3. completa a Magna Ease de 2 para 5 tamanhos com EOA (Tsui 2022)
--   4. cria os campos de mercado brasileiro e cadastra Labcor e Cardioprótese
--   5. varre as 40 famílias uma a uma: 21 com venda no Brasil confirmada (10
--      delas com o número do registro ANVISA conferido no HTML da fonte) e 19
--      não confirmadas — que CONTINUAM no catálogo, com a ressalva e a data
--
-- O QUE MUDA NA TELA: a Perimount e a Trifecta GT saem do catálogo e passam a
-- aparecer só na seção de referência histórica; as 10 famílias transcateter
-- somem; a Abbott "Epic" vira Epic Plus Supra e Epic Plus; entram os dois
-- fabricantes nacionais.
--
-- NO FIM há um SELECT de conferência. Olhe o resultado dele: "rodou sem erro"
-- não é a mesma coisa que "fez o que devia".
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 20260830010000_catalogo_so_cirurgico.sql
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 20260830020000_catalogo_imagens_e_novas.sql
-- ---------------------------------------------------------------------------

-- As imagens oficiais conferidas uma a uma, e as três famílias ativas que faltavam
--
-- ## As imagens
--
-- Durante rodadas inteiras este catálogo registrou "a Medtronic bloqueia, não há
-- foto". O muro existe — `medtronic.com` responde 403 até no HTML —, mas eu
-- estava errado sobre o meio: a fotografia de produto da Medtronic não mora em
-- `medtronic.com`, e sim em `medtronic.scene7.com`, que responde normalmente.
-- Nove famílias que estavam registradas como impossíveis entram aqui.
--
-- Cada URL abaixo foi **aberta e olhada** antes de entrar. O que eu vi em cada
-- uma está escrito em `scripts/catalogo/fotos-oficiais.json`, campo
-- `o_que_eu_vi` — nome de arquivo não basta, e nesta base já foram rejeitadas
-- candidatas por mostrarem outro produto, radiografia de peça explantada e
-- quadro de vídeo cirúrgico.
--
-- `image_kind` separa fotografia de renderização. A Medtronic e a Abbott
-- publicam foto de estúdio; a Corcym publica desenho 3D. Chamar as duas de
-- "foto do fabricante" diria ao médico que aquilo é o objeto retratado quando é
-- o objeto desenhado.

-- ---------------------------------------------------------------------------
-- Medtronic — nove famílias, fotografia de produto
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog SET
  image_url = 'https://medtronic.scene7.com/is/image/Medtronic/avalus-bioprosthesis-prodmast?fmt=jpg&fit=constrain,1&wid=600',
  image_kind = 'foto'
 WHERE manufacturer = 'Medtronic' AND model_name = 'Avalus';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://medtronic.scene7.com/is/image/Medtronic/freestyle-bioprosthesis-prodmast?fmt=jpg&fit=constrain,1&wid=600',
  image_kind = 'foto'
 WHERE manufacturer = 'Medtronic' AND model_name = 'Freestyle';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://medtronic.scene7.com/is/image/Medtronic/hancock-ii-prodmast?fmt=jpg&fit=constrain,1&wid=600',
  image_kind = 'foto'
 WHERE manufacturer = 'Medtronic' AND model_name = 'Hancock II';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://medtronic.scene7.com/is/image/Medtronic/medtronic-open-pivot-mechanical-prodmast?fmt=jpg&fit=constrain,1&wid=600',
  image_kind = 'foto'
 WHERE manufacturer = 'Medtronic' AND model_name = 'Open Pivot';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://medtronic.scene7.com/is/image/Medtronic/cg-future-annuloplasty-ring-band-prodmast?fmt=jpg&fit=constrain,1&wid=600',
  image_kind = 'foto'
 WHERE manufacturer = 'Medtronic' AND model_name = 'CG Future';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://medtronic.scene7.com/is/image/Medtronic/contour-3d-prodmast?fmt=jpg&fit=constrain,1&wid=600',
  image_kind = 'foto'
 WHERE manufacturer = 'Medtronic' AND model_name = 'Contour 3D';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://medtronic.scene7.com/is/image/Medtronic/profile-3d-prodmast?fmt=jpg&fit=constrain,1&wid=600',
  image_kind = 'foto'
 WHERE manufacturer = 'Medtronic' AND model_name = 'Profile 3D';

-- ---------------------------------------------------------------------------
-- Corcym — cinco famílias, renderização do fabricante
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog SET
  image_url = 'https://corcym.s3.eu-central-1.amazonaws.com/assets/v1/images/perceval_plus/perceval_PLUS_LANCELOT.webp',
  image_kind = 'ilustracao',
  reference_url = 'https://www.corcym.com/devices/aortic/perceval-plus-lancelot'
 WHERE manufacturer = 'Corcym' AND model_name = 'Perceval Plus';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://corcym.s3.eu-central-1.amazonaws.com/assets/v1/images/products/crown.webp',
  image_kind = 'ilustracao',
  reference_url = 'https://www.corcym.com/devices/aortic/crown-prt'
 WHERE manufacturer = 'Corcym' AND model_name = 'Crown PRT';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://corcym.s3.eu-central-1.amazonaws.com/assets/v1/images/products/solo_smart.webp',
  image_kind = 'ilustracao',
  reference_url = 'https://www.corcym.com/devices/aortic/solo-smart'
 WHERE manufacturer = 'Corcym' AND model_name = 'Solo Smart';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://corcym.s3.eu-central-1.amazonaws.com/assets/v1/images/products/memo3d.webp',
  image_kind = 'ilustracao',
  reference_url = 'https://www.corcym.com/devices/mitral/US/memo3d'
 WHERE manufacturer = 'Corcym' AND model_name = 'Memo 3D';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://corcym.s3.eu-central-1.amazonaws.com/assets/v1/images/products/memo4d.webp',
  image_kind = 'ilustracao',
  reference_url = 'https://www.corcym.com/devices/mitral/US/memo4d'
 WHERE manufacturer = 'Corcym' AND model_name = 'Memo 4D';

-- ---------------------------------------------------------------------------
-- Abbott — foto própria por produto, e agora com o nome certo
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog SET
  image_url = 'https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/products/structural-heart/surgical-valves/product-images/epic-plus-supra-av-side-flip-fnl.png',
  image_kind = 'foto',
  reference_url = 'https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valve-solutions/epic-tissue-valve.html'
 WHERE manufacturer = 'Abbott' AND model_name = 'Epic Plus Supra';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/products/structural-heart/surgical-valves/product-images/epic-plus-mv-side-fnl.png',
  image_kind = 'foto',
  reference_url = 'https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valve-solutions/epic-tissue-valve.html'
 WHERE manufacturer = 'Abbott' AND model_name = 'Epic Plus';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/products/structural-heart/surgical-valves/product-images/regent-perspective-bottom-fnl.png',
  image_kind = 'foto'
 WHERE manufacturer = 'Abbott' AND model_name = 'St. Jude Regent';

UPDATE public.prosthesis_catalog SET
  image_url = 'https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/products/structural-heart/surgical-valves/product-images/masters-valve-bottom-fnl.png',
  image_kind = 'foto'
 WHERE manufacturer = 'Abbott' AND model_name = 'St. Jude Masters HP';

-- As que já tinham imagem antes desta rodada são fotografia do fabricante.
UPDATE public.prosthesis_catalog
   SET image_kind = 'foto'
 WHERE image_url IS NOT NULL AND image_kind IS NULL;

-- ---------------------------------------------------------------------------
-- Três famílias ativas que o catálogo não tinha
-- ---------------------------------------------------------------------------
--
-- Tamanhos e códigos vêm da tabela de pedido do próprio fabricante. Nenhuma
-- entra com EOA inventada: onde a diretriz não publica valor por tamanho, o
-- campo fica vazio, que é o que este catálogo faz desde o começo.

INSERT INTO public.prosthesis_catalog
  (manufacturer, model_name, type, valve_position, size, display_order,
   description, reference_url, image_url, image_kind, annulus_min_mm, annulus_max_mm)
SELECT 'Medtronic', 'Avalus Ultra', 'biologica_aortica'::public.prosthesis_type,
       'aortica'::public.valve_position_type, t.size, 53,
       'Bioprótese de pericárdio bovino com stent, geração seguinte da Avalus. Código ' || t.codigo || '.',
       'https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves/tissue-valves-conduits/avalus-ultra-bioprosthesis.html',
       'https://medtronic.scene7.com/is/image/Medtronic/avalus-ultra-bioprosthesis-prodmast?fmt=jpg&fit=constrain,1&wid=600',
       'foto', NULL, NULL
  FROM (VALUES (19,'400U19'),(21,'400U21'),(23,'400U23'),(25,'400U25'),(27,'400U27'),(29,'400U29'))
       AS t(size, codigo)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.prosthesis_catalog c
    WHERE c.manufacturer = 'Medtronic' AND c.model_name = 'Avalus Ultra' AND c.size = t.size);

INSERT INTO public.prosthesis_catalog
  (manufacturer, model_name, type, valve_position, size, display_order,
   description, reference_url, image_url, image_kind,
   effective_orifice_area, eoa_reference_sd, mean_gradient_ref, mean_gradient_ref_sd,
   eoa_source_label, eoa_source_url)
SELECT 'Medtronic', 'Mosaic', 'biologica_mitral'::public.prosthesis_type,
       'mitral'::public.valve_position_type, t.size, 53,
       'Bioprótese porcina de perfil baixo para posição mitral. Código ' || t.codigo
         || '; diâmetro do orifício ' || t.orificio || ' mm, anel de sutura ' || t.anel || ' mm.',
       'https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves/tissue-valves-conduits/mosaic-mitral-bioprosthesis.html',
       'https://medtronic.scene7.com/is/image/Medtronic/mosaic-mitral-bioprosthesis-prodmast?fmt=jpg&fit=constrain,1&wid=600',
       'foto', t.eoa, t.eoa_dp, t.grad, t.grad_dp,
       CASE WHEN t.eoa IS NULL THEN NULL ELSE 'ASE 2024 — Tabela A5 (próteses mitrais cirúrgicas)' END,
       CASE WHEN t.eoa IS NULL THEN NULL ELSE 'https://pubmed.ncbi.nlm.nih.gov/38182282/' END
  FROM (VALUES
      -- Só o 25 mm aparece na Tabela A5, lido por posição de coluna
      -- (EOA em x≈505, gradiente médio em x≈324). Os demais ficam sem valor.
      (25,'310C25',22.5,33.0, 1.42::numeric, 0.29::numeric, 8.3::numeric, 1.71::numeric),
      (27,'310C27',24.0,35.0, NULL, NULL, NULL, NULL),
      (29,'310C29',26.0,38.0, NULL, NULL, NULL, NULL),
      (31,'310C31',28.0,41.0, NULL, NULL, NULL, NULL),
      (33,'310C33',30.0,43.0, NULL, NULL, NULL, NULL)
    ) AS t(size, codigo, orificio, anel, eoa, eoa_dp, grad, grad_dp)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.prosthesis_catalog c
    WHERE c.manufacturer = 'Medtronic' AND c.model_name = 'Mosaic' AND c.size = t.size);

INSERT INTO public.prosthesis_catalog
  (manufacturer, model_name, type, valve_position, size, display_order,
   description, reference_url, image_url, image_kind)
SELECT 'Abbott', 'Epic Max', 'biologica_aortica'::public.prosthesis_type,
       'aortica'::public.valve_position_type, t.size, 20,
       'Bioprótese porcina aórtica com tecnologia anticalcificação Linx. Código ' || t.codigo
         || '; diâmetro do anel tecidual ' || t.size || ' mm.',
       'https://www.cardiovascular.abbott/us/en/hcp/products/structural-heart/surgical-valve-solutions/epic-max.html',
       'https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/products/structural-heart/surgical-valves/product-images/epic-max-aortic-valve-front-v2-250x.jpg',
       'foto'
  FROM (VALUES (19,'EMAX-19'),(21,'EMAX-21'),(23,'EMAX-23'),(25,'EMAX-25'),(27,'EMAX-27'))
       AS t(size, codigo)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.prosthesis_catalog c
    WHERE c.manufacturer = 'Abbott' AND c.model_name = 'Epic Max' AND c.size = t.size);

-- ---------------------------------------------------------------------------
-- 20260830030000_magna_ease_por_tamanho.sql
-- ---------------------------------------------------------------------------

-- A Magna Ease deixa de ter 2 de 6 tamanhos com EOA e passa a ter 5
--
-- ## O que estava faltando, e por quê
--
-- A Magna Ease é a única PERIMOUNT que a Edwards ainda vende, e o catálogo só
-- tinha EOA em dois dos seis tamanhos. O motivo não era desleixo: a fonte usada
-- (Mayr 2021) traz os seis tamanhos, mas com n=2 no 19 mm, n=6 no 21, n=4 no 27
-- e **n=1** no 29 — abaixo do piso de amostra desta base (`N_MINIMO = 10`, em
-- `src/data/buscaDeFontes.ts`). O piso existe porque no ensaio Dafodil-1 o 23 mm
-- (n=3) marcou EOA maior que o 25 mm (n=3): a curva inverte, e ruído de amostra
-- pequena viraria recomendação de prótese.
--
-- Tsui et al. 2022 resolve isso com uma coorte muito maior, na mesma medida (na
-- alta hospitalar) e com a tabela por tamanho:
--
--     19 mm  n=9    1,3 ± 0,37 cm²   19,2 ± 4,72 mmHg   ← abaixo do piso
--     21 mm  n=34   1,5 ± 0,42       16,7 ± 6,21
--     23 mm  n=87   1,7 ± 0,36       13,8 ± 5,00
--     25 mm  n=66   1,9 ± 0,59       13,5 ± 5,42
--     27 mm  n=19   2,3 ± 0,67        9,5 ± 3,79
--     29 mm  n=11   2,5 ± 0,61        9,4 ± 2,43
--
-- O 23 e o 25 já tinham valor, vindos de Mayr (n=17 e n=27). São substituídos
-- pelos de Tsui, que medem a mesma coisa em coorte cinco vezes maior. Não é que
-- os de Mayr estivessem errados; é que estes são melhores, e a fonte citada na
-- tela passa a dizer qual foi usada.
--
-- ## O 19 mm continua vazio, e isso é de propósito
--
-- n=9. Um paciente abaixo do piso. Baixar o piso para dez virar nove porque um
-- caso específico ficou de fora é como a régua deixa de existir — e o 19 mm é
-- justamente o tamanho onde o mismatch decide conduta, ou seja, o pior lugar
-- para relaxar o critério. Fica vazio, com o motivo registrado.

UPDATE public.prosthesis_catalog SET
  effective_orifice_area = t.eoa,
  eoa_reference_sd = t.eoa_dp,
  mean_gradient_ref = t.grad,
  mean_gradient_ref_sd = t.grad_dp,
  eoa_source_label = 'Tsui 2022 — alta hospitalar, por tamanho, n = ' || t.n,
  eoa_source_url = 'https://pubmed.ncbi.nlm.nih.gov/36378942/'
 FROM (VALUES
     (21, 34, 1.5::numeric, 0.42::numeric, 16.7::numeric, 6.21::numeric),
     (23, 87, 1.7::numeric, 0.36::numeric, 13.8::numeric, 5.00::numeric),
     (25, 66, 1.9::numeric, 0.59::numeric, 13.5::numeric, 5.42::numeric),
     (27, 19, 2.3::numeric, 0.67::numeric,  9.5::numeric, 3.79::numeric),
     (29, 11, 2.5::numeric, 0.61::numeric,  9.4::numeric, 2.43::numeric)
   ) AS t(size, n, eoa, eoa_dp, grad, grad_dp)
 WHERE prosthesis_catalog.manufacturer = 'Edwards'
   AND prosthesis_catalog.model_name = 'Magna Ease'
   AND prosthesis_catalog.valve_position = 'aortica'
   AND prosthesis_catalog.size = t.size;

-- ---------------------------------------------------------------------------
-- 20260830040000_mercado_brasileiro.sql
-- ---------------------------------------------------------------------------

-- O catálogo passa a dizer se a prótese é vendida NO BRASIL, e entram os nacionais
--
-- ## Por que o critério mudou
--
-- Até aqui a auditoria de "ainda se vende?" foi feita contra páginas americanas
-- de fabricante. Para um site de cirurgião brasileiro isso responde à pergunta
-- errada: o que importa é se a prótese tem registro na ANVISA e chega à
-- prateleira daqui. Uma prótese pode ter saído de linha nos EUA e continuar
-- sendo implantada no Brasil — e o contrário também.
--
-- ## Três estados, e o terceiro é o ponto
--
-- `mercado_br` só admite 'confirmado' e 'nao_confirmado'. **NULO quer dizer que
-- ninguém procurou ainda**, e essa é a distinção que este projeto inteiro
-- persegue: campo vazio que pode significar "procurei e não achei" ou "não
-- olhei" é campo que engana. Marcar todas as famílias como 'nao_confirmado' de
-- uma vez só, sem ter aberto uma por uma, seria afirmar uma busca que não
-- aconteceu — por isso só entram aqui as que eu de fato conferi.
--
-- E `nao_confirmado` **não remove ninguém do catálogo**, por decisão do usuário e
-- por bom senso clínico: tirar uma prótese que talvez esteja na prateleira do
-- serviço é pior do que mantê-la com ressalva. "Não confirmei" não é "não
-- existe".
--
-- ## O que eu não fiz, e por quê
--
-- A base da ANVISA (`consultas.anvisa.gov.br`) responde 403 com desafio do
-- Cloudflare a qualquer cliente que não seja um navegador com captcha resolvido.
-- Não se contorna. A prova de mercado aqui vem da página brasileira do
-- fabricante e do número de registro quando ele aparece publicamente — que é o
-- melhor disponível, e a tela diz que é isso.

-- ---------------------------------------------------------------------------
-- 1) Colunas
-- ---------------------------------------------------------------------------

ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS anvisa_registro text,
  ADD COLUMN IF NOT EXISTS mercado_br text,
  ADD COLUMN IF NOT EXISTS mercado_br_conferido_em date,
  ADD COLUMN IF NOT EXISTS mercado_br_fonte text;

DO $$ BEGIN
  ALTER TABLE public.prosthesis_catalog
    ADD CONSTRAINT prosthesis_mercado_br_valido
    CHECK (mercado_br IS NULL OR mercado_br IN ('confirmado', 'nao_confirmado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Afirmação sem data é palpite com cara de fato. As duas andam juntas.
DO $$ BEGIN
  ALTER TABLE public.prosthesis_catalog
    ADD CONSTRAINT prosthesis_mercado_br_com_data
    CHECK ((mercado_br IS NULL) = (mercado_br_conferido_em IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Registro gravado sem a confirmação correspondente seria número solto na tela.
DO $$ BEGIN
  ALTER TABLE public.prosthesis_catalog
    ADD CONSTRAINT prosthesis_anvisa_exige_confirmacao
    CHECK (anvisa_registro IS NULL OR mercado_br = 'confirmado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2) Labcor — fabricante nacional, ausente deste catálogo até agora
-- ---------------------------------------------------------------------------
--
-- A Labcor é citada no parecer técnico brasileiro de 2023 sobre biopróteses
-- (Dokimos Plus) junto com a Braile e a Cardioprótese. Faltar um fabricante
-- nacional muito implantado no SUS é lacuna maior, para um cirurgião brasileiro,
-- do que qualquer nome errado de importada.
--
-- Tamanhos, códigos e diâmetros vêm da tabela "Technical Specifications" do
-- próprio fabricante. O **diâmetro interno é medida geométrica** e vai para a
-- descrição, nunca para `effective_orifice_area` — é a mesma armadilha já
-- documentada na Miltonia da Meril.
--
-- Sobre EOA: a ASE 2024 **não** traz a Dokimos Plus. Traz a Labcor Santiago
-- (19 mm) e a Labcor Synergy (21 mm), que são gerações anteriores, um tamanho
-- cada. Emprestar o valor de uma geração para outra é inventar procedência, e
-- por isso estas linhas entram sem EOA, com o motivo registrado em
-- `src/data/buscaDeFontes.ts`.

INSERT INTO public.prosthesis_catalog
  (manufacturer, model_name, type, valve_position, size, display_order,
   description, reference_url, image_url, image_kind,
   anvisa_registro, mercado_br, mercado_br_conferido_em, mercado_br_fonte)
SELECT 'Labcor', 'Dokimos Plus Aórtica', 'biologica_aortica'::public.prosthesis_type,
       'aortica'::public.valve_position_type, t.size, 80,
       'Bioprótese de pericárdio bovino com pericárdio montado por fora da armação, '
         || 'com tratamento anticalcificante REDUCER. Referência ' || t.codigo
         || '. Do fabricante: diâmetro externo ' || t.externo || ' mm, diâmetro interno '
         || t.interno || ' mm (medida geométrica, não é área efetiva de orifício), '
         || 'anel de sutura ' || t.anel || ' mm, altura total ' || t.altura || ' mm.',
       'https://labcor.com.br/dokimos-plus-aortic-labcor/',
       'https://labcor.com.br/wp-content/uploads/2022/04/dokimos-2.png',
       'foto', '10171250041', 'confirmado', DATE '2026-08-30',
       'https://labcor.com.br/dokimos-plus-aortic-labcor/'
  FROM (VALUES
      (19,'19A',19.0,16,23,14.0),(21,'21A',21.0,18,25,15.5),(23,'23A',23.0,20,27,16.5),
      (25,'25A',25.0,22,29,17.0),(27,'27A',27.0,24,31,19.0)
    ) AS t(size, codigo, externo, interno, anel, altura)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.prosthesis_catalog c
    WHERE c.manufacturer = 'Labcor' AND c.model_name = 'Dokimos Plus Aórtica' AND c.size = t.size);

INSERT INTO public.prosthesis_catalog
  (manufacturer, model_name, type, valve_position, size, display_order,
   description, reference_url, image_url, image_kind,
   anvisa_registro, mercado_br, mercado_br_conferido_em, mercado_br_fonte)
SELECT 'Labcor', 'Dokimos Plus Mitral', 'biologica_mitral'::public.prosthesis_type,
       'mitral'::public.valve_position_type, t.size, 81,
       'Bioprótese de pericárdio bovino para posição mitral, com tratamento '
         || 'anticalcificante REDUCER. Referência ' || t.codigo || '. Do fabricante: '
         || 'diâmetro externo ' || t.externo || ' mm, diâmetro interno ' || t.interno
         || ' mm (medida geométrica, não é área efetiva de orifício), anel de sutura '
         || t.anel || ' mm.',
       'https://labcor.com.br/dokimos-plus-mitral/',
       'https://labcor.com.br/wp-content/uploads/2022/04/dokimos-3.png',
       'foto', '10171250042', 'confirmado', DATE '2026-08-30',
       'https://labcor.com.br/dokimos-plus-mitral/'
  FROM (VALUES
      (25,'25M',25,22,33),(27,'27M',27,24,35),(29,'29M',29,26,37),
      (31,'31M',31,28,39),(33,'33M',33,30,41)
    ) AS t(size, codigo, externo, interno, anel)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.prosthesis_catalog c
    WHERE c.manufacturer = 'Labcor' AND c.model_name = 'Dokimos Plus Mitral' AND c.size = t.size);

-- ---------------------------------------------------------------------------
-- 3) Cardioprótese — o outro nacional
-- ---------------------------------------------------------------------------
--
-- Sem número de registro na página, e por isso `anvisa_registro` fica nulo. O
-- `mercado_br` fica 'confirmado' mesmo assim, e a diferença entre as duas coisas
-- é proposital: página de produto em português, de fabricante sediado em
-- Curitiba, é prova de que se vende no Brasil; o número do registro é outro
-- dado, que eu não tenho. Misturar os dois faria a ausência do número parecer
-- ausência de registro.

INSERT INTO public.prosthesis_catalog
  (manufacturer, model_name, type, valve_position, size, display_order,
   description, reference_url, image_url, image_kind,
   mercado_br, mercado_br_conferido_em, mercado_br_fonte)
SELECT 'Cardioprótese', 'Premium Aórtica', 'biologica_aortica'::public.prosthesis_type,
       'aortica'::public.valve_position_type, t.size, 82,
       'Bioprótese de pericárdio bovino com anel de suporte em poliacetal e três hastes '
         || 'equidistantes, revestido de malha de poliéster. Cúspides de altura reduzida, '
         || 'desenhadas para não obstruir os óstios coronarianos em raiz aórtica pequena. '
         || 'Tratamento anticalcificante com ácido glutâmico.',
       'https://cardioprotese.com.br/cardioprotese-premium-aortica/',
       'https://cardioprotese.com.br/wp-content/uploads/2024/11/Cardioprotese-Premium-Aortica.webp',
       'foto', 'confirmado', DATE '2026-08-30',
       'https://cardioprotese.com.br/cardioprotese-premium-aortica/'
  FROM (VALUES (19),(21),(23),(25),(27)) AS t(size)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.prosthesis_catalog c
    WHERE c.manufacturer = 'Cardioprótese' AND c.model_name = 'Premium Aórtica' AND c.size = t.size);

INSERT INTO public.prosthesis_catalog
  (manufacturer, model_name, type, valve_position, size, display_order,
   description, reference_url, image_url, image_kind,
   mercado_br, mercado_br_conferido_em, mercado_br_fonte)
SELECT 'Cardioprótese', 'Premium Mitral', 'biologica_mitral'::public.prosthesis_type,
       'mitral'::public.valve_position_type, t.size, 83,
       'Bioprótese de pericárdio bovino para posição mitral, com aba de sutura RETA e mais '
         || 'larga que a da aórtica — desenho do fabricante para implante no anel mitral '
         || 'nativo. Anel de suporte em poliacetal com três hastes equidistantes.',
       'https://cardioprotese.com.br/cardioprotese-premium-mitral/',
       'https://cardioprotese.com.br/wp-content/uploads/2024/11/Cardioprotese-Premium-Mitral.webp',
       'foto', 'confirmado', DATE '2026-08-30',
       'https://cardioprotese.com.br/cardioprotese-premium-mitral/'
  FROM (VALUES (25),(27),(29),(31),(33)) AS t(size)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.prosthesis_catalog c
    WHERE c.manufacturer = 'Cardioprótese' AND c.model_name = 'Premium Mitral' AND c.size = t.size);

-- ---------------------------------------------------------------------------
-- 4) As importadas cujo registro brasileiro eu encontrei
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog SET
  anvisa_registro = '80219050154', mercado_br = 'confirmado',
  mercado_br_conferido_em = DATE '2026-08-30',
  mercado_br_fonte = 'https://www.edwards.com/br/devices/heart-valves/intuity'
 WHERE manufacturer = 'Edwards' AND model_name = 'Intuity Elite';

UPDATE public.prosthesis_catalog SET
  anvisa_registro = '80219050171', mercado_br = 'confirmado',
  mercado_br_conferido_em = DATE '2026-08-30',
  mercado_br_fonte = 'https://consultas.anvisa.gov.br/#/documentos-tecnicos/25351196630201859'
 WHERE manufacturer = 'Edwards' AND model_name = 'Inspiris Resilia';

-- A Braile é fabricante brasileiro: as quatro famílias dela se vendem aqui por
-- definição, e o parecer técnico do INC de 2023 as cita nominalmente.
UPDATE public.prosthesis_catalog SET
  mercado_br = 'confirmado',
  mercado_br_conferido_em = DATE '2026-08-30',
  mercado_br_fonte = 'https://braile.com.br/wp-json/wp/v2/produto'
 WHERE manufacturer = 'Braile' AND active = true;

-- ---------------------------------------------------------------------------
-- 5) O catálogo passa a servir as colunas novas
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
  advisory_date date,
  anvisa_registro text,
  mercado_br text,
  mercado_br_conferido_em date,
  mercado_br_fonte text
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
         c.advisory::text, c.advisory_note, c.advisory_url, c.advisory_date,
         c.anvisa_registro, c.mercado_br, c.mercado_br_conferido_em, c.mercado_br_fonte
    FROM public.prosthesis_catalog c
   WHERE c.active = true
   ORDER BY c.display_order, c.manufacturer, c.model_name, c.size;
$$;

REVOKE ALL ON FUNCTION public.catalogo_proteses() FROM public;
GRANT EXECUTE ON FUNCTION public.catalogo_proteses() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 20260831010000_mercado_brasileiro_varredura.sql
-- ---------------------------------------------------------------------------

-- A varredura de mercado brasileiro, família por família
--
-- A rodada anterior criou os campos e conferiu 10 das 40 famílias. Esta fecha as
-- outras 30, e corrige uma afirmação que eu tinha gravado sem verificar.
--
-- ## A correção primeiro, porque é a parte que estava errada
--
-- Eu gravei `anvisa_registro = '80219050154'` para a Edwards Intuity Elite a
-- partir de um RESUMO DE BUSCA — nunca abri a página que continha o número. É a
-- mesma classe de defeito dos dois PMIDs que inventei nesta sessão e que o
-- `npm run pmids` pegou: uma afirmação precisa, de aparência conferida, sem
-- ninguém ter olhado a fonte.
--
-- As páginas brasileiras da Edwards respondem 404 deste ambiente (a raiz
-- `edwards.com/br` carrega, as de produto não), e o distribuidor que lista o
-- portfólio deles não traz a Intuity. Então o número sai, e a família volta para
-- `nao_confirmado`. Registro errado num catálogo clínico é pior do que registro
-- nenhum: o número tem cara de conferido justamente por ser preciso.
--
-- ## O padrão de prova, e por que ele varia
--
-- Três forças de evidência, e a coluna distingue as duas primeiras da terceira:
--
--   1. **número de registro achado no HTML de página brasileira** — o mais forte.
--      Cada número abaixo foi conferido no HTML cru, e o texto ao redor foi lido
--      para garantir que ele pertence àquele produto e não ao vizinho da lista.
--   2. **página de distribuidor brasileiro viva, sem número** — prova que se
--      vende aqui, e é o que basta para `mercado_br = 'confirmado'`.
--   3. **nada encontrado** — `nao_confirmado`, com a data. NÃO remove do
--      catálogo: tirar uma prótese que talvez esteja na prateleira do serviço é
--      pior do que mantê-la com ressalva.
--
-- A base da ANVISA continua atrás de desafio do Cloudflare e não se contorna.

-- ---------------------------------------------------------------------------
-- 1) A correção da Intuity Elite
-- ---------------------------------------------------------------------------

UPDATE public.prosthesis_catalog SET
  anvisa_registro = NULL,
  mercado_br = 'nao_confirmado',
  mercado_br_conferido_em = DATE '2026-08-31',
  mercado_br_fonte = NULL
 WHERE manufacturer = 'Edwards' AND model_name = 'Intuity Elite';

-- ---------------------------------------------------------------------------
-- 2) Edwards — sete famílias com registro conferido no HTML do distribuidor
-- ---------------------------------------------------------------------------
--
-- Fonte: intermedicalbr.com/cirurgia-cardiaca — distribuidor brasileiro que
-- publica o número de registro ao lado de cada produto. Os seis números foram
-- localizados no HTML e o texto anterior a cada um foi lido para confirmar a
-- qual produto pertence.

UPDATE public.prosthesis_catalog SET
  anvisa_registro = t.registro, mercado_br = 'confirmado',
  mercado_br_conferido_em = DATE '2026-08-31',
  mercado_br_fonte = 'https://intermedicalbr.com/cirurgia-cardiaca/'
 FROM (VALUES
     -- "prótese valvar aórtica com tecido RESILIA e tecnologia VFit"
     ('Inspiris Resilia',  '80219050171'),
     -- "manga de sutura em formato selado que acompanha a anatomia mitral nativa"
     ('Mitris Resilia',    '80219050183'),
     -- "para substituição de válvula aórtica OU MITRAL. Tecnologia
     --  Carpentier-Edwards" — um registro só cobre as duas posições da família
     ('Magna Ease',        '10350250013'),
     ('Magna Mitral Ease', '10350250013'),
     -- "conduto valvado pré-montado com tecido RESILIA para substituição da raiz"
     ('Konect Resilia',    '80219050182'),
     -- "totalmente flexível para anuloplastia mitral"
     ('Physio Flex (5300)','80219050195'),
     -- "geometria tridimensional sela de cavalo e estrutura semi-rígida"
     ('Physio II (5200)',  '80219050134')
   ) AS t(modelo, registro)
 WHERE prosthesis_catalog.manufacturer = 'Edwards'
   AND prosthesis_catalog.model_name = t.modelo;

-- ---------------------------------------------------------------------------
-- 3) Abbott Epic Max — registro no comunicado da própria Abbott Brasil
-- ---------------------------------------------------------------------------
--
-- Comunicado de 06/05/2026 anunciando a aprovação pela ANVISA. O número está no
-- rodapé do HTML: "Epic™ Max – Registro ANVISA no 10332340525". O texto também
-- diz que a válvula é fabricada na unidade da Abbott em Belo Horizonte.

UPDATE public.prosthesis_catalog SET
  anvisa_registro = '10332340525', mercado_br = 'confirmado',
  mercado_br_conferido_em = DATE '2026-08-31',
  mercado_br_fonte = 'https://www.abbottbrasil.com.br/corpnewsroom/noticias/press-releases/abbott-recebe-aprovacao-da-anvisa-para-a-valvula-biologica-epic-max-para-tratar-pacientes-com-estenose-ou-insuficiencia-da-valvula-aortica.html'
 WHERE manufacturer = 'Abbott' AND model_name = 'Epic Max';

-- ---------------------------------------------------------------------------
-- 4) Medtronic — cinco famílias em distribuidor brasileiro, sem número
-- ---------------------------------------------------------------------------
--
-- Cada URL foi requisitada e devolveu 200 com página de produto. O distribuidor
-- não publica o registro, então `anvisa_registro` fica nulo — e a diferença
-- entre "não tenho o número" e "não tem registro" é justamente o motivo de os
-- dois campos serem separados.

UPDATE public.prosthesis_catalog SET
  mercado_br = 'confirmado',
  mercado_br_conferido_em = DATE '2026-08-31',
  mercado_br_fonte = 'https://medicicor.com.br/produto/' || t.slug || '/'
 FROM (VALUES
     ('Avalus',     'valvula-biologica-avalus'),
     ('Hancock II', 'valvula-biologica-hancock-ii'),
     ('Mosaic',     'valvula-cardiaca-mitral-mosaic'),
     ('Open Pivot', 'valvula-mecanica-open-pivot'),
     ('Contour 3D', 'anal-de-plastia-contour-3d')
   ) AS t(modelo, slug)
 WHERE prosthesis_catalog.manufacturer = 'Medtronic'
   AND prosthesis_catalog.model_name = t.modelo;

-- ---------------------------------------------------------------------------
-- 5) As dezenove que não consegui confirmar
-- ---------------------------------------------------------------------------
--
-- Procurei e não achei — o que é diferente de não existir, e por isso nenhuma
-- sai do catálogo. O selo na tela mostra a data, para quem souber melhor poder
-- corrigir.
--
-- O padrão do que ficou de fora diz algo: anel de anuloplastia e mecânica de
-- geração antiga quase não aparecem em catálogo de distribuidor on-line, e
-- fabricante sem operação brasileira própria (Corcym, Meril) não publica nada em
-- português. Ausência de vitrine não é ausência de mercado.

UPDATE public.prosthesis_catalog SET
  mercado_br = 'nao_confirmado',
  mercado_br_conferido_em = DATE '2026-08-31',
  mercado_br_fonte = NULL,
  anvisa_registro = NULL
 FROM (VALUES
     ('Medtronic', 'Avalus Ultra'),
     ('Medtronic', 'Freestyle'),
     ('Medtronic', 'CG Future'),
     ('Medtronic', 'Profile 3D'),
     ('Edwards',   'Cosgrove-Edwards Band (4600)'),
     ('Edwards',   'MC3 Tricuspid (4900)'),
     ('Abbott',    'Epic Plus'),
     ('Abbott',    'Epic Plus Supra'),
     ('Abbott',    'St. Jude Regent'),
     ('Abbott',    'St. Jude Masters HP'),
     ('Corcym',    'Perceval Plus'),
     ('Corcym',    'Crown PRT'),
     ('Corcym',    'Solo Smart'),
     ('Corcym',    'Memo 3D'),
     ('Corcym',    'Memo 4D'),
     ('Meril',     'Dafodil'),
     ('Meril',     'Miltonia'),
     ('Meril',     'Miltonia AP')
   ) AS t(fab, modelo)
 WHERE prosthesis_catalog.manufacturer = t.fab
   AND prosthesis_catalog.model_name = t.modelo
   AND prosthesis_catalog.mercado_br IS NULL;

COMMIT;

-- ===========================================================================
-- CONFERÊNCIA — o resultado abaixo é o que prova que deu certo
-- ===========================================================================
--
-- Esperado depois de rodar:
--   familias_ativas ....... 40   (36 do catálogo cirúrgico + 4 dos nacionais)
--   transcateter_ativas .... 0
--   sem_imagem ............. 0
--   fora_de_linha .......... 2   (Edwards Perimount e Abbott Trifecta GT)
--   perimount_no_catalogo .. 0   ← era isto que estava errado na tela
--   mercado_conferido ..... 40   (todas: 21 confirmadas, 19 não confirmadas)
--   com_registro_anvisa ... 10   (7 Edwards, Abbott Epic Max e 2 da Labcor)

SELECT
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE active) AS familias_ativas,
  (SELECT count(*) FROM public.prosthesis_catalog
    WHERE active AND type::text = 'tavi') AS transcateter_ativas,
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE active AND image_url IS NULL) AS sem_imagem,
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE inactive_reason = 'fora_de_linha') AS fora_de_linha,
  (SELECT count(*) FROM public.prosthesis_catalog
    WHERE active AND model_name = 'Perimount') AS perimount_no_catalogo,
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE active AND mercado_br IS NOT NULL) AS mercado_conferido,
  (SELECT count(DISTINCT manufacturer || '|' || model_name)
     FROM public.prosthesis_catalog WHERE active AND anvisa_registro IS NOT NULL) AS com_registro_anvisa;
