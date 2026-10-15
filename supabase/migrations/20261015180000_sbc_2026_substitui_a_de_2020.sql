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
-- Os trechos de 2020 saem da base — e por que isto NÃO é opcional
-- ---------------------------------------------------------------------------
--
-- O `knowledge-seed` é idempotente por `(source_id, section)`: trecho cuja
-- section já existe é PULADO, nunca atualizado. Os seis trechos brasileiros
-- foram reescritos com sections novas (de "… (SBC 2020)" para "… (SBC 2026,
-- Quadro N)"), então os novos entram — e os velhos FICAM.
--
-- Sem este DELETE, o resultado seria a base servindo, debaixo de uma fonte cujo
-- título diz 2026, dois conjuntos contraditórios de recomendação: o de 2020 e o
-- de 2026. A IA citaria "[Fonte: SBC 2026]" sobre texto de 2020 — e, pior,
-- poderia citar os dois na mesma resposta como se fossem duas fontes
-- concordando. Não daria erro em lugar nenhum.
--
-- As seis sections são nomeadas uma a uma, e não apagadas por padrão de texto:
-- `like '%SBC 2020%'` também pegaria um trecho curado à mão por um
-- administrador que mencionasse a edição antiga de propósito.
--
-- Entre esta migração e a próxima execução do seed, a base fica SEM os trechos
-- brasileiros. É um estado honesto — a IA responde que não encontrou o assunto
-- na base — e preferível ao estado mentiroso. Para encurtá-lo, rode
-- "Popular / atualizar base RAG" em Administração → Base da IA logo após o
-- deploy; o pg_cron faria isso sozinho na próxima janela.

delete from public.knowledge_chunks
where source_id = (select id from public.knowledge_sources where slug = 'sbc-valvopatias-2024')
  and section in (
    'Estenose aórtica — indicações de intervenção (SBC 2020)',
    'Estenose mitral reumática — contexto brasileiro (SBC 2020)',
    'Insuficiência mitral primária — SBC 2020',
    'Insuficiência aórtica crônica — SBC 2020',
    'Regurgitação tricúspide — SBC 2020',
    'Epidemiologia e anticoagulação — SBC 2020'
  );

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
  (s.year = 2026)                                   as ano_2026,
  (s.title like '%2026%')                           as titulo_diz_2026,
  (s.citation like '%e20260796%')                   as citacao_tem_o_artigo,
  (s.url = 'https://doi.org/10.36660/abc.20260796') as url_e_o_doi,
  (s.description like '%2011 → 2017 → 2020 → 2026%') as linhagem_registrada,
  -- E a parte que o UPDATE sozinho não provaria: nenhum trecho de 2020
  -- sobreviveu debaixo da fonte que agora diz 2026.
  (select count(*) from public.knowledge_chunks c
    where c.source_id = s.id and c.section like '%SBC 2020%') as trechos_de_2020_restantes,
  (select count(*) from public.knowledge_chunks c
    where c.source_id = s.id) as trechos_da_fonte
from public.knowledge_sources s
where s.slug = 'sbc-valvopatias-2024';
