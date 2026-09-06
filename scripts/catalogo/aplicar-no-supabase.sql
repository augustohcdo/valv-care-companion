-- ===========================================================================
-- VALVEPATH — nada pendente, 2026-09-06
-- ===========================================================================
--
-- Este arquivo é gerado a partir de `PENDENTES`, em
-- scripts/catalogo/gerar-sql-de-aplicacao.mjs. A lista está VAZIA: toda
-- migration do repositório já foi aplicada em produção.
--
-- Não é um arquivo para rodar — é o registro de que não há o que rodar. Se
-- alguém o executar pelo workflow "Banco de dados", a resposta abaixo diz
-- exatamente isso, em vez de um erro de SQL vazio.
--
-- Quando entrar migration nova: acrescente o nome em `PENDENTES`, rode
-- `node scripts/catalogo/gerar-sql-de-aplicacao.mjs` e commite o resultado.
-- A CI reprova se este arquivo divergir da lista.

select 'nada pendente' as situacao,
       'toda migration do repositorio ja foi aplicada' as observacao;
