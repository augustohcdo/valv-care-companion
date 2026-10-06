/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  arquivosDeCodigo, lerFonte, leiturasMedidas, formatar,
  type LeituraMedida, type ClassificacaoDaLeitura,
} from "./astDeChamadas";
import { encontrarCegas, clientesCriadosNoArquivo } from "./detectorDeChamadasCegas";

/**
 * Duas opiniões sobre o mesmo fato, e a divergência como sinal.
 *
 * ## Por que medir duas vezes
 *
 * `detectorDeChamadasCegas.ts` mede por expressão regular quantas leituras do
 * cliente do Supabase descartam o `error`, e é desse número que sai a DÍVIDA
 * DECLARADA do projeto: `DIVIDA_CONHECIDA = 2`, em `readErrors.test.ts`.
 *
 * Esse detector tem fragilidades que se veem a olho nu no código dele:
 *
 *   · trunca o statement em 12 linhas (`fim < i + 12`);
 *   · procura o padrão de destino num contexto que inclui COMENTÁRIOS — um
 *     comentário com `const { data, error } =` acima da chamada pode servir de
 *     destino;
 *   · caça `<nome>.error` numa janela de 8 linhas depois do statement.
 *
 * Nenhuma dessas é hipótese. Nesta sessão um analisador por expressão regular
 * se perdeu num delimitador DEZ vezes — o `]` dentro de `"[data-carregando]"`,
 * o primeiro backtick de um rótulo concatenado em três, o `{` de um padrão de
 * desestruturação, o `\(` dentro de um literal de regex — e duas delas foram em
 * medidores que eu mesmo escrevi no mesmo dia. Em todas, o número saiu errado
 * para baixo: o lado tranquilizador.
 *
 * Um `expect(cegas).toEqual([])` não distingue "nada para achar" de "detector
 * que não acha nada". Um segundo detector que não divide analisador com o
 * primeiro distingue.
 *
 * ## O que foi medido
 *
 * 129 leituras em `src` e 69 em `supabase/functions`: **zero cegas pelos dois
 * métodos**. As duas acusações do detector por texto são as duas chamadas de
 * `AdminUsuarios.tsx` que passam a PROMESSA para o helper `executar`, e é ele
 * que faz `const { error } = await chamada`. O `readErrors.test.ts` já as
 * declarava falsos positivos — o que faltava era isso ser medido em vez de lido
 * por mim.
 *
 * ## O que a divergência quer dizer
 *
 * Esta guarda não manda consertar: manda OLHAR. Se um método acusa e o outro
 * não, um dos dois está errado, e qual deles é a pergunta inteira. A mensagem
 * de falha diz isso, porque "conserte o código" seria a instrução errada na
 * metade dos casos.
 */

const RAIZES = ["src", "supabase/functions"];

/**
 * As divergências conhecidas, com o motivo — e nenhuma outra.
 *
 * O formato é `arquivo` → por quê. Entrar aqui significa: os dois métodos
 * discordam, eu olhei, e o detector por texto é que está errado.
 */
const DIVERGENCIAS_EXPLICADAS: Record<string, string> = {
  "src/pages/app/AdminUsuarios.tsx":
    "as duas chamadas passam a PROMESSA para o helper `executar`, que faz " +
    "`const { error } = await chamada` e mostra o erro em toast. O erro é " +
    "observado uma função adiante, e o detector por texto não atravessa " +
    "fronteira de função — nem vai: `readErrors.test.ts` explica por que não.",
};

const arquivos = arquivosDeCodigo(RAIZES);
const medidas: LeituraMedida[] = arquivos.flatMap((a) => leiturasMedidas(lerFonte(a)));
const porClasse = (c: ClassificacaoDaLeitura) => medidas.filter((m) => m.classificacao === c);

/** O detector por texto, nas duas raízes, como as guardas dele o chamam. */
const porTexto = [
  ...encontrarCegas({ raiz: "src", nomesDoCliente: () => ["supabase"] }),
  ...encontrarCegas({ raiz: "supabase/functions", nomesDoCliente: clientesCriadosNoArquivo }),
];

const soDoArquivo = (lugar: string) => lugar.split(":")[0];

