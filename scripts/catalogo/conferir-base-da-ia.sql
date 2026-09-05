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
-- nem `net.*`. Pode ser executado quantas vezes quiser.
--
-- ## Por que UM comando só
--
-- A primeira versão trazia dois `SELECT`. A API de gestão devolveu **só o
-- último** — os quatro números que mais importavam não voltaram, e a saída
-- parecia completa. Arquivo de conferência que responde pela metade sem avisar
-- é o defeito que esta sessão inteira persegue, dentro da própria ferramenta de
-- conferir. Agora é um comando só, e a distribuição por fonte vem agregada
-- dentro dele.
--
-- ## O que cada campo prova
--
--   fonte_2025_cadastrada .. 1  ← sem a linha em `knowledge_sources`, o seed
--                                 PULA os sete trechos e ainda responde `ok`.
--   trechos_esc_2025 ....... 7  ← os trechos da ESC/EACTS 2025 na base.
--   trechos_total ..........    ← soma geral.
--   seed_ainda_agendado .... 0  ← a tarefa se desagenda ao rodar. `1` aqui
--                                 significa que ela AINDA NÃO rodou (ou falhou
--                                 antes do `unschedule`) — é a diferença entre
--                                 "o seed não precisou inserir nada" e "o seed
--                                 nunca aconteceu", que o total sozinho não
--                                 distingue.
--   ultima_execucao ........    ← o que o pg_cron registrou da última rodada da
--                                 tarefa: quando e com que status. `null` é
--                                 tarefa que nunca disparou.
--   por_fonte ..............    ← distingue "a base tem N trechos" de "a base
--                                 tem N trechos DAS FONTES CERTAS".

select
  (select count(*) from public.knowledge_sources
     where slug = 'esc-eacts-2025-vhd')                 as fonte_2025_cadastrada,
  (select count(*) from public.knowledge_chunks c
     join public.knowledge_sources s on s.id = c.source_id
     where s.slug = 'esc-eacts-2025-vhd')               as trechos_esc_2025,
  (select count(*) from public.knowledge_chunks)        as trechos_total,
  (select count(*) from cron.job
     where jobname = 'valvepath-seed-unico')            as seed_ainda_agendado,
  (select jsonb_build_object(
            'quando', max(d.start_time),
            'status', (array_agg(d.status order by d.start_time desc))[1],
            'retorno', (array_agg(d.return_message order by d.start_time desc))[1])
     from cron.job_run_details d
     join cron.job j on j.jobid = d.jobid
     where j.jobname = 'valvepath-seed-unico')          as ultima_execucao,
  -- `review_status` é coluna; `awaiting_medical_review` mora dentro de
  -- `metadata` (o seed grava os dois). Conferi o `insert` da função antes de
  -- escrever isto — a primeira versão tratava a segunda como coluna e teria
  -- quebrado no painel.
  (select jsonb_agg(jsonb_build_object(
            'fonte', t.slug, 'trechos', t.trechos, 'preliminares', t.preliminares)
            order by t.trechos desc, t.slug)
     from (
       select s.slug,
              count(c.id)                                                 as trechos,
              count(c.id) filter (where c.review_status = 'ai_generated') as preliminares
       from public.knowledge_sources s
       left join public.knowledge_chunks c on c.source_id = s.id
       group by s.slug
     ) t)                                               as por_fonte;
