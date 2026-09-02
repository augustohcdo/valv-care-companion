-- As medidas que a ESC/EACTS 2025 exige e o caso clínico não guardava
--
-- ## Por que existe
--
-- Duas páginas públicas afirmam ao médico que o conteúdo do ValvePath segue a
-- diretriz de 2025. O motor de conduta carimbava ESC 2021 em 18 recomendações.
-- Atualizá-lo é o combinado — mas metade do que 2025 mudou depende de medidas
-- que a tabela `clinical_cases` não tem:
--
--   · **Vmax** e **volume sistólico indexado** separam a estenose aórtica de
--     alto gradiente da de baixo fluxo/baixo gradiente. São ramos com Classe de
--     recomendação diferente, e sem eles o motor não sabe em qual está.
--   · **DSVE** (diâmetro sistólico final do VE) entrou como gatilho cirúrgico
--     isolado na insuficiência aórtica (>50 mm) e na mitral primária (≥40 mm) —
--     independente da fração de ejeção.
--   · **Altura e peso** dão a superfície corporal, e é ela que transforma o DSVE
--     em DSVE indexado, que é o critério que pega paciente de porte pequeno.
--   · **Teste de esforço** e **risco cirúrgico** são as duas condições da
--     recomendação nova mais importante de 2025 (IIa A): troca valvar em
--     assintomático como alternativa à vigilância.
--   · **Fibrilação atrial** e **etiologia da estenose mitral** decidem se o
--     anticoagulante pode ser DOAC ou tem de ser varfarina. Na EM reumática com
--     área ≤ 2,0 cm² o DOAC é Classe III — contraindicado.
--
-- ## A escolha de guardar altura e peso, e não a superfície corporal
--
-- `src/lib/bsa.ts` já calcula por DuBois, e é a mesma função que o cálculo de
-- mismatch usa. Guardar a superfície pronta criaria um segundo número que pode
-- divergir do primeiro — e as duas ferramentas passariam a discordar sobre o
-- mesmo paciente. Guardando altura e peso, existe uma fonte só.
--
-- ## Todas anuláveis, e NULL quer dizer alguma coisa
--
-- NULL é "ninguém mediu", que é diferente de "está normal". O motor trata os
-- dois de forma distinta: sem a medida ele PEDE o exame, em vez de escolher o
-- ramo de vigilância em silêncio. A direção do erro importa — faltando o dado, o
-- sistema antigo mandava esperar.

ALTER TABLE public.clinical_cases
  ADD COLUMN IF NOT EXISTS vmax_m_s          numeric,
  ADD COLUMN IF NOT EXISTS svi_ml_m2         numeric,
  ADD COLUMN IF NOT EXISTS lvesd_mm          numeric,
  ADD COLUMN IF NOT EXISTS altura_cm         numeric,
  ADD COLUMN IF NOT EXISTS peso_kg           numeric,
  ADD COLUMN IF NOT EXISTS teste_esforco     text,
  ADD COLUMN IF NOT EXISTS risco_cirurgico   text,
  ADD COLUMN IF NOT EXISTS fibrilacao_atrial boolean,
  ADD COLUMN IF NOT EXISTS em_etiologia      text;

COMMENT ON COLUMN public.clinical_cases.vmax_m_s IS
  'Velocidade transvalvar máxima, m/s. ≥4,0 define estenose aórtica de alto gradiente; >5,0 é "very severe" (ESC/EACTS 2025, Tabela 4).';
COMMENT ON COLUMN public.clinical_cases.svi_ml_m2 IS
  'Volume sistólico indexado, mL/m². ≤35 caracteriza baixo fluxo (ESC/EACTS 2025, Tabela 4).';
COMMENT ON COLUMN public.clinical_cases.lvesd_mm IS
  'Diâmetro sistólico final do VE, mm. Gatilho cirúrgico isolado na IA (>50) e na IM primária (≥40).';
COMMENT ON COLUMN public.clinical_cases.altura_cm IS
  'Altura em cm. Com o peso, dá a superfície corporal por DuBois (src/lib/bsa.ts) para indexar o DSVE.';
COMMENT ON COLUMN public.clinical_cases.peso_kg IS
  'Peso em kg. Ver altura_cm.';
COMMENT ON COLUMN public.clinical_cases.teste_esforco IS
  'Resultado do teste de esforço. "queda_pa" = queda sustentada de PA > 20 mmHg, que é IIa C por si só.';
COMMENT ON COLUMN public.clinical_cases.risco_cirurgico IS
  'Conclusão do Heart Team. "baixo" = STS-PROM e EuroSCORE II < 4% (nota de rodapé da Tabela 4). Ver src/lib/euroscore2.ts.';
COMMENT ON COLUMN public.clinical_cases.fibrilacao_atrial IS
  'FA presente. Com em_etiologia, decide se o anticoagulante pode ser DOAC.';
COMMENT ON COLUMN public.clinical_cases.em_etiologia IS
  'Etiologia da estenose mitral. Na reumática com área ≤ 2,0 cm², DOAC é Classe III.';

-- ---------------------------------------------------------------------------
-- Restrições
-- ---------------------------------------------------------------------------
--
-- Enum por CHECK, no padrão do resto do projeto, e sempre admitindo NULL: o
-- estado "não informado" tem de continuar representável, senão o banco força o
-- preenchimento e alguém preenche qualquer coisa para salvar o caso.

DO $$ BEGIN
  ALTER TABLE public.clinical_cases
    ADD CONSTRAINT clinical_cases_teste_esforco_valido
    CHECK (teste_esforco IS NULL OR teste_esforco IN ('normal', 'sintomas', 'queda_pa', 'nao_realizado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.clinical_cases
    ADD CONSTRAINT clinical_cases_risco_cirurgico_valido
    CHECK (risco_cirurgico IS NULL OR risco_cirurgico IN ('baixo', 'intermediario', 'alto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.clinical_cases
    ADD CONSTRAINT clinical_cases_em_etiologia_valida
    CHECK (em_etiologia IS NULL OR em_etiologia IN ('reumatica', 'degenerativa'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Faixas fisiológicas. Não são validação de formulário duplicada por capricho:
-- é a última barreira antes de um valor absurdo virar recomendação de cirurgia.
-- Os limites são largos de propósito — barram erro de digitação (Vmax 45 em vez
-- de 4,5), não julgam o caso.
DO $$ BEGIN
  ALTER TABLE public.clinical_cases
    ADD CONSTRAINT clinical_cases_medidas_2025_plausiveis
    CHECK (
      (vmax_m_s  IS NULL OR (vmax_m_s  > 0 AND vmax_m_s  <= 10)) AND
      (svi_ml_m2 IS NULL OR (svi_ml_m2 > 0 AND svi_ml_m2 <= 100)) AND
      (lvesd_mm  IS NULL OR (lvesd_mm  > 0 AND lvesd_mm  <= 120)) AND
      (altura_cm IS NULL OR (altura_cm >= 40 AND altura_cm <= 250)) AND
      (peso_kg   IS NULL OR (peso_kg   >= 2  AND peso_kg   <= 400))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
