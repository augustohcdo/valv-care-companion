/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import { encontrarCegas, clientesCriadosNoArquivo } from "./detectorDeLeituraCega";

/**
 * A mesma varredura de `readErrors.test.ts`, do lado do servidor.
 *
 * ## O vão que isto fecha
 *
 * `readErrors.test.ts` varre `src`. As vinte edge functions nunca foram
 * medidas por nada — nem por esta guarda, nem por lint com regra de tipo, nem
 * por teste. O `deno check` confere tipos e não tem opinião sobre erro
 * descartado.
 *
 * E é do lado do servidor que a leitura cega é pior. Na tela, a falha aparece
 * para alguém que pode recarregar. Numa função, ela sai em **200 OK** com um
 * corpo que parece completo, e quem chamou relata sucesso: o documento de LGPD
 * é entregue ao titular, o vigia grava "nenhum problema", o e-mail semanal diz
 * que está tudo em dia. Ninguém recarrega nada, porque ninguém viu falha.
 *
 * Quando esta varredura rodou pela primeira vez: **54 leituras cegas**.
 *
 * ## Por que o cliente não é procurado pelo nome "supabase"
 *
 * Porque ele quase nunca se chama assim aqui: é `admin` em quinze lugares,
 * `userClient` em três, `adminDoc` em um. Uma varredura que procurasse a
 * palavra "supabase" acharia menos da metade e devolveria um número baixo e
 * tranquilizador.
 *
 * Esse erro — guardar o vocabulário em vez da coisa — já apareceu duas vezes
 * nesta sessão: a guarda da plataforma antiga casava com o NOME dela e deixava
 * passar a referência crua do projeto, que é o que de fato acoplava; a do selo
 * de revisão casava com `'reviewed'` em qualquer lugar e acusava um `WHERE` que
 * não escrevia nada. Nas duas, a palavra estava certa e a coisa, não. Aqui o
 * cliente é
 * descoberto pelo `createClient` que o cria, e o teste `clientesCriadosNoArquivo`
 * abaixo existe só para provar isso.
 *
 * ## O que esta guarda NÃO prova, dito antes que alguém assuma
 *
 * As telas corrigidas nesta sessão ganharam teste de COMPORTAMENTO: renderiza
 * com a leitura falhando e cobra o que aparece. Nas edge functions não existe
 * equivalente, e não é descuido — elas são módulos Deno que chamam
 * `Deno.serve` no topo, e o vitest roda em Node. Fazer isso exigiria extrair a
 * lógica de dentro do `Deno.serve` para funções puras, em cada uma das vinte.
 *
 * Então o que existe hoje, aqui, é a varredura estática: ela garante que o
 * `error` é OBSERVADO, e não que a função responda direito quando ele vem. É o
 * piso. Está escrito para ninguém ler "9 testes passando" como se as functions
 * estivessem cobertas — que seria, exatamente, relatar trabalho não feito.
 */

const RAIZ = "supabase/functions";

/**
 * Funções onde a leitura cega vira afirmação que SAI do sistema — documento
 * legal, alarme de segurança, cópia de segurança. Zero leituras cegas, sempre.
 *
 * Entram aqui depois de zeradas, nunca antes: lista com dívida dentro é lista
 * que não significa nada.
 */
const SEM_TOLERANCIA = [
  // O documento de acesso/portabilidade da LGPD. Cada `?? []` transformava
  // falha de leitura numa tabela vazia dentro do JSON entregue ao titular como
  // "seus dados completos" — e o `audit_logs` registrava a tabela como
  // incluída, porque a chave existia.
  "supabase/functions/dpo-export/index.ts",
  // O vigia. Uma leitura cega aqui é a forma mais pura do problema: ele relata
  // calmaria sem ter olhado, e é justamente ele que deveria avisar.
  "supabase/functions/job-watchdog/index.ts",
  // O FHIR que sai para o sistema de um hospital. Bundle bem formado, `total`
  // coerente, 200 — e uma seção faltando. `MedicationStatement` cego entregava
  // paciente com prótese mecânica SEM anticoagulante; `Condition` cego, estenose
  // importante como quem não tem valvopatia. Não há página para recarregar do
  // lado de lá: o hospital arquiva.
  "supabase/functions/fhir-read/index.ts",
];

/**
 * Quantas leituras cegas as outras funções ainda têm.
 *
 * Só pode cair — mesma catraca de `readErrors.test.ts`, mesma confissão: o
 * número é dívida declarada, com a lista de onde ela está na mensagem do teste.
 *
 * 54 → 42: `dpo-export` (8) e `job-watchdog` (4) zerados e promovidos acima.
 * 42 → 33: as leituras de AUTORIZAÇÃO e de EXISTÊNCIA, em nove funções. Elas
 *          se pareciam e falhavam de três jeitos diferentes, que é o motivo de
 *          terem ido juntas:
 *
 *            · **falha fechada com motivo errado** — `has_role` cego virava
 *              403 "forbidden" e `user_roles` cego virava 401. Negar sem
 *              confirmar o papel está certo; fazer o administrador concluir que
 *              perdeu o acesso, não. Sete lugares;
 *            · **falha afirmando ausência** — `access-decide` dizia
 *              "solicitação não encontrada" sobre um pedido de acesso do
 *              titular que está lá. Mesmo formato do "médico não encontrado"
 *              que esta base já tinha: a coisa existe, e a culpa vai para quem
 *              clicou;
 *            · **falha ABRINDO** — a checagem de duplicidade do
 *              `access-request` caía para o INSERT quando a leitura falhava, e
 *              produzia a segunda linha na fila que ela existe para evitar.
 *
 *          Junto, as duas do backup: em `offsite-copy` e `weekly-export`, não
 *          conseguir ler o segredo do cron parava a cópia de segurança com um
 *          401 e SEM registro em `job_runs` — silêncio que o vigia só notaria
 *          dias depois.
 * 33 → 24: `fhir-read` (9) zerado e promovido acima. Nele estava o padrão mais
 *          difícil de perceber da sessão inteira:
 *
 *              .eq("patient_id", (await admin.from("patients")…).data?.id
 *                                 ?? "00000000-0000-0000-0000-000000000000")
 *
 *          Não é ausência lida como vazio — é um valor INVENTADO no lugar do
 *          que não deu para ler. A consulta fica válida, não casa com nada,
 *          devolve zero linhas e **nenhum erro**. O resultado é uma resposta
 *          limpa, plausível e falsa.
 */
