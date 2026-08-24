-- O paciente encontra o médico — e o médico decide se aceita.
--
-- Duas mudanças que dependem uma da outra.
--
-- A primeira: hoje **nenhum nome de outra pessoa aparece no app**. As policies
-- de `profiles` são só `auth.uid() = user_id` e `has_role(admin)`, então
-- qualquer leitura de nome alheio volta zero linhas, sem erro, e a tela cai no
-- texto de reserva ("Médico(a)"). Uma vitrine construída sobre isso mostraria
-- cartões sem nome. O RPC abaixo resolve **só o necessário para o diretório**,
-- em vez de abrir `profiles` inteiro.
--
-- A segunda: o vínculo paciente→médico é unilateral. A policy de UPDATE de
-- `patients` é `auth.uid() = user_id` sobre a linha inteira, então o paciente
-- escreve `linked_doctor_id` sozinho. Com uma vitrine aberta, qualquer pessoa
-- se pendura em qualquer médico. Passa a ser pedido que o médico aceita, e a
-- permissão de coluna é revogada — a policy continua, o que sai é o direito de
-- escrever aquelas duas colunas.

-- ---------------------------------------------------------------------------
-- 1. As duas chaves do médico
--
-- `no_diretorio` começa ligado: a anuência é colhida no formulário de
-- solicitação de acesso (`access_requests.consent_diretorio`), como manda a
-- Resolução CFM nº 2.336/2023. E é revogável — sem isso o consentimento seria
-- irrevogável, o que o invalidaria (LGPD art. 8º §5º).
alter table public.doctors
  add column if not exists no_diretorio boolean not null default true;
alter table public.doctors
  add column if not exists aceita_novos_pacientes boolean not null default true;

comment on column public.doctors.no_diretorio is
  'Aparece no diretório que os pacientes consultam. Anuência dada na solicitação de acesso, revogável pelo próprio médico no perfil.';

