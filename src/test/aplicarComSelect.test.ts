// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Toda escrita que passa por `aplicar()` encadeia `.select(...)`.
 *
 * ## O buraco que o próprio helper documentava
 *
 * `aplicar()` existe porque dez lugares desta base ignoravam o retorno da
 * escrita e emendavam direto no `toast.success` — e, pior, no `logAudit`. Ele
 * trata as DUAS formas de falhar, e a segunda é a que ninguém espera: quando a
 * RLS recusa um UPDATE ou DELETE, o PostgREST responde **200 com `error: null`
 * e zero linhas**. Para ele, alterar nada é sucesso.
 *
 * Só que o helper só enxerga essas zero linhas se o chamador tiver pedido
 * `.select(...)`. Sem isso o `data` vem `undefined`, e o comentário dele diz o
 * que acontece então, com todas as letras:
 *
 *   > "`data` só é undefined quando o chamador não pediu `.select(...)`. Nesse
 *   >  caso não dá para saber quantas linhas mudaram, e o helper não inventa —
 *   >  **segue como sucesso**, que é o que o `error: null` diz."
 *
 * Honesto da parte dele, e é exatamente o ponto: a garantia dependia de cada
 * chamador lembrar. **Cinco não lembravam** — dois `delete` e três `insert`, em
 * `AdminArquivos` e `AdminBiblioteca`. Numa recusa de RLS, o administrador lia
 * "Arquivo removido" com a linha intacta no banco.
 *
 * ## Por que o teste tira os comentários antes de olhar
 *
 * Porque a primeira medição que eu fiz acusou o `CaseTimeline`, que está
 * correto nas três chamadas — o que ela pegou foi a MENÇÃO a `aplicar()` dentro
 * de um comentário que explica por que o `.select` está ali. Guarda que casa
 * com a palavra pune quem documentou a regra, e este repositório já pagou esse
 * preço meia dúzia de vezes.
 *
 * (A mesma medição, antes disso, acusou 21 de 28 — porque eu cortava o
 * argumento no primeiro `{`, que é justamente o objeto do `.update({...})`, e
 * escondia o `.select` que vinha depois. Parser que não equilibra delimitadores
 * não lê código: lê texto.)
 */

const RAIZ = "src";
const HELPER = "src/lib/mutate.ts";
const IGNORAR = new Set(["node_modules", "dist", "coverage"]);

function varrer(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrer(full, out);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
}

