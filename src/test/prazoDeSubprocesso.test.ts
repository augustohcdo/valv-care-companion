// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Todo teste que sobe um processo externo declara o próprio prazo.
 *
 * ## O falso vermelho que originou a regra
 *
 * `functionsCarregam.test.ts` reprovou numa execução da suíte inteira e passou
 * ao rodar sozinho, com a árvore de trabalho limpa nas duas vezes. A causa são
 * dois relógios que ninguém tinha alinhado:
 *
 *   · o `spawnSync` daquele teste tem `timeout: 60_000`;
 *   · o prazo padrão de um teste no Vitest são **5 000 ms**, e o
 *     `vitest.config.ts` deste repositório não mexe nele.
 *
 * Com a máquina disputada — 116 arquivos de teste em paralelo — o Deno levou
 * mais de 5 s para subir, e **o Vitest matou o teste antes** do `spawnSync`
 * sequer se preocupar. O que sobrou foi um vermelho sem causa.
 *
 * ## Por que isto importa nesta sessão
 *
 * A sessão inteira persegue o verde que não fez o trabalho. Este é o mesmo
 * defeito pelo avesso, e custa igual: guarda intermitente ensina quem a vê a
 * rodar de novo até passar. Quando o vermelho de VERDADE aparecer, a segunda
 * tentativa vai enterrá-lo junto com o ruído — e aí não há guarda nenhuma.
 *
 * ## A regra é sobre a classe, não sobre o arquivo
 *
 * Erro cometido três vezes nesta sessão: amarrar a regra ao arquivo onde o
 * defeito apareceu. Quando fui olhar, **cinco** blocos de teste subiam processo
 * externo com 60 s de folga para o filho e 5 s para si mesmos, espalhados por
 * três arquivos. Consertar só o que reprovou deixaria os outros quatro
 * esperando a próxima máquina lenta.
 */

const RAIZ = "src";
const IGNORAR = new Set(["node_modules", "dist", "coverage"]);

/**
 * Quem sobe processo externo. `fork` entra: é o mesmo custo de subida.
 *
 * O `(?<![.\w$])` não é enfeite. Sem ele, `/regex/.exec(texto)` casava com o
 * `exec` do `child_process` e esta guarda acusou um teste que só lê YAML —
 * reprovando quem não sobe processo nenhum. Os nomes aqui são os IMPORTADOS de
 * `node:child_process`; como método de outro objeto, são outra coisa.
 */
