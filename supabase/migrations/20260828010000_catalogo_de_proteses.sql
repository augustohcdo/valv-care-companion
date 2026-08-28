-- ============================================================================
-- Catálogo de próteses: o tamanho que estava errado, a EOA que nunca existiu,
-- e a porta pública para as ferramentas gratuitas.
--
-- Três coisas medidas no banco antes desta migration:
--
--   1. `effective_orifice_area` era NULA nas **246** linhas. A tela de novo
--      caso já montava "· EOA {valor}" na lista de próteses desde sempre — e
--      esse sufixo nunca apareceu uma única vez em produção. Pior: a EOA
--      indexada é a conta inteira do *mismatch* prótese-paciente, então a
--      ferramenta que este projeto passa a oferecer não teria o que calcular.
--
--   2. **7 linhas tinham `size` gravado ×10** (215, 245, 275, 305). A Meril
--      Myval tem tamanhos intermediários — 21,5 / 24,5 / 27,5 / 30,5 mm — e a
--      coluna era `integer`. O médico lia "Myval 305" na lista.
--
--   3. `prosthesis_catalog` só concede SELECT a `authenticated`. As ferramentas
--      livres precisam do catálogo **sem sessão**, e a resposta a isso não é
--      abrir a tabela para `anon`: é uma função de leitura com forma
--      controlada, como já se fez com `diretorio_medicos`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. O tamanho deixa de ser inteiro — e as 7 linhas voltam ao valor real
-- ---------------------------------------------------------------------------
ALTER TABLE public.prosthesis_catalog
  ALTER COLUMN size TYPE numeric(4,1) USING size::numeric;

UPDATE public.prosthesis_catalog
   SET size = size / 10
 WHERE size > 42;

-- A trava que impede o defeito de voltar. 42 mm é folga confortável sobre o
-- maior dispositivo real do catálogo (anel mitral de 40 mm): a próxima linha
-- gravada ×10 é recusada pelo banco, não descoberta meses depois na tela.
ALTER TABLE public.prosthesis_catalog
  DROP CONSTRAINT IF EXISTS prosthesis_catalog_size_plausivel;
ALTER TABLE public.prosthesis_catalog
  ADD CONSTRAINT prosthesis_catalog_size_plausivel
  CHECK (size IS NULL OR (size > 0 AND size <= 42));

-- ---------------------------------------------------------------------------
-- 2. A procedência de cada EOA, linha a linha
-- ---------------------------------------------------------------------------
-- `effective_orifice_area` sozinha é um número sem dono. A Tabela 13 da mesma
-- publicação classifica obstrução por "referência − 1 DP" e "referência − 2 DP",
-- então o desvio-padrão não é enfeite: sem ele, metade da tabela de leitura do
-- gradiente não roda.
ALTER TABLE public.prosthesis_catalog
  ADD COLUMN IF NOT EXISTS eoa_reference_sd numeric,
  ADD COLUMN IF NOT EXISTS eoa_source_label text,
  ADD COLUMN IF NOT EXISTS eoa_source_url text;

COMMENT ON COLUMN public.prosthesis_catalog.effective_orifice_area IS
  'EOA de referência publicada, em cm². REGRA: uma linha só recebe valor quando '
  'existe fonte citável para AQUELE modelo e AQUELE tamanho. Sem interpolar '
  'entre tamanhos, sem herdar de "modelo parecido", sem média de família. '
  'Quem preencher tem que preencher eoa_source_label e eoa_source_url junto — '
  'src/test/ferramentas.test.ts reprova o contrário.';

