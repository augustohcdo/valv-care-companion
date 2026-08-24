-- A anuência de aparecer no diretório entra na trilha de consentimento.
--
-- Ela já é colhida no formulário de solicitação de acesso
-- (`access_requests.consent_diretorio`, com data) e revogável pela chave no
-- perfil (`doctors.no_diretorio`). O que faltava era estar **onde um pedido de
-- LGPD procura**: `user_consents`, junto com termos, política e IA. Uma
-- anuência que mora só numa tabela de fila responde mal a "me mostre tudo que
-- vocês têm sobre mim".
--
-- `alter type ... add value` é append-only e não pode rodar dentro de um bloco
-- de transação junto com o uso do valor novo — por isso a migration só declara
-- o valor; quem grava é a edge function, depois.
do $$ begin
  alter type public.consent_type add value if not exists 'directory_listing';
exception when duplicate_object then null; end $$;

comment on type public.consent_type is
  'Tipos de consentimento granular. directory_listing = médico aceita aparecer no diretório visível a pacientes (Resolução CFM nº 2.336/2023 exige anuência; LGPD art. 8º §5º a torna revogável).';