-- ---------------------------------------------------------------------------
-- 2. O diretório
--
-- `security definer` para poder ler `profiles.full_name`, e com a cerca dentro
-- da própria função: só médico verificado, no diretório e que não seja de
-- demonstração. Sem ranking — a ordenação é estável e neutra, e a Resolução
-- CFM nº 2.336/2023 veda "melhor médico", "destaque da especialidade" e afins.
create or replace function public.diretorio_medicos(
  _especialidade text default null,
  _uf text default null,
  _busca text default null
)
returns table (
  doctor_id uuid, nome text, crm text, crm_uf text, especialidade text,
  rqe text, cidade text, instituicao text, bio text, aceita_novos_pacientes boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.id, p.full_name, d.crm, d.crm_uf, d.specialty,
         d.rqe, d.city, d.institution, d.bio, d.aceita_novos_pacientes
    from public.doctors d
    join public.profiles p on p.user_id = d.user_id
   where d.verified
     and d.no_diretorio
     and not d.is_demo
     and (_especialidade is null or d.specialty = _especialidade)
     and (_uf is null or d.crm_uf = _uf)
     and (
       _busca is null or _busca = ''
       or p.full_name ilike '%' || _busca || '%'
       or coalesce(d.institution, '') ilike '%' || _busca || '%'
       or coalesce(d.city, '') ilike '%' || _busca || '%'
     )
   -- Ordem estável e sem mérito: pelo id, que não diz nada sobre o
   -- profissional. Alfabética premiaria quem tem nome no começo do alfabeto.
   order by d.id;
$$;

revoke all on function public.diretorio_medicos(text, text, text) from public, anon;
grant execute on function public.diretorio_medicos(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. O pedido de vínculo
create table if not exists public.patient_link_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  mensagem text,
  status text not null default 'pendente',
  decidido_em timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.patient_link_requests
    add constraint patient_link_requests_status_check
    check (status in ('pendente', 'aceito', 'recusado', 'cancelado'));
exception when duplicate_object then null; end $$;

-- Um pedido pendente por par: reenviar não deve empilhar fila para o médico.
create unique index if not exists idx_link_request_pendente
  on public.patient_link_requests (patient_id, doctor_id) where status = 'pendente';

alter table public.patient_link_requests enable row level security;

create policy "Patient manages own link requests" on public.patient_link_requests
  for select to authenticated
  using (patient_id in (select id from public.patients where user_id = auth.uid()));

create policy "Patient creates own link request" on public.patient_link_requests
  for insert to authenticated
  with check (patient_id in (select id from public.patients where user_id = auth.uid()));

create policy "Doctor views requests addressed to them" on public.patient_link_requests
  for select to authenticated
  using (doctor_id in (select id from public.doctors where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Quem escreve o vínculo é a função, não o cliente
create or replace function public.responder_vinculo(_request_id uuid, _aceitar boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pedido public.patient_link_requests%rowtype;
  v_doctor uuid;
begin
  select * into v_pedido from public.patient_link_requests where id = _request_id;
  if not found then raise exception 'pedido não encontrado' using errcode = '42704'; end if;

  -- Só o médico destinatário decide. Deixar o paciente aceitar o próprio
  -- pedido devolveria o vínculo unilateral por outro caminho.
  select id into v_doctor from public.doctors where user_id = auth.uid();
  if v_doctor is null or v_doctor <> v_pedido.doctor_id then
    raise exception 'apenas o médico destinatário pode responder' using errcode = '42501';
  end if;
  if v_pedido.status <> 'pendente' then
    raise exception 'pedido já respondido' using errcode = '22023';
  end if;

  update public.patient_link_requests
     set status = case when _aceitar then 'aceito' else 'recusado' end,
         decidido_em = now()
   where id = _request_id;

  if _aceitar then
    update public.patients
       set linked_doctor_id = v_pedido.doctor_id, linked_at = now(), updated_at = now()
     where id = v_pedido.patient_id;
  end if;

  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (auth.uid(),
          case when _aceitar then 'patient_link_accepted' else 'patient_link_rejected' end,
          'patient_link_requests', _request_id,
          jsonb_build_object('patient_id', v_pedido.patient_id, 'doctor_id', v_pedido.doctor_id));

  return jsonb_build_object('ok', true, 'status', case when _aceitar then 'aceito' else 'recusado' end);
end;
$$;

revoke all on function public.responder_vinculo(uuid, boolean) from public, anon;
grant execute on function public.responder_vinculo(uuid, boolean) to authenticated;

-- Desvincular continua sendo direito do paciente — e continua sendo escrita
-- naquelas colunas, então também passa pela função.
create or replace function public.desvincular_medico()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_patient uuid; v_doctor uuid;
begin
  select id, linked_doctor_id into v_patient, v_doctor
    from public.patients where user_id = auth.uid() and deleted_at is null;
  if v_patient is null then raise exception 'paciente não encontrado' using errcode = '42704'; end if;

  update public.patients set linked_doctor_id = null, linked_at = null, updated_at = now()
   where id = v_patient;
  -- O pedido aceito volta a 'cancelado' para o paciente poder pedir de novo:
  -- o índice único só permite um pendente por par.
  update public.patient_link_requests set status = 'cancelado', decidido_em = now()
   where patient_id = v_patient and doctor_id = v_doctor and status = 'aceito';

  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (auth.uid(), 'doctor_patient_unlinked', 'patients', v_patient,
          jsonb_build_object('doctor_id', v_doctor));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.desvincular_medico() from public, anon;
grant execute on function public.desvincular_medico() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fecha a escrita unilateral
--
-- A policy de UPDATE continua (o paciente edita o próprio perfil). O que sai é
-- o direito de escrever `linked_doctor_id`/`linked_at` — mesmo movimento já
-- feito com `doctors.verified`, que o médico podia ligar em si mesmo.
--
-- **Revogar coluna de um GRANT de tabela é no-op no Postgres** — medido: depois
-- de `revoke update (linked_doctor_id, linked_at)`, a coluna continuava
-- concedida, porque o privilégio vinha do nível da tabela. O caminho é revogar
-- a tabela inteira e devolver só as colunas do perfil.
revoke update on public.patients from authenticated, anon;
grant update (sex, city, uf, comorbidities, updated_at) on public.patients to authenticated;
