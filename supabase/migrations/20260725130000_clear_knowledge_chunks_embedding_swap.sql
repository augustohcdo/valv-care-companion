
-- Embeddings were generated with google/gemini-embedding-2 via the Lovable AI
-- gateway. We've moved to OpenAI text-embedding-3-large (see clinical-ai and
-- knowledge-seed edge functions), a different vector space at the same
-- dimension (3072) — old rows would silently return wrong similarity scores
-- if left in place. All rows were preliminary (review_status='ai_generated',
-- not yet reviewed by a clinician), so it's safe to clear and reseed.
delete from public.knowledge_chunks;
