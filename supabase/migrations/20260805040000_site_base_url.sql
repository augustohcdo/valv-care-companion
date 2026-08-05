-- A URL do site publicado, para o vigia diário poder sondá-lo.
--
-- Vai para `internal_secrets` ao lado de `functions_base_url` pelo mesmo
-- motivo: a URL do projeto Supabase antigo ficou cravada em três migrations e
-- sobreviveu à migração de projeto, deixando o backup semanal apontando para um
-- projeto de terceiro. Domínio no código envelhece calado.
insert into public.internal_secrets (key, value)
values ('site_base_url', 'https://valvepath.com.br')
on conflict (key) do update set value = excluded.value;