const DIVIDA_CONHECIDA = 24;

const cegas = encontrarCegas({ raiz: RAIZ, nomesDoCliente: clientesCriadosNoArquivo });
const foraDaLista = cegas.filter((c) => !SEM_TOLERANCIA.includes(c.split(":")[0]));
const naLista = cegas.filter((c) => SEM_TOLERANCIA.includes(c.split(":")[0]));

describe("leituras cegas nas edge functions", () => {
  it("nas funções que produzem documento legal ou alarme, nenhuma ignora o erro", () => {
    expect(
      naLista,
      `\n${naLista.join("\n")}\n\n` +
        "Nestas funções a falha de leitura vira 200 OK com corpo incompleto:\n" +
        "um export de LGPD sem uma tabela, um vigia que não viu o que não leu.\n" +
        "Observe o `error` e responda com falha — nunca deixe o `?? []` responder.",
    ).toEqual([]);
  });

  it("a dívida das demais funções não cresce", () => {
    expect(
      foraDaLista.length,
      `\nLeituras cegas fora da lista sem tolerância: ${foraDaLista.length} ` +
        `(conhecidas: ${DIVIDA_CONHECIDA})\n\n` +
        foraDaLista.join("\n") +
        "\n\nSe o número SUBIU, uma leitura nova está descartando o erro.\n" +
        "Se CAIU, baixe DIVIDA_CONHECIDA para o novo valor.",
    ).toBeLessThanOrEqual(DIVIDA_CONHECIDA);
  });

  it("a lista sem tolerância aponta para arquivos que existem", () => {
    // Sem isto, renomear uma função esvaziaria a exigência em silêncio.
    for (const caminho of SEM_TOLERANCIA) {
      expect(() => statSync(caminho), `SEM_TOLERANCIA aponta para ${caminho}`).not.toThrow();
    }
  });

  it("a varredura enxerga leitura cega de verdade nas functions", () => {
    // Contraprova do mecanismo. Sem ela, um detector quebrado — que não achasse
    // NADA — passaria nos dois testes acima e diria que o servidor está limpo.
    expect(
      cegas.length,
      "a varredura não achou nenhuma leitura cega nas functions — o detector provavelmente quebrou",
    ).toBeGreaterThan(0);
  });
});

/**
 * A descoberta do cliente, cobrada direto.
 *
 * Este é o teste que impede a guarda de voltar a mirar no vocabulário. Ele não
 * olha número nenhum: olha se o mecanismo enxerga um cliente chamado `admin`.
 */
describe("o cliente é descoberto pelo createClient, não pelo nome", () => {
  it("acha o cliente chamado `admin`, que é o nome de quinze deles", () => {
    const texto = 'const admin = createClient(URL, SERVICE, { auth: {} });';
    expect(clientesCriadosNoArquivo(texto)).toEqual(["admin"]);
  });

  it("acha mais de um cliente no mesmo arquivo", () => {
    // `dpo-export` cria dois: o do usuário (para conferir quem chamou) e o
    // administrativo (para ler os dados). Achar só um deixaria metade das
    // leituras daquele arquivo fora da varredura.
    const texto = [
      "const userClient = createClient(URL, ANON, { global: {} });",
      "const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });",
    ].join("\n");
    expect(clientesCriadosNoArquivo(texto)).toEqual(["userClient", "admin"]);
  });

  it("acha o cliente com anotação de tipo entre o nome e o `=`", () => {
    const texto = "const admin: SupabaseClient = createClient(URL, SERVICE);";
    expect(clientesCriadosNoArquivo(texto)).toEqual(["admin"]);
  });

  it("arquivo que não cria cliente nenhum devolve lista vazia, e é pulado", () => {
    // Os `_shared/*.ts` que só montam cabeçalho ou texto. Varrê-los custaria
    // nada e acharia nada, mas a lista vazia é o que faz o `encontrarCegas`
    // pular o arquivo em vez de rodar a regex de chamada sobre ele.
    expect(clientesCriadosNoArquivo("export const cors = { 'x': '1' };")).toEqual([]);
  });

  it("não confunde `createClientSomethingElse` com o createClient de verdade", () => {
    // `\b` no fim do padrão. Sem ele, uma função auxiliar com nome parecido
    // registraria um cliente que não existe, e a varredura passaria a acusar
    // linhas que não são chamada de banco — falso positivo que convida a
    // desligar a guarda.
    expect(clientesCriadosNoArquivo("const x = createClientProxy(a, b);")).toEqual([]);
  });
});
