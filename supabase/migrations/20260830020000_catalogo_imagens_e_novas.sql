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
