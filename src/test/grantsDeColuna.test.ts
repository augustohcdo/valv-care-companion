/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { sqlSemComentarios } from "./sqlDeMigrations";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Toda coluna que a tela grava está no `grant update (…)` da tabela.
 *
 * ## O defeito, provado rodando
 *
 * Duas migrations que não se falaram:
 *
 * **2026-08-05** fechou um buraco real — `authenticated` tinha UPDATE nas doze
 * colunas de `doctors`, inclusive `verified`, e qualquer médico podia marcar a
 * si mesmo como verificado. O conserto está certo, e o comentário registra a
 * sutileza: privilégio de coluna **não subtrai** de privilégio de tabela, então
 * revoga-se a tabela e concede-se de volta coluna por coluna.
 *
 *     revoke update on public.doctors from authenticated;
 *     grant update (crm, crm_uf, specialty, rqe, institution, city, bio) …
 *
 * **2026-08-24** acrescentou `no_diretorio` e `aceita_novos_pacientes`, e a tela
 * passou a gravar as NOVE colunas numa instrução só. O grant continuou com sete.
 *
 * Num PostgreSQL 16, com os dois passos replicados na ordem em que rodaram:
 *
 *     update … set verified = true               → permission denied  (trava ok)
 *     update … set <as 7 de 2026-08-05>          → UPDATE 1
 *     update … set <as 9 que a tela grava hoje>  → PERMISSION DENIED
 *
 * O formulário inteiro reprovava — CRM, instituição, biografia —, porque tudo
 * vai na mesma instrução. E a caixa "Aparecer no diretório", que o código
 * enquadra como consentimento revogável (LGPD art. 8º §5º, CFM nº 2.336/2023),
 * não tinha como ser desmarcada: `no_diretorio` nasce `true`.
 *
 * ## Por que uma guarda, e não só o conserto
 *
 * A MESMA migration de 2026-08-24 faz para `patients` exatamente o que faltou
 * em `doctors`: revoga a tabela e concede cinco colunas nominais. O autor estava
 * pensando em privilégio de coluna naquele dia. Em `patients` ficou certo; em
 * `doctors`, as colunas entraram e o grant não.
 *
 * Quer dizer: a lição estava aprendida, escrita e aplicada — no arquivo ao lado,
 * na mesma hora. Nenhuma guarda ligava as duas pontas, e a próxima coluna nova
 * vai repetir o caminho. Esta liga: o grant das migrations contra as chaves que
 * o código do cliente escreve.
 *
 * ## O que ela NÃO cobre
 *
 * Só `src/` — o cliente. As edge functions usam `service_role`, que ignora
 * privilégio de coluna e RLS; cobrá-las aqui seria falso vermelho. E ela lê o
 * objeto literal do `.update({…})`: se alguém montar as colunas por variável ou
 * espalhar um objeto, o sítio entra na lista de NÃO LIDOS, que o teste também
 * exige vazia — parser que não entende não pode virar silêncio.
 */

const MIGRATIONS = "supabase/migrations";

/** Comentários fora, linhas preservadas. Guarda que lê comentário não confere código. */
// Esta guarda lê DUAS linguagens e tinha um limpador só, que não servia para
// nenhuma das duas: ele tirava `//` e `/* */`, então nas migrations ele deixava
// TODO comentário `--` passar por código — numa guarda que afirma revogação de
// UPDATE por coluna. Medido antes de trocar: com `--` removido, as duas listas
// (`revogadas` e `concedidas`) saem idênticas, então a fragilidade não tinha
// alcance hoje. Fragilidade sem alcance ainda é fragilidade.
//
// Agora cada linguagem tem o seu: `sqlSemComentarios` para as migrations,
// `semComentariosDeCodigo` (pelo parser) para o TypeScript.

export interface GrantsDeColuna {
  /** Tabelas cujo UPDATE de tabela foi revogado de `authenticated`. */
  revogadas: Set<string>;
  /** Por tabela, as colunas devolvidas por `grant update (…)`. */
  concedidas: Map<string, Set<string>>;
}

