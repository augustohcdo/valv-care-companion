/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { semComentariosDeCodigo } from "./semComentariosDeCodigo";

/**
 * Cobertura do export de LGPD: nenhuma tabela com dado do titular fica fora
 * sem motivo escrito.
 *
 * ## O defeito, medido
 *
 * `dpo-export` percorre três listas de tabelas escritas à mão
 * (`USER_ID_TABLES`, `PATIENT_ID_TABLES`, `USER_AS_PATIENT_ID_TABLES`), mais
 * duas embutidas em laços (as do lado médico e as filhas de `clinical_cases`).
 * **Nada conferia a cobertura dessas listas.**
 *
 * É a mesma forma do defeito que esta base já pagou no backup, e o cabeçalho de
 * `backupCoverage.test.ts` conta como terminou:
 *
 *   > "Foi assim que 15 tabelas ficaram de fora sem ninguém perceber, entre elas
 *   >  a trilha de auditoria (`audit_logs`), quem é administrador (`user_roles`)
 *   >  e o catálogo de próteses inteiro."
 *
 * Aqui o preço é outro: o export é a resposta a um pedido do art. 18 da LGPD —
 * "que dados vocês têm sobre mim". Uma tabela omitida não é inconveniência, é
 * resposta errada a um direito, com cara de resposta completa.
 *
 * Medido quando isto foi escrito: **sete** tabelas com chave de titular fora das
 * listas.
 *
 *   · `access_requests` — nome, e-mail, telefone, CRM, CRM/UF, RQE,
 *     especialidade, instituição, cidade, a mensagem que a pessoa escreveu e o
 *     MOTIVO DA RECUSA. A mais rica das sete;
 *   · `appointments` — data, local e anotações da consulta. Liga por `case_id`,
 *     como as outras quatro filhas de `clinical_cases`, e faltava só na linha
 *     do laço;
 *   · `patient_link_requests` — os pedidos de vínculo, nos DOIS lados;
 *   · `user_roles` — o que a pessoa é no sistema;
 *   · `hospital_members` — vínculo com instituição;
 *   · `pseudonym_map` — o valor original que foi pseudonimizado;
 *   · `client_errors` — a única exclusão, e com motivo técnico.
 *
 * ## A exclusão, e por que ela é diferente das outras seis
 *
 * `client_errors` é coalescida por `(source, context, message)` — **sem
 * `user_id`**. Uma linha soma `occurrences` de usuários diferentes e carrega o
 * `user_id` de quem a criou primeiro. Filtrar por `user_id` erraria nos dois
 * sentidos: entregaria contagens de outras pessoas e deixaria de fora erros do
 * titular somados na linha de alguém. Exportar assim seria pior do que não
 * exportar — afirmaria completude sobre uma atribuição que a tabela não
 * sustenta.
 *
 * ## Como a cobertura é medida
 *
 * A referência sai de `src/integrations/supabase/types.ts`, gerado do schema
 * real e commitado — então roda no CI sem credencial, como `backupCoverage`,
 * `rlsCoverage` e `encerramentoCobertura`.
 *
 * O critério é "a tabela tem coluna que liga a uma pessoa": `user_id`,
 * `patient_id`, `doctor_id`, `author_doctor_id` ou `case_id`. Não é perfeito —
 * uma tabela que guardasse dado do titular numa coluna com outro nome passaria.
 * É o piso que se consegue medir do schema, e ele pegou sete.
 */

const TYPES = "src/integrations/supabase/types.ts";
const EXPORT_FN = "supabase/functions/dpo-export/index.ts";

/** Colunas que ligam uma linha a uma pessoa. */
const CHAVES_DE_TITULAR = ["user_id", "patient_id", "doctor_id", "author_doctor_id", "case_id"];

