/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  arquivosDeCodigo, lerFonte, okCravadoComItensFalhados, formatar,
} from "./astDeChamadas";
import { semComentarios } from "./resultadoDescartado";

/**
 * O `ok` de `job_runs` é medido, e não cravado.
 *
 * ## O defeito, como ele estava
 *
 * `admin-digest` gravava:
 *
 *     await recordJobRun({
 *       job: JOB, startedAt,
 *       ok: true,
 *       itemsOk: notificados,
 *       itemsFailed: destinatarios.length - notificados,
 *       …
 *     });
 *
 * Ou seja: contou as notificações que não entraram e gravou sucesso na mesma
 * chamada. E `job_runs.ok` não é um campo decorativo — é por ele que se sabe se
 * a tarefa agendada fez o trabalho. Os DOIS leitores filtram por
 * `.eq("ok", true)` e nenhum olha `items_failed`:
 *
 *   · `job-watchdog`, cujo comentário diz exatamente o que estava sendo
 *     quebrado daqui — "uma tarefa que roda todo dia e falha todo dia não pode
 *     passar por saudável só porque rodou";
 *   · o próprio resumo semanal, ao conferir as outras tarefas.
 *
 * Então um resumo semanal cujas notificações todas falharam e cujo e-mail não
 * saiu deixava uma linha de SUCESSO, e o vigia a lia como prova de que o canal
 * de aviso do administrador está de pé. O defeito morava no campo que existe
 * para dizer se a tarefa fez o trabalho, lido pela tarefa que existe para
 * notar que não fez.
 *
 * Os outros cinco `recordJobRun` desta base já amarravam o `ok` à contagem:
 * `ok: failed === 0`, `ok: falhas === 0`, `ok: naoConferido.length === 0`.
 * `admin-digest` era o único com o literal — e era o único sem uma guarda que
 * notasse.
 */

const RAIZES = ["supabase/functions"];
const arquivos = arquivosDeCodigo(RAIZES);
const medida = arquivos.map((a) => ({ arquivo: a, ...okCravadoComItensFalhados(lerFonte(a)) }));
const cravados = medida.flatMap((m) => m.achados);
const chamadas = medida.reduce((s, m) => s + m.chamadas, 0);

describe("o `ok` de `job_runs` é medido", () => {
  it("nenhum `recordJobRun` grava `ok: true` ao lado de `itemsFailed`", () => {
    expect(
      cravados.map(formatar),
      "\n" + cravados.map(formatar).join("\n") + "\n\n" +
        "Esta chamada CONTA as falhas e grava sucesso. `job_runs.ok` é lido por\n" +
        "`job-watchdog` e pelo resumo do administrador com `.eq(\"ok\", true)`, e\n" +
        "nenhum dos dois olha `items_failed` — então uma execução que não entregou\n" +
        "nada passa por saudável, no campo que existe justamente para dizer se\n" +
        "entregou.\n\n" +
        "Amarre o `ok` ao que de fato aconteceu, como os outros fazem:\n" +
        "  ok: falhas === 0\n\n" +
        "E ponha `error:` dizendo o que falhou — o vigia imprime esse campo.",
    ).toEqual([]);
  });

  it("a varredura achou os `recordJobRun` que existem", () => {
    // Piso: a regra acima afirma um zero, e zero é o que uma varredura que não
    // acha chamada nenhuma também devolve. Eram 16 chamadas em 6 funções
    // quando esta guarda foi escrita; o piso é folgado para não virar falso
    // vermelho a cada tarefa nova.
    expect(
      chamadas,
      `a varredura achou só ${chamadas} chamadas a \`recordJobRun\` — ` +
        "o nome mudou, ou ela parou de olhar `supabase/functions`",
    ).toBeGreaterThan(8);
  });

  it("a premissa continua valendo: os leitores filtram por `ok`", () => {
    /**
     * Isto não é uma exigência — é a PREMISSA da regra acima, remedida.
     *
     * A regra existe porque ninguém olha `items_failed`. Se alguém passar a
     * olhar, a regra fica mais rígida do que precisa, e uma guarda rígida sem
     * motivo é uma guarda que alguém desliga. Então a premissa é conferida
     * aqui, e se ela mudar esta linha reprova pedindo para RECONSIDERAR a
     * regra — não para desfazer a mudança.
     *
     * Lê o código sem comentários de propósito: o arquivo que eu mesmo acabei
     * de anotar menciona `items_failed` na prosa, e guarda que lê comentário
     * não confere código. Foi o defeito em que esta sessão tropeçou nove
     * vezes, duas delas em armadilha que eu mesmo plantei no mesmo dia.
     */
    const leitores = [
      "supabase/functions/job-watchdog/index.ts",
      "supabase/functions/admin-digest/index.ts",
    ];
    for (const caminho of leitores) {
      const codigo = semComentarios(readFileSync(caminho, "utf8"));
      expect(
        codigo,
        `${caminho} deixou de filtrar \`job_runs\` por \`ok\` — a premissa da ` +
          "regra acima mudou",
      ).toMatch(/\.eq\(\s*"ok",\s*true\s*\)/);
      expect(
        /items_failed/.test(codigo),
        `${caminho} passou a olhar \`items_failed\`. Isso é bom — e torna a regra ` +
          "`ok: true` + `itemsFailed` mais rígida do que precisa. Reconsidere-a: " +
          "ou ela continua valendo por outro motivo, e o motivo vai escrito aqui, " +
          "ou ela sai.",
      ).toBe(false);
    }
  });

  it("o detector acusa a contradição e absolve as formas corretas", () => {
    // A contraprova. Sem ela a regra passa com o detector devolvendo lista
    // vazia por estar quebrado.
    const plantar = (codigo: string) => okCravadoComItensFalhados(lerFonte("plantado.ts", codigo));

    const ruim = plantar(
      'await recordJobRun({ job: J, startedAt, ok: true, itemsOk: n, itemsFailed: total - n });\n',
    );
    expect(ruim.chamadas, "não reconheceu a chamada").toBe(1);
    expect(ruim.achados.length, "não acusou `ok: true` ao lado de `itemsFailed`").toBe(1);

    const boas = plantar(
      // derivado — o que se quer
      'await recordJobRun({ job: J, startedAt, ok: falhas === 0, itemsOk: n, itemsFailed: falhas });\n' +
      // abreviado, a partir de uma variável — `offsite-copy` faz assim
      'await recordJobRun({ job: J, startedAt, ok, itemsOk: n, itemsFailed: nFalhas });\n' +
      // o caminho de falha
      'await recordJobRun({ job: J, startedAt, ok: false, error: e });\n' +
      // sucesso literal SEM contagem de falhas: não é contradição, não acusa
      'await recordJobRun({ job: J, startedAt, ok: true, details: { x: 1 } });\n',
    );
    expect(boas.chamadas, "não reconheceu as quatro chamadas").toBe(4);
    expect(boas.achados.map(formatar), "acusou forma correta").toEqual([]);
  });
});