const SOBE_PROCESSO =
  /(?<![.\w$])(spawnSync|execSync|execFileSync|spawn|exec|execFile|fork)\s*\(/;

/** O prazo que o próprio filho recebeu, quando recebeu algum. */
const PRAZO_DO_FILHO = /\btimeout:\s*([0-9_]+)/g;

/**
 * O piso para quem sobe processo sem dar prazo ao filho.
 *
 * Não é um número escolhido a esmo: subir `node` ou `deno` numa máquina de CI
 * disputada passa dos 5 s com folga, e 30 s ainda reprova de verdade um script
 * que travou. Quem precisar de mais escreve mais — o ponto é que esteja escrito.
 */
const PISO_MS = 30_000;

/** Blocos que recebem prazo próprio no Vitest. */
const BLOCOS = /\b(it|test|beforeAll|beforeEach|afterAll|afterEach)(?:\.\w+)*\s*\(/g;

export interface BlocoDeTeste {
  bloco: string;
  corpo: string;
  /** O último argumento, quando é um literal numérico. `null` quando não é. */
  prazo: number | null;
  linha: number;
}

/**
 * Os blocos de teste de um arquivo, com o prazo que cada um declara.
 *
 * O argumento é lido equilibrando delimitadores e pulando strings — não por
 * `split(",")`. Esta base já pagou duas vezes pelo parser que lê texto em vez
 * de código: o que cortava no primeiro `{` (e escondia o `.select` que vinha
 * depois) e a janela de 500 caracteres que perdia o alvo quando alguém quebrava
 * a chamada em várias linhas.
 */
export function blocosDeTeste(texto: string): BlocoDeTeste[] {
  const achados: BlocoDeTeste[] = [];
  BLOCOS.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = BLOCOS.exec(texto)) !== null) {
    // `foo.it(` ou `.test(` não é um bloco de teste: é método de outra coisa.
    const anterior = texto[m.index - 1];
    if (anterior === "." || anterior === "_" || /[A-Za-z0-9$]/.test(anterior ?? "")) continue;

    const abre = m.index + m[0].length - 1;
    let i = abre;
    let nivel = 0;
    let aspa: string | null = null;
    const argumentos: string[] = [];
    let inicioArg = abre + 1;

    for (; i < texto.length; i++) {
      const c = texto[i];
      if (aspa) {
        if (c === "\\") i++;
        else if (c === aspa) aspa = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { aspa = c; continue; }
      if ("({[".includes(c)) nivel++;
      else if (")}]".includes(c)) {
        nivel--;
        if (nivel === 0) { argumentos.push(texto.slice(inicioArg, i)); break; }
      } else if (c === "," && nivel === 1) {
        argumentos.push(texto.slice(inicioArg, i));
        inicioArg = i + 1;
      }
    }
    if (nivel !== 0) continue; // chamada não fechada: não é o que procuramos

    const ultimo = argumentos[argumentos.length - 1]?.trim() ?? "";
    const numero = /^[0-9][0-9_]*$/.test(ultimo) ? Number(ultimo.replace(/_/g, "")) : null;

    achados.push({
      bloco: m[1],
      corpo: texto.slice(abre, i + 1),
      prazo: numero,
      linha: texto.slice(0, m.index).split("\n").length,
    });
  }
  return achados;
}

/** O que falta neste bloco, se ele sobe processo externo. */
export function faltaPrazo(bloco: BlocoDeTeste): string | null {
  if (!SOBE_PROCESSO.test(bloco.corpo)) return null;

  PRAZO_DO_FILHO.lastIndex = 0;
  const doFilho = [...bloco.corpo.matchAll(PRAZO_DO_FILHO)].map((x) =>
    Number(x[1].replace(/_/g, "")),
  );
  const exigido = doFilho.length > 0 ? Math.max(...doFilho, PISO_MS) : PISO_MS;

  if (bloco.prazo === null) {
    return `sobe processo externo e não declara prazo (o padrão do Vitest são 5 s; precisa de ≥ ${exigido})`;
  }
  if (bloco.prazo < exigido) {
    return `declara ${bloco.prazo} ms, menos que os ${exigido} ms que o processo filho pode levar — o Vitest mata antes`;
  }
  return null;
}

function varrerTestes(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrerTestes(full, out);
    else if (/\.test\.tsx?$/.test(nome)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
}

/**
 * As fixtures ficam AQUI, no topo do módulo, e não dentro dos `it` que as usam.
 *
 * Se estivessem dentro, o texto `spawnSync(` estaria dentro de um bloco de
 * teste deste arquivo — e a varredura de disco acusaria a própria fixture. É a
 * mesma armadilha que a guarda dos mocks de escrita pisou ontem, quando o
 * `indexOf("function escrita(")` casou com a própria string de busca.
 */
const COM_SPAWN_SEM_PRAZO = [
  'it("sobe o script", () => {',
  '  const r = spawnSync("deno", ["run", ALVO], { encoding: "utf8", timeout: 60_000 });',
  "  expect(r.status).toBe(2);",
  "});",
].join("\n");

const COM_SPAWN_COM_PRAZO = [
  'it("sobe o script", () => {',
  '  const r = spawnSync("deno", ["run", ALVO], { encoding: "utf8", timeout: 60_000 });',
  "  expect(r.status).toBe(2);",
  "}, 90_000);",
].join("\n");

const SEM_SPAWN = [
  'it("lê o arquivo", () => {',
  '  expect(readFileSync(ALVO, "utf8")).toContain("x");',
  "});",
].join("\n");

/** Também no topo, e pelo mesmo motivo: ela cita `spawnSync(`. */
const METODO_HOMONIMO = ['const r = suite.it("x", () => spawnSync("a"));'].join("\n");

/**
 * Um `.exec(` de REGEX, que não sobe processo nenhum.
 *
 * Esta guarda acusou um teste que só lê YAML porque `/re/.exec(texto)` casava
 * com o `exec` do `child_process`. Reprovar quem não sobe processo é o erro
 * que esta base persegue do outro lado.
 */
const EXEC_DE_REGEX = [
  'it("lê o bloco de permissões", () => {',
  "  const bloco = /permissions:\\n(.+)/.exec(yml);",
  "  expect(bloco).not.toBeNull();",
  "});",
].join("\n");

describe("prazo dos testes que sobem processo externo", () => {
  it("nenhum bloco sobe processo com o prazo padrão de 5 s", () => {
    const ruins: string[] = [];
    let comSubprocesso = 0;

    for (const arquivo of varrerTestes(RAIZ)) {
      for (const bloco of blocosDeTeste(readFileSync(arquivo, "utf8"))) {
        if (!SOBE_PROCESSO.test(bloco.corpo)) continue;
        comSubprocesso++;
        const falta = faltaPrazo(bloco);
        if (falta) ruins.push(`  · ${arquivo}:${bloco.linha} (${bloco.bloco}) — ${falta}`);
      }
    }

    expect(comSubprocesso, "a varredura não achou bloco nenhum subindo processo — ela parou de medir")
      .toBeGreaterThanOrEqual(5);
    expect(
      ruins,
      `\n${ruins.join("\n")}\n\n` +
        "O prazo padrão de um teste no Vitest são 5 000 ms, e dar 60 s ao processo\n" +
        "filho não adianta: quem estoura primeiro é o Vitest, e o vermelho sai sem\n" +
        "dizer o que estava sendo conferido.\n\n" +
        "Escreva o prazo no próprio bloco:  it(\"…\", () => { … }, 90_000);",
    ).toEqual([]);
  });

  it("acusa o bloco que sobe processo sem declarar prazo", () => {
    const [bloco] = blocosDeTeste(COM_SPAWN_SEM_PRAZO);
    expect(bloco.prazo).toBeNull();
    expect(faltaPrazo(bloco)).toMatch(/não declara prazo/);
  });

  it("acusa o prazo menor que o do processo filho", () => {
    const [bloco] = blocosDeTeste(COM_SPAWN_COM_PRAZO.replace("}, 90_000);", "}, 10_000);"));
    expect(bloco.prazo).toBe(10_000);
    expect(faltaPrazo(bloco), "10 s é menos que os 60 s do filho").toMatch(/o Vitest mata antes/);
  });

  it("aprova o bloco com prazo folgado", () => {
    const [bloco] = blocosDeTeste(COM_SPAWN_COM_PRAZO);
    expect(bloco.prazo).toBe(90_000);
    expect(faltaPrazo(bloco), "reprovou quem fez certo").toBeNull();
  });

  it("não cobra prazo de quem não sobe processo", () => {
    // Guarda que pune quem fez certo é guarda que alguém desliga. A esmagadora
    // maioria dos 1140 testes não sobe nada, e 5 s lhes basta.
    const [bloco] = blocosDeTeste(SEM_SPAWN);
    expect(faltaPrazo(bloco)).toBeNull();
  });

  it("lê o último argumento sem se perder nas vírgulas de dentro", () => {
    // O parser precisa equilibrar delimitadores: há vírgulas dentro do array de
    // argumentos, dentro do objeto de opções e dentro das strings. `split(",")`
    // leria qualquer uma delas como o prazo.
    const [bloco] = blocosDeTeste(COM_SPAWN_COM_PRAZO);
    expect(bloco.prazo, "confundiu uma vírgula de dentro com o fim do argumento").toBe(90_000);
    expect(bloco.corpo, "o corpo extraído não chegou ao fim da chamada").toContain("expect(r.status)");
  });

  it("não confunde `.exec(` de regex com o `exec` do child_process", () => {
    const [bloco] = blocosDeTeste(EXEC_DE_REGEX);
    expect(
      faltaPrazo(bloco),
      "cobrou prazo de um teste que não sobe processo nenhum",
    ).toBeNull();
  });

  it("não confunde método de objeto com bloco de teste", () => {
    // `suite.it(` e `awaitIt(` não são blocos do Vitest.
    expect(blocosDeTeste(METODO_HOMONIMO)).toEqual([]);
  });
});
