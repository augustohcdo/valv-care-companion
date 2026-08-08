-- A Política de Privacidade promete expurgo de logs em 6 meses. Ninguém o executa.
--
-- `Privacidade.tsx` diz "Logs de acesso à aplicação: 6 meses (Art. 15, Marco
-- Civil)" e conclui "Após esses prazos, os dados são eliminados ou anonimizados
-- de forma segura". Não existe rotina nenhuma que faça isso — nem função, nem
-- agendamento. Ainda não há descumprimento: o registro mais antigo é de 28/07,
-- com dias de idade. O que falta é o mecanismo, não o prazo.
--
-- A lista mora no banco, não no código, pelo mesmo motivo de `watched_jobs`: a
-- lista de tabelas do backup ficou quinze tabelas atrasada justamente por morar
-- longe do que descrevia.

create table if not exists public.retention_policies (
  tabela text primary key,
  coluna_data text not null,
  dias integer not null check (dias > 0),
  enabled boolean not null default true,
  motivo text,
  created_at timestamptz not null default now()
);

alter table public.retention_policies enable row level security;

drop policy if exists "Admin reads retention_policies" on public.retention_policies;
create policy "Admin reads retention_policies"
on public.retention_policies for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Sem policy de escrita: a lista muda por migration. Mesmo desenho de
-- `watched_jobs`, `job_runs` e `client_errors`.

-- 180 dias ≈ 6 meses, que é o prazo publicado. São os três registros
-- operacionais: erro de cliente, execução de tarefa agendada e contador de
-- visita (que não guarda nada sobre quem visitou).
insert into public.retention_policies (tabela, coluna_data, dias, motivo) values
  ('client_errors', 'created_at',  180, 'Log de erro da aplicação — 6 meses, Art. 15 do Marco Civil'),
  ('job_runs',      'started_at',  180, 'Histórico de execução de tarefa agendada'),
  ('page_views',    'day',         180, 'Contador agregado de visita, sem identificador de pessoa')
on conflict (tabela) do update set
  coluna_data = excluded.coluna_data,
  dias        = excluded.dias,
  motivo      = excluded.motivo;

/**
 * A trilha NUNCA entra aqui, e a recusa mora na função — não só na lista.
 *
 * `audit_logs`, `integration_audit_log` e `consent_audit_log` não são "log de
 * acesso": são a trilha clínica e de consentimento, com 20 anos publicados em
 * `Termos.tsx` e `Parceiros.tsx`. Expurgá-las por engano trocaria um problema de
 * conformidade por um irreversível.
 *
 * Deixar isso só na ausência de linha na tabela seria proteção de uma camada só
 * — exatamente o que esta rodada está corrigindo na imutabilidade da trilha.
 * Um `insert` futuro nessa lista, por descuido, encontra a recusa aqui.
 */
-- O parâmetro existe porque `triggered_by` não pode afirmar o que não sabe: uma
-- execução manual gravada como 'pg_cron' apagaria a diferença entre a tarefa ter
-- rodado sozinha e alguém a ter disparado. Mesma correção já feita nas três
-- functions agendadas.
drop function if exists public.aplicar_retencao();
create or replace function public.aplicar_retencao(_triggered_by text default 'pg_cron')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proibidas constant text[] := array['audit_logs', 'integration_audit_log', 'consent_audit_log'];
  politica record;
  apagadas integer;
  total integer := 0;
  falhas integer := 0;
  detalhes jsonb := '{}'::jsonb;
  erro text := null;
  inicio timestamptz := now();
begin
  for politica in
    select tabela, coluna_data, dias from public.retention_policies where enabled order by tabela
  loop
    begin
      if politica.tabela = any (proibidas) then
        raise exception 'trilha de auditoria não pode ser expurgada: %', politica.tabela;
      end if;

      -- A tabela e a coluna precisam existir de verdade. Sem isso, um nome
      -- errado na lista viraria erro obscuro em vez de recusa clara — e os
      -- identificadores entram na consulta por %I, nunca concatenados.
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = politica.tabela
          and column_name = politica.coluna_data
      ) then
        raise exception 'coluna %.% não existe', politica.tabela, politica.coluna_data;
      end if;

      execute format(
        'delete from public.%I where %I < (now() - make_interval(days => $1))',
        politica.tabela, politica.coluna_data
      ) using politica.dias;

      get diagnostics apagadas = row_count;
      total := total + apagadas;
      detalhes := detalhes || jsonb_build_object(politica.tabela, apagadas);
    exception when others then
      falhas := falhas + 1;
      detalhes := detalhes || jsonb_build_object(politica.tabela, 'erro: ' || sqlerrm);
      erro := coalesce(erro || ' | ', '') || politica.tabela || ': ' || sqlerrm;
    end;
  end loop;

  -- Tarefa que ninguém vigia falha calada — foi assim que o backup passou
  -- semanas sem gravar arquivo.
  insert into public.job_runs
    (job, started_at, finished_at, ok, items_ok, items_failed, details, error, triggered_by)
  values
    ('retencao', inicio, now(), falhas = 0, total, falhas, detalhes, erro, _triggered_by);

  return jsonb_build_object('ok', falhas = 0, 'apagadas', total, 'falhas', falhas, 'detalhes', detalhes);
end;
$$;

revoke all on function public.aplicar_retencao(text) from public, anon, authenticated;

-- Diária, de madrugada, fora do horário das outras tarefas.
select cron.unschedule('valvepath-retencao')
where exists (select 1 from cron.job where jobname = 'valvepath-retencao');

select cron.schedule(
  'valvepath-retencao',
  '15 5 * * *',
  $$ select public.aplicar_retencao(); $$
);

-- E entra na lista do vigia: se o expurgo parar, o painel e o alerta mostram.
insert into public.watched_jobs (job, label, stale_after_days, enabled)
values ('retencao', 'Expurgo de logs por retenção', 2, true)
on conflict (job) do update set
  label = excluded.label,
  stale_after_days = excluded.stale_after_days,
  enabled = excluded.enabled;

/**
 * A imutabilidade da trilha deixa de ser acidente.
 *
 * `Parceiros.tsx` afirma trilha imutável por 20 anos, e hoje isso é verdade —
 * mas por um caminho frágil: as três tabelas têm RLS ativa e nenhuma policy de
 * UPDATE ou DELETE, e RLS sem policy nega. Os GRANT de update e delete para
 * `authenticated` e `anon` continuam lá, então a promessa depende de ninguém
 * nunca adicionar uma policy sem perceber. Nada muda no comportamento de hoje;
 * muda o que acontece amanhã.
 *
 * E há um privilégio que não era acidente nenhum: **TRUNCATE estava concedido a
 * `authenticated` e a `anon` nas três**. RLS não se aplica a TRUNCATE — nenhuma
 * policy o filtra, nem a ausência delas o impede. Ou seja, a única operação
 * capaz de apagar a trilha inteira de uma vez era exatamente a que a proteção
 * existente não cobria. Vem do `grant all` que o Supabase aplica por padrão às
 * tabelas do schema public.
 *
 * O `service_role` ignora tudo isso, então backup e atendimento a pedido de
 * LGPD seguem funcionando.
 */
revoke update, delete, truncate on public.audit_logs            from authenticated, anon;
revoke update, delete, truncate on public.integration_audit_log from authenticated, anon;
revoke update, delete, truncate on public.consent_audit_log     from authenticated, anon;
