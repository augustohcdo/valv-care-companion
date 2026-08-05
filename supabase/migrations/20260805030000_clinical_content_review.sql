-- Dar ao médico o meio de revisar o conteúdo clínico — de verdade.
--
-- Os 11 trechos da base RAG são todos `ai_generated`, e nenhum caminho existia
-- para uma revisão médica acontecer. `content_review_status` já tinha as
-- colunas certas (`reviewer_name`, `reviewer_crm`, `reviewer_crm_uf`,
-- `reviewed_at`, `notes`) e estava vazia; `ContentReviewBadge` já sabia
-- desenhar o selo com o nome de quem revisou. As duas peças foram construídas
-- e nunca alimentadas.
--
-- **A identidade do revisor vem do banco, nunca de um campo digitado.** Um
-- formulário com "nome do revisor" e "CRM" deixaria qualquer um escrever
-- qualquer nome — seria fabricar autoridade clínica, só que com mais passos.
-- Por isso quem aprova precisa ser administrador **e** ter registro em
-- `doctors` com `verified = true`, e o nome/CRM/UF gravados são lidos dali.
--
-- É o que dá sentido à verificação de CRM: ela deixa de ser selo decorativo e
-- passa a ser o que autoriza uma afirmação clínica.

create or replace function public.revisar_trecho(
  _chunk_id uuid,
  _aprovar boolean,
  _notas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_crm text;
  v_uf text;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'apenas administradores acessam a revisao de conteudo'
      using errcode = '42501';
  end if;

  select p.full_name, d.crm, d.crm_uf
    into v_nome, v_crm, v_uf
    from public.doctors d
    join public.profiles p on p.user_id = d.user_id
   where d.user_id = auth.uid() and d.verified = true;

  if not found then
    raise exception
      'aprovar conteudo clinico exige registro de medico com CRM verificado'
      using errcode = '42501';
  end if;

  update public.knowledge_chunks
     set review_status = case when _aprovar then 'reviewed' else 'ai_generated' end,
         updated_at = now()
   where id = _chunk_id;

  if not found then
    raise exception 'trecho nao encontrado' using errcode = '22023';
  end if;

  -- `content_key` é UNIQUE, e `clinical_guideline` já é um dos valores aceitos
  -- pelo CHECK de `content_type` — nada a alterar no esquema existente.
  insert into public.content_review_status (
    content_key, content_type, status,
    reviewer_name, reviewer_crm, reviewer_crm_uf, reviewed_at, notes
  )
  values (
    _chunk_id::text,
    'clinical_guideline',
    case when _aprovar then 'reviewed' else 'ai_generated_pending' end,
    case when _aprovar then v_nome end,
    case when _aprovar then v_crm end,
    case when _aprovar then v_uf end,
    case when _aprovar then now() end,
    nullif(btrim(coalesce(_notas, '')), '')
  )
  on conflict (content_key) do update set
    status = excluded.status,
    reviewer_name = excluded.reviewer_name,
    reviewer_crm = excluded.reviewer_crm,
    reviewer_crm_uf = excluded.reviewer_crm_uf,
    reviewed_at = excluded.reviewed_at,
    notes = excluded.notes,
    updated_at = now();

  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (
    auth.uid(),
    case when _aprovar then 'content_reviewed' else 'content_review_revoked' end,
    'knowledge_chunks',
    _chunk_id,
    jsonb_build_object('crm', v_crm, 'crm_uf', v_uf)
  );
end;
$$;

revoke all on function public.revisar_trecho(uuid, boolean, text) from anon;
grant execute on function public.revisar_trecho(uuid, boolean, text) to authenticated;

-- Quem está logado pode aprovar conteúdo clínico? A tela precisa saber **antes**
-- de oferecer o botão, para explicar o motivo em vez de deixar o usuário
-- esbarrar num erro.
create or replace function public.posso_revisar_conteudo()
returns table (pode boolean, motivo text, revisor text, crm text)
language sql
security definer
set search_path = public
as $$
  select
    d.id is not null,
    case
      when not public.has_role(auth.uid(), 'admin'::public.app_role)
        then 'apenas administradores acessam esta tela'
      when d.id is null
        then 'aprovar conteudo clinico exige registro de medico com CRM verificado'
    end,
    p.full_name,
    case when d.id is not null then d.crm || '/' || d.crm_uf end
  from public.profiles p
  left join public.doctors d
    on d.user_id = p.user_id and d.verified = true
  where p.user_id = auth.uid();
$$;

revoke all on function public.posso_revisar_conteudo() from anon;
grant execute on function public.posso_revisar_conteudo() to authenticated;
