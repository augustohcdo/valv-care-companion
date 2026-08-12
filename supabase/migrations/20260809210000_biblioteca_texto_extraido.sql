-- Obra grande entra pelo texto, não pelo arquivo.
--
-- O teto de upload do projeto é 50 MB e **não pode ser levantado** no plano
-- gratuito ("For Free projects, the limit can't exceed 50 MB"). Um livro de
-- referência passa disso com folga — por causa de imagem e fonte embutida, não
-- por causa do conteúdo. O texto dele são poucos megabytes, e é o texto que
-- alimenta a base.
--
-- Então o navegador extrai o texto localmente e sobe só ele. O binário nunca
-- sai da máquina de quem envia.

-- O bucket só aceitava `application/pdf`; sem isto o JSON do texto seria
-- recusado pelo servidor — e a recusa viria como erro cru, no fim de uma
-- extração de vários minutos.
update storage.buckets
   set allowed_mime_types = array['application/pdf', 'application/json']
 where id = 'reference-library';

alter table public.reference_works
  -- 'pdf' = o documento original; 'texto' = o texto extraído dele, com a
  -- página preservada para a citação continuar chegando à página.
  add column if not exists kind text not null default 'pdf',
  add column if not exists pages integer;

do $$ begin
  alter table public.reference_works
    add constraint reference_works_kind_check check (kind in ('pdf', 'texto'));
exception when duplicate_object then null; end $$;

comment on column public.reference_works.kind is
  'pdf = documento original enviado; texto = texto extraído no navegador, quando a obra passa do teto de upload.';
