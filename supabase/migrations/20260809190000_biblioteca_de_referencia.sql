-- Biblioteca de referência: onde as obras que originam a base de conhecimento
-- ficam guardadas.
--
-- O chat não serve para livro: o anexo estoura. O caminho é o próprio site — o
-- administrador sobe o PDF pelo navegador e o arquivo fica aqui, num bucket
-- privado.
--
-- Isso também fecha um buraco da rodada anterior: `knowledge_sources` guarda a
-- *referência* da obra, mas o documento que originou cada trecho não ficava em
-- lugar nenhum. Quem for revisar depois precisa poder abrir a fonte e conferir
-- o que foi sintetizado — sem isso, "citação rastreável" é só uma string.

-- ---------------------------------------------------------------------------
-- 1. O bucket
-- ---------------------------------------------------------------------------
--
-- 50 MB é o teto do projeto (`fileSizeLimit` da configuração de storage, plano
-- gratuito), então não adianta pedir mais aqui. Só PDF: o resto não é obra de
-- referência, e tipo aberto é como upload sem allowlist vira problema.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reference-library', 'reference-library', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin lê a biblioteca" on storage.objects;
create policy "Admin lê a biblioteca"
on storage.objects for select to authenticated
using (bucket_id = 'reference-library' and public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin sobe na biblioteca" on storage.objects;
create policy "Admin sobe na biblioteca"
on storage.objects for insert to authenticated
with check (bucket_id = 'reference-library' and public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin remove da biblioteca" on storage.objects;
create policy "Admin remove da biblioteca"
on storage.objects for delete to authenticated
using (bucket_id = 'reference-library' and public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- 2. A obra
-- ---------------------------------------------------------------------------
--
-- Uma linha por documento, com o que a citação precisa. `knowledge_sources`
-- continua sendo a fonte citada no app; esta tabela é o arquivo por trás dela.
create table if not exists public.reference_works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text,
  edition text,
  year integer,
  publisher text,
  /** Caminho dentro do bucket `reference-library`. */
  storage_path text not null unique,
  file_bytes bigint,
  notes text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

alter table public.reference_works enable row level security;

drop policy if exists "Admin lê reference_works" on public.reference_works;
create policy "Admin lê reference_works"
on public.reference_works for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin registra reference_works" on public.reference_works;
create policy "Admin registra reference_works"
on public.reference_works for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin remove reference_works" on public.reference_works;
create policy "Admin remove reference_works"
on public.reference_works for delete to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- O bucket fica **fora** do inventário de storage e da cópia externa de
-- propósito: é material de origem, que o dono do produto tem em mãos, e
-- duplicá-lo semanalmente só inflaria o backup sem cobrir nenhuma perda real.
-- A tabela, sim, entra no backup — é ela que diz o que a base citou.
