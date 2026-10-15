-- O relatório do encerramento passa a MEDIR, e a declarar o que não alcança.
--
-- ---------------------------------------------------------------------------
-- O defeito
-- ---------------------------------------------------------------------------
--
-- `encerrar_conta` devolvia, no bloco `apagado`:
--
--     'perfil', 'nome, telefone e data de nascimento',
--     'paciente', case when _paciente_id is null then null else 'cidade e UF' end,
--     'medico',  case when _eh_medico then 'bio, instituição e cidade' else null end,
--     'outros',  'filtros salvos, notificações e autorizações de acesso a dados',
--     'papeis',  'papéis de acesso e vínculos hospitalares removidos',
--
-- Frases fixas. Nenhuma delas é medida: são afirmações sobre o que a função se
-- propõe a fazer, não sobre o que fez. Só `casos_pseudonimizados` vinha de um
-- `get diagnostics`.
--
-- Isso importa porque o relatório não fica no servidor: `AdminDPO` monta com
-- ele a RESPOSTA OFICIAL ao titular, e o comentário de lá diz por quê — "a
-- resposta ao titular nasce do relatório do próprio encerramento, em vez de ser
-- redigida de memória — é o que garante que ela descreva o que de fato foi
-- feito". Enquanto o relatório for prosa fixa, essa garantia não existe.
--
-- ---------------------------------------------------------------------------
-- O limite que estava escrito só no comentário
-- ---------------------------------------------------------------------------
--
-- A pseudonimização do prontuário roda `where c.patient_id = _paciente_id`, e o
-- comentário acima dela diz, com todas as letras:
--
--   > "Só os casos VINCULADOS a este paciente. Caso digitado à mão, sem vínculo
--   >  de conta, não pode ser atribuído ao titular com segurança — e fingir
--   >  cobertura total seria pior que declarar o limite."
--
-- A decisão é certa: trocar o nome por semelhança alteraria o prontuário de
-- outra pessoa. O que estava errado é ONDE o limite foi declarado. Ele vivia
-- num comentário de SQL, enquanto o diálogo de encerramento prometia, antes da
-- confirmação irreversível, que "o nome deixa de aparecer no prontuário,
-- substituído por um código" — sem ressalva.
--
-- Medido no repositório: NENHUM caminho do aplicativo nem das migrations
-- escreve `clinical_cases.patient_id`. `buildPayload` em `NovoCaso.tsx` não o
-- inclui; nenhuma migration faz `set patient_id`. Quer dizer que o vínculo é
-- sempre nulo e `casos_pseudonimizados` é sempre 0 — a promessa do diálogo
-- nunca se cumpria, e não por falha ocasional.
--
-- Esta migration não muda o CRITÉRIO (mudá-lo exigiria casar por nome, que é
-- justamente o que alteraria registro de terceiro). Ela faz o relatório contar
-- o que fez e DIZER o que não alcança, para que a promessa feita à pessoa
-- corresponda ao que acontece. O diálogo e a resposta oficial foram corrigidos
-- junto, no mesmo commit.
--
-- Idempotente: `create or replace`.

