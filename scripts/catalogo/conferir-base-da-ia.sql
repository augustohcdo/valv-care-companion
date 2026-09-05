-- ===========================================================================
-- VALVEPATH — conferência da base que a IA consulta (SÓ LEITURA)
-- ===========================================================================
--
-- ## Por que existe um arquivo só para conferir
--
-- O `aplicar-no-supabase.sql` traz um `SELECT` no fim, mas ele roda no mesmo
-- instante em que agenda o trabalho — retrato de antes, não prova de depois.
-- Reaplicar aquele arquivo só para reler o número teria efeito colateral:
-- reagendaria a tarefa do seed. Conferir não pode mudar o que se confere.
--
-- Este arquivo NÃO escreve nada. Nenhum `insert`, `update`, `delete`, `cron.*`
-- nem `net.*`. Pode ser executado quantas vezes quiser, inclusive por quem
-- estiver só desconfiado do estado da base.
--
-- ## O que cada número prova
--
--   fonte_2025_cadastrada .. 1  ← sem a linha em `knowledge_sources`, o seed
--                                 PULA os sete trechos e ainda responde `ok`.
--                                 Foi esse o defeito de "sucesso sem trabalho"
--                                 que a função passou a denunciar.
--   trechos_esc_2025 ....... 7  ← os trechos da ESC/EACTS 2025 que estavam no
--                                 código e não estavam na base.
--   trechos_total .......... 33 ← 26 antes do seed + os 7.
--   seed_ainda_agendado .... 0  ← a tarefa se desagenda depois de rodar. 1 aqui
--                                 significa que ela NÃO rodou ainda (ou falhou
--                                 antes do `unschedule`).
--
-- `trechos_por_fonte` mostra a distribuição, que é o que distingue "a base tem
-- 33 trechos" de "a base tem 33 trechos DAS FONTES CERTAS".

select
  (select count(*) from public.knowledge_sources
    where slug = 'esc-eacts-2025-vhd')                  as fonte_2025_cadastrada,
  (select count(*) from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id
    where s.slug = 'esc-eacts-2025-vhd')                as trechos_esc_2025,
  (select count(*) from public.knowledge_chunks)        as trechos_total,
  (select count(*) from cron.job
    where jobname = 'valvepath-seed-unico')             as seed_ainda_agendado;

-- Distribuição por fonte: quem tem trecho, e quanto.
--
-- `review_status` é coluna; `awaiting_medical_review` mora dentro de `metadata`
-- (o seed grava os dois). Conferi o `insert` da função antes de escrever isto —
-- a primeira versão desta consulta tratava a segunda como coluna e teria
-- quebrado no painel.
select
  s.slug                                                       as fonte,
  count(c.id)                                                  as trechos,
  count(c.id) filter (where c.review_status = 'ai_generated')  as preliminares
from public.knowledge_sources s
left join public.knowledge_chunks c on c.source_id = s.id
group by s.slug
order by trechos desc, s.slug;
