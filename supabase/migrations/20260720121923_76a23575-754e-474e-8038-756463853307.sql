CREATE OR REPLACE FUNCTION public.match_knowledge(query_embedding vector, match_count integer DEFAULT 5, filter_topic text DEFAULT NULL::text)
 RETURNS TABLE(chunk_id uuid, source_id uuid, source_title text, source_organization text, source_year integer, source_scope text, source_url text, source_citation text, topic text, section text, content text, review_status text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id, s.id, s.title, s.organization, s.year, s.scope, s.url, s.citation,
    c.topic, c.section, c.content, c.review_status,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_sources s ON s.id = c.source_id
  WHERE c.embedding IS NOT NULL
    AND c.review_status = 'reviewed'
    AND (filter_topic IS NULL OR c.topic = filter_topic)
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$function$;