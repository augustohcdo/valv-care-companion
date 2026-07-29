-- Auditoria de reference_url do catálogo de próteses (pendência sinalizada no
-- histórico do projeto: URLs preenchidas por padrão/suposição, não verificadas).
--
-- Duas categorias de problema encontradas e corrigidas por NULL (nunca por um
-- link inventado):
--
-- 1) Página de categoria/família genérica em vez do produto específico —
--    identificado pela própria URL não ter um slug do produto, e confirmado
--    por reference_url idêntica compartilhada entre modelos diferentes:
--    Edwards Cosgrove-Edwards Band / Magna Mitral Ease / Physio Flex, todas
--    apontavam para a mesma página "mitral-surgical"; Medtronic CG Future /
--    Contour 3D / Profile 3D todas para "annuloplasty-rings.html"; Abbott
--    Rigid Saddle Ring para "repair.html"; Edwards Perimount (clássico) para
--    "aortic-surgical"; Edwards MC3 Tricuspid para "tricuspid-surgical".
--    Braile Biocor apontava só para a home do site, não uma página de produto.
--
-- 2) Página fora do ar (404) — confirmado por dois métodos independentes:
--    o teste manual (navegador real) já registrado no histórico do projeto, e
--    um novo teste automatizado (WebFetch) rodado nesta auditoria, ambos
--    falhando exatamente nos mesmos dois modelos: Edwards Magna Ease e
--    Meril Myval / Myval Octacor (mesma reference_url para as duas).
--
-- Os demais reference_url do catálogo (Abbott, Corcym, Medtronic Evolut FX
-- etc.) retornaram 404 só no teste automatizado desta rodada, sem confirmação
-- manual independente — sites de fabricante costumam bloquear fetch
-- automatizado em páginas de produto (só a home responde). Não foram
-- alterados para evitar remover links possivelmente válidos por falso
-- positivo; ficam sinalizados para verificação manual futura.

UPDATE public.prosthesis_catalog SET reference_url = NULL
WHERE (manufacturer, model_name) IN (
  ('Edwards', 'Cosgrove-Edwards Band (4600)'),
  ('Edwards', 'Magna Mitral Ease'),
  ('Edwards', 'Physio Flex (5300)'),
  ('Medtronic', 'CG Future'),
  ('Medtronic', 'Contour 3D'),
  ('Medtronic', 'Profile 3D'),
  ('Abbott', 'Rigid Saddle Ring'),
  ('Edwards', 'Perimount'),
  ('Edwards', 'MC3 Tricuspid (4900)'),
  ('Braile', 'Biocor'),
  ('Edwards', 'Magna Ease'),
  ('Meril', 'Myval'),
  ('Meril', 'Myval Octacor')
);
