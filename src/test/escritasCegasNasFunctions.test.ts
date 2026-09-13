/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import { encontrarEscritasCegas, clientesCriadosNoArquivo } from "./detectorDeChamadasCegas";

/**
 * As ESCRITAS das edge functions — o vão gêmeo do das leituras.
 *
 * ## O mesmo `RAIZ = "src"`, do outro lado
 *
 * `writeErrors.test.ts` varre `src` e exige zero desde sempre. As vinte edge
 * functions ficaram de fora dele exatamente como ficaram de fora da varredura
 * de leitura — mesma linha, mesmo esquecimento, um arquivo ao lado.
 *
 * Quando esta varredura rodou pela primeira vez: **14 escritas cegas**.
 *
 * ## Por que a regra aqui é mais dura que a de `src`
 *
 * O detector de `src` só acusa a escrita cega quando ela vem junto de um
 * `toast.success` ou de um `logAudit` — porque numa tela, uma escrita que falha
 * sem anunciar nada ainda deixa a lista sem o item, e alguém percebe.
 *
 * No servidor não existe esse alguém. A função responde 200 e a história acaba
 * ali. Das catorze, **oito não anunciavam sucesso de forma reconhecível** — e
 * eram as piores:
 *
 *   · `access-decide` gravava a conta e o registro de médico (esse, conferido),
 *     mandava o e-mail "seu acesso foi aprovado", e então tentava gravar o
 *     PAPEL de médico sem olhar o resultado. Sem o papel, a pessoa define a
 *     senha, entra, e o `ProtectedRoute` a barra: aprovada no papel, barrada na
 *     porta, e ninguém dos dois lados entende por quê;
 *   · na mesma função, o consentimento de listagem no diretório. O comentário
 *     logo acima dele já dizia que "é lá que um pedido de LGPD vai procurar" —
 *     e a escrita não era conferida. A pessoa passaria a aparecer no diretório
 *     sem que existisse registro de que concordou, com o ônus da prova do
 *     consentimento sendo do controlador (art. 8º, §2º);
 *   · e o `status` do próprio pedido, que é o que faz a guarda de duplicidade
 *     funcionar: falhando calado, o pedido fica PENDENTE e a próxima aprovação
 *     refaz tudo, com segundo e-mail e segundo link de senha.
 *
 * Exigir anúncio de sucesso teria deixado passar a maioria. A regra é: escreveu
 * e não olhou o erro, entra.
 *
 * ## E o que ESTA guarda não prova
 *
 * O mesmo limite da varredura de leitura, e vale repetir porque é fácil
 * confundir cobertura com garantia: ela cobra que o `error` seja OBSERVADO, não
 * que a função faça a coisa certa com ele. É o piso.
 */

const RAIZ = "supabase/functions";

/**
 * Exceções deliberadas. Cada uma precisa de motivo escrito — a regra é a mesma
 * do `writeErrors.test.ts`: se não dá para escrever o motivo, é esquecimento, e
 * não decisão.
 */
const EXCECOES: Record<string, string> = {
  // O registrador de erros não pode reportar a própria falha: ele é quem as
  // outras funções chamam PARA reportar. Se falhar ao gravar, não há canal —
  // chamar a si mesmo em cima de uma falha sua é laço, não tratamento. Ele já
  // roda dentro de try/catch e nunca lança para quem chamou.
  "supabase/functions/_shared/logError.ts":
    "é o próprio canal de reporte; reportar a falha dele seria recursão",

  // `hospital_api_keys.last_used_at` é carimbo de uso, escrito depois de a
  // resposta já estar formada. Conferido: NADA lê essa coluna hoje — nem tela,
  // nem função, nem migration. Uma falha aqui deixa o carimbo velho e não muda
  // decisão nenhuma.
  //
  // Fica como exceção, e não como conserto, porque tratar o erro exigiria
  // decidir o que fazer com ele — e não há nada sensato a fazer: recusar a
  // resposta FHIR ao hospital por causa de um carimbo seria punir o hospital
  // por uma falha nossa de telemetria. Se um dia alguém passar a ler a coluna
  // para revogar chave ociosa, esta isenção precisa cair junto.
  "supabase/functions/fhir-read/index.ts":
    "só o carimbo last_used_at, que ninguém lê; falha não muda decisão",
  "supabase/functions/fhir-ingest/index.ts":
    "só o carimbo last_used_at, que ninguém lê; falha não muda decisão",
};

