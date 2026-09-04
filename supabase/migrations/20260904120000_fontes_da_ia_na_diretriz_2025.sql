-- As fontes que a IA clínica cita: a de 2025 que faltava, e uma citação inventada
--
-- ## Por que existe
--
-- O motor de conduta passou para a ESC/EACTS 2025 em 02/09. A base de trechos
-- que a IA consulta — que o próprio prompt chama de "a camada de maior peso
-- para conduta" — continuou em 2021. Na mesma tela do caso, o painel de conduta
-- dizia "ESC/EACTS 2025 (DOI 10.1093/eurheartj/ehaf194)" e a IA respondia pela
-- edição anterior, com `TAVI ≥ 75 anos` e `Vmax ≥ 5,5 m/s`.
--
-- Quem achou foi o usuário, cardiologista: "a parte médica ainda está
-- desatualizada com a diretriz antiga". Estava — em cinco camadas.
--
-- ## 1) A fonte de 2025 não existia
--
-- Sem a linha em `knowledge_sources`, o `knowledge-seed` não acha o
-- `source_slug` e PULA os sete trechos novos, respondendo `ok: true` — o que
-- era, até esta rodada, sucesso relatado sem ter feito nada. A função passou a
-- devolver `fontes_nao_cadastradas`, mas a linha aqui é o que resolve.
--
-- ## 2) Uma citação que ninguém podia conferir
--
-- A linha `sbc-valvopatias-2024` trazia, no campo de citação,
-- `Arq Bras Cardiol. 2024;122(5):e20240001` — volume, fascículo e identificador
-- de artigo, tudo com aparência de conferido. Procurando essa edição para citá-la
-- direito, duas buscas (uma restrita ao site do próprio periódico) encontram a
-- linhagem 2011 → 2017 → 2020 e NENHUMA de 2024.
--
-- Busca não prova ausência — foi a lição do registro ANVISA, e um cardiologista
-- resolve isto em um segundo. Mas número de fascículo inventado é precisamente
-- o defeito que o `npm run pmids` existe para impedir, e ele estava na tabela
-- que alimenta as respostas da IA. Fica a edição apontável, com páginas reais.
--
-- O `slug` NÃO muda: é a chave que os seis trechos da SBC usam, e trocá-la faria
-- o seed pulá-los em silêncio. O que o médico lê é o título e o ano.
--
-- ## 3) A edição de 2021 fica, e passa a dizer que foi superada
--
-- Decisão do usuário: manter os trechos de 2021 onde 2025 não trouxe novidade.
-- Diretriz antiga não é informação falsa — apresentá-la como vigente é. A
-- descrição da fonte passa a carregar isso, porque é o texto que acompanha o
-- trecho recuperado.
--
-- Seguro rodar duas vezes: um INSERT com ON CONFLICT e dois UPDATE idempotentes.

-- ---------------------------------------------------------------------------
-- 1) A diretriz valvar vigente
-- ---------------------------------------------------------------------------

INSERT INTO public.knowledge_sources
  (slug, title, organization, year, scope, url, citation, description, is_primary_br, review_status)
VALUES (
  'esc-eacts-2025-vhd',
  '2025 ESC/EACTS Guidelines for the management of valvular heart disease',
  'European Society of Cardiology / EACTS',
  2025,
  'international',
  'https://doi.org/10.1093/eurheartj/ehaf194',
  'Eur Heart J. 2025;46(44):4635-4736. DOI 10.1093/eurheartj/ehaf194',
  'Diretriz valvar VIGENTE. É a que o motor de conduta do ValvePath aplica — ver src/data/diretriz2025.ts, onde cada limiar está ao lado da frase literal que o sustenta.',
  false,
  'ai_generated'
)
ON CONFLICT (slug) DO UPDATE SET
  title        = EXCLUDED.title,
  organization = EXCLUDED.organization,
  year         = EXCLUDED.year,
  url          = EXCLUDED.url,
  citation     = EXCLUDED.citation,
  description  = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- 2) A diretriz brasileira: a edição que se consegue apresentar
-- ---------------------------------------------------------------------------

UPDATE public.knowledge_sources
SET
  title    = 'Atualização das Diretrizes Brasileiras de Valvopatias — 2020',
  year     = 2020,
  citation = 'Arq Bras Cardiol. 2020;115(4):720-775',
  description =
    'Diretriz da SBC para valvopatias, com contexto epidemiológico brasileiro '
    '(alta prevalência de doença reumática) e considerações sobre o SUS. O registro '
    'anterior citava uma edição de 2024 com fascículo e identificador de artigo que '
    'não se encontram em busca nenhuma; ficou a edição apontável. Para a conduta '
    'valvar vigente, a referência é a ESC/EACTS 2025.'
WHERE slug = 'sbc-valvopatias-2024';

-- ---------------------------------------------------------------------------
-- 3) A edição de 2021 fica como referência do que mudou
-- ---------------------------------------------------------------------------

UPDATE public.knowledge_sources
SET description =
  'SUPERADA pela ESC/EACTS 2025. Mantida como referência histórica: mostrar o que '
  'mudou entre as edições é o que o médico pergunta. Não use como conduta atual — '
  'em 2021 o corte de idade do TAVI era 75 anos (hoje 70) e o gatilho de estenose '
  'muito grave era Vmax ≥ 5,5 m/s (hoje gradiente médio ≥ 60 mmHg ou Vmax > 5,0 m/s).'
WHERE slug = 'esc-eacts-2021-vhd';