/** Tira comentários de linha e de bloco, preservando o tamanho das strings. */
export function semComentarios(texto: string): string {
  let fora = "";
  let i = 0;
  let aspa: string | null = null;
  while (i < texto.length) {
    const c = texto[i];
    const prox = texto[i + 1];
    if (aspa) {
      if (c === "\\") { fora += texto.slice(i, i + 2); i += 2; continue; }
      if (c === aspa) aspa = null;
      fora += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { aspa = c; fora += c; i++; continue; }
    if (c === "/" && prox === "/") { while (i < texto.length && texto[i] !== "\n") i++; continue; }
    if (c === "/" && prox === "*") {
      i += 2;
      while (i < texto.length && !(texto[i] === "*" && texto[i + 1] === "/")) i++;
      i += 2; continue;
    }
    fora += c; i++;
  }
  return fora;
}

/**
 * O PRIMEIRO argumento de cada `aplicar(...)` — equilibrando `()`, `{}`, `[]` e
 * aspas até a vírgula de nível zero. É o encadeamento da escrita; o segundo
 * argumento é o objeto de mensagens e não interessa aqui.
 */
export function escritasPassadasParaAplicar(texto: string): string[] {
  const limpo = semComentarios(texto);
  const achadas: string[] = [];
  let busca = 0;
  while (true) {
    const k = limpo.indexOf("aplicar(", busca);
    if (k < 0) break;
    busca = k + 8;
    // `function aplicar(` é a definição, não uma chamada.
    if (/\bfunction\s+$/.test(limpo.slice(Math.max(0, k - 20), k))) continue;

    let nivel = 0;
    let i = k + 8;
    let aspa: string | null = null;
    for (; i < limpo.length; i++) {
      const c = limpo[i];
      if (aspa) {
        if (c === "\\") { i++; continue; }
        if (c === aspa) aspa = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { aspa = c; continue; }
      if ("({[".includes(c)) nivel++;
      else if (")}]".includes(c)) { if (nivel === 0) break; nivel--; }
      else if (c === "," && nivel === 0) break;
    }
    achadas.push(limpo.slice(k + 8, i));
  }
  return achadas;
}

const arquivos = varrer(RAIZ).filter((f) => f !== HELPER);

describe("as escritas que passam por aplicar()", () => {
  it("existem escritas para conferir", () => {
    // Sem isto, renomear o helper deixaria zero iterações e o teste abaixo
    // passaria por não ter olhado nada.
    const total = arquivos.reduce(
      (n, f) => n + escritasPassadasParaAplicar(readFileSync(f, "utf8")).length,
      0,
    );
    expect(total, "nenhuma chamada a aplicar() encontrada em src").toBeGreaterThan(10);
  });

  it("todas encadeiam .select(...)", () => {
    const sem: string[] = [];
    for (const arquivo of arquivos) {
      for (const escrita of escritasPassadasParaAplicar(readFileSync(arquivo, "utf8"))) {
        if (!/\.select\(/.test(escrita)) {
          sem.push(`  · ${arquivo} — ${escrita.replace(/\s+/g, " ").trim().slice(0, 100)}`);
        }
      }
    }

    expect(
      sem,
      `\n${sem.join("\n")}\n\n` +
        "Sem `.select(...)`, o `aplicar()` não recebe as linhas afetadas e NÃO\n" +
        "consegue ver o caso em que a RLS recusa: o PostgREST responde 200 com\n" +
        "`error: null` e zero linhas, e a tela anuncia sucesso sobre uma escrita\n" +
        "que não aconteceu — com `logAudit` em seguida, afirmando na trilha de\n" +
        "conformidade um fato que não ocorreu.\n\n" +
        "Encadeie `.select(\"id\")` no fim da operação.",
    ).toEqual([]);
  });

  it("o helper continua tratando as duas formas de falhar", () => {
    // A regra acima só vale porque o helper faz alguma coisa com as zero linhas.
    // Se ele parar de olhar o `data`, todo `.select` do repositório vira enfeite.
    const helper = readFileSync(HELPER, "utf8");
    expect(helper, "o helper não confere mais o `error`").toMatch(/if \(error\)/);
    expect(
      helper,
      "o helper não trata mais a lista vazia — é o caso da RLS recusando com 200",
    ).toMatch(/Array\.isArray\(data\) && data\.length === 0/);
  });

  /**
   * E o nível de fora: escrita que anuncia sucesso SEM passar pelo helper.
   *
   * O `.select` obrigatório acima só vale para quem já usa `aplicar()`. Havia
   * dezessete UPDATE/DELETE/UPSERT que nem passavam por ele — conferiam só o
   * `error` e emendavam no `toast.success`, às vezes com `logAudit` junto. Para
   * a recusa de RLS, que chega como 200 com zero linhas, isso é sucesso.
   *
   * Os piores três, e é por eles que esta regra existe:
   *
   *   · `CasoDetalhe` gravava `case_updated` na trilha de auditoria sobre um
   *     caso que não mudou — a trilha afirmando o que não aconteceu;
   *   · `AdminDPO` gravava `dpo_status_updated` sobre um pedido de titular que
   *     seguia no status antigo, com os prazos do art. 18 correndo;
   *   · `PacienteIntegracoes` dizia "Acesso revogado." com a concessão viva — o
   *     paciente acreditando que o hospital perdeu acesso aos dados dele.
   *
   * O décimo sétimo só apareceu quando ESTA regra rodou: a promoção do rascunho
   * a caso clínico, em `NovoCaso`. Minha contagem à mão tinha parado em
   * dezesseis porque a janela que eu usei não alcançava o `toast.success`, vinte
   * linhas abaixo. Contagem à mão erra; regra que roda, não.
   *
   * A regra é a mesma do outro lado da moeda: quem ANUNCIA sucesso precisa ter
   * olhado as linhas. Por `aplicar()` ou conferindo na mão; o caminho não
   * importa, a garantia sim.
   */
  it("nenhuma escrita anuncia sucesso sem ter olhado as linhas", () => {
    // Ancorado no encadeamento do Supabase, e não no nome do método: `.delete(`
    // sozinho casa com `Set.prototype.delete`, e foi o que a versão anterior
    // acusou no `CaseLaudoReader` — um `proximo.delete(key)` num Set.
    //
    // E a janela é larga (1500) porque a estreita tinha o defeito oposto: ao
    // reformatar uma escrita em várias linhas, o `toast.success` saía dela e o
    // site deixava de ser CONFERIDO, em vez de passar conferido. Guarda que
    // perde o alvo quando alguém quebra a linha não guarda nada.
    //
    // Com as duas correções: 46 escritas do Supabase varridas, 0 acusadas.
    const MUTACAO =
      /\bsupabase\s*(?:\.\w+)*\.from\(\s*"[^"]+"\s*\)\s*\.(update|delete|upsert)\s*\(/gs;
    const JANELA = 1500;
    const culpadas: string[] = [];

    for (const arquivo of arquivos) {
      const limpo = semComentarios(readFileSync(arquivo, "utf8"));
      for (const m of limpo.matchAll(MUTACAO)) {
        const antes = limpo.slice(Math.max(0, m.index! - 300), m.index!);
        // dentro de um `aplicar(...)`? então a regra de cima já cobre.
        const dentroDeAplicar =
          antes.includes("aplicar(") &&
          antes.lastIndexOf("aplicar(") > Math.max(antes.lastIndexOf(";"), antes.lastIndexOf("}"));
        if (dentroDeAplicar) continue;

        const depois = limpo.slice(m.index! + m[0].length, m.index! + m[0].length + JANELA);
        const anuncia = depois.includes("toast.success") || depois.includes("logAudit(");
        if (!anuncia) continue;

        const janela = limpo.slice(m.index!, m.index! + m[0].length + JANELA);
        const olhouAsLinhas = janela.includes(".select(") && /\blength\b/.test(janela);
        if (olhouAsLinhas) continue;

        const linha = limpo.slice(0, m.index!).split("\n").length;
        culpadas.push(`  · ${arquivo}:${linha}`);
      }
    }

    expect(
      culpadas,
      `\n${culpadas.join("\n")}\n\n` +
        "Esta escrita anuncia sucesso — `toast.success` ou `logAudit` logo depois —\n" +
        "sem ter olhado quantas linhas mudaram.\n\n" +
        "Quando a RLS recusa um UPDATE ou DELETE, o PostgREST devolve 200 com\n" +
        "`error: null` e ZERO linhas: conferir só o `error` lê isso como sucesso.\n" +
        "Com `logAudit` em seguida, a trilha de conformidade passa a afirmar um\n" +
        "fato que não ocorreu — e quem for lê-la depois não tem como saber quais\n" +
        "linhas valem.\n\n" +
        "Passe por `aplicar(<escrita>.select(\"id\"), { sucesso, falha })`.",
    ).toEqual([]);
  });

  it("o detector não confunde menção em comentário com chamada", () => {
    // A contraprova, e o falso vermelho que ela evita: o `CaseTimeline` explica
    // num comentário por que usa `aplicar()`, e a primeira medição o acusou.
    const comComentario = [
      "// a escrita passa por `aplicar()`: uma recusa de RLS devolve 200",
      '/* exemplo: aplicar(supabase.from("x").update({}), { … }) */',
      'const ok = await aplicar(supabase.from("x").update({ a: 1 }).eq("id", i).select("id"), m);',
    ].join("\n");
    expect(
      escritasPassadasParaAplicar(comComentario),
      "contou a menção em comentário como chamada",
    ).toHaveLength(1);

    // E o outro lado: uma chamada de verdade sem `.select` tem de ser vista.
    const semSelect = 'await aplicar(supabase.from("x").delete().eq("id", i), { sucesso: "a", falha: "b" });';
    const achadas = escritasPassadasParaAplicar(semSelect);
    expect(achadas).toHaveLength(1);
    expect(/\.select\(/.test(achadas[0]), "não viu a falta do .select").toBe(false);
  });

  it("não confunde Set.delete com escrita no banco", () => {
    // O falso positivo que a janela larga revelou: `proximo.delete(key)` num
    // `Set`, no `CaseLaudoReader`, com um `logAudit` legítimo mais abaixo na
    // mesma função. Sem a âncora no `supabase.from(...)`, a guarda mandava
    // conferir linhas de uma estrutura de dados em memória.
    const MUTACAO =
      /\bsupabase\s*(?:\.\w+)*\.from\(\s*"[^"]+"\s*\)\s*\.(update|delete|upsert)\s*\(/gs;
    const doSet = "const proximo = new Set(antes); proximo.delete(key); logAudit('x', 'y', 'z');";
    expect([...doSet.matchAll(MUTACAO)], "confundiu Set.delete com escrita").toHaveLength(0);

    const doBanco = 'await supabase.from("clinical_cases").delete().eq("id", i); toast.success("ok");';
    expect([...doBanco.matchAll(MUTACAO)], "não viu a escrita de verdade").toHaveLength(1);
  });

  it("o detector equilibra as chaves do objeto escrito", () => {
    // O erro que me deu 21 de 28 na primeira medição: cortar o argumento no
    // primeiro `{` esconde o `.select` que vem DEPOIS do objeto do update.
    const multilinha = [
      "await aplicar(",
      '  supabase.from("x").update({',
      "    campo: 1,",
      "    outro: { aninhado: true },",
      '  }).eq("id", i).select("id"),',
      '  { sucesso: "a", falha: "b" },',
      ");",
    ].join("\n");
    const [escrita] = escritasPassadasParaAplicar(multilinha);
    expect(escrita, "não chegou até o fim do encadeamento").toContain('.select("id")');
    expect(escrita, "invadiu o segundo argumento").not.toContain("sucesso");
  });
});
