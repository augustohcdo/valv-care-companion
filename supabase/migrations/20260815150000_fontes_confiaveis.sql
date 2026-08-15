-- Onde a IA pode pesquisar — e, em cada fonte, o que ela pode embasar.
--
-- A base ValvePath (knowledge_chunks) é pequena e sempre será: ela guarda
-- síntese com citação, não a literatura inteira. Isso limita o médico, que
-- pergunta sobre estudo recente, registro brasileiro, especificação de prótese.
-- Dar acesso à internet aberta resolveria isso e criaria um problema pior:
-- resposta clínica ancorada em blog, fórum ou material promocional, com a
-- mesma aparência de autoridade das outras.
--
-- Então a pesquisa externa é possível **apenas** dentro desta lista. Não é
-- filtro aplicado depois da resposta — é a única origem que a função consegue
-- alcançar. Domínio fora daqui não é rejeitado no fim: ele nunca é buscado.
--
-- **`citable_for` e `never_for` são o miolo desta tabela.** Confiável não é
-- propriedade do domínio, é propriedade do par (domínio, pergunta). O site da
-- Edwards é a melhor fonte do mundo para o diâmetro de anel de um modelo dela,
-- e é a pior fonte possível para decidir entre TAVI e cirurgia — é material do
-- fabricante da prótese. O DATASUS diz quantos procedimentos o SUS fez, e não
-- diz limiar de indicação. Sem esse par declarado, "fonte confiável" vira um
-- carimbo que atravessa qualquer pergunta.

create table if not exists public.trusted_sources (
  id uuid primary key default gen_random_uuid(),
  -- Sem esquema e sem "www.": é o host que a função compara, e comparar
  -- "https://abccardiol.org/" com "abccardiol.org" seria erro silencioso.
  domain text not null unique,
  name text not null,
  category text not null check (category in (
    'sociedade_medica',   -- diretriz e posicionamento
    'orgao_publico',      -- regulação e dados públicos
    'literatura',         -- base indexada de artigos
    'fabricante'          -- especificação técnica de produto
  )),
  /** O que esta fonte PODE embasar. Vai literal para a instrução do modelo. */
  citable_for text not null,
  /** O que ela NÃO pode embasar, com o motivo. Também vai para a instrução. */
  never_for text,
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trusted_sources_enabled
  on public.trusted_sources (domain) where enabled;

insert into public.trusted_sources (domain, name, category, citable_for, never_for, notes) values
  -- ---------------------------------------------------------------- literatura
  ('pubmed.ncbi.nlm.nih.gov', 'PubMed (National Library of Medicine)', 'literatura',
   'Artigos indexados: ensaio clínico, metanálise, revisão sistemática, diretriz publicada em periódico. Sempre com PMID, periódico e ano.',
   'Não citar um resumo como se fosse recomendação de diretriz: resumo é achado de estudo, e o peso depende do desenho.',
   'Acesso pela E-utilities do NCBI: pública, sem chave, com metadado estruturado (periódico, ano, tipo de publicação).'),
  ('www.ncbi.nlm.nih.gov', 'NCBI / PubMed Central', 'literatura',
   'Texto completo de artigo em acesso aberto.', null, null),
  ('www.cochranelibrary.com', 'Cochrane Library', 'literatura',
   'Revisão sistemática e avaliação de qualidade de evidência.', null, null),

  -- ----------------------------------------------------------- sociedade médica
  ('abccardiol.org', 'Arquivos Brasileiros de Cardiologia (SBC)', 'sociedade_medica',
   'Diretriz brasileira de valvopatias e posicionamentos da SBC — fonte primária para o contexto brasileiro.',
   null,
   'Onde a Diretriz Brasileira de Valvopatias 2024 é publicada.'),
  ('www.escardio.org', 'European Society of Cardiology', 'sociedade_medica',
   'Diretrizes ESC/EACTS de doença valvar e documentos de consenso.', null, null),
  ('www.acc.org', 'American College of Cardiology', 'sociedade_medica',
   'Diretrizes ACC/AHA e documentos de decisão clínica.', null, null),
  ('www.ahajournals.org', 'American Heart Association (journals)', 'sociedade_medica',
   'Diretrizes AHA e artigos de Circulation.', null, null),

  -- -------------------------------------------------------------- órgão público
  ('apidadosabertos.saude.gov.br', 'Dados Abertos — Ministério da Saúde', 'orgao_publico',
   'Dados públicos de produção e procedimentos do SUS.',
   'Volume de procedimento não é indicação clínica: DATASUS descreve o que foi feito, não o que se deve fazer.',
   'API pública de dados abertos do Ministério da Saúde.'),
  ('datasus.saude.gov.br', 'DATASUS', 'orgao_publico',
   'Epidemiologia e produção hospitalar no Brasil — magnitude do problema, disponibilidade regional.',
   'Não embasa limiar, classe de recomendação ou escolha de prótese.', null),
  ('www.gov.br', 'Portal do Governo Federal (inclui ANVISA e Ministério da Saúde)', 'orgao_publico',
   'Registro e regularização de produto para saúde no Brasil, notas técnicas, alerta sanitário.',
   'Registro na ANVISA diz que o produto pode ser comercializado, não que ele é a melhor escolha para o paciente.', null),

  -- ----------------------------------------------------------------- fabricante
  ('www.edwards.com', 'Edwards Lifesciences', 'fabricante',
   'Especificação técnica do próprio produto: modelo, tamanho, faixa de anel, área efetiva de orifício, instruções de uso.',
   'Nunca para indicação, comparação entre marcas ou desfecho clínico — é material do fabricante da prótese, com conflito de interesse por definição.', null),
  ('www.medtronic.com', 'Medtronic', 'fabricante',
   'Especificação técnica do próprio produto.',
   'Nunca para indicação, comparação entre marcas ou desfecho clínico.', null),
  ('www.cardiovascular.abbott', 'Abbott Structural Heart', 'fabricante',
   'Especificação técnica do próprio produto.',
   'Nunca para indicação, comparação entre marcas ou desfecho clínico.', null),
  ('brailebiomedica.com.br', 'Braile Biomédica', 'fabricante',
   'Especificação técnica do próprio produto (fabricante nacional).',
   'Nunca para indicação, comparação entre marcas ou desfecho clínico.', null),
  ('www.merillife.com', 'Meril Life Sciences', 'fabricante',
   'Especificação técnica do próprio produto.',
   'Nunca para indicação, comparação entre marcas ou desfecho clínico.', null)
on conflict (domain) do nothing;

alter table public.trusted_sources enable row level security;

-- Leitura para qualquer autenticado, de propósito: saber **onde** a IA
-- pesquisa é parte do que faz o médico confiar nela. Esconder a lista
-- transformaria a pesquisa externa numa caixa-preta, que é o oposto do pedido.
drop policy if exists "Authenticated reads trusted_sources" on public.trusted_sources;
create policy "Authenticated reads trusted_sources"
on public.trusted_sources for select to authenticated
using (true);

drop policy if exists "Admin manages trusted_sources" on public.trusted_sources;
create policy "Admin manages trusted_sources"
on public.trusted_sources for all to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));