const cegas = encontrarEscritasCegas({ raiz: RAIZ, nomesDoCliente: clientesCriadosNoArquivo });
const foraDasExcecoes = cegas.filter((c) => !(c.split(":")[0] in EXCECOES));

describe("escritas cegas nas edge functions", () => {
  it("nenhuma escreve sem observar o erro, fora das exceções declaradas", () => {
    expect(
      foraDasExcecoes,
      `\n${foraDasExcecoes.join("\n")}\n\n` +
        "No servidor não há tela para mostrar que a escrita falhou nem alguém para\n" +
        "recarregar: a função responde 200 e acabou. Observe o `error` e faça a\n" +
        "resposta refletir o que de fato persistiu.\n\n" +
        "Se a escrita PODE falhar em silêncio de propósito, ponha o arquivo em\n" +
        "EXCECOES com o motivo escrito — motivo que não se consegue escrever é\n" +
        "esquecimento disfarçado de decisão.",
    ).toEqual([]);
  });

  it("as exceções apontam para arquivos que existem", () => {
    // Sem isto, renomear um arquivo deixaria a isenção órfã e silenciosa: ela
    // continuaria "valendo" para um caminho que não existe mais, enquanto o
    // arquivo novo entraria sem ninguém notar.
    for (const caminho of Object.keys(EXCECOES)) {
      expect(() => statSync(caminho), `EXCECOES aponta para ${caminho}`).not.toThrow();
    }
  });

  it("toda exceção é usada — isenção que não isenta nada é lixo acumulando", () => {
    // Quando uma escrita isenta é consertada, a isenção precisa SAIR. Senão a
    // lista vira um cemitério de permissões que ninguém revisa, e a próxima
    // escrita cega no mesmo arquivo entra de graça.
    const arquivosComCega = new Set(cegas.map((c) => c.split(":")[0]));
    for (const caminho of Object.keys(EXCECOES)) {
      expect(
        arquivosComCega.has(caminho),
        `${caminho} está em EXCECOES mas não tem mais escrita cega — tire a isenção`,
      ).toBe(true);
    }
  });

  it("a varredura ainda enxerga escrita cega de verdade", () => {
    // A contraprova. Com o número em zero fora das exceções, o teste de cima
    // passa tanto com o servidor limpo quanto com o detector quebrado.
    const texto = [
      'const admin = createClient(URL, KEY);',
      'await admin.from("audit_logs").insert({ action: "x" });',
      'return json({ ok: true });',
    ].join("\n");
    const { mkdtempSync, writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    const { tmpdir } = require("node:os") as typeof import("node:os");
    const { join } = require("node:path") as typeof import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "escritas-"));
    try {
      writeFileSync(join(dir, "index.ts"), texto);
      const achadas = encontrarEscritasCegas({
        raiz: dir, nomesDoCliente: clientesCriadosNoArquivo,
      });
      expect(
        achadas.length,
        "a varredura não achou uma escrita cega evidente — o detector quebrou",
      ).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("não acusa a escrita que OBSERVA o erro", () => {
    // O outro lado do detector: um falso positivo aqui encheria a lista de
    // exceções com código correto, que é como uma guarda acaba desligada.
    const texto = [
      'const admin = createClient(URL, KEY);',
      'const { error } = await admin.from("audit_logs").insert({ action: "x" });',
      'if (error) console.error(error.message);',
    ].join("\n");
    const { mkdtempSync, writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    const { tmpdir } = require("node:os") as typeof import("node:os");
    const { join } = require("node:path") as typeof import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "escritas-ok-"));
    try {
      writeFileSync(join(dir, "index.ts"), texto);
      expect(
        encontrarEscritasCegas({ raiz: dir, nomesDoCliente: clientesCriadosNoArquivo }),
        "acusou uma escrita que confere o erro",
      ).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
