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
