-- Extensão para busca vetorial
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- knowledge_sources: catálogo de documentos-fonte
-- ============================================================
CREATE TABLE public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  year INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('br', 'international')),
  url TEXT,
  citation TEXT,
  description TEXT,
  is_primary_br BOOLEAN NOT NULL DEFAULT false,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'ai_generated')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_sources TO anon, authenticated;
GRANT ALL ON public.knowledge_sources TO service_role;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read knowledge_sources"
  ON public.knowledge_sources FOR SELECT
  USING (true);

CREATE POLICY "Admins manage knowledge_sources"
  ON public.knowledge_sources FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_knowledge_sources_updated
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- knowledge_chunks: trechos com embeddings
-- ============================================================
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  section TEXT,
  content TEXT NOT NULL,
  embedding vector(3072),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'ai_generated' CHECK (review_status IN ('pending', 'reviewed', 'ai_generated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read knowledge_chunks"
  ON public.knowledge_chunks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage knowledge_chunks"
  ON public.knowledge_chunks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX knowledge_chunks_topic_idx ON public.knowledge_chunks(topic);
CREATE INDEX knowledge_chunks_embedding_idx
  ON public.knowledge_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE TRIGGER trg_knowledge_chunks_updated
  BEFORE UPDATE ON public.knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- match_knowledge: busca semântica para o RAG
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(3072),
  match_count INT DEFAULT 5,
  filter_topic TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  source_title TEXT,
  source_organization TEXT,
  source_year INTEGER,
  source_scope TEXT,
  source_url TEXT,
  source_citation TEXT,
  topic TEXT,
  section TEXT,
  content TEXT,
  review_status TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, s.id, s.title, s.organization, s.year, s.scope, s.url, s.citation,
    c.topic, c.section, c.content, c.review_status,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_sources s ON s.id = c.source_id
  WHERE c.embedding IS NOT NULL
    AND (filter_topic IS NULL OR c.topic = filter_topic)
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

-- ============================================================
-- content_review_status: selos de revisão por conteúdo educativo
-- ============================================================
CREATE TABLE public.content_review_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('patient_topic', 'clinical_guideline', 'ai_prompt')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'ai_generated_pending')),
  reviewer_name TEXT,
  reviewer_crm TEXT,
  reviewer_crm_uf TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_review_status TO anon, authenticated;
GRANT ALL ON public.content_review_status TO service_role;
ALTER TABLE public.content_review_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read content_review_status"
  ON public.content_review_status FOR SELECT
  USING (true);

CREATE POLICY "Admins manage content_review_status"
  ON public.content_review_status FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_content_review_status_updated
  BEFORE UPDATE ON public.content_review_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Seed: fontes principais
-- ============================================================
INSERT INTO public.knowledge_sources (slug, title, organization, year, scope, url, citation, description, is_primary_br, review_status) VALUES
  ('sbc-valvopatias-2024', 'Diretriz Brasileira de Valvopatias — 2024', 'Sociedade Brasileira de Cardiologia (SBC)', 2024,
   'br', 'https://abccardiol.org/', 'Arq Bras Cardiol. 2024;122(5):e20240001',
   'Diretriz oficial da SBC para valvopatias, com contexto epidemiológico brasileiro (alta prevalência de doença reumática) e considerações sobre SUS.',
   true, 'ai_generated'),
  ('acc-aha-2020-valvular', '2020 ACC/AHA Guideline for the Management of Patients With Valvular Heart Disease', 'American College of Cardiology / American Heart Association', 2020,
   'international', 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000000923', 'Circulation. 2021;143:e72–e227',
   'Guideline norte-americano de referência.', false, 'ai_generated'),
  ('esc-eacts-2021-vhd', '2021 ESC/EACTS Guidelines for the management of valvular heart disease', 'European Society of Cardiology / EACTS', 2021,
   'international', 'https://academic.oup.com/eurheartj/article/43/7/561/6358470', 'Eur Heart J. 2022;43(7):561–632',
   'Guideline europeu de referência.', false, 'ai_generated'),
  ('datasus-valvopatia-reumatica', 'Epidemiologia da doença valvar reumática no Brasil — DATASUS', 'Ministério da Saúde / DATASUS', 2023,
   'br', 'https://datasus.saude.gov.br/', 'DATASUS/SIH-SUS',
   'Dados de morbidade e mortalidade por febre reumática e valvopatia reumática no SUS.',
   false, 'ai_generated');
