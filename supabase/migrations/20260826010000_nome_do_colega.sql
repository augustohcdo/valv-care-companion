-- O nome do colega na discussão do caso.
--
-- `CaseDiscussion.tsx` e `CaseCollaborators.tsx` consultavam `public.profiles`
-- direto. As policies de `profiles` são só `auth.uid() = user_id` e
-- `has_role(admin)`, então a consulta voltava vazia para qualquer colega e a
-- tela caía no texto de reserva: **"Dr(a). Médico"** em toda mensagem, e
-- "Dr(a). —" em todo colaborador. Medido na base atual: 32 comentários de 4
-- autores distintos, e 18 colaborações — todos assim.
--
-- Não é cosmético. É prontuário: uma discussão clínica em que toda opinião é
-- assinada por "Médico" é um registro que não dá para auditar. Não se sabe quem
-- recomendou o quê.
--
-- ---------------------------------------------------------------------------
-- A cerca, e por que NÃO é `can_access_case`
-- ---------------------------------------------------------------------------
--
-- `can_access_case` é o helper óbvio e está errado para este uso: ele inclui o
-- paciente (`c.patient_id in (select id from patients where user_id = ...)`),
-- enquanto a policy de SELECT de `case_comments` é **só de médico** — dono do
-- caso ou colaborador com convite aceito.
--
-- Ou seja: o paciente não lê a discussão. Reusar o helper conveniente faria com
-- que ele passasse a saber o nome e o CRM de todo médico que opinou num debate
-- ao qual não tem acesso — inclusive de um colega consultado para segunda
-- opinião. Seria criar um vazamento ao corrigir um defeito de nome.
--
-- Então a condição abaixo **espelha a policy da própria discussão**, escrita do
-- mesmo jeito, para as duas não divergirem com o tempo.
--
-- A base de consentimento é assinar o que se escreve: quem aceitou colaborar ou
-- comentou consentiu em ser identificado *naquele caso*, entre os profissionais
-- *daquele caso*. Isso não é publicidade médica (Resolução CFM nº 2.336/2023) e
-- por isso não depende de `doctors.no_diretorio` — quem saiu do diretório
-- continua assinando o que escreve no caso em que trabalha.
create or replace function public.participantes_do_caso(_case_id uuid)
returns table (
  user_id uuid,
  full_name text,
  crm text,
  crm_uf text,
  specialty text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.full_name, d.crm, d.crm_uf, d.specialty
  from public.profiles p
  left join public.doctors d on d.user_id = p.user_id
  where
    -- A cerca vem primeiro: sem sessão de médico do caso, zero linha, e o
    -- resto da condição não chega a importar.
    (
      public.is_case_owner(_case_id, auth.uid())
      or exists (
        select 1
        from public.case_collaborators cc
        join public.doctors dd on dd.id = cc.doctor_id
        where cc.case_id = _case_id
          and cc.status = 'aceito'
          and cc.deleted_at is null
          and dd.user_id = auth.uid()
      )
    )
    -- E devolve apenas quem participa DESTE caso: autor de comentário,
    -- colaborador (em qualquer status, para o convite pendente ter nome) ou o
    -- médico dono.
    and (
      p.user_id in (
        select author_id from public.case_comments
        where case_id = _case_id and deleted_at is null
      )
      or p.user_id in (
        select dd.user_id from public.case_collaborators cc
        join public.doctors dd on dd.id = cc.doctor_id
        where cc.case_id = _case_id and cc.deleted_at is null
      )
      or p.user_id in (
        select dd.user_id from public.clinical_cases c
        join public.doctors dd on dd.id = c.doctor_id
        where c.id = _case_id
      )
    );
$$;

revoke all on function public.participantes_do_caso(uuid) from public, anon;
grant execute on function public.participantes_do_caso(uuid) to authenticated;

comment on function public.participantes_do_caso(uuid) is
  'Nomes dos profissionais de um caso, para quem é médico daquele caso. Espelha '
  'a policy de SELECT de case_comments de propósito: can_access_case seria mais '
  'largo e incluiria o paciente, que não lê a discussão.';

-- ---------------------------------------------------------------------------
-- O outro lado do mesmo defeito: o paciente e o próprio médico
-- ---------------------------------------------------------------------------
--
-- `PacienteHome.tsx`, `PacienteJornada.tsx` e `PacienteMedico.tsx` também liam
-- `profiles` direto, pela mesma razão e com o mesmo resultado: o paciente via
-- **"Dr(a). Médico(a)"** no cartão do próprio médico assistente. Aqui não há
-- dúvida nenhuma de base legal — ele escolheu esse médico, o médico aceitou o
-- vínculo, e saber o nome de quem cuida de você é o mínimo.
--
-- A cerca é o vínculo, e só ele: médico ligado ao paciente que chama, ou médico
-- dono de um caso cujo paciente é quem chama. Nada além disso — em especial,
-- **não** devolve os colegas que discutem o caso, que é a discussão fechada
-- tratada acima.
create or replace function public.meus_medicos()
returns table (
  doctor_id uuid,
  user_id uuid,
  full_name text,
  crm text,
  crm_uf text,
  specialty text,
  institution text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct d.id, d.user_id, p.full_name, d.crm, d.crm_uf, d.specialty, d.institution
  from public.doctors d
  join public.profiles p on p.user_id = d.user_id
  where
    d.id in (
      select pt.linked_doctor_id from public.patients pt
      where pt.user_id = auth.uid() and pt.linked_doctor_id is not null
    )
    or d.id in (
      select c.doctor_id from public.clinical_cases c
      join public.patients pt on pt.id = c.patient_id
      where pt.user_id = auth.uid()
    );
$$;

revoke all on function public.meus_medicos() from public, anon;
grant execute on function public.meus_medicos() to authenticated;

comment on function public.meus_medicos() is
  'Os médicos a que o paciente que chama está ligado — vínculo aceito ou dono de '
  'caso dele. Não devolve colegas da discussão do caso: essa é fechada ao paciente.';

-- ---------------------------------------------------------------------------
-- E o espelho: o médico e os próprios pacientes
-- ---------------------------------------------------------------------------
--
-- `MedicoPacientes.tsx` fazia `full_name: prof?.full_name || "Paciente"`. Com a
-- policy de `profiles`, isso significa que a lista de pacientes de um médico
-- mostraria **todos chamados "Paciente"** — ele não distinguiria um do outro.
-- Hoje não aparece porque a base ainda não tem paciente nenhum (medido: 0), o
-- que torna o defeito latente e não menos real: apareceria com o primeiro.
--
-- A cerca é o cuidado: paciente vinculado a este médico, ou paciente de um caso
-- que este médico atende. Espelha `meus_medicos` do outro lado.
create or replace function public.meus_pacientes()
returns table (
  patient_id uuid,
  user_id uuid,
  full_name text,
  phone text,
  -- Data de nascimento entra porque é dado clínico de quem o médico atende —
  -- idade muda conduta em doença valvar. O prontuário já a exibia; o que
  -- mudou foi a via de leitura.
  birth_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct pt.id, pt.user_id, p.full_name, p.phone, p.birth_date
  from public.patients pt
  join public.profiles p on p.user_id = pt.user_id
  where pt.deleted_at is null
    and (
      pt.linked_doctor_id in (select d.id from public.doctors d where d.user_id = auth.uid())
      or pt.id in (
        select c.patient_id from public.clinical_cases c
        join public.doctors d on d.id = c.doctor_id
        where d.user_id = auth.uid() and c.patient_id is not null
      )
    );
$$;

revoke all on function public.meus_pacientes() from public, anon;
grant execute on function public.meus_pacientes() to authenticated;

comment on function public.meus_pacientes() is
  'Os pacientes sob cuidado do médico que chama — vínculo aceito ou caso dele.';
