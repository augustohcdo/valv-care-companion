-- A lista de fontes passa a dizer o que faz — e o que não faz.
--
-- `trusted_sources` nasceu chamada de "onde a IA pode pesquisar" com 15 linhas,
-- e só uma delas é de fato consultada: o PubMed, pela E-utilities do NCBI. As
-- outras catorze são permissão sem consumo. A diferença não é filosófica: sem
-- ela, um administrador acrescenta um domínio, a tela responde "fonte
-- cadastrada", e nada passa a ser buscado.
--
-- O caminho que faltava está **medido como inviável**, não em aberto. A função
-- `lerFonte` foi escrita para ler a página do fabricante; buscando uma URL real
-- de cada fabricante do catálogo, quatro dos seis devolvem 404 e o único que
-- responde entrega 462 caracteres de casca de JavaScript. São sites que não
-- existem para quem não roda script — não é ajuste de cabeçalho.
--
-- Então a coluna separa as duas coisas com honestidade:
--
--   'automatica' — a IA busca sozinha. Hoje, só o PubMed.
--   'referencia' — fonte que a IA **aceita e cita**, e que o produto declara
--                  como sua base, mas que não é varrida automaticamente.

alter table public.trusted_sources
  add column if not exists consulta text not null default 'referencia';

do $$ begin
  alter table public.trusted_sources
    add constraint trusted_sources_consulta_check
    check (consulta in ('automatica', 'referencia'));
exception when duplicate_object then null; end $$;

-- O único caminho de busca implementado.
update public.trusted_sources
   set consulta = 'automatica'
 where domain = 'pubmed.ncbi.nlm.nih.gov';

-- Achado ao comparar o catálogo de próteses com a cerca: 28 próteses apontam
-- `reference_url` para a Corcym (ex-LivaNova) e o domínio não constava. Um link
-- do próprio catálogo que a lista não reconhece é a mesma classe de defeito das
-- quinze tabelas que ficaram fora do backup.
insert into public.trusted_sources (domain, name, category, citable_for, never_for, consulta, notes) values
  ('www.corcym.com', 'Corcym (ex-LivaNova)', 'fabricante',
   'Especificação técnica do próprio produto: modelo, tamanho, faixa de anel, área efetiva de orifício.',
   'Nunca para indicação, comparação entre marcas ou desfecho clínico — é material do fabricante da prótese.',
   'referencia',
   '28 próteses do catálogo apontam para este domínio.')
on conflict (domain) do nothing;

comment on column public.trusted_sources.consulta is
  'automatica = a IA busca sozinha nesta fonte; referencia = fonte aceita e citável, não varrida.';
