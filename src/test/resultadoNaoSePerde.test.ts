/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import ts from "typescript";
import {
  arquivosDeCodigo, lerFonte, errosEngolidos, resultadosDescartados, ehUso, formatar,
} from "./astDeChamadas";

/**
 * O resultado da chamada ao banco não se perde — medido por AST.
 *
 * ## O vão que esta guarda fecha
 *
 * `readErrors.test.ts` declara, por escrito, o limite do detector por texto:
 *
 *   > "O detector cobra que o `error` seja DESESTRUTURADO junto da chamada —
 *   >  observado —, não que alguém faça algo com ele. Tirar a ação e deixar a
 *   >  observação passa."
 *
 * Então `const { data, error } = await supabase.from("x").update(…);` seguido de
 * `return data;`, sem o `error` aparecer nunca mais, passa pelos quatro
 * detectores desta base e pelo lint — `@typescript-eslint/no-unused-vars` está
 * desligado aqui, de propósito, porque "não usado é estilo". Nesta chamada não é
 * estilo: é a diferença entre uma recusa de RLS vista e uma engolida, e o
 * cliente do Supabase devolve recusa em `{ error }` sem lançar nada.
 *
 * ## O que foi medido antes de escrever a guarda
 *
 * Nas 306 desestruturações de `error` em `src/` e `supabase/functions/`:
 * **zero** ficam sem uso. E das chamadas ao cliente, **zero** descartam o
 * resultado por inteiro.
 *
 * Os dois zeros foram conferidos contra material plantado antes de serem
 * acreditados — medidor que acha zero e medidor quebrado se parecem. A
 * contraprova de cada um está abaixo, no `describe` dos detectores, e roda em
 * toda CI: sem ela, esta guarda passaria com o projeto inteiro consertado e com
 * o detector inteiro quebrado.
 *
 * ## Por que vale guardar um zero
 *
 * Porque este é o único zero desta base que nenhuma outra guarda sustenta. As
 * outras quatro medem se o `error` foi desestruturado; esta mede se ele foi
 * OLHADO. Elas continuariam verdes com as 306 viradas em 306 engolidas.
 */

const RAIZES = ["src", "supabase/functions"];

/**
 * Lugares onde o `error` pode ficar sem uso, com o motivo.
 *
 * Vazio, e é o estado a defender. Para acrescentar uma entrada, escreva O QUE
 * observa a falha no lugar do `error` — não "aqui não importa", que é o que
 * esta guarda existe para não deixar passar calado.
 */
const PODEM_ENGOLIR: Record<string, string> = {};

const arquivos = arquivosDeCodigo(RAIZES);
const medida = arquivos.map((a) => {
  const fonte = lerFonte(a);
  const { achados, desestruturacoes } = errosEngolidos(fonte);
  return { arquivo: a, engolidos: achados, desestruturacoes, descartados: resultadosDescartados(fonte) };
});

const engolidos = medida.flatMap((m) => (m.arquivo in PODEM_ENGOLIR ? [] : m.engolidos));
const descartados = medida.flatMap((m) => m.descartados);
const desestruturacoes = medida.reduce((s, m) => s + m.desestruturacoes, 0);