describe("as duas opiniões sobre leitura cega", () => {
  it("pelo AST, nenhuma leitura descarta o `error`", () => {
    const cegas = porClasse("cega");
    expect(
      cegas.map(formatar),
      "\n" + cegas.map(formatar).join("\n") + "\n\n" +
        "Alguém recebe o resultado desta leitura e o `error` não aparece em\n" +
        "lugar nenhum. O cliente do Supabase devolve `{ data: null, error }` sem\n" +
        "lançar, então `data ?? []` transforma recusa de RLS e queda de rede em\n" +
        "lista vazia — e a tela imprime a lista vazia como fato.",
    ).toEqual([]);
  });

  it("nenhuma leitura fica em forma que o detector não sabe ler", () => {
    /**
     * Terceiro estado, relatado em vez de engolido: 0 = certo, acusação =
     * errado, e "não consegui ler" é a terceira coisa, que não pode se
     * disfarçar de zero.
     *
     * A forma que me obrigou a escrever isto foi
     * `void supabase.rpc(…).then(({ error }) => …)` do `PageViewTracker`: o
     * erro É observado, no retorno da promessa. A primeira versão deste
     * detector a classificava como não-classificada, e eu quase a declarei
     * como exceção em vez de ensinar o detector a ler `.then`.
     */
    const obscuras = porClasse("nao-classificada");
    expect(
      obscuras.map(formatar),
      "\n" + obscuras.map(formatar).join("\n") + "\n\n" +
        "Este detector não sabe dizer se o `error` desta leitura é observado.\n" +
        "Não é acusação e não é absolvição: ensine-o a ler esta forma, ou o\n" +
        "zero da regra acima vale só para as formas que ele conhece.",
    ).toEqual([]);
  });

  it("os dois métodos concordam, e toda divergência está explicada", () => {
    const cegasPorAst = new Set(porClasse("cega").map((m) => `${m.arquivo}:${m.linha}`));

    // Acusado pelo texto e não pelo AST.
    const soNoTexto = porTexto.filter((lugar) => {
      if (cegasPorAst.has(lugar)) return false;
      // O número de linha dos dois difere (um aponta a linha do `.select(`, o
      // outro o começo da cadeia), então a comparação é por ARQUIVO. É mais
      // frouxa de propósito: comparar linha a linha produziria divergência
      // sobre a mesma chamada e a guarda viraria ruído.
      return !porClasse("cega").some((m) => m.arquivo === soDoArquivo(lugar));
    });
    const naoExplicadas = soNoTexto.filter((l) => !(soDoArquivo(l) in DIVERGENCIAS_EXPLICADAS));

    expect(
      naoExplicadas,
      "\n" + naoExplicadas.join("\n") + "\n\n" +
        "O detector por TEXTO acusa esta leitura e o detector por AST não.\n" +
        "Um dos dois está errado, e qual é a pergunta inteira:\n\n" +
        "  · se o `error` É observado ali, o detector por texto tem um falso\n" +
        "    positivo — e ele enche a dívida declarada de código correto, o que\n" +
        "    convida a desligar a guarda;\n" +
        "  · se NÃO é observado, o detector por AST tem um falso negativo — e\n" +
        "    aí o zero da primeira regra deste arquivo não vale nada.\n\n" +
        "Olhe a chamada e decida. Se for falso positivo do texto, declare o\n" +
        "arquivo em DIVERGENCIAS_EXPLICADAS dizendo o que observa o erro.",
    ).toEqual([]);

    // E o contrário: acusado pelo AST e não pelo texto.
    const arquivosDoTexto = new Set(porTexto.map(soDoArquivo));
    const soNoAst = porClasse("cega").filter((m) => !arquivosDoTexto.has(m.arquivo));
    expect(
      soNoAst.map(formatar),
      "\n" + soNoAst.map(formatar).join("\n") + "\n\n" +
        "O detector por AST acusa e o por TEXTO não vê. Se a acusação procede,\n" +
        "o detector por texto tem um falso NEGATIVO — e é ele que produz a\n" +
        "`DIVIDA_CONHECIDA` do projeto, que estaria entendida por baixo.",
    ).toEqual([]);
  });

  it("toda divergência declarada ainda é uma divergência", () => {
    // Exceção órfã é permissão que ninguém revisa. Se o detector por texto
    // parar de acusar aquele arquivo, a entrada tem de sair — senão a próxima
    // acusação lá entra de graça.
    for (const [arquivo, motivo] of Object.entries(DIVERGENCIAS_EXPLICADAS)) {
      expect(motivo.length, `a divergência de ${arquivo} não tem motivo escrito`)
        .toBeGreaterThan(40);
      expect(
        porTexto.map(soDoArquivo),
        `${arquivo} está em DIVERGENCIAS_EXPLICADAS, mas o detector por texto ` +
          "não o acusa mais — tire a entrada",
      ).toContain(arquivo);
      expect(
        porClasse("cega").map((m) => m.arquivo),
        `${arquivo} está declarado como falso positivo do texto, mas o AST ` +
          "passou a acusá-lo também — então não é falso positivo",
      ).not.toContain(arquivo);
    }
  });

  it("a dívida declarada em `readErrors.test.ts` bate com a divergência medida", () => {
    /**
     * O fecho do laço. `readErrors.test.ts` carrega `DIVIDA_CONHECIDA = 2` com
     * a prosa "as duas que sobraram são FALSOS POSITIVOS, e ficam". Essa frase
     * era a minha leitura do código; aqui ela passa a ser medida.
     *
     * Se a dívida subir sem que a divergência suba, alguém escreveu uma leitura
     * cega de verdade e a subiu em um para a guarda passar — que é a saída que
     * o próprio `readErrors` diz existir ("quem topar com ele tem uma saída:
     * subir `DIVIDA_CONHECIDA` em um").
     */
    const divida = Number(
      /const DIVIDA_CONHECIDA = (\d+)/.exec(
        readFileSync("src/test/readErrors.test.ts", "utf8"),
      )?.[1] ?? "-1",
    );
    expect(divida, "não achei `DIVIDA_CONHECIDA` em readErrors.test.ts").toBeGreaterThanOrEqual(0);

    const semTolerancia = new Set([
      // A lista SEM_TOLERANCIA do `readErrors` é cobrada lá e não entra na
      // dívida; aqui o que interessa é o resto.
    ]);
    const naDivida = porTexto.filter((l) => !semTolerancia.has(soDoArquivo(l)));

    expect(
      naDivida.length,
      `o detector por texto acusa ${naDivida.length} leituras; ` +
        `DIVIDA_CONHECIDA diz ${divida}. Se o número subiu, confira se a ` +
        "leitura nova é cega de verdade — o AST acusa " +
        `${porClasse("cega").length} — ou se é mais um falso positivo do texto.`,
    ).toBeLessThanOrEqual(divida);

    expect(
      porClasse("cega").length,
      "o AST acusa leituras cegas; a dívida declarada deixou de ser só falso positivo",
    ).toBe(0);
  });
});

