/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import { encontrarCegas, clientesCriadosNoArquivo } from "./detectorDeChamadasCegas";

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
 * As quatro funções que foram zeradas primeiro, e por quê.
 *
 * A lista nasceu como exigência separada, enquanto o resto do diretório ainda
 * tinha dívida sob catraca. Hoje a exigência vale para `supabase/functions`
 * inteiro e ela não decide mais nada — mas fica, porque diz onde o defeito
 * doía mais. Um zero sem memória volta a subir sem ninguém entender por quê.
 */
const PIORES = [
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
  // A IA clínica. O contexto com que o modelo raciocina: exames seriados,
  // diário de sintomas, evolução, prótese planejada. Cada um sumindo em
  // silêncio fazia a IA responder com a confiança de sempre sobre dados que
  // não estavam lá — e em valvopatia a progressão entre dois ecos é o que
  // separa vigiar de operar.
  "supabase/functions/clinical-ai/index.ts",
];

/**
 * A queda, para o número não virar folclore.
 *
 * Começou em 54 e chegou a 0. A catraca saiu junto: enquanto havia dívida, o
 * número era confissão; com ela zerada, a exigência é o diretório inteiro, e
 * uma leitura cega nova reprova sem precisar de constante para comparar.
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
 * 24 → 13: `clinical-ai` (10) zerado e promovido acima, e três achados dele
 *          merecem nome próprio:
 *
 *            · a trava de rajada falhava ABERTA e calada. `count` nulo por erro
 *              caía no `?? 0`, e `0 >= limite` é falso: a trava deixava de
 *              existir exatamente quando o banco está sob pressão. Agora deixa
 *              passar e REGISTRA — é válvula contra automação, não fronteira de
 *              segurança, e negar IA a todos os médicos custaria mais; o que
 *              não dá é ninguém jamais saber que ela parou de funcionar;
 *            · o consentimento de IA cego dizia ao médico que o paciente não
 *              consentiu. Ausência de linha é recusa e continua sendo; falha de
 *              leitura não é ausência de linha;
 *            · a lista de fontes de literatura cega caía em
 *              `sem_fonte_automatica` — "a busca está DESLIGADA". O comentário
 *              três linhas abaixo já dizia que desligada e "não achei nada" são
 *              estados diferentes, e a linha acima dele cometia o erro. Entrou
 *              o quinto estado, `fontes_ilegiveis`, até a tela do médico.
 * 13 →  0: o resto. Três delas falhavam ABRINDO, e o estrago sai do sistema:
 *          o `welcome-email` REENVIAVA a boas-vindas a quem já recebeu (e-mail
 *          não se desenvia); o `knowledge-seed` reinseria o trecho de diretriz,
 *          deixando a base que a IA cita com a mesma recomendação duplicada,
 *          como se fossem duas fontes concordando; e o `access-request` já
 *          tinha sido corrigido na rodada anterior pelo mesmo motivo.
 *
 *          O `admin-digest` anunciava "tudo em dia" sobre tarefa cujo histórico
 *          não conseguiu ler — a frase que não pode sair quando ninguém olhou,
 *          no canal que o administrador de fato lê.
 *
 *          E o `logError`: a ÚNICA que degrada de propósito. Ela é quem as
 *          outras chamam para relatar falha; se recusar, o problema original
 *          some junto. Falhando, o erro continua sendo registrado — só perde o
 *          agrupamento. Tolerada, mas não silenciosa: vai para `console.error`,
 *          que é o canal que sobra quando `logError` é quem falhou.
 */

const cegas = encontrarCegas({ raiz: RAIZ, nomesDoCliente: clientesCriadosNoArquivo });


describe("leituras cegas nas edge functions", () => {
  it("NENHUMA leitura das edge functions ignora o erro", () => {
    expect(
      cegas,
      `\n${cegas.join("\n")}\n\n` +
        "Do lado do servidor a falha de leitura vira 200 OK com corpo incompleto:\n" +
        "um export de LGPD sem uma tabela, um bundle FHIR sem as medicações do\n" +
        "paciente, um vigia que não viu o que não leu, um e-mail dizendo que está\n" +
        "tudo em dia. Ninguém recarrega, porque ninguém viu falha.\n\n" +
        "Observe o `error` e responda com falha — nunca deixe o `?? []` responder.\n" +
        "E ponha a checagem COLADA na leitura: passar a consulta como argumento\n" +
        "para um ajudante tira o erro do alcance de quem escreveu a linha.",
    ).toEqual([]);
  });

  it("as quatro piores continuam existindo com esse nome", () => {
    // Sem isto, renomear uma delas apagaria a memória de onde o defeito doeu
    // mais — e a exigência do diretório continuaria passando, sem ninguém notar
    // que a história se perdeu.
    for (const caminho of PIORES) {
      expect(() => statSync(caminho), `PIORES aponta para ${caminho}`).not.toThrow();
    }
  });

  it("a varredura ainda enxerga leitura cega de verdade", () => {
    // A contraprova, e agora ela é a única coisa entre um detector quebrado e um
    // "zero" que não significa nada. Com a dívida em zero, o teste de cima passa
    // tanto com o servidor limpo quanto com a varredura achando nada.
    //
    // Então o mecanismo é exercitado sobre um caso construído: uma leitura cega
    // de verdade, num cliente que se chama `admin`, tem de ser encontrada.
    const texto = [
      'const admin = createClient(URL, KEY);',
      'const { data } = await admin.from("pacientes").select("*").eq("id", x);',
      'return data ?? [];',
    ].join("\n");
    const { mkdtempSync, writeFileSync, rmSync } = require("node:fs") as typeof import("node:fs");
    const { tmpdir } = require("node:os") as typeof import("node:os");
    const { join } = require("node:path") as typeof import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "cegas-"));
    try {
      writeFileSync(join(dir, "index.ts"), texto);
      const achadas = encontrarCegas({ raiz: dir, nomesDoCliente: clientesCriadosNoArquivo });
      expect(
        achadas.length,
        "a varredura não achou uma leitura cega evidente — o detector quebrou",
      ).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