export function grantsDeColuna(dir = MIGRATIONS): GrantsDeColuna {
  const revogadas = new Set<string>();
  const concedidas = new Map<string, Set<string>>();

  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = sqlSemComentarios(readFileSync(join(dir, arquivo), "utf8"));

    for (const m of sql.matchAll(
      /revoke\s+[^;]*\bupdate\b[^;]*on\s+(?:public\.)?(\w+)\s+from\s+([^;]+);/gi,
    )) {
      if (/authenticated/i.test(m[2])) revogadas.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(
      /grant\s+update\s*\(([^)]*)\)\s*on\s+(?:public\.)?(\w+)\s+to\s+([^;]+);/gi,
    )) {
      if (!/authenticated/i.test(m[3])) continue;
      const tabela = m[2].toLowerCase();
      if (!concedidas.has(tabela)) concedidas.set(tabela, new Set());
      for (const col of m[1].split(",")) concedidas.get(tabela)!.add(col.trim().toLowerCase());
    }
  }
  return { revogadas, concedidas };
}

export interface EscritaDoCliente {
  arquivo: string;
  tabela: string | null;
  colunas: string[] | null;
  espalha: boolean;
}

/**
 * As chaves de nível 1 do objeto literal que começa em `texto[i] === "{"`.
 *
 * Equilibra delimitadores e pula strings, em vez de cortar por vírgula: esta
 * base já pagou duas vezes por parser que lê texto em vez de código.
 */
