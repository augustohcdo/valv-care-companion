/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { semComentariosDeCodigo as semComentariosDeTs } from "./semComentariosDeCodigo";
import { statSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
 *
 * ## O vão que ela TINHA, e que custou sete chamadas
 *
 * O detector olha `.from(…).insert/update/upsert/delete`. **`.rpc(…)` ficava
 * fora** — e uma função SQL que faz DML é escrita igual, só por outro caminho.
 *
 * Medido: `log_integration_event` é chamada sete vezes nas edge functions, e
 * **nenhuma das sete recebia o resultado**. Zero de sete. É a trilha que
 * registra qual hospital leu ou gravou dados de qual paciente — a mesma de onde
 * sai a prova em auditoria de LGPD, e a tabela que está fora de toda lista de
 * expurgo desta base justamente porque é tratada como prova.
 *
 * Esta guarda existia, rodava, e passava: o alcance dela não incluía o caminho
 * pelo qual a escrita acontecia. Cobertura não é garantia nem quando a guarda é
 * boa — é garantia só sobre o que ela olha.
 *
 * O bloco "nenhum `.rpc(` descarta o resultado", abaixo, fecha esse vão.
 */

const RAIZ = "supabase/functions";

/**
 * Tira comentários antes de varrer.
 *
 * Esta base já pagou nove vezes por guarda que lê comentário em vez de código,
 * e aqui o risco é concreto: os cabeçalhos das próprias funções CITAM chamadas
 * de RPC para explicar o que fazem.
 */
// `semComentarios` mora em `semComentariosDeCodigo.ts`, pelo PARSER do
// TypeScript. Havia OITO cópias disto no projeto, em duas famílias, e
// nenhuma estava correta: a família regex apaga `//` de dentro de literal de
// texto, e a família varredor quebra em literal de REGEX — `/\\/\\*…\\*\\//g` faz
// ela ler começo de comentário e apagar o resto da linha. Guardas que existem
// para não ler comentário como código não podem ler literal como comentário.

/**
 * Exceções deliberadas. Cada uma precisa de motivo escrito — a regra é a mesma
 * do `writeErrors.test.ts`: se não dá para escrever o motivo, é esquecimento, e
 * não decisão.
 */
/**
 * **Vazia**, e isto é o estado a defender — não um descuido.
 *
 * Havia três isenções, e as três caíram de uma vez quando as escritas foram
 * consertadas. A regra "toda exceção é usada", abaixo, foi quem avisou: ela
 * reprovou dizendo "está em EXCECOES mas não tem mais escrita cega — tire a
 * isenção". Guarda que cobra a limpeza da própria lista de permissões.
 *
 * O raciocínio delas fica registrado, porque ele é o que explica a FORMA do
 * conserto:
 *
 *  · `_shared/logError.ts` — "é o próprio canal de reporte; reportar a falha
 *    dele seria recursão". Verdade, e é por isso que o conserto não chama
 *    `logError` de dentro de `logError`: ele confere as duas escritas, grita no
 *    `console.error` e DEVOLVE se gravou. Quem chama decide — o `report-error`
 *    decide, e responde `{ ok: registrou }` em vez de `{ ok: true }` fixo;
 *
 *  · `fhir-read` e `fhir-ingest` — "só o carimbo `last_used_at`, que ninguém
 *    lê; falha não muda decisão", com a observação de que tratar o erro
 *    exigiria decidir o que fazer, e "recusar a resposta FHIR ao hospital por
 *    causa de um carimbo seria punir o hospital por uma falha nossa de
 *    telemetria". Também verdade — e havia um terceiro caminho que a isenção
 *    não considerou: `console.error`. Não derruba a resposta, não pune ninguém,
 *    e o carimbo velho deixa de envelhecer calado.
 *
 * Acrescentar uma entrada aqui exige escrever o motivo. O que estas três
 * ensinaram é que vale perguntar antes se existe um canal que avisa sem punir.
 */
const EXCECOES: Record<string, string> = {};

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

  it("nenhum `.rpc(` descarta o resultado", () => {
    /**
     * O vão que deixou sete chamadas passarem.
     *
     * Uma função SQL que faz DML é escrita igual a um INSERT, só por outro
     * caminho — e o detector acima não olha `.rpc(`. `log_integration_event`,
     * chamada sete vezes, não era recebida em nenhuma delas.
     *
     * A regra é a forma da chamada: `await x.rpc(` sem atribuição descarta o
     * `{ data, error }` que o cliente devolve. Decidir por PROXIMIDADE não
     * serve, e eu tentei: a primeira medição procurava um `error` nos 150
     * caracteres anteriores e contou o `error` do INSERT logo acima como se
     * fosse a conferência do RPC. Disse "18 de 21 conferem"; o certo era zero
     * de sete. Proximidade não é posse — e o número errado era mais
     * tranquilizador que o certo.
     */
    const arquivos = execFileSync("git", ["ls-files", RAIZ], { encoding: "utf8" })
      .trim().split("\n")
      .filter((f) => f.endsWith(".ts"));

    const descartados: string[] = [];
    let total = 0;
    for (const arquivo of arquivos) {
      const limpo = semComentariosDeTs(readFileSync(arquivo, "utf8"), arquivo);
      for (const m of limpo.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)) {
        total++;
        // A instrução começa depois do último `;` ou `{` de nível de bloco. Se
        // ela contém um `=` antes do `.rpc`, o resultado foi recebido.
        const inicio = Math.max(
          limpo.lastIndexOf(";", m.index),
          limpo.lastIndexOf("{", m.index),
          limpo.lastIndexOf("}", m.index),
        );
        const instrucao = limpo.slice(inicio + 1, m.index);
        if (!instrucao.includes("=")) {
          const linha = limpo.slice(0, m.index).split("\n").length;
          descartados.push(`  · ${arquivo}:${linha} — ${m[1]}`);
        }
      }
    }

    expect(total, "a varredura não achou `.rpc(` nenhum").toBeGreaterThanOrEqual(10);
    expect(
      descartados,
      `\n${descartados.join("\n")}\n\n` +
        "`await x.rpc(…)` sem atribuição descarta o `{ data, error }`. Uma função\n" +
        "SQL que faz DML é escrita igual a um INSERT: se ela recusar, nada entra,\n" +
        "a edge function responde 200 e ninguém sabe.\n\n" +
        "Foi assim que as sete chamadas de `log_integration_event` — a trilha de\n" +
        "onde sai a prova em auditoria de LGPD — ficaram sem conferência nenhuma.\n\n" +
        "Receba o resultado: `const { error } = await admin.rpc(…)`.",
    ).toEqual([]);
  }, 30_000);

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
