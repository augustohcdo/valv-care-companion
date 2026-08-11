-- Ampliar a base de conhecimento a partir de obras de referência.
--
-- Hoje a base tem 11 trechos, todos vindos do conhecimento geral do modelo, sem
-- nenhuma fonte documental por trás. A ingestão passa a aceitar lotes derivados
-- de obras reais, com citação até o capítulo.
--
-- Duas regras governam o desenho, e as duas viram estrutura aqui em vez de
-- ficarem dependendo de alguém lembrar delas.

-- ---------------------------------------------------------------------------
-- 1. A citação vira dado, não disciplina
-- ---------------------------------------------------------------------------
--
-- O que se guarda é síntese própria mais a referência ao original — nunca a
-- redação da obra. Um trecho sem citação rastreável falha nas duas pontas: o
-- médico não consegue conferir na fonte, e referenciar deixa de se distinguir de
-- reproduzir.
alter table public.knowledge_sources
  add column if not exists edition text,
  add column if not exists authors text,
  add column if not exists license_note text;

comment on column public.knowledge_sources.license_note is
  'Como esta fonte pode ser usada. Obra protegida: apenas síntese e citação, nunca reprodução do texto. Norma oficial (CFM, Anvisa, lei): reprodução permitida, Lei 9.610 Art. 8º.';

-- ---------------------------------------------------------------------------
-- 2. Nenhum atalho carimba "revisado por médico"
-- ---------------------------------------------------------------------------
--
-- `revisar_trecho` já é a porta legítima: exige administrador **com** registro em
-- `doctors` e `verified = true`, e grava nome, CRM e UF lidos do banco — nunca de
-- um campo digitado.
--
-- O que faltava era fechar o atalho. Um `insert` de ingestão, ou um `update`
-- direto, podia nascer com `review_status = 'reviewed'` e o selo verde apareceria
-- sem médico nenhum atrás. Enquanto isso era regra de conduta, dependia de quem
-- escreve o código lembrar dela — inclusive eu, inclusive com pressa.
--
-- Agora o banco recusa. A promoção continua possível pelo caminho que registra
-- quem assinou.
create or replace function public.impedir_revisao_sem_medico()
returns trigger
language plpgsql
as $$
begin
  if new.review_status = 'reviewed'
     and coalesce(current_setting('valvepath.revisao_autorizada', true), '') <> 'on' then
    raise exception
      'trecho só vira "reviewed" pelo RPC revisar_trecho, que exige médico com CRM verificado'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_impedir_revisao_sem_medico on public.knowledge_chunks;
create trigger trg_impedir_revisao_sem_medico
  before insert or update on public.knowledge_chunks
  for each row execute function public.impedir_revisao_sem_medico();

-- `revisar_trecho` recriada com o corpo **idêntico** ao de
-- 20260805030000_clinical_content_review.sql, acrescida de uma única linha: a
-- marca de sessão que o gatilho exige, válida só dentro desta transação.
--
-- Reescrever a função de memória teria mudado tipo de retorno, formato do
-- `content_key` e nomes das ações de auditoria — e quebrado a tela que a
-- consome. O corpo abaixo foi copiado do arquivo original.
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

  -- A ÚNICA linha nova. Autoriza o gatilho, e só nesta transação: qualquer
  -- outro caminho que tente gravar 'reviewed' continua sendo recusado.
  perform set_config('valvepath.revisao_autorizada', 'on', true);

  update public.knowledge_chunks
     set review_status = case when _aprovar then 'reviewed' else 'ai_generated' end,
         updated_at = now()
   where id = _chunk_id;

  if not found then
    raise exception 'trecho nao encontrado' using errcode = '22023';
  end if;

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
