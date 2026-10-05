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
 *
 * ## O que esta guarda deixava de conferir, e não dizia
 *
 * Ela reprovou um `it` novo que declara `30_000` ms. Investigando: o parser
 * contava o `\(` de um literal de regex (`/\.eq\(\s*"crm"/`) como abertura de
 * parêntese, o nível nunca voltava a zero, e `if (nivel !== 0) continue`
 * **descartava o bloco em silêncio**.
 *
 * Medido sobre a base inteira, antes e depois:
 *
 *                              blocos lidos   descartados em silêncio
 *     parser original              1270                 23
 *     com regex e comentário       1286                  0
 *
 * Vinte e três blocos nunca foram conferidos por esta guarda, e nada dizia.
 * Falso vermelho é visível e irrita; falso verde não aparece — e o piso de
 * `comSubprocesso >= 5` não acusa nada enquanto cinco outros blocos
 * continuarem legíveis. Agora bloco ilegível é RELATADO, como terceiro estado:
 * "não consegui ler" reprova, porque "não sei" não é "está tudo bem".
 *
 * Três consertos, todos medidos:
 *
 *   · literais de regex e comentários são pulados na contagem de delimitadores;
 *   · `it(` dentro de string não é mais tratado como chamada — era por aí que
 *     as fixtures deste próprio arquivo entravam na varredura. A observação
 *     abaixo sobre "fixtures no topo do módulo" passa a valer por LEITURA, não
 *     por posição; ela fica porque continua sendo onde elas se leem melhor;
 *   · `SOBE_PROCESSO` passa a ler o corpo sem string nem comentário: citar
 *     `spawnSync(` numa fixture não é subir processo.
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

/** Palavras-chave depois das quais uma barra abre regex, não divide. */
const ANTES_DE_REGEX = [
  "return", "typeof", "case", "in", "of", "new", "delete", "void", "yield", "await",
];

/**
 * Caracteres depois dos quais uma barra abre literal de regex.
 *
 * A lista é ESTREITA, e isso foi medido. A primeira versão era larga — incluía
 * `}`, `<` e `>` — com o raciocínio de que ali começa instrução nova. Em `.tsx`
 * isso é falso três vezes:
 *
 *   · `<CaseExamGap caso={vazio} />` — a barra do fechamento automático vem
 *     depois de `}`;
 *   · `</div>` — vem depois de `<`;
 *   · `a > b` — comparação.
 *
 * Com a lista larga, 16 blocos CORRETOS de três arquivos `.tsx` viravam
 * ilegíveis. Medido nas três variantes sobre a base inteira:
 *
 *     larga (}, <, > livres) → 1270 blocos lidos, 23 ilegíveis
 *     ESTREITA (esta)        → 1286 blocos lidos,  7 ilegíveis
 *     estreita + } livre     → 1270 blocos lidos, 23 ilegíveis
 *
 * `=>` é tratado à parte, porque `.filter((x) => /re/.test(x))` é comum e o
 * caractere anterior ali é `>`.
 */
const ABRE_REGEX = "(,=:!&|?;[+*%^~".split("");

/**
 * A barra em `i` abre um literal de regex, ou é divisão?
 *
 * Decidido pelo último caractere significativo antes dela, que é como todo
 * analisador de JavaScript resolve esta ambiguidade: divisão só vem depois de
 * algo que PRODUZ valor — identificador, número, `)`, `]`, `}`.
 *
 * O custo de errar para o lado conservador é conhecido e pequeno: uma regex que
 * comece instrução depois de `}` não é reconhecida, o bloco não fecha, e ele
 * aparece na lista de ILEGÍVEIS — alto, não em silêncio.
 */
export function comecaRegex(texto: string, i: number): boolean {
  let k = i - 1;
  while (k >= 0 && /\s/.test(texto[k])) k--;
  if (k < 0) return true;
  const p = texto[k];
  if (p === ">" && texto[k - 1] === "=") return true; // `=>`
  if (p === "}") return false;                        // JSX `{x} />`
  if (/[A-Za-z0-9_$)\]]/.test(p)) {
    const palavra = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(texto.slice(0, k + 1))?.[1];
    return palavra !== undefined && ANTES_DE_REGEX.includes(palavra);
  }
  return ABRE_REGEX.includes(p);
}

