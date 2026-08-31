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
