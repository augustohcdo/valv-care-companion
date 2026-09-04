// Este teste roda o gerador e lê o disco; daí a referência a `node`.
/// <reference types="node" />
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clinicalLibrary } from "@/data/clinicalLibrary";

/**
 * A página de revisão da biblioteca é gerada, e este teste RODA o gerador.
 *
 * ## Por que não basta ler o script
 *
 * A promessa da página é: "nada aqui foi redigitado — as duas colunas saem do
 * repositório". Um guarda que lesse `gerar-revisao-biblioteca.mjs` procurando a
 * palavra `clinicalLibrary` diria que a promessa vale, e continuaria dizendo
 * isso se o script passasse a emitir texto fixo com o import ainda no topo. É a
 * armadilha que esta sessão persegue: a verificação que confere o arquivo em
 * vez da coisa.
 *
 * Então o teste executa o gerador de verdade, num arquivo temporário, e exige
 * que a saída contenha afirmações lidas de `clinicalLibrary` EM TEMPO DE
 * EXECUÇÃO. Mudou o texto no arquivo de dados e a página não mudou junto? O
 * teste reprova.
 *
 * São ~3 segundos, porque o gerador transpila as duas versões do arquivo. Vale:
 * é a única forma de a promessa da página ser verificada em vez de declarada.
 */

const escapado = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const desescapado = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

let html = "";
let tmp = "";

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "revisao-teste-"));
  const arquivo = join(tmp, "saida.html");
  try {
    execFileSync("node", ["scripts/gerar-revisao-biblioteca.mjs", "--saida", arquivo], {
      stdio: "pipe",
    });
  } catch (e) {
    // A causa mais provável de falhar aqui e não localmente é clone RASO: o
    // gerador lê a versão anterior da biblioteca com `git show <commit>:…`, e
    // `actions/checkout` traz só o commit da ponta por padrão. O `ci.yml` pede
    // `fetch-depth: 0` por causa disto — se alguém tirar, a mensagem tem de
    // dizer o que houve, em vez de "comando falhou".
    // O erro ORIGINAL é reemitido, com a mensagem enriquecida — em vez de um
    // `new Error` que engoliria a causa. A explicação abaixo é o palpite mais
    // provável, não a única causa possível: quem cair numa das outras precisa
    // continuar vendo o que o gerador realmente disse.
    const erro = e as Error & { stderr?: Buffer };
    const saida = erro.stderr?.toString().trim();
    erro.message =
      `O gerador da revisão não rodou.\n${saida || erro.message}\n` +
      "Se isto é a CI: confira `fetch-depth: 0` no checkout — sem histórico, " +
      "o `git show` do commit anterior não existe.";
    throw erro;
  }
  html = readFileSync(arquivo, "utf8");
}, 60_000);

