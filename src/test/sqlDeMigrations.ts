/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Leitura das migrations para as guardas — com noção de ORDEM e sem comentário.
 *
 * ## Por que este módulo existe
 *
 * `rlsCoverage.test.ts` tem duas extrações lado a lado, e só uma delas tinha
 * aprendido a lição. `politicasVivas` modela `drop policy` e `create policy`
 * na POSIÇÃO em que aparecem, e o comentário dela explica por quê:
 *
 *   > "A primeira versão fazia duas varreduras por arquivo (…) Quer dizer: ela
 *   >  não tinha noção de ORDEM. (…) Agora cada instrução é aplicada na posição
 *   >  em que aparece: um `create` depois de um `drop` revive, e um `drop`
 *   >  depois de um `create` derruba. É o que o Postgres faz, e modelar menos
 *   >  do que isso é modelar outra coisa."
 *
 * A extração de TABELAS da mesma guarda nunca ganhou isso. Ela era:
 *
 *     const criadas = new Set([...sql.matchAll(/create\s+table\s+…/g)]…);
 *     const comRls  = new Set([...sql.matchAll(/…enable row level security/g)]…);
 *
 * sobre a concatenação crua de todas as migrations. Sem `drop table`, sem
 * `disable row level security`, e lendo comentário como código.
 *
 * ## O que isso custava, medido
 *
 * Cruzando com `src/integrations/supabase/types.ts` — que é gerado do banco de
 * produção e é a lista de tabelas que existem de verdade: 47 tabelas no schema,
 * 48 no `criadas`. A sobra é `backup_runs`, criada em
 * `20260801130000_fix_cron_target_and_rotate_secrets` e APAGADA em
 * `20260801160000_job_runs`, depois de migrar as linhas para `job_runs`. A
 * guarda contava uma tabela que não existe há dois meses.
 *
 * Hoje isso é inofensivo porque `backup_runs` também tem `enable row level
 * security` na mesma migration. Os dois jeitos de doer são:
 *
 *   · **falso vermelho** — tabela criada sem RLS e apagada depois fica
 *     acusada para sempre, sobre algo que não existe. A saída de quem topar com
 *     isso é pôr o nome em `SEM_RLS_JUSTIFICADO`, e aí a dispensa fica lá, sem
 *     ninguém revisar, valendo para a próxima tabela com o mesmo nome;
 *   · **falso verde** — tabela criada COM RLS, apagada, e recriada depois SEM
 *     RLS com o mesmo nome. `criadas` e `comRls` guardam as duas da primeira
 *     vez, e a guarda aprova uma tabela desprotegida. É o defeito que esta
 *     sessão persegue, dentro da guarda de segurança.
 *
 * E a cegueira a comentário é a mesma que, horas atrás, fez uma docstring
 * minha subir a dívida declarada de leituras cegas de 2 para 3. Aqui ela seria
 * pior: um `-- alter table x enable row level security` em prosa faria a tabela
 * `x` passar por protegida. Medido hoje: nenhuma ocorrência em comentário, nem
 * de `create table` nem de `enable`. Fragilidade sem alcance ainda é
 * fragilidade — e esta custa pouco para fechar.
 */

/** Tira comentários de SQL preservando as posições, caractere a caractere. */
export function sqlSemComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, (linha) => " ".repeat(linha.length));
}

export function arquivosDeMigration(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
}

export interface TabelaViva {
  tabela: string;
  /** RLS ligado na última instrução que mexeu nisso. */
  rls: boolean;
  /** A migration que a criou (a última vez, se foi recriada). */
  criadaEm: string;
  /** A migration que ligou o RLS, ou `null` se ninguém ligou. */
  rlsEm: string | null;
}

/** Instruções que esta leitura entende, e nada além. */
type Instrucao =
  | { pos: number; tipo: "create"; tabela: string }
  | { pos: number; tipo: "drop"; tabela: string }
  | { pos: number; tipo: "rls"; tabela: string; liga: boolean };

/**
 * As tabelas que AINDA existem, e se cada uma tem RLS.
 *
 * Mesma forma de `politicasVivas`: uma passada por arquivo em ordem de nome,
 * instruções aplicadas na posição em que aparecem.
 *
 * `enable row level security` sobre tabela que esta leitura não viu criar é
 * devolvido em `rlsOrfao` em vez de ser engolido — no Postgres isso é erro, e
 * aqui quer dizer que a leitura perdeu o `create table` correspondente. Terceiro
 * estado: 0 é certo, acusação é errado, e "não consegui ler" não pode se
 * disfarçar de nenhum dos dois.
 */
