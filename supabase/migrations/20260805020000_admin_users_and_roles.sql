-- O administrador não conseguia administrar.
--
-- Levantei as policies de admin do banco: 22 policies em 17 tabelas, e nenhuma
-- delas em `user_roles`, `profiles`, `audit_logs` ou `doctors`. Na prática,
-- conceder o papel de administrador a alguém exigia SQL direto no painel do
-- Supabase, listar contas era impossível, e a trilha de auditoria só mostrava
-- as próprias linhas de quem consultava.
--
-- E havia um buraco pior no meio disso. `MedicoHome` diz ao médico "seu CRM
-- está em verificação manual", mas a única policy de UPDATE em `doctors` é
-- "Doctor updates own record", e o papel `authenticated` tinha UPDATE nas 12
-- colunas — inclusive `verified`. O sistema prometia uma verificação que
-- ninguém podia fazer e, ao mesmo tempo, deixava qualquer médico marcar a si
-- mesmo como verificado.

-- ============================================================================
-- 1. Leitura: o administrador enxerga as contas e a trilha de auditoria
-- ============================================================================

drop policy if exists "Admin reads profiles" on public.profiles;
create policy "Admin reads profiles"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admin reads audit_logs" on public.audit_logs;
create policy "Admin reads audit_logs"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- `user_roles` ganha só LEITURA por policy. A escrita passa pelo RPC abaixo,
-- que aplica travas que uma policy não teria como aplicar.
drop policy if exists "Admin reads user_roles" on public.user_roles;
create policy "Admin reads user_roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================================
-- 2. O médico para de poder se autoverificar
-- ============================================================================
--
-- Privilégio de coluna não subtrai de um privilégio de tabela: com UPDATE
-- concedido na tabela inteira, revogar uma coluna não faz nada. Então revoga-se
-- a tabela e concede-se, de volta, exatamente as colunas do formulário de
-- perfil (`MedicoPerfil.tsx:63`). `verified` fica fora, e `updated_at` continua
-- funcionando porque quem o preenche é o gatilho `doctors_updated_at`, que
-- atribui em `NEW` e não precisa de privilégio.

revoke update on public.doctors from authenticated;
revoke update on public.doctors from anon;
grant update (crm, crm_uf, specialty, rqe, institution, city, bio)
  on public.doctors to authenticated;

-- ============================================================================
-- 3. Listar contas
-- ============================================================================

create or replace function public.admin_listar_usuarios()
returns table (
  user_id uuid,
  email text,
  full_name text,
  account_type text,
  papeis text[],
  criado_em timestamptz,
  ultimo_acesso timestamptz,
  email_confirmado boolean,
  doctor_id uuid,
  crm text,
  crm_uf text,
  verificado boolean,
  eh_paciente boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.user_id,
    u.email::text,
    p.full_name,
    p.account_type,
    coalesce(
      (select array_agg(r.role::text order by r.role::text)
         from public.user_roles r where r.user_id = p.user_id),
      '{}'::text[]
    ),
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null,
    d.id,
    d.crm,
    d.crm_uf,
    coalesce(d.verified, false),
    exists (select 1 from public.patients pa
             where pa.user_id = p.user_id and pa.deleted_at is null)
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.doctors d on d.user_id = p.user_id
  where public.has_role(auth.uid(), 'admin'::public.app_role)
  order by u.created_at desc;
$$;

revoke all on function public.admin_listar_usuarios() from anon;
grant execute on function public.admin_listar_usuarios() to authenticated;

-- ============================================================================
-- 4. Conceder e revogar papel
-- ============================================================================
--
-- Uma recusa: ninguém remove o próprio papel de administrador. Trancar-se para
-- fora só se desfaz com SQL direto no painel do Supabase.
--
-- Eu tinha escrito uma segunda trava, para "o último administrador não pode ser
-- removido", e ela caiu ao ser testada: é inalcançável no caso perigoso e
-- errada no inofensivo. Como só um administrador pode chamar esta função, se
-- existe apenas um administrador então ele **é** quem está chamando — e aí a
-- recusa acima já barra. Sobrava o caso em que o alvo nem é administrador, no
-- qual a trava recusaria uma operação que não tira ninguém de lugar nenhum.
-- Guarda inalcançável que só sabe dar falso positivo é pior que guarda nenhuma.

create or replace function public.admin_definir_papel(
  _user_id uuid,
  _role public.app_role,
  _conceder boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'apenas administradores podem alterar papeis'
      using errcode = '42501';
  end if;

  if _role = 'admin'::public.app_role and not _conceder
     and _user_id = auth.uid() then
    raise exception 'voce nao pode remover o proprio papel de administrador'
      using errcode = '22023';
  end if;

  if _conceder then
    insert into public.user_roles (user_id, role)
    values (_user_id, _role)
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = _role;
  end if;

  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    case when _conceder then 'role_granted' else 'role_revoked' end,
    'user_roles',
    _user_id,
    jsonb_build_object('role', _role::text)
  );
end;
$$;

revoke all on function public.admin_definir_papel(uuid, public.app_role, boolean) from anon;
grant execute on function public.admin_definir_papel(uuid, public.app_role, boolean) to authenticated;

-- ============================================================================
-- 5. Verificar o CRM de um médico
-- ============================================================================
--
-- O caminho que a interface prometia e não existia. Como o UPDATE da coluna
-- `verified` foi revogado acima, este RPC é o único jeito de mexer nela.

create or replace function public.admin_verificar_medico(
  _doctor_id uuid,
  _verificado boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'apenas administradores podem verificar medicos'
      using errcode = '42501';
  end if;

  update public.doctors set verified = _verificado where id = _doctor_id;

  if not found then
    raise exception 'medico nao encontrado' using errcode = '22023';
  end if;

  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    case when _verificado then 'doctor_verified' else 'doctor_unverified' end,
    'doctors',
    _doctor_id,
    jsonb_build_object('verificado', _verificado)
  );
end;
$$;

revoke all on function public.admin_verificar_medico(uuid, boolean) from anon;
grant execute on function public.admin_verificar_medico(uuid, boolean) to authenticated;