-- ---------------------------------------------------------------------------
-- 3. Os valores publicados
-- ---------------------------------------------------------------------------
-- Fonte: Lancellotti P, Pibarot P, Chambers J, et al. "Recommendations for the
-- imaging assessment of prosthetic heart valves: a report from the European
-- Association of Cardiovascular Imaging, endorsed by the Chinese Society of
-- Echocardiography, the Inter-American Society of Echocardiography, and the
-- Brazilian Department of Cardiovascular Imaging."
-- Eur Heart J Cardiovasc Imaging 2016;17(6):589-590. PMID 27143783.
-- Tabela 7 (posição aórtica) e Tabela 8 (posição mitral).
--
-- Cobertura honesta: das 246 linhas, **29** têm valor publicado para o par
-- exato modelo × tamanho. As outras 217 seguem nulas, e a tela diz isso em vez
-- de disfarçar. Alguns exemplos do que ficou de fora, e por quê:
--
--   * **Braile Biocor** — a Tabela 7 lista "Biocor (Epic)", que é a linhagem
--     St. Jude → Abbott Epic. A Braile Biocor é bioprótese brasileira
--     diferente, de mesmo nome comercial. Herdar o valor por causa do nome
--     seria inventar hemodinâmica de um produto a partir de outro.
--   * **Edwards Magna Ease** — a tabela traz "Carpentier-Edwards Magna", a
--     geração anterior. Gerações diferentes, valores diferentes.
--   * **Abbott Trifecta GT** — a tabela traz "Trifecta". Não são a mesma
--     entrada, e a regra acima não abre exceção para variante.
--   * **TAVI, anéis e as demais mecânicas** — não estão nas Tabelas 7 e 8.
--
-- Onde não há EOA de referência, a ferramenta de *mismatch* continua inteira:
-- ela aceita a EOA **medida** no ecocardiograma, que é o dado que o médico tem
-- no pós-operatório de qualquer forma.

WITH publicado(manufacturer, model_name, tipo, size, eoa, sd) AS (VALUES
  -- Tabela 7 — posição aórtica
  ('Medtronic', 'Hancock II',      'biologica_aortica', 21.0, 1.2, 0.2),
  ('Medtronic', 'Hancock II',      'biologica_aortica', 23.0, 1.3, 0.2),
  ('Medtronic', 'Hancock II',      'biologica_aortica', 25.0, 1.5, 0.2),
  ('Medtronic', 'Hancock II',      'biologica_aortica', 27.0, 1.6, 0.2),
  ('Medtronic', 'Hancock II',      'biologica_aortica', 29.0, 1.6, 0.2),
  ('Edwards',   'Perimount',       'biologica_aortica', 19.0, 1.1, 0.3),
  ('Edwards',   'Perimount',       'biologica_aortica', 21.0, 1.3, 0.4),
  ('Edwards',   'Perimount',       'biologica_aortica', 23.0, 1.5, 0.4),
  ('Edwards',   'Perimount',       'biologica_aortica', 25.0, 1.8, 0.4),
  ('Edwards',   'Perimount',       'biologica_aortica', 27.0, 2.1, 0.4),
  ('Abbott',    'Epic',            'biologica_aortica', 19.0, 1.0, 0.3),
  ('Abbott',    'Epic',            'biologica_aortica', 21.0, 1.3, 0.5),
  ('Abbott',    'Epic',            'biologica_aortica', 23.0, 1.4, 0.5),
  ('Abbott',    'Epic',            'biologica_aortica', 25.0, 1.9, 0.7),
  ('Medtronic', 'Freestyle',       'biologica_aortica', 19.0, 1.2, 0.2),
  ('Medtronic', 'Freestyle',       'biologica_aortica', 21.0, 1.4, 0.2),
  ('Medtronic', 'Freestyle',       'biologica_aortica', 23.0, 1.5, 0.3),
  ('Medtronic', 'Freestyle',       'biologica_aortica', 25.0, 2.0, 0.4),
  ('Medtronic', 'Freestyle',       'biologica_aortica', 27.0, 2.3, 0.5),
  ('Abbott',    'St. Jude Regent', 'mecanica',          19.0, 1.6, 0.4),
  ('Abbott',    'St. Jude Regent', 'mecanica',          21.0, 2.0, 0.7),
  ('Abbott',    'St. Jude Regent', 'mecanica',          23.0, 2.2, 0.9),
  ('Abbott',    'St. Jude Regent', 'mecanica',          25.0, 2.5, 0.9),
  ('Abbott',    'St. Jude Regent', 'mecanica',          27.0, 3.6, 1.3),
  -- Tabela 8 — posição mitral
  ('Medtronic', 'Hancock II',      'biologica_mitral',  25.0, 1.5, 0.4),
  ('Medtronic', 'Hancock II',      'biologica_mitral',  27.0, 1.8, 0.5),
  ('Medtronic', 'Hancock II',      'biologica_mitral',  29.0, 1.9, 0.5),
  ('Medtronic', 'Hancock II',      'biologica_mitral',  31.0, 2.6, 0.5),
  ('Medtronic', 'Hancock II',      'biologica_mitral',  33.0, 2.6, 0.7)
)
UPDATE public.prosthesis_catalog c
   SET effective_orifice_area = p.eoa,
       eoa_reference_sd       = p.sd,
       eoa_source_label       = 'EACVI 2016 — Tabela ' ||
         CASE WHEN p.tipo = 'biologica_mitral' THEN '8' ELSE '7' END ||
         ' (valores normais de referência)',
       eoa_source_url         = 'https://pubmed.ncbi.nlm.nih.gov/27143783/'
  FROM publicado p
 WHERE c.manufacturer = p.manufacturer
   AND c.model_name   = p.model_name
   AND c.type::text   = p.tipo
   AND c.size         = p.size;

