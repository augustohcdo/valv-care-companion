-- ============================================================================
-- Etapa 1 de 2: o convite de colega por CRM ganha um RPC
-- ============================================================================
--
-- ## O que ficou em aberto, e onde está escrito
--
-- A migration `20260923140000_doctors_sem_leitura_aberta` trocou o
-- `using (true)` de `doctors` por uma cerca de cinco portas, e registrou no
-- próprio cabeçalho o que ela NÃO fazia:
--
--   > A porta 5 mantém todo médico enxergando todo médico, inclusive quem
--   > desmarcou a caixa. É o que o convite de colaboração por CRM exige, e RLS
--   > não sabe dizer "só quando a consulta filtra por CRM exato".
--   >
--   > Fechar também a porta 5 exige mover a busca de colega para um RPC
--   > `security definer` que receba CRM e UF e devolva uma linha só.
--
-- É esse RPC. A porta 5 **continua aberta aqui** — ela sai na etapa 2.
--
-- ## Por que em duas etapas, e não numa
--
-- Porque nenhuma das duas ordens de uma etapa só é segura:
--
--   · fechar a porta 5 antes de o frontend publicar → o `CaseCollaborators`
--     que está no ar faz `select id, user_id from doctors where crm = …`, a
--     cerca filtra a linha, e a tela responde **"Médico não encontrado —
--     verifique o CRM e a UF"** sobre um colega que existe. Pior que um erro:
--     é uma frase falsa que joga a culpa na digitação de quem convida;
--   · publicar o frontend antes do RPC → ele chama uma função que não existe.
--
-- Com as duas etapas, cada estado intermediário funciona: aqui o RPC passa a
-- existir sem nada mudar de comportamento, e a etapa 2 só entra depois de o
-- frontend que o usa estar no ar.
--
-- ## O que o RPC pode, e o que ele NÃO resolve
--
-- Ele devolve `id` e `user_id` — nada mais. É estritamente menos do que a
-- leitura de hoje, que entrega CRM, RQE, cidade, instituição e biografia de
-- toda a tabela.
--
-- O que ele **não** impede, e fica dito para ninguém confundir: um médico
-- continua podendo sondar números de CRM um a um e descobrir que um registro
-- existe. Isso é inerente a convidar alguém por CRM — a função é a mesma do
-- formulário. O que deixa de ser possível é **ler a tabela em bloco**, que é a
-- diferença entre sondar e baixar.
--
-- Nenhum filtro por `is_demo` nem por `no_diretorio`: a consulta que este RPC
-- substitui não tem nenhum dos dois, e acrescentá-los aqui mudaria quem pode
-- ser convidado a pretexto de uma mudança de leitura. Se for para mudar, que
-- seja numa migration que fale só disso.
-- ============================================================================

create or replace function public.medico_por_crm(_crm text, _crm_uf text)
returns table (id uuid, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.user_id
    from public.doctors d
   where
     -- A porta: só médico procura colega. Sem isto o RPC seria uma leitura de
     -- `doctors` por CRM aberta a qualquer conta autenticada — mais frouxo que
     -- a cerca que ele vem ajudar a fechar.
     exists (select 1 from public.doctors eu where eu.user_id = auth.uid())
     and d.crm = btrim(_crm)
     and d.crm_uf = upper(btrim(_crm_uf))
   limit 1
$$;

-- `limit 1` e não `maybeSingle` do lado do cliente: `UNIQUE (crm, crm_uf)` já
-- garante uma linha, mas se algum dia não garantir, é melhor devolver uma do
-- que estourar na tela de quem convida.

revoke all on function public.medico_por_crm(text, text) from public;
grant execute on function public.medico_por_crm(text, text) to authenticated;

-- ===========================================================================
-- CONFERÊNCIA — o resultado abaixo é o que prova que deu certo
-- ===========================================================================
--
-- Esperado:
--   existe ..................... true
--   security_definer ........... true
--   devolve_so_id_e_user_id .... true   ← não vaza CRM, bio, cidade
--   exige_ser_medico ........... true   ← a porta de dentro da função
--   authenticated_executa ...... true
--   publico_nao_executa ........ true
--   porta_5_ainda_aberta ....... true   ← esta etapa NÃO a fecha; é a etapa 2

SELECT
  count(*) > 0                                                   AS existe,
  bool_or(f.prosecdef)                                           AS security_definer,
  bool_or(pg_catalog.pg_get_function_result(f.oid)
          = 'TABLE(id uuid, user_id uuid)')                      AS devolve_so_id_e_user_id,
  bool_or(f.prosrc LIKE '%eu.user_id = auth.uid()%')             AS exige_ser_medico,
  bool_or(has_function_privilege('authenticated', f.oid, 'EXECUTE'))
                                                                 AS authenticated_executa,
  bool_or(NOT has_function_privilege('public', f.oid, 'EXECUTE')) AS publico_nao_executa,
  (SELECT p.prosrc LIKE '%from public.doctors d2 where d2.user_id = _user_id%'
     FROM pg_proc p JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE pn.nspname = 'public' AND p.proname = 'pode_ver_medico')
                                                                 AS porta_5_ainda_aberta
FROM pg_proc f
JOIN pg_namespace n ON n.oid = f.pronamespace
WHERE n.nspname = 'public' AND f.proname = 'medico_por_crm';