create or replace function public.encerrar_conta(_user_id uuid, _motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _ator uuid := auth.uid();
  _ehServico boolean := coalesce(auth.role(), '') = 'service_role';
  _codigo text;
  _paciente_id uuid;
  _casos integer := 0;
  _nome_perfil text;
  _eh_medico boolean;
  _admins integer;
  -- Os contadores. Um por passo, porque "quantas linhas mudaram" é a única
  -- coisa que o relatório pode afirmar sem supor.
  _perfil integer := 0;
  _paciente integer := 0;
  _medico integer := 0;
  _grants integer := 0;
  _filtros integer := 0;
  _notificacoes integer := 0;
  _papeis integer := 0;
  _hospitais integer := 0;
  _acessos integer := 0;
  _dpo integer := 0;
  _erros integer := 0;
begin
  -- Autorização. O `service_role` chega aqui pela edge function, que já validou
  -- o JWT e conferiu admin-ou-titular; mesmo padrão de `doctor_weekly_digest`.
  if not _ehServico then
    if _ator is null then
      raise exception 'não autenticado' using errcode = '42501';
    end if;
    if _ator <> _user_id and not public.has_role(_ator, 'admin'::public.app_role) then
      raise exception 'só o próprio titular ou um administrador pode encerrar a conta'
        using errcode = '42501';
    end if;
  end if;

  -- Recusa deliberada: o único administrador não pode sair.
  if public.has_role(_user_id, 'admin'::public.app_role) then
    select count(*) into _admins from public.user_roles where role = 'admin'::public.app_role;
    if _admins <= 1 then
      raise exception 'esta é a única conta de administrador; promova outra pessoa antes de encerrá-la'
        using errcode = '42501';
    end if;
  end if;

  _codigo := upper(substr(md5(_user_id::text), 1, 6));
  select id into _paciente_id from public.patients where user_id = _user_id;
  select exists (select 1 from public.doctors where user_id = _user_id) into _eh_medico;
  select full_name into _nome_perfil from public.profiles where user_id = _user_id;

  -- 2.1 Pseudonimização dentro do prontuário.
  --
  -- Só os casos VINCULADOS a este paciente. Caso digitado à mão, sem vínculo de
  -- conta, não pode ser atribuído ao titular com segurança — e fingir cobertura
  -- total seria pior que declarar o limite. O limite agora é DECLARADO no
  -- relatório, em `limites`, e não só aqui.
  if _paciente_id is not null then
    insert into public.pseudonym_map (user_id, origem, origem_id, valor_original, motivo)
    select _user_id, 'clinical_cases.patient_name', c.id, c.patient_name, _motivo
    from public.clinical_cases c
    where c.patient_id = _paciente_id and c.patient_name not like 'Titular removido%';

    update public.clinical_cases
       set patient_name = 'Titular removido · ' || _codigo
     where patient_id = _paciente_id and patient_name not like 'Titular removido%';
    get diagnostics _casos = row_count;
  end if;

  -- 2.2 A camada de conta.
  if _nome_perfil is not null then
    insert into public.pseudonym_map (user_id, origem, origem_id, valor_original, motivo)
    values (_user_id, 'profiles.full_name', _user_id, _nome_perfil, _motivo);
  end if;

  update public.profiles
     set full_name = 'Titular removido · ' || _codigo,
         phone = null,
         birth_date = null
   where user_id = _user_id;
  get diagnostics _perfil = row_count;

  update public.patients set city = null, uf = null where user_id = _user_id;
  get diagnostics _paciente = row_count;

  -- O CRM e a UF **ficam**: são a autoria do prontuário, exigida pelo CFM.
  update public.doctors set bio = null, institution = null, city = null
   where user_id = _user_id;
  get diagnostics _medico = row_count;

  -- 2.3 Acesso e ruído operacional.
  update public.data_access_grants set revoked_at = now()
   where patient_id = _user_id and revoked_at is null;
  get diagnostics _grants = row_count;

  delete from public.saved_filters where user_id = _user_id;
  get diagnostics _filtros = row_count;

  delete from public.notifications where user_id = _user_id;
  get diagnostics _notificacoes = row_count;

  -- 2.4 O que ficava para trás. Três destinos, não dois: há linha cujo REGISTRO
  -- precisa sobreviver e cuja IDENTIFICAÇÃO não.
  delete from public.user_roles where user_id = _user_id;
  get diagnostics _papeis = row_count;

  delete from public.hospital_members where user_id = _user_id;
  get diagnostics _hospitais = row_count;

  update public.access_requests
     set nome = 'Titular removido · ' || _codigo,
         email = null, telefone = null, crm = null, crm_uf = null,
         instituicao = null, cidade = null, uf = null, rqe = null, mensagem = null
   where user_id = _user_id;
  get diagnostics _acessos = row_count;

  update public.dpo_requests
     set requester_name = 'Titular removido · ' || _codigo,
         requester_email = null, requester_cpf = null
   where user_id = _user_id;
  get diagnostics _dpo = row_count;

  update public.client_errors set user_id = null where user_id = _user_id;
  get diagnostics _erros = row_count;

  -- A trilha carrega as contagens, não só o código: é por ela que uma auditoria
  -- posterior confere o que a resposta ao titular afirmou.
  insert into public.audit_logs (user_id, action, target_table, target_id, metadata)
  values (coalesce(_ator, _user_id), 'account_closed', 'auth.users', _user_id,
          jsonb_build_object('codigo', _codigo, 'casos_pseudonimizados', _casos,
                             'motivo', _motivo, 'por_servico', _ehServico,
                             'linhas', jsonb_build_object(
                               'perfil', _perfil, 'paciente', _paciente, 'medico', _medico,
                               'grants', _grants, 'filtros', _filtros,
                               'notificacoes', _notificacoes, 'papeis', _papeis,
                               'hospitais', _hospitais, 'acessos', _acessos,
                               'dpo', _dpo, 'erros', _erros)));

  return jsonb_build_object(
    'codigo', _codigo,
    -- `apagado` continua em prosa legível, porque é o que o titular lê — mas
    -- cada frase agora só sai quando a linha correspondente MUDOU.
    'apagado', jsonb_build_object(
      'perfil', case when _perfil > 0 then 'nome, telefone e data de nascimento do cadastro' end,
      'paciente', case when _paciente > 0 then 'cidade e UF do cadastro de paciente' end,
      'medico', case when _medico > 0 then 'bio, instituição e cidade do perfil profissional' end,
      'outros', case when _filtros + _notificacoes + _grants > 0
        then 'filtros salvos, notificações e autorizações de acesso a dados' end,
      'papeis', case when _papeis + _hospitais > 0
        then 'papéis de acesso e vínculos com instituições' end,
      'anonimizado', case when _acessos + _dpo + _erros > 0
        then 'pedidos de acesso, pedidos ao DPO e relatórios de erro perdem a identificação e mantêm o registro' end),
    -- E as contagens, ao lado da prosa. É o que permite conferir: quem auditar
    -- depois compara com a trilha e com o banco.
    'linhas', jsonb_build_object(
      'perfil', _perfil, 'paciente', _paciente, 'medico', _medico,
      'autorizacoes_revogadas', _grants, 'filtros_apagados', _filtros,
      'notificacoes_apagadas', _notificacoes, 'papeis_removidos', _papeis,
      'vinculos_hospitalares_removidos', _hospitais,
      'pedidos_de_acesso_anonimizados', _acessos,
      'pedidos_dpo_anonimizados', _dpo, 'relatorios_de_erro_desvinculados', _erros,
      'casos_pseudonimizados', _casos),
    'mantido', jsonb_build_object(
      'prontuario', 'registro clínico preservado por 20 anos — Lei 13.787/2018, Art. 6º, e LGPD Art. 16, I',
      'autoria', case when _eh_medico then 'CRM e UF preservados — Resolução CFM nº 1.821/2007' end,
      'trilha', 'registros de auditoria e de consentimento, como prova do que aconteceu',
      'reidentificacao', case when _casos > 0 or _nome_perfil is not null
        then 'a correspondência do pseudônimo fica em base restrita, acessível apenas pelo processo do DPO' end),
    -- O que esta função NÃO alcança, dito à pessoa em vez de ficar num
    -- comentário de SQL.
    'limites', jsonb_build_object(
      'prontuario_nao_vinculado',
        'A substituição do nome no prontuário alcança apenas os casos VINCULADOS a esta conta. '
        || 'Caso registrado com o nome digitado à mão não é alterado: não há como atribuí-lo ao '
        || 'titular com segurança, e trocar por semelhança de nome alteraria o prontuário de outra '
        || 'pessoa. Se `casos_pseudonimizados` for 0, o nome CONTINUA nesses registros — a remoção '
        || 'passa por pedido ao DPO, caso a caso.',
      'casos_pseudonimizados', _casos)
  );
end;
$$;

revoke all on function public.encerrar_conta(uuid, text) from public, anon;
grant execute on function public.encerrar_conta(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — e por que a primeira versão dela não provava nada
-- ---------------------------------------------------------------------------
--
-- Ela conferia três coisas: a função existe, é SECURITY DEFINER, e o `anon` não
-- a executa. Apliquei, veio `funcao_existe: 1, security_definer: true,
-- anon_executa: false`, e isso não diz se o CORPO NOVO entrou — um
-- `create or replace` que tivesse mantido a versão antiga daria exatamente os
-- mesmos três valores.
--
-- É o aviso que o próprio workflow imprime no fim de cada execução: "'Executou
-- sem erro' não é 'fez o que devia' — é esse resultado que prova". A minha
-- conferência era da primeira espécie.
--
-- Agora ela lê o `prosrc` e procura o que SÓ a versão nova tem, incluindo a
-- CONTAGEM de medições: onze `get diagnostics`, um por escrita. Um número é
-- mais difícil de satisfazer por acidente que um `LIKE`.
--
-- Esperado:
--   relata_limites ..... true    ← o bloco que declara o que a função não alcança
--   relata_contagens ... true    ← as onze contagens no relatório
--   mede_o_perfil ...... true    ← `get diagnostics` na primeira escrita
--   quantas_medicoes ... 11
--   security_definer ... true
--   anon_executa ....... false
select
  (f.prosrc like '%''limites'', jsonb_build_object%')                     as relata_limites,
  (f.prosrc like '%''linhas'', jsonb_build_object%')                      as relata_contagens,
  (f.prosrc like '%get diagnostics _perfil%')                             as mede_o_perfil,
  (length(f.prosrc) - length(replace(f.prosrc, 'get diagnostics', '')))
    / length('get diagnostics')                                          as quantas_medicoes,
  f.prosecdef                                                             as security_definer,
  has_function_privilege('anon', 'public.encerrar_conta(uuid, text)', 'EXECUTE') as anon_executa
from pg_proc f
join pg_namespace n on n.oid = f.pronamespace
where n.nspname = 'public' and f.proname = 'encerrar_conta';
