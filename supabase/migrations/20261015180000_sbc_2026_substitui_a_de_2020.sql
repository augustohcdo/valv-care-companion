-- ---------------------------------------------------------------------------
-- A diretriz brasileira que a IA cita passa a ser a de 2026
-- ---------------------------------------------------------------------------
--
-- ## Por que esta migração existe, e por que ela não é opcional
--
-- Os seis trechos brasileiros da base da IA foram reescritos a partir da
-- Diretriz Brasileira de Valvopatias 2026 — PDF oficial do periódico, 108
-- páginas, cada trecho citando o quadro e a página de onde saiu.
--
-- O rótulo que o médico lê na tela NÃO vem do trecho: vem desta linha de
-- `knowledge_sources` (`title`, `year`, `citation`). Trocar o conteúdo sem
-- trocar o rótulo produziria a pior combinação possível: recomendação de 2026
-- apresentada como se fosse de 2020. Procedência errada afirmada com confiança
-- é o defeito que este projeto persegue, e aqui ele apareceria do lado clínico.
--
-- ## O slug continua `sbc-valvopatias-2024`
--
-- Terceira vez que isto precisa ser escrito, e pelo mesmo motivo das duas
-- anteriores: é a chave que os trechos usam. Trocá-la faria o seed pulá-los em
-- silêncio. O que vale é o título e o ano — e agora os dois dizem 2026.
--
-- ## A edição de 2020 não some; ela vira história
--
-- A `description` registra a linhagem 2011 → 2017 → 2020 → 2026 para quem abrir
-- a tabela não concluir que houve troca de documento sem explicação. A de 2020
-- foi a referência correta do projeto até 15/10/2026.
--
-- Seguro rodar duas vezes: é um UPDATE idempotente.

update public.knowledge_sources
set
  title       = 'Diretriz Brasileira de Valvopatias — 2026',
  year        = 2026,
  citation    = 'Tarasoutchi F, Fernandes JRC, Rosa VEE, Sampaio RO, et al. Diretriz Brasileira de '
                || 'Valvopatias – 2026. Arq Bras Cardiol. 2026;123(10):e20260796. '
                || 'DOI 10.36660/abc.20260796',
  url         = 'https://doi.org/10.36660/abc.20260796',
  description = 'Edição de 2026, realização conjunta da Sociedade Brasileira de Cardiologia (SBC), da '
                || 'Sociedade Brasileira de Hemodinâmica e Cardiologia Intervencionista (SBHCI) e da '
                || 'Sociedade Brasileira de Cirurgia Cardiovascular (SBCCV), apresentada no 81º '
                || 'Congresso Brasileiro de Cardiologia. Linhagem: 2011 → 2017 → 2020 → 2026; a de '
                || '2020 foi a referência do projeto até 15/10/2026. Usa GRADE (força Forte/Fraca, '
                || 'certeza Alta/Moderada/Baixa/Muito baixa) em vez de Classe I–III e Nível A–C, e '
                || 'traz nas tabelas a posição da AHA e da ESC ao lado da brasileira. O slug diz 2024 '
                || 'por motivo histórico — é a chave que os trechos já cadastrados usam, e trocá-la os '
                || 'faria sumir da base sem aviso. Vale o título e o ano: 2026.'
where slug = 'sbc-valvopatias-2024';

-- ---------------------------------------------------------------------------
-- Conferência — e desta vez ela prova o que afirma
-- ---------------------------------------------------------------------------
--
-- A lição de 2026-10-11, registrada na migração do encerramento de conta: um
-- SELECT que só confirma que a linha existe prova exatamente nada, porque a
-- linha existia antes também. O que interessa é se o CONTEÚDO mudou.
--
-- As três colunas abaixo têm de voltar `true`. Se `ano_2026` vier `false`, o
-- UPDATE não pegou a linha — provavelmente porque o slug mudou em produção, e
-- aí os trechos também estão órfãos.

select
  (year = 2026)                                   as ano_2026,
  (title like '%2026%')                           as titulo_diz_2026,
  (citation like '%e20260796%')                   as citacao_tem_o_artigo,
  (url = 'https://doi.org/10.36660/abc.20260796') as url_e_o_doi,
  (description like '%2011 → 2017 → 2020 → 2026%') as linhagem_registrada
from public.knowledge_sources
where slug = 'sbc-valvopatias-2024';