describe("o resultado da chamada ao banco não se perde", () => {
  it("nenhum `error` desestruturado fica sem uso", () => {
    expect(
      engolidos.map(formatar),
      "\n" + engolidos.map(formatar).join("\n") + "\n\n" +
        "Aqui o `error` é desestruturado e nunca mais mencionado. A chamada tem a\n" +
        "CARA de conferida e não confere nada: o cliente do Supabase entrega a\n" +
        "recusa em `{ error }` sem lançar, então o `try/catch` em volta não dispara\n" +
        "e a tela — ou a resposta da função — segue como se tivesse dado certo.\n\n" +
        "Nenhum dos quatro detectores por texto desta base pega isto: todos cobram\n" +
        "a desestruturação, que aqui existe. O lint também não: `no-unused-vars`\n" +
        "está desligado neste repositório.\n\n" +
        "Faça algo com ele — `if (error) throw error`, um toast, um `console.error`\n" +
        "— ou declare o arquivo em PODEM_ENGOLIR dizendo o que observa a falha no\n" +
        "lugar dele.",
    ).toEqual([]);
  });

  it("nenhuma chamada ao cliente descarta o resultado por inteiro", () => {
    expect(
      descartados.map(formatar),
      "\n" + descartados.map(formatar).join("\n") + "\n\n" +
        "`await cliente.…(…);` como statement inteiro joga fora `data` E `error`.\n" +
        "Os detectores por texto já cobram isto; esta medida é a segunda opinião,\n" +
        "por AST, que não se perde em quebra de linha nem em literal com\n" +
        "parêntese — onde os de texto já se perderam nesta base.\n\n" +
        "Se esta regra acusa e as outras não, o defeito pode estar nelas.",
    ).toEqual([]);
  });

  it("toda dispensa aponta para arquivo que existe e que de fato engole", () => {
    // Dispensa órfã é permissão que ninguém revisa, e o próximo `error`
    // engolido no mesmo arquivo entra de graça.
    for (const [arquivo, motivo] of Object.entries(PODEM_ENGOLIR)) {
      expect(() => statSync(arquivo), `PODEM_ENGOLIR aponta para ${arquivo}, que não existe`)
        .not.toThrow();
      expect(motivo.length, `a dispensa de ${arquivo} não tem motivo escrito`).toBeGreaterThan(30);
      const naMedida = medida.find((m) => m.arquivo === arquivo);
      expect(
        naMedida?.engolidos.length ?? 0,
        `${arquivo} está dispensado mas não engole nenhum \`error\` — tire a dispensa`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("os pisos da varredura", () => {
  /**
   * Três pisos, porque esta guarda afirma DOIS zeros, e zero é o que uma
   * varredura quebrada também devolve. Cada piso mata uma forma de o zero ser
   * falso: não achar arquivo, não achar desestruturação, não saber acusar.
   */
  it("a varredura leu o projeto, e não um punhado de arquivos", () => {
    expect(
      arquivos.length,
      `a varredura achou só ${arquivos.length} arquivos em ${RAIZES.join(" e ")} — ` +
        "provavelmente o caminho mudou e ela está olhando quase nada",
    ).toBeGreaterThan(200);
  });

  it("a varredura achou as desestruturações de `error` que existem", () => {
    // Eram 306 quando esta guarda foi escrita. O piso é folgado de propósito:
    // o número exato viraria falso vermelho a cada refactor, e o que importa é
    // que o detector não passou a ler zero.
    expect(
      desestruturacoes,
      `só ${desestruturacoes} desestruturações de \`error\` no projeto inteiro — ` +
        "o detector parou de reconhecer o padrão",
    ).toBeGreaterThan(200);
  });

  it("`src/test/` fica fora da varredura, e isso é deliberado", () => {
    // Os detectores deste diretório carregam material plantado — chamadas que
    // engolem o erro — para provar que acusam. Varrer o material de prova
    // acusaria a prova, e a saída seria desligar a guarda.
    expect(arquivos.filter((a) => a.includes("src/test/"))).toEqual([]);
    // E o contrário: o resto de `src` TEM de estar lá, senão a exclusão virou
    // uma peneira larga sem ninguém notar.
    expect(arquivos.some((a) => a.startsWith("src/pages/"))).toBe(true);
    expect(arquivos.some((a) => a.startsWith("supabase/functions/"))).toBe(true);
  });
});

describe("os dois detectores, conferidos contra material plantado", () => {
  /**
   * A contraprova. Sem ela, as duas regras acima passam com o detector
   * devolvendo lista vazia por estar quebrado — que é o defeito que esta
   * sessão inteira persegue, dentro da própria guarda.
   *
   * O material fica em texto aqui, e não em arquivo no disco, para que a
   * varredura do projeto nunca o encontre.
   */
  const plantar = (codigo: string) => lerFonte("plantado.ts", codigo);

  it("acha o `error` engolido na forma simples e na apelidada", () => {
    const { achados, desestruturacoes: n } = errosEngolidos(plantar(
      'async function f(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").update({ a: 1 });\n' +
      '  return "salvo";\n' +
      '}\n' +
      'async function g(supabase: any) {\n' +
      '  const { data, error: erroSalvar } = await supabase.from("t").insert({ a: 1 });\n' +
      '  return data;\n' +
      '}\n',
    ));
    expect(n, "não reconheceu as duas desestruturações").toBe(2);
    expect(achados.map((a) => a.nome)).toEqual(["error", "erroSalvar"]);
  });

  it("absolve quem olha o erro, nas formas usadas nesta base", () => {
    const { achados } = errosEngolidos(plantar(
      'async function a(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").update({ a: 1 });\n' +
      '  if (error) throw error;\n' +
      '}\n' +
      'async function b(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").insert({ a: 1 });\n' +
      '  if (error) console.error(error.message);\n' +
      '}\n' +
      'async function c(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").delete();\n' +
      '  return { ok: !error };\n' +
      '}\n' +
      'async function d(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").upsert({ a: 1 });\n' +
      '  return { error };\n' +
      '}\n',
    ));
    expect(achados.map(formatar), "acusou quem confere o erro").toEqual([]);
  });

  it("não aceita homônimo como uso", () => {
    // `return { error: null }` é chave de objeto, e foi o caso que me fez
    // escrever `ehUso`: contar identificadores por nome absolveria esta
    // função, que engole a recusa e DEVOLVE que não houve erro.
    const { achados } = errosEngolidos(plantar(
      'async function f(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").insert({ a: 1 });\n' +
      '  return { error: null };\n' +
      '}\n' +
      'async function g(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").insert({ a: 1 });\n' +
      '  const resposta = { data: 1 };\n' +
      '  return resposta.error;\n' +
      '}\n',
    ));
    expect(achados.length, "homônimo passou por uso").toBe(2);
  });

  it("`ehUso` separa uso de homonímia nas quatro posições", () => {
    // Cobrado direto, e não só pelo total: as quatro negativas são a peça em
    // que este detector se distingue de contar palavras, e um teste do total
    // passaria com três delas.
    const olhar = (codigo: string, procurado: string) => {
      const achados: boolean[] = [];
      const anda = (no: ts.Node) => {
        if (ts.isIdentifier(no) && no.text === procurado) achados.push(ehUso(no));
        ts.forEachChild(no, anda);
      };
      anda(plantar(codigo));
      return achados;
    };
    // `{ error: null }` → chave, não uso.
    expect(olhar("const x = { error: null };", "error")).toEqual([false]);
    // `outro.error` → propriedade de outro objeto, não uso.
    expect(olhar("const y = outro.error;", "error")).toEqual([false]);
    // `error.message` → o próprio `error` é lido: uso.
    expect(olhar("f(error.message);", "error")).toEqual([true]);
    // `{ error }` abreviado → repassar é tratar: uso.
    expect(olhar("const z = { error };", "error")).toEqual([true]);
  });

  it("acha o resultado descartado, inclusive quebrado em linhas e com `void`", () => {
    const achados = resultadosDescartados(plantar(
      'async function f(supabase: any, admin: any) {\n' +
      '  await supabase.from("t").update({ a: 1 }).eq("id", 1);\n' +
      '  await admin.rpc("log_integration_event", { x: 1 });\n' +
      '  void await supabase.storage.from("b").remove(["p"]);\n' +
      '  await admin.auth.admin.signOut("tok", "global");\n' +
      '  await supabase\n' +
      '    .from("t")\n' +
      '    .delete()\n' +
      '    .eq("id", 2);\n' +
      '}\n',
    ));
    expect(achados.length, "perdeu alguma das cinco formas de descarte").toBe(5);
  });

  it("não acusa quem recebe o resultado, nem chamada que não é do cliente", () => {
    const achados = resultadosDescartados(plantar(
      'async function f(supabase: any) {\n' +
      '  const { error } = await supabase.from("t").insert({ a: 1 });\n' +
      '  if (error) throw error;\n' +
      '  await fetch("https://exemplo.invalid");\n' +
      '  await alguemOutro.from("t").update({ a: 1 });\n' +
      '}\n',
    ));
    expect(achados.map(formatar), "acusou chamada que não é do cliente").toEqual([]);
  });
});