/**
 * As posições que são CÓDIGO: fora de string, de comentário e de regex.
 *
 * Existe porque o localizador de blocos (`BLOCOS.exec`) casava `it(` **dentro
 * das strings de fixture deste próprio arquivo** — `'it("sobe o script", …'` —
 * e aquelas sete falsas chamadas, naturalmente, nunca fechavam.
 *
 * O cabeçalho deste arquivo contornava isso por POSIÇÃO: "as fixtures ficam no
 * topo do módulo, senão a varredura de disco acusaria a própria fixture".
 * Contorno por posição depende de cada autor lembrar; isto não.
 */
export function mascaraDeCodigo(texto: string): Uint8Array {
  const m = new Uint8Array(texto.length).fill(1);
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (c === '"' || c === "'" || c === "`") {
      const aspa = c;
      m[i] = 0; i++;
      while (i < texto.length) {
        if (texto[i] === "\\") { m[i] = 0; if (i + 1 < texto.length) m[i + 1] = 0; i += 2; continue; }
        m[i] = 0;
        const fecha = texto[i] === aspa;
        i++;
        if (fecha) break;
      }
      continue;
    }
    if (c === "/" && texto[i + 1] === "/") {
      while (i < texto.length && texto[i] !== "\n") { m[i] = 0; i++; }
      continue;
    }
    if (c === "/" && texto[i + 1] === "*") {
      while (i < texto.length && !(texto[i] === "*" && texto[i + 1] === "/")) { m[i] = 0; i++; }
      m[i] = 0; if (i + 1 < texto.length) m[i + 1] = 0;
      i += 2;
      continue;
    }
    if (c === "/" && comecaRegex(texto, i)) {
      const fim = fimDoLiteralRegex(texto, i);
      for (let k = i; k <= fim && k < texto.length; k++) m[k] = 0;
      i = fim + 1;
      continue;
    }
    i++;
  }
  return m;
}

/** O índice da barra que FECHA o literal, pulando classes `[...]` e escapes. */
export function fimDoLiteralRegex(texto: string, inicio: number): number {
  let i = inicio + 1;
  let emClasse = false;
  for (; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\\") { i++; continue; }
    if (c === "\n") return i; // regex não atravessa linha: era divisão, afinal
    if (emClasse) { if (c === "]") emClasse = false; continue; }
    if (c === "[") { emClasse = true; continue; }
    if (c === "/") return i;
  }
  return texto.length;
}

