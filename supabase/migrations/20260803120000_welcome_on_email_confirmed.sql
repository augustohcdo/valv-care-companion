-- Boas-vindas no momento em que a pessoa confirma o e-mail.
--
-- O texto de cada público vive em `supabase/functions/_shared/welcome.ts`, num
-- lugar só. Repetir título/resumo/link aqui em SQL criaria duas versões da
-- mesma mensagem para envelhecer em direções diferentes — foi assim que a
-- lista de tabelas do backup ficou 15 tabelas atrás do banco. Por isso o
-- gatilho não escreve a mensagem: ele chama a function, que escreve as duas
-- (notificação no app e e-mail) a partir da mesma fonte.
--
-- Isso troca a garantia transacional por uma entrega best-effort, então a
-- entrega precisa de rede: a `welcome-email` também roda por varredura diária,
-- é idempotente, e entra em `watched_jobs` — se a varredura parar, o vigia
-- avisa. Gatilho para chegar na hora; varredura para não depender do gatilho.

-- 1. Quem confirmou o e-mail recentemente, com o perfil já resolvido.
--
--    A function precisa do e-mail e do tipo de conta, e `auth.users` não é
--    legível pelo PostgREST. Devolver isto por RPC é melhor que varrer
--    `listUsers()` página a página: a janela recorta o trabalho no banco, onde
--    é barato.
create or replace function public.recent_confirmed_users(_since timestamptz)
returns table (
  user_id uuid,
  email text,
  confirmed_at timestamptz,
  account_type text,
  full_name text
)
language sql security definer set search_path to 'public'
as $$
  select u.id, u.email::text, u.email_confirmed_at, p.account_type, p.full_name
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where u.email_confirmed_at is not null
    and u.email_confirmed_at >= _since
  order by u.email_confirmed_at desc;
$$;

-- Só o service_role (a edge function) chama isto. A lista traz endereços de
-- e-mail de terceiros; nenhum usuário logado tem por que enxergá-la.
revoke execute on function public.recent_confirmed_users(timestamptz) from public, anon, authenticated;

-- 2. O gatilho da confirmação.
create or replace function public.notify_email_confirmed()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_url text;
  v_secret text;
begin
  -- Só a transição nulo -> preenchido. Um UPDATE qualquer em auth.users (troca
  -- de senha, refresh) não pode reenviar boas-vindas.
  if old.email_confirmed_at is not null or new.email_confirmed_at is null then
    return new;
  end if;

  select value into v_url from public.internal_secrets where key = 'functions_base_url';
  select value into v_secret from public.internal_secrets where key = 'export_cron_secret';

  if v_url is null or v_secret is null then
    raise warning 'boas-vindas não disparadas: internal_secrets incompleto';
    return new;
  end if;

  -- Nada aqui pode derrubar a confirmação do e-mail: a pessoa acabou de clicar
  -- no link, e falhar em avisá-la não pode custar a conta dela. A varredura
  -- diária recupera o que este disparo perder.
  begin
    perform net.http_post(
      url := v_url || '/welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', v_secret
      ),
      body := jsonb_build_object('user_id', new.id, 'source', 'trigger'),
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'boas-vindas não disparadas para %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row execute function public.notify_email_confirmed();

-- 3. A varredura diária, meia hora antes do vigia — assim, quando ele acorda,
--    já tem o resultado do dia para avaliar.
select cron.unschedule('valvepath-welcome-sweep')
where exists (select 1 from cron.job where jobname = 'valvepath-welcome-sweep');

select cron.schedule(
  'valvepath-welcome-sweep',
  '30 4 * * *',
  $$
  select net.http_post(
    url := (select value from public.internal_secrets where key = 'functions_base_url') || '/welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.internal_secrets where key = 'export_cron_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 60000
  );
  $$
);

-- 4. E entra na lista do vigia. Dois dias de folga: a varredura é diária, e um
--    dia perdido não é motivo de alarme; dois seguidos são.
insert into public.watched_jobs (job, label, stale_after_days, enabled)
values ('welcome-email', 'Boas-vindas (varredura)', 2, true)
on conflict (job) do update set
  label = excluded.label,
  stale_after_days = excluded.stale_after_days,
  enabled = excluded.enabled;
