-- Arquivos de trabalho: um lugar privado e durável para guardar coisas.
--
-- O pedido foi "uma pasta no meu computador para você gravar e salvar tudo". A
-- premissa não se sustenta e isso muda o desenho: o assistente roda num
-- contêiner efêmero na nuvem, que é recriado e apaga tudo o que não estiver no
-- Git. Uma pasta lá pareceria armazenamento sem ser.
--
-- Os dois lugares que de fato duram são o repositório — que é **público**, e
-- portanto não serve para nada sensível — e um bucket privado aqui. Este é o
-- bucket.
--
-- O desenho é o mesmo da biblioteca de referência
-- (`20260809190000_biblioteca_de_referencia.sql`): bucket privado + tabela que
-- indexa o que está nele + acesso só de administrador. Não vale inventar outro
-- formato para o mesmo problema.

-- ---------------------------------------------------------------------------
-- 1. O bucket
-- ---------------------------------------------------------------------------
--
-- 50 MB é o teto do projeto (`fileSizeLimit` da configuração de storage), não
-- uma escolha desta migration — pedir mais aqui não muda nada. A quantidade de
-- arquivos, essa sim, é livre.
--
-- Allowlist ampla, mas allowlist: o uso é geral, e por isso a lista é maior que
-- a da biblioteca (que só aceita PDF). Tipo nulo seria upload sem restrição
-- nenhuma, que é como um bucket vira depósito de qualquer coisa executável.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace', 'workspace', false, 52428800,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
    'text/plain', 'text/markdown', 'text/csv', 'application/json',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin lê os arquivos de trabalho" on storage.objects;
create policy "Admin lê os arquivos de trabalho"
on storage.objects for select to authenticated
using (bucket_id = 'workspace' and public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin sobe arquivos de trabalho" on storage.objects;
create policy "Admin sobe arquivos de trabalho"
on storage.objects for insert to authenticated
with check (bucket_id = 'workspace' and public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin remove arquivos de trabalho" on storage.objects;
create policy "Admin remove arquivos de trabalho"
on storage.objects for delete to authenticated
using (bucket_id = 'workspace' and public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- 2. O índice
-- ---------------------------------------------------------------------------
--
-- Sem uma tabela, o bucket seria uma lista de nomes de arquivo. `origem` existe
-- para uma pergunta prática: distinguir o que o assistente gravou do que a
-- pessoa subiu, sem ter que lembrar depois.
create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  /** Caminho dentro do bucket `workspace`. */
  storage_path text not null unique,
  titulo text not null,
  descricao text,
  mime_type text,
  file_bytes bigint,
  origem text not null default 'humano' check (origem in ('humano', 'assistente')),
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists workspace_files_created_idx
  on public.workspace_files (created_at desc);

alter table public.workspace_files enable row level security;

drop policy if exists "Admin lê workspace_files" on public.workspace_files;
create policy "Admin lê workspace_files"
on public.workspace_files for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin registra workspace_files" on public.workspace_files;
create policy "Admin registra workspace_files"
on public.workspace_files for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin atualiza workspace_files" on public.workspace_files;
create policy "Admin atualiza workspace_files"
on public.workspace_files for update to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin remove workspace_files" on public.workspace_files;
create policy "Admin remove workspace_files"
on public.workspace_files for delete to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- A **tabela** entra no backup semanal: é o índice, e sem ele o bucket vira uma
-- pilha de arquivos sem contexto. Os **arquivos** não entram, e a razão é
-- honesta: o backup mora no mesmo projeto Supabase, então copiá-los para lá não
-- protege contra a perda que importa — a do projeto. A cópia externa de verdade
-- continua parada esperando a credencial da Backblaze B2.
