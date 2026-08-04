-- O arquivo do prontuário deixa de poder ser destruído, e o backup passa a
-- saber quais arquivos deveriam existir.
--
-- ## Por que remover a policy de DELETE
--
-- `CaseDocuments.tsx` apagava o objeto do storage e, na linha seguinte, marcava
-- a linha como soft-deleted: o registro dizia "recuperável" sobre bytes que já
-- não existiam. Corrigir só a interface deixaria a correção pela metade — a
-- policy abaixo permite ao médico do caso apagar o objeto por chamada direta à
-- API, sem passar pela tela.
--
-- Mesmo movimento da Fase 5, quando a policy de DELETE de `clinical_cases` foi
-- removida pelo mesmo motivo: enquanto a permissão existir, a proteção depende
-- de ninguém usar o caminho de baixo.
--
-- `"Patient deletes own files"` FICA. Documento que o paciente subiu é dele, e
-- a LGPD lhe dá o direito de apagar. A assimetria é deliberada: no bucket do
-- caso o dono do registro é o prontuário; no do paciente, é a pessoa.
--
-- O service_role ignora RLS, então o backup e o atendimento de um pedido de
-- eliminação continuam podendo remover o arquivo quando for o caso.

drop policy if exists "Case doctor deletes files" on storage.objects;

-- ## Inventário
--
-- Os arquivos não entram no backup (ver RECOVERY.md: copiá-los toda semana
-- multiplicaria o armazenamento sem cobrir perda do projeto, que só uma cópia
-- externa cobre). Mas saber QUAIS deveriam existir é barato e responde duas
-- perguntas que hoje ninguém consegue responder: o que a restauração precisa
-- trazer, e se algum documento vivo perdeu o arquivo.
--
-- Só os buckets de documento. `clinical-exports` é o próprio backup — listá-lo
-- dentro de si mesmo não ajuda ninguém.
create or replace function public.storage_inventory()
returns table (
  bucket_id text,
  name text,
  size bigint,
  mime_type text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql security definer set search_path to 'public'
as $$
  select o.bucket_id,
         o.name,
         (o.metadata->>'size')::bigint,
         o.metadata->>'mimetype',
         o.created_at,
         o.updated_at
  from storage.objects o
  where o.bucket_id in ('medical-documents', 'patient-documents')
  order by o.bucket_id, o.name;
$$;

-- A lista traz o caminho de arquivos clínicos de todos os pacientes; nenhum
-- usuário logado tem por que enxergá-la.
revoke execute on function public.storage_inventory() from public, anon, authenticated;

-- ## Conferência entre registro e realidade
--
-- Um documento VIVO cujo arquivo sumiu é falha clínica: o médico clica para
-- baixar e não vem nada. Hoje isso só apareceria quando alguém tentasse.
--
-- O filtro por `deleted_at is null` é essencial, não detalhe: com o documento
-- do paciente continuando apagável, "linha apagada sem arquivo" é o estado
-- correto — e alarmar sobre ele treinaria quem lê a ignorar o alarme.
create or replace function public.documentos_sem_arquivo()
returns table (documentos_ausentes bigint, arquivos_orfaos bigint)
language sql security definer set search_path to 'public'
as $$
  select
    (select count(*) from public.case_documents d
      where d.deleted_at is null
        and not exists (select 1 from storage.objects o
                        where o.bucket_id = 'medical-documents' and o.name = d.storage_path))
    +
    (select count(*) from public.patient_documents d
      where d.deleted_at is null
        and not exists (select 1 from storage.objects o
                        where o.bucket_id = 'patient-documents' and o.name = d.storage_path)),
    -- Arquivo sem linha nenhuma: rastro de upload cujo registro no banco
    -- falhou depois. O caminho existe no código (sobe o arquivo, depois grava a
    -- linha), então o número é informativo, não alarme.
    (select count(*) from storage.objects o
      where o.bucket_id = 'medical-documents'
        and not exists (select 1 from public.case_documents d where d.storage_path = o.name))
    +
    (select count(*) from storage.objects o
      where o.bucket_id = 'patient-documents'
        and not exists (select 1 from public.patient_documents d where d.storage_path = o.name));
$$;

revoke execute on function public.documentos_sem_arquivo() from public, anon;
grant execute on function public.documentos_sem_arquivo() to authenticated;
