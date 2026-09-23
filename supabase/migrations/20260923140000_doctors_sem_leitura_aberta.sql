-- ============================================================================
-- A tabela `doctors` era legível por inteiro por qualquer conta autenticada
-- ============================================================================
--
-- ## O que a tela promete ao médico
--
-- Em `MedicoPerfil`, a caixa "Aparecer no diretório" diz, com todas as letras:
--
--   > Pacientes com conta veem seu nome, CRM/UF, RQE, especialidade, cidade,
--   > instituição e sua biografia, e podem enviar pedido de vínculo.
--   > **Desmarcar tira você da lista**; os vínculos que já existem continuam.
--
-- E o comentário ao lado enquadra a caixa como consentimento revogável — LGPD
-- art. 8º §5º ("consentimento que não pode ser retirado não é consentimento") e
-- a anuência de publicidade médica da Resolução CFM nº 2.336/2023.
--
-- ## O que o banco fazia
--
--     CREATE POLICY "Authenticated users view doctors"
--     ON public.doctors FOR SELECT TO authenticated USING (true);
--
-- Qualquer conta autenticada — qualquer paciente, qualquer cadastro novo — lia
-- a tabela inteira: médicos que desmarcaram a caixa, médicos ainda NÃO
-- verificados, com CRM, RQE, cidade, instituição e biografia.
--
-- O `diretorio_medicos()` filtra por três condições (`verified`,
-- `no_diretorio`, `not is_demo`). A cerca estava na porta da frente, e a
-- tabela, aberta pelos fundos.
--
-- ## A prova, executada num PostgreSQL 16
--
-- Bancada com as tabelas e a política COMO ESTÃO no repositório, uma médica que
-- desmarcou a caixa e um médico não verificado, lidos por uma conta de paciente
-- sem relação nenhuma com os dois:
--
--     diretório (a cerca que a tela promete) → 0 linhas
--     select * from doctors                  → as 2 linhas, com a biografia
--
-- ## A história deste arquivo, que é a mesma de sempre
--
-- A política original era `TO authenticated, anon USING (true)` — legível até
-- sem login. A migration `20260428191449` a estreitou, com o comentário
-- "restringir tabela": tirou o `anon` e **deixou o `using (true)`**. A lição
-- aprendida, escrita, e aplicada pela metade.
--
-- ## O que esta migration faz
--
-- Troca o `using (true)` por uma cerca com cinco portas, uma para cada leitura
-- que o aplicativo realmente faz — todas conferidas na bancada:
--
--   1. a própria linha do médico                    (useDoctor, MedicoPerfil)
--   2. o médico vinculado ao paciente               (PacienteHome, PacienteMedico)
--   3. o médico responsável por um caso que eu vejo (CasoDetalhe)
--   4. colaborador de um caso que eu vejo           (CaseCollaborators, Jornada)
--   5. médico enxerga médico                        (convite de colega por CRM)
--
-- A busca do paciente por CRM **não** precisa de leitura aberta: ela já passa
-- pelo `diretorio_medicos()`, com a cerca aplicada, e o comentário em
-- `PacienteMedico.tsx` diz isso desde que foi escrita.
--
-- ## O QUE ESTA MIGRATION NÃO FAZ — e fica dito
--
-- A porta 5 mantém todo médico enxergando todo médico, inclusive quem desmarcou
-- a caixa. É o que o convite de colaboração por CRM exige, e RLS não sabe dizer
-- "só quando a consulta filtra por CRM exato".
--
-- A promessa da tela é sobre PACIENTES ("Pacientes com conta veem…"), e essa
-- passa a ser cumprida. Fechar também a porta 5 exige mover a busca de colega
-- para um RPC `security definer` que receba CRM e UF e devolva uma linha só —
-- mudança maior, em `CaseCollaborators.tsx`, e que fica registrada aqui em vez
-- de ser feita às pressas junto com uma mudança de segurança.
--
-- ## A view `doctors_directory`
--
-- Criada na mesma migration de 2026-04-28, `security_invoker = true`, e não é
-- usada por nenhuma tela. Herda a política de quem consulta: estreitar a tabela
-- estreita a view junto, sem mexer nela.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- O helper, e por que ele precisa ser SECURITY DEFINER
-- ----------------------------------------------------------------------------
-- Política que consulta `doctors` aplicaria a política de `doctors` — recursão,
-- e o Postgres recusa com "infinite recursion detected in policy for relation".
-- O mesmo vale para `patients`, cujas políticas referenciam `doctors`. Por isso
-- a decisão inteira mora numa função SECURITY DEFINER, como `can_access_case` e
-- `is_owner_doctor` já fazem nesta base pelo mesmo motivo.
create or replace function public.pode_ver_medico(_doctor_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null and (
    -- 1. a própria linha
       exists (select 1 from public.doctors d
                where d.id = _doctor_id and d.user_id = _user_id)
    -- 2. o médico a quem este paciente está vinculado
    or exists (select 1 from public.patients p
                where p.user_id = _user_id
                  and p.linked_doctor_id = _doctor_id
                  and p.deleted_at is null)
    -- 3. o médico responsável por um caso que este usuário pode ver
    or exists (select 1 from public.clinical_cases c
                where c.doctor_id = _doctor_id
                  and public.can_access_case(c.id, _user_id))
    -- 4. colaborador de um caso que este usuário pode ver
    or exists (select 1 from public.case_collaborators cc
                where cc.doctor_id = _doctor_id
                  and cc.deleted_at is null
                  and public.can_access_case(cc.case_id, _user_id))
    -- 5. médico enxerga médico (convite de colega por CRM) — ver o bloco
    --    "O QUE ESTA MIGRATION NÃO FAZ" no cabeçalho
    or exists (select 1 from public.doctors d2 where d2.user_id = _user_id)
  )
$$;

revoke all on function public.pode_ver_medico(uuid, uuid) from public;
grant execute on function public.pode_ver_medico(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- A política
-- ----------------------------------------------------------------------------
drop policy if exists "Authenticated users view doctors" on public.doctors;

create policy "Ver medico com relacao ou sendo medico"
on public.doctors for select
to authenticated
using (public.pode_ver_medico(id, auth.uid()));
