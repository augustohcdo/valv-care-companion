-- ---------------------------------------------------------------------------
-- Só leitura: quais trechos existem hoje debaixo da fonte brasileira
-- ---------------------------------------------------------------------------
--
-- Por que este arquivo existe, e por que ele não muda nada
--
-- A migração `20261015180000_sbc_2026_substitui_a_de_2020.sql` apaga SEIS
-- sections nomeadas — as que o seed usava quando citava a edição de 2020. Só
-- que a conferência do `aplicar-no-supabase.sql`, rodada em 2026-10-15,
-- devolveu `trechos_da_sbc: 12`.
--
-- Doze, não seis. Quer dizer que há seis trechos na base que o seed atual não
-- declara — provavelmente de uma versão anterior dele, com outros títulos.
-- Apagar seis e deixar seis desconhecidos debaixo de uma fonte que passa a
-- dizer 2026 seria repetir, pela metade, o defeito que a migração existe para
-- evitar.
--
-- Então antes de apagar, medir. Isto é um SELECT: não escreve nada.
--
-- Uso: disparar o workflow "Banco de dados" com
--   arquivo = scripts/sql/listar-trechos-da-sbc.sql

select
  c.section,
  length(c.content)                                   as tamanho,
  c.review_status,
  c.created_at::date                                  as criado_em,
  (c.section like '%2026%')                           as e_da_edicao_nova,
  (c.section like '%SBC 2020%')                        as nomeada_na_migracao
from public.knowledge_chunks c
join public.knowledge_sources s on s.id = c.source_id
where s.slug = 'sbc-valvopatias-2024'
order by c.created_at, c.section;
