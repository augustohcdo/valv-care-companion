-- ============================================================================
-- Etapa 2 de 2: a porta 5 fecha — médico deixa de enxergar todo médico
-- ============================================================================
--
-- ## NÃO APLIQUE ESTE ARQUIVO ANTES DE O FRONTEND ESTAR NO AR
--
-- Ele depende de `CaseCollaborators.tsx` já chamar `medico_por_crm`. Com o
-- frontend antigo publicado, fechar a porta 5 faz a busca de colega devolver
-- zero linhas e a tela dizer **"Médico não encontrado — verifique o CRM e a
-- UF"** sobre um colega que existe: uma frase falsa que joga a culpa na
-- digitação de quem convida. A pessoa confere o CRM três vezes e liga para o
-- colega; o problema nunca esteve ali.
--
-- A ordem é: aplicar `20261005120000` (o RPC) → publicar o frontend → aplicar
-- este. A etapa 1 e o frontend são seguros em qualquer ordem entre si; este
-- arquivo é o único com pré-requisito.
--
-- ## O que sai
--
-- A quinta porta de `pode_ver_medico`:
--
--     or exists (select 1 from public.doctors d2 where d2.user_id = _user_id)
--
-- Ela dizia "quem é médico vê qualquer médico". Era o que a busca por CRM
-- exigia, e a RLS não sabe dizer "só quando a consulta filtra por CRM exato" —
-- agora não precisa saber: quem filtra por CRM é o RPC.
--
-- ## O que a tela promete, e o que passa a valer
--
-- A caixa "Aparecer no diretório", no `MedicoPerfil`, diz que desmarcar tira o
-- médico da lista, e o código a enquadra como consentimento revogável: LGPD
-- art. 8º §5º ("consentimento que não pode ser retirado não é consentimento") e
-- a anuência de publicidade médica da Resolução CFM nº 2.336/2023.
--
-- A etapa de setembro fez a promessa valer para PACIENTES. Com esta, ela passa
-- a valer para colegas também: um médico que desmarcou a caixa deixa de ser
-- legível por qualquer outro médico — segue legível por quem tem relação com
-- ele (portas 1 a 4) e localizável por CRM exato para convite (o RPC).
--
-- ## As quatro portas que ficam, e quem depende de cada uma
--
--   1. a própria linha ............ useDoctor, MedicoPerfil, homeDoUsuario
--   2. o médico do paciente ....... PacienteHome, PacienteMedico
--   3. o dono de um caso que vejo .. CasoDetalhe, MedicoColaboracoes
--   4. colaborador de um caso ...... CaseCollaborators (a releitura após o
--                                    convite entra por aqui: quem convidou é
--                                    dono do caso, então `can_access_case` é
--                                    verdadeiro e a linha do convidado aparece)
-- ============================================================================

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
    -- A porta 5 — "quem é médico vê qualquer médico" — saiu aqui. O convite de
    -- colega por CRM passou para `medico_por_crm`, que filtra por CRM exato e
    -- devolve `id` e `user_id`, nada mais.
  )
$$;

-- ===========================================================================
-- CONFERÊNCIA — o resultado abaixo é o que prova que deu certo
-- ===========================================================================
--
-- Esperado:
--   porta_5_saiu ............... true
--   as_quatro_portas_ficaram ... true
--   segue_security_definer ..... true
--   rpc_do_convite_existe ...... true   ← sem ele, a porta 5 não podia sair

SELECT
  NOT (f.prosrc LIKE '%d2.user_id = _user_id%')                  AS porta_5_saiu,
  (f.prosrc LIKE '%d.id = _doctor_id and d.user_id = _user_id%'
   AND f.prosrc LIKE '%p.linked_doctor_id = _doctor_id%'
   AND f.prosrc LIKE '%c.doctor_id = _doctor_id%'
   AND f.prosrc LIKE '%cc.doctor_id = _doctor_id%')              AS as_quatro_portas_ficaram,
  f.prosecdef                                                    AS segue_security_definer,
  EXISTS (SELECT 1 FROM pg_proc p2 JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
           WHERE n2.nspname = 'public' AND p2.proname = 'medico_por_crm')
                                                                 AS rpc_do_convite_existe
FROM pg_proc f
JOIN pg_namespace n ON n.oid = f.pronamespace
WHERE n.nspname = 'public' AND f.proname = 'pode_ver_medico';