describe("a página de revisão da biblioteca", () => {
  it("é gerada sem erro e tem corpo", () => {
    expect(html.length, "saída vazia").toBeGreaterThan(5000);
    expect(html).toContain("<title>Revisão da Biblioteca Clínica</title>");
  });

  it("toda afirmação impressa como atual existe, palavra por palavra, no código", () => {
    // A primeira versão deste teste cobrava a presença do PRIMEIRO keyPoint de
    // cada tópico, e reprovou — corretamente, e contra mim: a revisão mostra o
    // que MUDOU, e "Tríade clássica: dispneia, angina e síncope" não mudou. O
    // teste estava errado, não o gerador.
    //
    // A exigência certa é a inversa, e é mais forte: tudo o que a página
    // imprime sob "Diz agora" tem de estar hoje em `clinicalLibrary`, idêntico.
    // Um gerador que emitisse texto fixo, ou que "melhorasse" a redação ao
    // imprimir, reprova aqui — e é exatamente esse o risco de uma página que o
    // médico vai aprovar achando que aprova o que o aplicativo mostra.
    const atuais = new Set(
      clinicalLibrary.flatMap((t) => [
        ...t.keyPoints,
        ...t.sections.flatMap((s) => [s.body, ...(s.bullets ?? [])]),
      ]),
    );
    const impressas = [...html.matchAll(/<div class="bloco entrou">[\s\S]*?<\/ul>/g)].flatMap((b) =>
      [...b[0].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => desescapado(m[1])),
    );
    expect(impressas.length, "a página não imprimiu nenhuma afirmação nova").toBeGreaterThan(5);
    const inventadas = impressas.filter((f) => !atuais.has(f));
    expect(inventadas, "a página imprime como atual um texto que não está em clinicalLibrary")
      .toEqual([]);
  });

  it("as afirmações retiradas NÃO estão mais no código", () => {
    // O outro lado: o bloco "Dizia antes" tem de conter só texto que saiu. Se
    // uma frase ainda vigente aparecesse ali, a revisão sugeriria ao médico que
    // a corrigimos quando não corrigimos.
    const atuais = new Set(
      clinicalLibrary.flatMap((t) => [
        ...t.keyPoints,
        ...t.sections.flatMap((s) => [s.body, ...(s.bullets ?? [])]),
      ]),
    );
    const retiradas = [...html.matchAll(/<div class="bloco saiu">[\s\S]*?<\/ul>/g)].flatMap((b) =>
      [...b[0].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => desescapado(m[1])),
    );
    expect(retiradas.length).toBeGreaterThan(3);
    expect(
      retiradas.filter((f) => atuais.has(f)),
      "texto listado como retirado que continua vigente na biblioteca",
    ).toEqual([]);
  });

  it("traz cada tópico da biblioteca, pelo título atual", () => {
    for (const topico of clinicalLibrary) {
      expect(html, `tópico ausente na revisão: ${topico.slug}`).toContain(escapado(topico.shortTitle));
    }
  });

  it("leva o revisor ao PubMed onde existe PMID", () => {
    // A referência sem link tem `nota` dizendo por quê — a página imprime a
    // nota no lugar do link, e não deixa o vazio passar por esquecimento.
    const comUrl = clinicalLibrary.flatMap((t) => t.references).filter((r) => r.url);
    expect(comUrl.length).toBeGreaterThan(10);
    for (const r of comUrl.slice(0, 8)) {
      expect(html, `referência sem link na página: ${r.citacao.slice(0, 40)}`).toContain(r.url!);
    }
    const semUrl = clinicalLibrary.flatMap((t) => t.references).filter((r) => !r.url);
    for (const r of semUrl) {
      expect(r.nota, `referência sem URL e sem nota: ${r.citacao.slice(0, 40)}`).toBeTruthy();
      expect(html).toContain(escapado(r.nota!));
    }
  });

  it("mostra a afirmação de 2021 que foi retirada, e não só a nova", () => {
    // O ponto da revisão é o CONTRASTE. Uma página que só listasse o texto
    // atual não permitiria conferir a correção — e a correção era o assunto:
    // "FEVE ≤ 55% → cirurgia" era falso em 2025, e o revisor precisa vê-la
    // escrita para reconhecer o que mudou.
    expect(html).toContain("Dizia antes");
    expect(html).toMatch(/FEVE ≤ 55%/);
    expect(html).toContain("Diz agora");
  });

  it("não afirma que a revisão médica já aconteceu", () => {
    // Marcar conteúdo como revisado por médico exige administrador com CRM
    // verificado no banco. A página é o material da leitura, não o ato — e
    // dizer o contrário seria fabricar autoridade clínica, que é a linha que
    // este projeto não cruza.
    //
    // A regra é sobre a AFIRMAÇÃO, não sobre a palavra: o rodapé precisa poder
    // dizer que a página *não* marca nada como revisado. Um teste que barrasse
    // o termo barraria o próprio aviso — e reprovou, na primeira versão, por
    // isso mesmo.
    expect(html, "a página se declara revisada ou aprovada")
      .not.toMatch(/\b(foi|está|conteúdo) (revisad|aprovad)\w*\b/i);
    expect(html, "a página não dispensa o selo de revisão médica de verdade")
      .toMatch(/não marca nada como "revisado por médico"/);
  });

  it("o gerador recusa em vez de entregar página vazia", () => {
    // Saída 2 = NÃO GEROU, a mesma convenção de `mobile.mjs` e `migrations`.
    // Apontar para um commit que não existe tem de falhar, não produzir um
    // arquivo com "0 tópicos alterados" que passaria por revisão em dia.
    let codigo = 0;
    try {
      execFileSync("node", ["scripts/gerar-revisao-biblioteca.mjs", "--saida", join(tmp, "nao.html")], {
        stdio: "pipe",
        env: { ...process.env, GIT_DIR: join(tmp, "sem-repo") },
      });
    } catch (e) {
      codigo = (e as { status?: number }).status ?? 0;
    }
    expect(codigo, "gerador não recusou quando não conseguiu ler a versão anterior").toBe(2);
  });

  it("limpa o que criou", () => {
    rmSync(tmp, { recursive: true, force: true });
    expect(true).toBe(true);
  });
});
