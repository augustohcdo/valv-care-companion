-- Um erro que se repete não pode empurrar todos os outros para fora da tela.
--
-- A tabela inteira de `client_errors` tinha 20 linhas — todas a mesma mensagem,
-- do mesmo aparelho, em 6,6 segundos. Um erro em laço de render escreveria
-- milhares e esconderia qualquer outro. E como a `report-error` é pública e sem
-- limite, isso também é um vetor de abuso: dá para inflar a tabela à vontade.
--
-- Em vez de um limitador à parte, a repetição passa a ser contada na própria
-- linha. Resolve as três coisas de uma vez: o ruído some, o crescimento para de
-- ser linear no número de repetições, e a tela ganha o "×N" de graça.

alter table public.client_errors
  add column if not exists occurrences integer not null default 1;

alter table public.client_errors
  add column if not exists last_seen_at timestamptz not null default now();

-- As linhas que já existiam nunca foram agrupadas; a última ocorrência delas é
-- o próprio instante em que foram gravadas. Ao criar a coluna, o default
-- `now()` marcou todas com o horário da migração — que é posterior à criação
-- delas, e é justamente esse excesso que este UPDATE desfaz.
update public.client_errors
   set last_seen_at = created_at
 where last_seen_at > created_at;

-- Sustenta a busca por "linha idêntica vista há pouco", que é o caminho quente
-- da coalescência: um SELECT antes de cada gravação.
create index if not exists idx_client_errors_dedupe
  on public.client_errors (source, context, message, last_seen_at desc);

-- A listagem do admin passa a ordenar por última ocorrência, não por criação:
-- um erro antigo que voltou a acontecer agora é mais urgente que um erro novo
-- que aconteceu uma vez.
create index if not exists idx_client_errors_last_seen
  on public.client_errors (last_seen_at desc);
