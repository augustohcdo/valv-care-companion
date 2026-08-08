-- Apagar a conta de um médico destruía o prontuário dos pacientes dele.
--
-- A corrente, lida de `pg_constraint` antes desta migration:
--
--   auth.users --CASCADE--> doctors --CASCADE--> clinical_cases --CASCADE--> case_exams
--                                                                        |-> case_events
--                                                                        |-> case_documents
--                                                                        \-> appointments
--
-- Medido com conta descartável no projeto de produção: criar médico + caso +
-- exame e apagar a conta levou os casos de 2 para 1 e os exames de 1 para 0,
-- **sem uma única linha em audit_logs**. Hard delete, irreversível.
--
-- Isso contradiz o que o site publica: `DPO.tsx` diz "dados clínicos retidos por
-- 20 anos (Lei 13.787/2018) mesmo após eliminação", e os Termos invocam a mesma
-- lei e a Resolução CFM nº 1.821/2007. E contradiz toda a arquitetura de
-- soft-delete desta sessão, que protege o caminho da interface e deixava aberto
-- justamente o caminho do administrador — o único por onde uma exclusão real
-- acontece hoje (painel do Supabase ou Admin API), que é como um pedido de
-- eliminação seria atendido.
--
-- O princípio: a ação destrutiva precisa **falhar alto**, não destruir em
-- silêncio. Conta sem prontuário continua podendo ser apagada.

-- ---------------------------------------------------------------------------
-- 1. A cascata mortal vira recusa
-- ---------------------------------------------------------------------------

-- `doctor_id` é NOT NULL, então SET NULL não é opção — e não seria desejável:
-- o prontuário precisa registrar quem o produziu. Com RESTRICT, a cascata que
-- vem de `auth.users` esbarra aqui e **aborta a transação inteira**: apagar a
-- conta de quem tem prontuário passa a devolver erro de chave estrangeira.
alter table public.clinical_cases drop constraint if exists clinical_cases_doctor_id_fkey;
alter table public.clinical_cases
  add constraint clinical_cases_doctor_id_fkey
  foreign key (doctor_id) references public.doctors(id) on delete restrict;

-- Era SET NULL: o caso sobrevivia sem o paciente que ele documenta. Um
-- prontuário sem titular não é registro preservado, é registro corrompido — e a
-- retenção de 20 anos é justamente sobre o registro do paciente.
alter table public.clinical_cases drop constraint if exists clinical_cases_patient_id_fkey;
alter table public.clinical_cases
  add constraint clinical_cases_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 2. As quatro tabelas do paciente ganham a chave que nunca tiveram
-- ---------------------------------------------------------------------------
--
-- Sem chave estrangeira nenhuma, apagar a conta de um paciente apagava a linha
-- em `patients` e deixava diário, medicações e documentos apontando para um
-- paciente inexistente: nem eliminados (o que a LGPD pediria) nem legíveis por
-- ninguém (a RLS os torna invisíveis). O pior dos dois.
--
-- CASCADE é o certo aqui: são dados do próprio paciente, e a cascata só chega a
-- rodar quando ele não tem prontuário — se tiver, o RESTRICT acima já barrou.
--
-- A auditoria de órfãos roda **antes** de aplicar, e aborta se encontrar
-- alguma: mesma disciplina de 20260731000000_fk_constraints_and_soft_delete_
-- remaining.sql. Conferido no momento de escrever: zero órfãs nas quatro.
do $$
declare
  orfas integer;
begin
  select
    (select count(*) from public.medications m       where not exists (select 1 from public.patients p where p.id = m.patient_id))
  + (select count(*) from public.medication_logs l   where not exists (select 1 from public.patients p where p.id = l.patient_id))
  + (select count(*) from public.symptom_entries s   where not exists (select 1 from public.patients p where p.id = s.patient_id))
  + (select count(*) from public.patient_documents d where not exists (select 1 from public.patients p where p.id = d.patient_id))
  into orfas;

  if orfas > 0 then
    raise exception 'há % linha(s) órfã(s) apontando para paciente inexistente; resolver antes de aplicar a chave estrangeira', orfas;
  end if;
end $$;

alter table public.medications drop constraint if exists medications_patient_id_fkey;
alter table public.medications
  add constraint medications_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

alter table public.medication_logs drop constraint if exists medication_logs_patient_id_fkey;
alter table public.medication_logs
  add constraint medication_logs_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

alter table public.symptom_entries drop constraint if exists symptom_entries_patient_id_fkey;
alter table public.symptom_entries
  add constraint symptom_entries_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

alter table public.patient_documents drop constraint if exists patient_documents_patient_id_fkey;
alter table public.patient_documents
  add constraint patient_documents_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Notificação acompanha a conta
-- ---------------------------------------------------------------------------
--
-- Havia 7 linhas apontando para contas que não existem mais — resíduo real de
-- contas descartáveis apagadas nesta sessão. Ninguém consegue lê-las (a RLS é
-- `user_id = auth.uid()` e esse usuário não existe), então são lixo invisível
-- que ainda ia parar no backup. Notificação é operacional: some com a conta.
delete from public.notifications n
where not exists (select 1 from auth.users u where u.id = n.user_id);

alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. O que fica deliberadamente SEM chave estrangeira
-- ---------------------------------------------------------------------------
--
--   audit_logs.user_id              consent_audit_log.user_id
--   integration_audit_log.actor_user_id
--   user_consents.user_id           dpo_requests.user_id
--   case_comments.author_id         case_events.created_by
--   case_exams.created_by           appointments.created_by
--   case_collaborators.invited_by   hospital_api_keys.created_by
--   client_errors.user_id
--
-- São campos de trilha e de autoria: precisam sobreviver à conta que nomeiam.
-- Uma chave com CASCADE apagaria a prova de que algo aconteceu; com RESTRICT
-- tornaria a exclusão de conta impossível para sempre. Guardar o id de uma conta
-- que não existe mais é o comportamento **correto** para um registro do que
-- aconteceu — é o mesmo motivo pelo qual `audit_logs` guarda `user_id` solto
-- desde o início.