/** Tabela → colunas do `Row`, lidas do schema gerado. */
function colunasPorTabela(): Record<string, string[]> {
  const linhas = readFileSync(TYPES, "utf8").split("\n");
  const ini = linhas.findIndex((l) => /^ {4}Tables: \{/.test(l));
  const fim = linhas.findIndex((l, i) => i > ini && /^ {4}Views: \{/.test(l));
  if (ini < 0 || fim < 0) throw new Error(`não achei o bloco Tables em ${TYPES}`);

  const saida: Record<string, string[]> = {};
  let atual = "";
  let dentroDoRow = false;
  for (const l of linhas.slice(ini, fim)) {
    const tabela = /^ {6}([a-z_]+): \{$/.exec(l);
    if (tabela) { atual = tabela[1]; saida[atual] = []; dentroDoRow = false; continue; }
    if (/^ {8}Row: \{$/.test(l)) { dentroDoRow = true; continue; }
    if (dentroDoRow && /^ {8}\}/.test(l)) { dentroDoRow = false; continue; }
    if (dentroDoRow && atual) {
      const coluna = /^ {10}([a-z_]+)\??:/.exec(l);
      if (coluna) saida[atual].push(coluna[1]);
    }
  }
  return saida;
}

/**
 * Todo nome de tabela citado pelo `dpo-export`, com os comentários TIRADOS.
 *
 * Sem a limpeza, o cabeçalho deste próprio arquivo e os comentários da função
 * — que NOMEIAM as sete tabelas para explicar o defeito — contariam como
 * cobertura, e a guarda passaria por ler a sua própria explicação. Foi o que
 * aconteceu doze vezes nesta sessão, de formas diferentes.
 */
function citadasPelaFuncao(texto?: string): Set<string> {
  const limpo = semComentariosDeCodigo(texto ?? readFileSync(EXPORT_FN, "utf8"), EXPORT_FN);
  return new Set([...limpo.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

/** A lista de exclusões declarada na própria função, com os motivos. */
function naoExportadas(): Record<string, string> {
  const limpo = semComentariosDeCodigo(readFileSync(EXPORT_FN, "utf8"), EXPORT_FN);
  const i = limpo.indexOf("const NAO_EXPORTADAS");
  if (i < 0) throw new Error("não achei `NAO_EXPORTADAS` em " + EXPORT_FN);
  const bloco = limpo.slice(i, limpo.indexOf("};", i));
  const saida: Record<string, string> = {};
  for (const m of bloco.matchAll(/([a-z_]+):\s*\n?\s*"([^"]+)"/g)) saida[m[1]] = m[2];
  return saida;
}

const colunas = colunasPorTabela();
const citadas = citadasPelaFuncao();
const dispensadas = naoExportadas();

/** Tabelas do schema com alguma chave de titular. */
const comTitular = Object.entries(colunas)
  .filter(([, cols]) => CHAVES_DE_TITULAR.some((k) => cols.includes(k)))
  .map(([t]) => t);

describe("cobertura do export de LGPD", () => {
  it("as duas leituras acharam o que deviam achar", () => {
    /**
     * Sem estes pisos, um refactor que mude o formato do schema gerado faria a
     * varredura devolver lista vazia — e "nenhuma tabela esquecida" passaria por
     * construção. É o formato exato do defeito que esta sessão persegue.
     */
    expect(Object.keys(colunas).length, "não li o schema gerado").toBeGreaterThan(40);
    expect(comTitular.length, "nenhuma tabela com chave de titular — a leitura falhou")
      .toBeGreaterThan(20);
    expect(citadas.size, "não li os nomes de tabela da função").toBeGreaterThan(20);
  });

  it("comentário que nomeia tabela entre aspas não conta como cobertura", () => {
    /**
     * A limpeza de comentário é PROTETIVA aqui, porque a varredura é por texto:
     * um `"user_roles"` escrito dentro de um comentário seria lido como se a
     * função consultasse a tabela.
     *
     * A primeira versão deste caso tentava provar isso comparando o número de
     * nomes no arquivo cru com o do arquivo limpo — e deu 57 contra 57. Os
     * comentários desta base citam tabela com acento grave, não com aspas, então
     * a limpeza não mudava nada e a asserção não provava nada. Em vez de supor,
     * o caso agora PLANTA o comentário que alguém escreveria ao explicar este
     * próprio defeito: com a limpeza, não conta; sem ela, contaria.
     */
    const plantado =
      'const X = ["profiles"];\n' +
      '// uma tabela esquecida foi "tabela_fantasma", e outra "outra_fantasma"\n' +
      '/* e "mais_uma_fantasma" num bloco */\n';
    // Exercita `citadasPelaFuncao` — a MESMA que a regra de cobertura usa. Uma
    // cópia da expressão aqui provaria que o limpador funciona e não provaria
    // que a guarda o usa; tirar a limpeza de lá passaria por aqui.
    expect(
      [...citadasPelaFuncao(plantado)],
      "a varredura da guarda leu nome de tabela que está em comentário",
    ).toEqual(["profiles"]);
    const cru = new Set([...plantado.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
    expect(cru.size, "o material plantado não contém o que deveria").toBe(4);
  });

  it("toda tabela com dado do titular é exportada ou tem exclusão justificada", () => {
    const esquecidas = comTitular.filter((t) => !citadas.has(t) && !(t in dispensadas));
    expect(
      esquecidas,
      `Tabelas com chave de titular fora do export de LGPD: ${esquecidas.join(", ")}.\n\n` +
        "Um pedido do art. 18 responde \"que dados vocês têm sobre mim\". Uma tabela\n" +
        "omitida é resposta ERRADA com cara de resposta completa — e foi assim que a\n" +
        "lista do backup ficou quinze tabelas atrasada.\n\n" +
        `Inclua na lista certa em ${EXPORT_FN} (por \`user_id\`, por \`patients.id\`,\n` +
        "por `auth.users.id` como paciente, pelo lado médico, ou por `case_id`), ou\n" +
        "declare em `NAO_EXPORTADAS` com o motivo escrito.",
    ).toEqual([]);
  });

  it("toda exclusão tem motivo escrito e aponta para tabela que existe", () => {
    expect(Object.keys(dispensadas).length, "a lista de exclusões não foi lida").toBeGreaterThan(0);
    for (const [tabela, motivo] of Object.entries(dispensadas)) {
      expect(motivo.length, `a exclusão de ${tabela} não tem motivo escrito`).toBeGreaterThan(40);
      expect(colunas[tabela], `${tabela} está dispensada e não existe no schema`).toBeTruthy();
      expect(
        CHAVES_DE_TITULAR.some((k) => colunas[tabela].includes(k)),
        `${tabela} está dispensada e não tem chave de titular — a dispensa não faz sentido`,
      ).toBe(true);
    }
  });

  it("a exclusão do `client_errors` continua valendo pelo motivo que foi escrito", () => {
    /**
     * A PREMISSA remedida. O motivo é que a coalescência não inclui `user_id`.
     * Se um dia ela passar a incluir, a tabela volta a ser atribuível e a
     * exclusão perde a base — e motivo envelhecido é o que faz a próxima pessoa
     * desligar a guarda.
     *
     * O índice que sustenta a coalescência é a prova, e o `logError` é quem a
     * usa: as duas pontas são conferidas.
     */
    expect(dispensadas.client_errors, "a exclusão do `client_errors` saiu").toBeTruthy();
    const migration = readFileSync(
      "supabase/migrations/20260801170000_client_errors_coalesce.sql", "utf8",
    );
    const indice = /create index[^;]*idx_client_errors_dedupe[^;]*;/s.exec(migration)?.[0] ?? "";
    expect(indice, "não achei o índice da coalescência").toBeTruthy();
    expect(indice, "a coalescência passou a considerar `user_id` — reconfira a exclusão")
      .not.toMatch(/user_id/);
    const log = semComentariosDeCodigo(
      readFileSync("supabase/functions/_shared/logError.ts", "utf8"), "logError.ts",
    );
    const busca = log.slice(log.indexOf('.from("client_errors")'), log.indexOf("maybeSingle()"));
    expect(busca, "a busca de coalescência mudou de chave — reconfira a exclusão")
      .not.toMatch(/eq\("user_id"/);
  });

  it("as seis tabelas achadas nesta rodada continuam no export", () => {
    /**
     * Nominal, além da regra geral. A regra proíbe esquecer; esta cobra que
     * estas seis, que ESTAVAM esquecidas, não voltem a sair — e nomeia cada uma
     * para que a reprovação diga qual.
     */
    for (const t of [
      "access_requests", "appointments", "patient_link_requests",
      "user_roles", "hospital_members", "pseudonym_map",
    ]) {
      expect(citadas.has(t), `${t} saiu do export de LGPD`).toBe(true);
    }
  });

  it("o pedido de vínculo é exportado pelos dois lados", () => {
    /**
     * A tabela tem `patient_id` E `doctor_id`, e as duas pontas são dados do
     * titular: um titular médico recebia só os pedidos em que é paciente.
     *
     * Esta regra é NOMINAL, e existe por um limite da regra geral que a inversão
     * expôs: a cobertura mede se o nome da tabela APARECE na função, não se ela
     * é consultada pela chave certa em cada lado. Tirando
     * `patient_link_requests` da lista do lado paciente, o nome continuava no
     * lado médico e a regra geral passava. Onde há duas chaves, a cobrança é
     * nominal, lado a lado.
     */
    const limpo = semComentariosDeCodigo(readFileSync(EXPORT_FN, "utf8"), EXPORT_FN);
    const porPaciente = limpo.slice(
      limpo.indexOf("const PATIENT_ID_TABLES"),
      limpo.indexOf("const NAO_EXPORTADAS"),
    );
    expect(porPaciente, "o pedido de vínculo não é exportado pelo lado paciente")
      .toMatch(/"patient_link_requests"/);
    expect(limpo, "o pedido de vínculo não é exportado pelo lado médico")
      .toMatch(/patient_link_requests_as_doctor/);
    expect(limpo, "o lado médico não filtra por `doctor_id`")
      .toMatch(/tabela: "patient_link_requests", coluna: "doctor_id"/);
  });

  it("o que ficou de fora viaja dentro do arquivo", () => {
    /**
     * Um export que lista o que trouxe e silencia sobre o que deixou de fora se
     * parece com completo. Quem recebe não tem como saber que havia uma decisão,
     * muito menos qual.
     */
    const limpo = semComentariosDeCodigo(readFileSync(EXPORT_FN, "utf8"), EXPORT_FN);
    const doc = limpo.slice(limpo.indexOf("const doc = {"), limpo.indexOf("const path ="));
    expect(doc, "o arquivo exportado não diz o que ficou de fora")
      .toMatch(/nao_incluido:\s*NAO_EXPORTADAS/);
  });

  it("não cita no export tabela que não existe mais no schema", () => {
    // A outra direção: um nome que sobrou de uma tabela removida faria o laço
    // consultar algo inexistente — e o `error` viraria `falhas`, abortando todo
    // o export com 503. Uma letra errada numa lista derruba o pedido inteiro.
    const TABELAS_DA_FUNCAO = [
      ...["profiles", "doctors", "patients", "user_consents", "consent_audit_log",
        "notifications", "saved_filters", "dpo_requests", "access_requests",
        "user_roles", "hospital_members", "pseudonym_map"],
      ...["clinical_cases", "patient_documents", "symptom_entries", "medications",
        "medication_logs", "patient_link_requests"],
      ...["data_access_requests", "data_access_grants", "fhir_resources_inbound",
        "fhir_resources_outbound", "integration_audit_log"],
      ...["case_collaborators", "case_comments"],
      ...["case_events", "case_exams", "case_messages", "case_documents", "appointments"],
    ];
    const fantasmas = TABELAS_DA_FUNCAO.filter((t) => !colunas[t]);
    expect(fantasmas, `tabelas citadas e inexistentes: ${fantasmas.join(", ")}`).toEqual([]);
    // E a lista acima tem de refletir a função: se ela crescer lá e não aqui,
    // esta regra deixa de cobrir o novo nome.
    const naFuncao = TABELAS_DA_FUNCAO.filter((t) => citadas.has(t));
    expect(naFuncao.length, "a lista desta regra descolou da função").toBe(TABELAS_DA_FUNCAO.length);
  });
});