function chavesDoObjeto(texto: string, i: number): { chaves: string[]; espalha: boolean } | null {
  let profundidade = 0;
  let aspa: string | null = null;
  let corpo = "";
  let j = i;

  for (; j < texto.length; j++) {
    const c = texto[j];
    if (aspa) {
      if (c === "\\") { j++; continue; }
      if (c === aspa) aspa = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { aspa = c; continue; }
    if ("{[(".includes(c)) { profundidade++; continue; }
    if ("}])".includes(c)) {
      profundidade--;
      if (profundidade === 0) break;
      continue;
    }
    if (profundidade === 1) corpo += c;
  }
  if (j >= texto.length) return null; // objeto não fechado: não entendi, e digo

  const chaves: string[] = [];
  for (const parte of corpo.split(",")) {
    const comDoisPontos = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:/.exec(parte);
    if (comDoisPontos) {
      chaves.push((comDoisPontos[1] ?? comDoisPontos[2] ?? comDoisPontos[3]).toLowerCase());
      continue;
    }
    // forma curta `{ crm }`
    const curta = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(parte);
    if (curta) chaves.push(curta[1].toLowerCase());
  }
  return { chaves, espalha: corpo.includes("...") };
}

/** Os `.from("x").update({…})` do cliente. */
export function escritasDoCliente(raiz = "src"): EscritaDoCliente[] {
  const achados: EscritaDoCliente[] = [];

  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const full = join(dir, nome);
      if (statSync(full).isDirectory()) { varrer(full); continue; }
      if (!/\.tsx?$/.test(nome) || nome.includes(".test.")) continue;

      const texto = semComentariosDeCodigo(readFileSync(full, "utf8"), full);
      for (const m of texto.matchAll(/\.update\s*\(\s*\{/g)) {
        // A tabela é o `.from("x")` mais próximo ANTES, sem cruzar fim de
        // instrução. Janela de N caracteres já enganou este repositório quando
        // alguém quebrou a chamada em várias linhas; o limite aqui é sintático.
        const antes = texto.slice(0, m.index!);
        const corte = Math.max(antes.lastIndexOf(";"), antes.lastIndexOf("\n\n"));
        const contexto = antes.slice(corte < 0 ? 0 : corte);
        const froms = [...contexto.matchAll(/\.from\s*\(\s*["'](\w+)["']/g)];
        const tabela = froms.length ? froms[froms.length - 1][1].toLowerCase() : null;

        const abre = texto.indexOf("{", m.index! + ".update".length);
        const lido = chavesDoObjeto(texto, abre);
        achados.push({
          arquivo: full,
          tabela,
          colunas: lido?.chaves ?? null,
          espalha: lido?.espalha ?? false,
        });
      }
    }
  };
  varrer(raiz);
  return achados;
}

describe("o cliente só grava colunas que o grant concede", () => {
  const { revogadas, concedidas } = grantsDeColuna();
  const escritas = escritasDoCliente();

  it("a varredura entendeu as migrations e o código", () => {
    /**
     * O piso, porque uma varredura que não acha nada aprova tudo. Se o extrator
     * de grant parar de casar, `revogadas` fica vazia e a regra abaixo passa
     * sobre nada — exatamente a forma de defeito que esta sessão persegue.
     */
    expect(
      revogadas.size,
      "nenhuma tabela com UPDATE revogado — o extrator de `revoke` parou de casar",
    ).toBeGreaterThanOrEqual(5);
    expect(
      concedidas.get("doctors")?.size ?? 0,
      "o grant de coluna de `doctors` não foi lido",
    ).toBeGreaterThanOrEqual(7);
    expect(
      escritas.length,
      "nenhum `.update({…})` encontrado em `src/` — o extrator do cliente parou",
    ).toBeGreaterThanOrEqual(25);
  });

  it("nenhum sítio de escrita ficou ILEGÍVEL para a varredura", () => {
    // Parser que não entende não pode virar silêncio: o sítio entra aqui em vez
    // de sair da conta. Quem montar as colunas por variável ou espalhar um
    // objeto precisa vir arrumar esta lista, e não descobrir na produção.
    const ilegiveis = escritas
      .filter((e) => e.tabela === null || e.colunas === null || e.espalha)
      .map((e) => `  · ${e.arquivo} — tabela=${e.tabela} colunas=${e.colunas} espalha=${e.espalha}`);
    expect(
      ilegiveis,
      `\n${ilegiveis.join("\n")}\n\n` +
        "A varredura não conseguiu ler estes `.update({…})`, então não sabe dizer\n" +
        "se as colunas estão no grant. Deixá-los passar seria a guarda aprovando\n" +
        "o que não olhou.",
    ).toEqual([]);
  });

  it("toda coluna gravada está no `grant update (…)` da tabela", () => {
    const fora: string[] = [];
    for (const e of escritas) {
      if (!e.tabela || !e.colunas || !revogadas.has(e.tabela)) continue;
      const permitidas = concedidas.get(e.tabela) ?? new Set<string>();
      const faltando = e.colunas.filter((c) => !permitidas.has(c));
      if (faltando.length) {
        fora.push(`  · ${e.tabela}: ${faltando.join(", ")}   (${e.arquivo})`);
      }
    }
    expect(
      fora,
      `\n${fora.join("\n")}\n\n` +
        "O UPDATE de tabela foi revogado destas tabelas e devolvido coluna por\n" +
        "coluna. Coluna fora do grant faz o Postgres recusar a instrução INTEIRA\n" +
        "com `permission denied for table` — não só aquele campo.\n\n" +
        "Foi assim que o formulário de perfil do médico parou de salvar por um\n" +
        "mês: duas colunas novas entraram na tela e não no grant.\n\n" +
        "Acrescente as colunas ao grant numa migration. Se a coluna NÃO deve ser\n" +
        "escrita pelo cliente — `verified` é o caso —, tire-a da tela.",
    ).toEqual([]);
  });

  it("`verified` continua fora do alcance do médico", () => {
    /**
     * O que a migration de 2026-08-05 existe para garantir, e que o conserto de
     * hoje não pode ter afrouxado por descuido: o selo que sustenta a regra
     * mais dura desta base é marcado pelo `admin_verificar_medico`, nunca pelo
     * próprio médico.
     *
     * Conferido rodando: com o grant novo aplicado, `update doctors set
     * verified = true` segue respondendo `permission denied for table doctors`.
     */
    expect(
      concedidas.get("doctors")?.has("verified") ?? false,
      "`verified` entrou no grant de coluna de `doctors` — o médico voltou a poder " +
        "se autoverificar, e é esse selo que autoriza marcar conteúdo como revisado",
    ).toBe(false);

    const naTela = escritasDoCliente().filter((e) => e.tabela === "doctors");
    for (const e of naTela) {
      expect(
        e.colunas ?? [],
        `${e.arquivo} grava \`verified\` em \`doctors\` pelo cliente`,
      ).not.toContain("verified");
    }
  });
});