describe("o detector por AST, conferido contra material plantado", () => {
  /**
   * A contraprova. Duas das regras acima afirmam zero, e zero é o que um
   * detector quebrado devolve. O material fica em texto, para a varredura do
   * projeto nunca o encontrar.
   */
  const plantar = (codigo: string) => leiturasMedidas(lerFonte("plantado.ts", codigo));
  const classes = (codigo: string) => plantar(codigo).map((m) => m.classificacao);

  it("acusa as formas cegas", () => {
    expect(classes('async function f(){ const { data } = await supabase.from("t").select("id"); return data; }'))
      .toEqual(["cega"]);
    expect(classes('async function f(){ const r = await supabase.rpc("x"); return r.data; }'))
      .toEqual(["cega"]);
    expect(classes(
      'async function f(){ const [{ data: a }, { data: b, error: e }] = ' +
      'await Promise.all([supabase.from("t").select("id"), supabase.from("u").select("id")]); ' +
      'if (e) throw e; return [a, b]; }',
    )).toEqual(["cega", "ok"]);
  });

  it("absolve as formas em que o erro é observado", () => {
    for (const codigo of [
      'async function f(){ const { data, error } = await supabase.from("t").select("id"); if (error) throw error; return data; }',
      'async function f(){ const r = await supabase.from("t").select("id"); if (r.error) throw r.error; return r.data; }',
      'async function f(){ const r = await supabase.rpc("x"); const { error } = r; if (error) throw error; }',
      'function f(){ void supabase.rpc("x").then(({ error }) => { if (error) console.error(error); }); }',
      'async function f(c: boolean){ const { data, error } = c ? await supabase.from("t").select("id") : { data: [], error: null }; if (error) throw error; return data; }',
    ]) {
      expect(classes(codigo), `acusou código correto:\n${codigo}`).not.toContain("cega");
      expect(classes(codigo), `não classificou:\n${codigo}`).not.toContain("nao-classificada");
    }
  });

  it("conta a cadeia uma vez, e não uma por elo", () => {
    // `supabase.from("t").select("id").eq("a",1).order("b").limit(1)` tem cinco
    // chamadas, todas com `select` entre os métodos e `supabase` na raiz. Sem a
    // regra da ponta, cada leitura entrava cinco vezes e o total era ficção.
    const m = plantar(
      'async function f(){ const { data, error } = await supabase.from("t")' +
      '.select("id").eq("a", 1).order("b").limit(1); if (error) throw error; return data; }',
    );
    expect(m).toHaveLength(1);
    expect(m[0].classificacao).toBe("ok");
  });

  it("não confunde escrita com leitura, nem chamada de outro objeto", () => {
    // Escrita é assunto das outras guardas; `.select()` depois de `.update()`
    // é a forma de FAZER a recusa aparecer, não uma leitura.
    expect(plantar('async function f(){ await supabase.from("t").update({ a: 1 }).select("id"); }'))
      .toEqual([]);
    expect(plantar('async function f(){ const { data } = await outro.from("t").select("id"); return data; }'))
      .toEqual([]);
  });

  it("os pisos: a varredura leu o projeto e achou as leituras que existem", () => {
    expect(arquivos.length, "a varredura achou quase nada").toBeGreaterThan(200);
    expect(
      medidas.length,
      `só ${medidas.length} leituras no projeto inteiro — eram 198 (129 em src, ` +
        "69 nas functions) quando esta guarda foi escrita",
    ).toBeGreaterThan(120);
    expect(
      porTexto.length,
      "o detector por TEXTO não acha nada — ele é quem produz a dívida do projeto",
    ).toBeGreaterThan(0);
  });
});
