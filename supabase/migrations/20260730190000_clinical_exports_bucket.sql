-- A policy para o bucket "clinical-exports" já existia desde 20260719035328
-- (só admins leem, escrita via service_role), mas o bucket em si nunca tinha
-- sido criado de fato — descoberto ao testar a função dpo-export (Fase 5),
-- que precisa dele para subir os exports de dados pessoais.
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinical-exports', 'clinical-exports', false)
ON CONFLICT (id) DO NOTHING;
