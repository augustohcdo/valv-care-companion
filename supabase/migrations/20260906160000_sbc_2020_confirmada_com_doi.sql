-- A diretriz brasileira: confirmada como 2020, agora com DOI e link do artigo
--
-- ## O que foi conferido, e por quê
--
-- Esta linha carregava, até 04/09, a citação `Arq Bras Cardiol. 2024;122(5):e20240001`
-- — volume, fascículo e identificador de artigo, tudo com aparência de conferido, e
-- nada disso existe. Foi trocada pela edição de 2020 com uma ressalva honesta: duas
-- buscas não são prova de ausência, e a confirmação ficou pendente de um cardiologista.
--
-- O usuário pediu a confirmação. Foram quatro buscas independentes, em 06/09/2026:
--
--   · SciELO e PubMed — a linhagem que aparece é 2011 → 2017 → 2020;
--   · o domínio do próprio periódico (abccardiol.org) — só a de 2020;
--   · o portal de diretrizes da SBC — lista diretrizes de 2025 e de 2026 de outros
--     temas (síndrome coronariana crônica, fibrilação atrial, obesidade) e NENHUMA
--     de valvopatias posterior a 2020;
--   · um artigo intitulado "Nova diretriz de valvopatias da SBC" que parecia
--     contradizer tudo — e é de 27/11/2011, quando aquela era a nova.
--
-- E o DOI foi RESOLVIDO, não copiado: 10.36660/abc.20201047 redireciona para
-- "Update of the Brazilian Guidelines for Valvular Heart Disease – 2020", Tarasoutchi
-- et al., Arq Bras Cardiol 2020;115(4):720-775. Título, autor, volume, fascículo e
-- páginas conferem com o que já estava gravado.
--
-- ## O que muda
--
-- A `url` apontava para `https://abccardiol.org/` — a home do periódico. Um link que
-- não leva ao documento não é fonte: quem clicar para conferir a afirmação cai numa
-- lista de artigos. Passa a apontar para o artigo, e a citação ganha o DOI.
--
-- ## O slug continua `sbc-valvopatias-2024`, e isso é deliberado
--
-- É a chave que os doze trechos da SBC usam. Trocá-la faria o seed pulá-los em
-- silêncio — o defeito que este projeto persegue. O que o médico lê é o título e o
-- ano, e os dois dizem 2020. A `description` passa a explicar a divergência, para
-- quem abrir a tabela não concluir que há duas edições.
--
-- Seguro rodar duas vezes: é um UPDATE idempotente.

update public.knowledge_sources
set
  title       = 'Atualização das Diretrizes Brasileiras de Valvopatias — 2020',
  year        = 2020,
  citation    = 'Tarasoutchi F, et al. Arq Bras Cardiol. 2020;115(4):720-775. DOI 10.36660/abc.20201047',
  url         = 'https://doi.org/10.36660/abc.20201047',
  description = 'Diretriz brasileira vigente para valvopatias, confirmada em 06/09/2026 como a edição mais '
                || 'recente da SBC (linhagem 2011 → 2017 → 2020; o portal de diretrizes da SBC não lista '
                || 'nenhuma de valvopatias posterior). O slug diz 2024 por motivo histórico — é a chave que '
                || 'os trechos já cadastrados usam, e trocá-la os faria sumir da base sem aviso. Vale o '
                || 'título e o ano: 2020.'
where slug = 'sbc-valvopatias-2024';