export interface BlocoDeTeste {
  bloco: string;
  corpo: string;
  /**
   * O corpo com string, comentário e regex apagados — só o que é CÓDIGO.
   *
   * `SOBE_PROCESSO` era testado no corpo cru, então a menção a `spawnSync(`
   * dentro de uma fixture em string contava como subida de processo. O
   * cabeçalho deste arquivo contornava isso pedindo que as fixtures morassem no
   * topo do módulo; a regra passa a valer por leitura, não por posição.
   */
  corpoDeCodigo: string;
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
export function blocosDeTeste(texto: string, naoFecharam?: number[]): BlocoDeTeste[] {
  const achados: BlocoDeTeste[] = [];
  const codigo = mascaraDeCodigo(texto);
  BLOCOS.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = BLOCOS.exec(texto)) !== null) {
    // `foo.it(` ou `.test(` não é um bloco de teste: é método de outra coisa.
    const anterior = texto[m.index - 1];
    if (anterior === "." || anterior === "_" || /[A-Za-z0-9$]/.test(anterior ?? "")) continue;
    // `it(` dentro de string ou comentário é texto, não chamada. Era por aqui
    // que as fixtures deste próprio arquivo entravam na varredura.
    if (!codigo[m.index]) continue;

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

      /**
       * Comentários e LITERAIS DE REGEX, que este parser não lia.
       *
       * O defeito, medido: um `it` cujo corpo contém `/\.eq\(\s*"crm"/` fazia
       * esta função devolver **zero blocos**. O `\(` da regex entrava na conta
       * de parênteses sem um `)` para fechar, `nivel` nunca voltava a 0, e o
       * `if (nivel !== 0) continue` descartava o bloco inteiro.
       *
       * As duas consequências, e a segunda é a pior:
       *
       *   · falso VERMELHO — quando um `)` posterior (o do `describe` que
       *     fecha) zerava o nível por acaso, o "bloco" passava a abranger o
       *     resto do arquivo, o último argumento deixava de ser um número, e a
       *     guarda cobrava prazo de um `it` que declara 30 000 ms;
       *   · falso VERDE — sem esse `)` extra, o bloco simplesmente SAÍA da
       *     varredura. Um teste que sobe `deno` sem prazo e tenha uma regex com
       *     parêntese escapado era invisível aqui. O piso de `>= 5` não pega:
       *     basta que cinco outros blocos continuem legíveis.
       *
       * Guarda cujo parser não lê código não confere código — lê texto. É a
       * sétima vez que esta base paga por isso, e a primeira dentro de um
       * parser que já havia sido consertado duas vezes pelo mesmo motivo.
       */
      if (c === "/" && texto[i + 1] === "/") {
        while (i < texto.length && texto[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && texto[i + 1] === "*") {
        i += 2;
        while (i < texto.length && !(texto[i] === "*" && texto[i + 1] === "/")) i++;
        i++;
        continue;
      }
      if (c === "/" && comecaRegex(texto, i)) {
        i = fimDoLiteralRegex(texto, i);
        continue;
      }
      // Escape solto fora de string: pula o próximo, para `\(` nunca contar.
      if (c === "\\") { i++; continue; }

      if ("({[".includes(c)) nivel++;
      else if (")}]".includes(c)) {
        nivel--;
        if (nivel === 0) { argumentos.push(texto.slice(inicioArg, i)); break; }
      } else if (c === "," && nivel === 1) {
        argumentos.push(texto.slice(inicioArg, i));
        inicioArg = i + 1;
      }
    }
    if (nivel !== 0) {
      /**
       * Chamada que o parser não conseguiu fechar.
       *
       * Antes aqui havia só `continue`, com o comentário "não é o que
       * procuramos" — e era justamente o que procurávamos. O bloco saía da
       * varredura sem deixar rastro: nem aprovado, nem reprovado, **ausente**.
       * Um `it` que sobe `deno` sem prazo e tenha uma regex que o parser não lê
       * ficava invisível, e o piso de `>= 5` não acusa nada enquanto cinco
       * outros blocos continuarem legíveis.
       *
       * Agora ele é relatado. "Não consegui ler" é um terceiro estado, como a
       * saída 2 dos scripts desta base: reprova porque "não sei" não é "está
       * tudo bem".
       */
      naoFecharam?.push(texto.slice(0, m.index).split("\n").length);
      continue;
    }

    const ultimo = argumentos[argumentos.length - 1]?.trim() ?? "";
    const numero = /^[0-9][0-9_]*$/.test(ultimo) ? Number(ultimo.replace(/_/g, "")) : null;

    const corpo = texto.slice(abre, i + 1);
    let soCodigo = "";
    for (let k = abre; k <= i; k++) soCodigo += codigo[k] ? texto[k] : " ";

    achados.push({
      bloco: m[1],
      corpo,
      corpoDeCodigo: soCodigo,
      prazo: numero,
      linha: texto.slice(0, m.index).split("\n").length,
    });
  }
  return achados;
}