export interface LeituraDeTabelas {
  vivas: Map<string, TabelaViva>;
  rlsOrfao: string[];
  /** Quantos `create table` foram lidos — o piso de quem confia neste número. */
  criacoesLidas: number;
}

/**
 * Lê o disco e delega. A regra em si mora em `tabelasVivasDeSql`, que é pura.
 *
 * A separação não é estética: as duas inversões que falharam na primeira
 * rodada desta guarda — `disable row level security` e o `enable` órfão —
 * falharam porque NENHUMA migration deste repositório tem esses casos. Mutar o
 * tratamento deles não derrubava nada, e as duas linhas estavam sem teste.
 * Com a regra separada do disco, cada caso é material plantado em texto.
 */
export function tabelasVivas(dir: string): LeituraDeTabelas {
  return tabelasVivasDeSql(
    arquivosDeMigration(dir).map((arquivo) => ({
      arquivo,
      sql: readFileSync(join(dir, arquivo), "utf8"),
    })),
  );
}

/** A regra, sobre as migrations JÁ em ordem de nome. Pura. */
export function tabelasVivasDeSql(
  entradas: Array<{ arquivo: string; sql: string }>,
): LeituraDeTabelas {
  const vivas = new Map<string, TabelaViva>();
  const rlsOrfao: string[] = [];
  let criacoesLidas = 0;

  for (const entrada of entradas) {
    const arquivo = entrada.arquivo;
    const sql = sqlSemComentarios(entrada.sql);
    const instrucoes: Instrucao[] = [];

    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z_0-9]*)"?/gi,
    )) {
      instrucoes.push({ pos: m.index, tipo: "create", tabela: m[1].toLowerCase() });
    }
    for (const m of sql.matchAll(
      /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_][a-z_0-9]*)"?/gi,
    )) {
      instrucoes.push({ pos: m.index, tipo: "drop", tabela: m[1].toLowerCase() });
    }
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:public\.)?"?([a-z_][a-z_0-9]*)"?\s+(enable|disable)\s+row\s+level\s+security/gi,
    )) {
      instrucoes.push({
        pos: m.index, tipo: "rls",
        tabela: m[1].toLowerCase(),
        liga: m[2].toLowerCase() === "enable",
      });
    }

    instrucoes.sort((a, b) => a.pos - b.pos);
    for (const i of instrucoes) {
      if (i.tipo === "create") {
        criacoesLidas++;
        // `if not exists` sobre tabela existente é no-op, e um `create table`
        // simples sobre tabela existente é erro no Postgres: nos dois casos o
        // estado certo é não mexer no que já está lá.
        if (!vivas.has(i.tabela)) {
          vivas.set(i.tabela, { tabela: i.tabela, rls: false, criadaEm: arquivo, rlsEm: null });
        }
      } else if (i.tipo === "drop") {
        vivas.delete(i.tabela);
      } else {
        const t = vivas.get(i.tabela);
        if (!t) {
          rlsOrfao.push(`${arquivo}: ${i.tabela} (nenhum \`create table\` lido antes)`);
          continue;
        }
        t.rls = i.liga;
        t.rlsEm = i.liga ? arquivo : null;
      }
    }
  }

  return { vivas, rlsOrfao, criacoesLidas };
}

/**
 * As tabelas que existem de VERDADE: o bloco `Tables` dos tipos gerados.
 *
 * `src/integrations/supabase/types.ts` é gerado a partir do banco de produção,
 * então é a única lista neste repositório que não depende de as migrations
 * terem sido aplicadas — nem de alguém não ter criado tabela à mão no painel do
 * Supabase. `backupCoverage.test.ts` já a usava por isso; a guarda de RLS não.
 */
export function tabelasDoSchemaGerado(
  caminho = "src/integrations/supabase/types.ts",
): string[] {
  const linhas = readFileSync(caminho, "utf8").split("\n");
  const ini = linhas.findIndex((l) => /^ {4}Tables: \{/.test(l));
  const fim = linhas.findIndex((l, i) => i > ini && /^ {4}Views: \{/.test(l));
  if (ini < 0 || fim < 0) throw new Error(`não achei o bloco Tables em ${caminho}`);
  return linhas
    .slice(ini, fim)
    .map((l) => /^ {6}([a-z_][a-z_0-9]*): \{$/.exec(l)?.[1])
    .filter((n): n is string => !!n);
}