-- ---------------------------------------------------------------------------
-- 4. A porta pública: forma controlada, não a tabela aberta
-- ---------------------------------------------------------------------------
-- Devolve só o que a tela mostra, e só linhas ativas. A tabela continua sem
-- nenhuma concessão a `anon`: quem lê sem sessão lê por aqui, e o dia em que
-- uma coluna nova entrar na tabela ela não vaza sozinha para a internet.
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
         c.annulus_min_mm, c.annulus_max_mm,
         c.description, c.reference_url, c.image_url, c.display_order
    FROM public.prosthesis_catalog c
   WHERE c.active = true
   ORDER BY c.display_order, c.manufacturer, c.model_name, c.size;
$$;

REVOKE ALL ON FUNCTION public.catalogo_proteses() FROM public;
GRANT EXECUTE ON FUNCTION public.catalogo_proteses() TO anon, authenticated;

COMMENT ON FUNCTION public.catalogo_proteses() IS
  'Catálogo de próteses para as ferramentas livres e para a tela de novo caso. '
  'É a ÚNICA leitura do catálogo usada pelo aplicativo: duas consultas ao mesmo '
  'catálogo divergiriam no primeiro campo novo, que é como a lista de tabelas '
  'do backup envelheceu quinze tabelas atrás.';

-- ---------------------------------------------------------------------------
-- 5. O catálogo passa a ser somente-leitura para quem vem pela internet
-- ---------------------------------------------------------------------------
-- Medido agora, e é o achado que não estava no plano: `anon` e `authenticated`
-- têm INSERT, UPDATE, DELETE e TRUNCATE nesta tabela — herança do
-- `GRANT ALL ON ALL TABLES IN SCHEMA public` que o Supabase aplica por padrão
-- (47 tabelas deste projeto estão assim). Hoje nada passa, porque a RLS está
-- ligada e a única policy é de SELECT: conferido chamando a API pública sem
-- sessão, a inserção volta 401 "violates row-level security" e a exclusão
-- afeta zero linha (o 204 do PostgREST é "apaguei nada com sucesso").
--
-- Mas a defesa é de uma camada só. Uma policy `FOR ALL` escrita sem cuidado, ou
-- a RLS desligada por um minuto numa manutenção, e o catálogo clínico inteiro
-- fica gravável por qualquer visitante. Ninguém no aplicativo escreve aqui —
-- o catálogo é conteúdo curado, e quem o mantém usa `service_role`. Então a
-- permissão some, e sobra o que é verdade: leitura.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.prosthesis_catalog FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. A regra da procedência vira invariante do banco
-- ---------------------------------------------------------------------------
-- A guarda de CI que eu tinha escrito varria o texto das migrations, e ela
-- encontrou um caso real que eu não sabia: a migration de 2026-07-21 semeia 12
-- linhas com `effective_orifice_area` e **sem fonte nenhuma**. No banco de hoje
-- elas não existem (a migration de 07-25 as apagou, e a leitura pelo RPC
-- confirma: 29 linhas com EOA, 0 sem fonte). Mas num projeto novo, replicando o
-- histórico, elas voltariam — e a ferramenta de mismatch calcularia em cima de
-- números sem dono.
--
-- Varredura de texto não é o lugar certo para isso. A regra é um invariante de
-- dado, então quem a impõe é o banco: qualquer escrita futura, de qualquer
-- migration ou de qualquer script, é recusada se gravar EOA sem procedência.
UPDATE public.prosthesis_catalog
   SET effective_orifice_area = NULL, eoa_reference_sd = NULL
 WHERE effective_orifice_area IS NOT NULL
   AND eoa_source_url IS NULL;

ALTER TABLE public.prosthesis_catalog
  DROP CONSTRAINT IF EXISTS prosthesis_catalog_eoa_com_fonte;
ALTER TABLE public.prosthesis_catalog
  ADD CONSTRAINT prosthesis_catalog_eoa_com_fonte
  CHECK (effective_orifice_area IS NULL OR eoa_source_url IS NOT NULL);