/** O que falta neste bloco, se ele sobe processo externo. */
export function faltaPrazo(bloco: BlocoDeTeste): string | null {
  // Pelo corpo de CÓDIGO: `spawnSync(` citado numa fixture em string não sobe
  // processo nenhum, e cobrar prazo por causa disso é reprovar quem fez certo.
  if (!SOBE_PROCESSO.test(bloco.corpoDeCodigo)) return null;

  PRAZO_DO_FILHO.lastIndex = 0;
  const doFilho = [...bloco.corpoDeCodigo.matchAll(PRAZO_DO_FILHO)].map((x) =>
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

/**
 * O corpo com literal de regex que fazia o parser perder o bloco INTEIRO.
 *
 * No topo do módulo como as outras, pelo motivo escrito acima: ele cita
 * `execFileSync(`, e dentro de um `it` a varredura de disco acusaria a fixture.
 */
const COM_REGEX_DE_PARENTESE = [
  'it("varre o repositório", () => {',
  '  const r = execFileSync("git", ["ls-files"], { encoding: "utf8" });',
  '  if (/\\.eq\\(\\s*"crm(_uf)?"/.test(r)) throw new Error("achou");',
  "  expect(r).toBeTruthy();",
  "}, 30_000);",
].join("\n");

/** O mesmo corpo SEM prazo: tem de ser acusado, não desaparecer. */
const COM_REGEX_SEM_PRAZO = COM_REGEX_DE_PARENTESE.replace("}, 30_000);", "});");

/** Divisão de verdade. Lida como regex, ela engoliria o resto da linha. */
const COM_DIVISAO = [
  'it("divide", () => {',
  '  const r = spawnSync("deno", ["run"], { timeout: 60_000 });',
  "  const media = r.stdout.length / 2;",
  "  expect(media).toBeGreaterThan(0);",
  "}, 90_000);",
].join("\n");

describe("prazo dos testes que sobem processo externo", () => {
  it("nenhum bloco sobe processo com o prazo padrão de 5 s", () => {
    const ruins: string[] = [];
    const ilegiveis: string[] = [];
    let comSubprocesso = 0;

    for (const arquivo of varrerTestes(RAIZ)) {
      const naoFecharam: number[] = [];
      for (const bloco of blocosDeTeste(readFileSync(arquivo, "utf8"), naoFecharam)) {
        if (!SOBE_PROCESSO.test(bloco.corpoDeCodigo)) continue;
        comSubprocesso++;
        const falta = faltaPrazo(bloco);
        if (falta) ruins.push(`  · ${arquivo}:${bloco.linha} (${bloco.bloco}) — ${falta}`);
      }
      for (const linha of naoFecharam) ilegiveis.push(`  · ${arquivo}:${linha}`);
    }

    expect(comSubprocesso, "a varredura não achou bloco nenhum subindo processo — ela parou de medir")
      .toBeGreaterThanOrEqual(5);
    expect(
      ilegiveis,
      `\n${ilegiveis.join("\n")}\n\n` +
        "⚠️ NÃO CONFERIDO — o parser não conseguiu fechar a chamada destes blocos,\n" +
        "então eles ficaram FORA da varredura: nem aprovados, nem reprovados.\n\n" +
        "Antes isto era um `continue` em silêncio, e um `it` que sobe `deno` sem\n" +
        "prazo ficava invisível aqui. O piso acima não pega: basta que cinco outros\n" +
        "blocos continuem legíveis.\n\n" +
        '"Não sei" não é "está tudo bem".',
    ).toEqual([]);
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

  /**
   * O literal de regex, que este parser não lia — e o custo medido.
   *
   * Um `it` cujo corpo contém `/\.eq\(\s*"crm(_uf)?"/` tinha o `\(` contado
   * como abertura de parêntese. `nivel` não voltava a 0, e `blocosDeTeste`
   * devolvia **zero blocos**. Medido: `blocos: 0, prazo: undefined`.
   *
   * Dois efeitos, e o segundo é pior:
   *
   *   · falso VERMELHO — num arquivo real, um `)` posterior zerava o nível por
   *     acaso e a guarda cobrou prazo de um `it` que declara 30 000 ms;
   *   · falso VERDE — sozinho, o bloco saía da varredura. Era a guarda
   *     deixando de conferir sem dizer que deixou.
   *
   * Este parser já havia sido consertado duas vezes pelo mesmo motivo de fundo
   * (ler texto em vez de código): a vez do `split(",")` e a da janela de 500
   * caracteres. Esta é a terceira.
   */
  it("regex com parêntese escapado não faz o bloco desaparecer", () => {
    const blocos = blocosDeTeste(COM_REGEX_DE_PARENTESE);
    expect(blocos, "o bloco sumiu da varredura").toHaveLength(1);
    expect(blocos[0].prazo, "não leu o prazo que está escrito").toBe(30_000);
    expect(faltaPrazo(blocos[0]), "acusou um bloco que declara 30 s").toBeNull();
  });

  it("e o mesmo bloco SEM prazo continua sendo acusado", () => {
    // O outro lado do conserto: não basta parar de reprovar quem fez certo; o
    // bloco que realmente não declara prazo tem de aparecer.
    const blocos = blocosDeTeste(COM_REGEX_SEM_PRAZO);
    expect(blocos).toHaveLength(1);
    expect(blocos[0].prazo).toBeNull();
    expect(faltaPrazo(blocos[0])).toMatch(/não declara prazo/);
  });

  it("divisão continua sendo divisão", () => {
    // Se toda barra abrisse regex, o `/ 2;` engoliria o resto do corpo até a
    // próxima barra e o prazo se perderia — o conserto viraria outro defeito.
    const blocos = blocosDeTeste(COM_DIVISAO);
    expect(blocos).toHaveLength(1);
    expect(blocos[0].prazo, "a divisão foi lida como início de regex").toBe(90_000);
  });

  it("`comecaRegex` decide pelo caractere anterior, e a lista é estreita", () => {
    const depoisDe = (antes: string) => comecaRegex(`${antes}/x/`, antes.length);

    // Produz valor → divisão.
    for (const antes of ["n ", "total", "r)", "arr[0]", "2 "]) {
      expect(comecaRegex(`${antes}/ 2`, antes.length), `"${antes}" devia ser divisão`).toBe(false);
    }

    // Não produz valor → regex. `=>` está aqui porque
    // `.filter((x) => /re/.test(x))` é comum e o caractere anterior é `>`.
    for (const antes of ["(", "= ", ", ", "! ", ": ", "&& ", "return ", "=> "]) {
      expect(depoisDe(antes), `"${antes}" devia abrir regex`).toBe(true);
    }

    /**
     * E as três formas de JSX que a lista LARGA quebrava.
     *
     * A primeira versão desta regra tratava `}`, `<` e `>` como início de
     * instrução, logo início de regex. Em `.tsx` isso transformava 16 blocos
     * corretos de três arquivos em "ilegíveis" — porque a barra do fechamento
     * automático de uma tag vem logo depois deles. Medido: 23 ilegíveis com a
     * lista larga, 7 com a estreita (e 0 depois de a máscara de código parar
     * de casar `it(` dentro de string).
     */
    for (const [antes, oQue] of [
      ["<CaseExamGap caso={vazio} ", "fechamento automático depois de `}`"],
      ["<", "tag de fechamento `</div>`"],
      ["a > b ", "comparação"],
    ] as const) {
      expect(
        depoisDe(antes),
        `"${antes}" não abre regex — é ${oQue}`,
      ).toBe(false);
    }
  });

  it("bloco que o parser não fecha é RELATADO, não descartado", () => {
    /**
     * A inversão do conserto profundo. Um corpo deliberadamente desequilibrado
     * — `(` sem par, fora de string e fora de regex — não pode sair em
     * silêncio: silêncio aqui é indistinguível de "conferido e está certo".
     */
    const desequilibrado = [
      'it("desequilibrado", () => {',
      '  const r = spawnSync("deno", ["run"]);',
      "  const x = foo((;", // `(` sem fechamento, de propósito
      "});",
    ].join("\n");
    const naoFecharam: number[] = [];
    const blocos = blocosDeTeste(desequilibrado, naoFecharam);
    expect(blocos, "o parser fechou algo que não fecha").toHaveLength(0);
    expect(
      naoFecharam,
      "o bloco ilegível saiu da varredura sem deixar rastro — era o `continue` em silêncio",
    ).toEqual([1]);
  });
});
