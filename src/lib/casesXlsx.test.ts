import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { montarPlanilhaDeCasos } from "./casesXlsx";
import type { CaseRow } from "./casesCsv";

/**
 * O export de planilha, gerado e LIDO DE VOLTA.
 *
 * ## Por que este arquivo nasceu agora
 *
 * `npm audit` acusava o `uuid` que vem por dentro do `exceljs`. O
 * `npm audit fix --force` "resolvia" instalando **exceljs@3.4.0** — duas
 * versões maiores ATRÁS da 4.4.0, que é a última publicada. Isso não é
 * correção, é regressão com aparência de correção: o relatório de auditoria
 * fica verde e a planilha do médico passa a ser gerada por uma biblioteca de
 * 2018.
 *
 * A saída foi um `override` do uuid só para o exceljs — que mantém a 4.4.0 e
 * zera a auditoria. Mas trocar uma dependência transitiva por baixo de uma
 * biblioteca é exatamente o tipo de mudança que "compila e não funciona": o
 * `npm run build` continuaria passando com a planilha saindo corrompida,
 * porque nada no projeto abria o arquivo gerado.
 *
 * Então este teste gera o .xlsx de verdade e o REABRE com o próprio ExcelJS,
 * conferindo abas, cabeçalho e conteúdo. Um arquivo quebrado reprova aqui.
 */

const caso = (over: Partial<CaseRow> = {}): CaseRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  patient_name: "Maria de Souza",
  patient_age: 72,
  patient_sex: "feminino",
  valve_type: "aortica",
  valve_disease: "estenose",
  severity: "critica",
  nyha: "III",
  status: "pre_intervencao",
  ejection_fraction: 48,
  mean_gradient: 52,
  peak_gradient: 84,
  valve_area: 0.7,
  regurgitation_grade: null,
  symptoms: ["Dispneia aos esforços"],
  comorbidities: ["Hipertensão arterial"],
  proposed_management: "Heart Team",
  clinical_notes: "Acompanhamento",
  created_at: "2026-01-10T10:00:00.000Z",
  updated_at: "2026-01-10T10:00:00.000Z",
  is_demo: false,
  ...over,
});

async function reabrir(cases: CaseRow[]) {
  const bytes = await montarPlanilhaDeCasos(cases);
  const lido = new ExcelJS.Workbook();
  await lido.xlsx.load(bytes);
  return lido;
}

describe("a planilha de casos, gerada e reaberta", () => {
  it("produz um arquivo que o próprio ExcelJS consegue abrir", async () => {
    const bytes = await montarPlanilhaDeCasos([caso()]);
    expect(bytes.byteLength, "planilha vazia").toBeGreaterThan(2000);
    // Assinatura ZIP — um .xlsx é um zip, e é o primeiro sinal de corrupção.
    const inicio = new Uint8Array(bytes.slice(0, 2));
    expect([inicio[0], inicio[1]]).toEqual([0x50, 0x4b]);

    const lido = await reabrir([caso()]);
    expect(lido.worksheets.map((w) => w.name)).toEqual(["Casos", "Resumo"]);
  });

  it("a aba de casos traz o cabeçalho e a linha do paciente", async () => {
    const lido = await reabrir([caso(), caso({ id: "2", patient_name: "João Lima", severity: "leve" })]);
    const casos = lido.getWorksheet("Casos")!;
    const cabecalho = casos.getRow(1).values as unknown[];
    expect(cabecalho).toContain("Paciente");
    expect(cabecalho).toContain("Demonstração");
    expect(casos.rowCount, "duas linhas de dados mais o cabeçalho").toBe(3);
    const nomes = [2, 3].map((n) => {
      const linha = casos.getRow(n).values as unknown[];
      return linha.find((v) => typeof v === "string" && /Maria|João/.test(v));
    });
    expect(nomes).toEqual(["Maria de Souza", "João Lima"]);
  });

  it("o resumo conta os casos e denuncia os fictícios", async () => {
    // Não é detalhe de formatação: quem abre a planilha lê o Resumo primeiro, e
    // uma coorte com caso de demonstração não pode passar por dado real.
    const lido = await reabrir([caso(), caso({ id: "2", is_demo: true })]);
    const resumo = lido.getWorksheet("Resumo")!;
    const texto: string[] = [];
    resumo.eachRow((linha) => {
      (linha.values as unknown[]).forEach((v) => {
        if (typeof v === "string") texto.push(v);
        if (typeof v === "number") texto.push(String(v));
      });
    });
    const juntos = texto.join(" | ");
    expect(juntos).toContain("Total de casos");
    expect(juntos).toContain("Dos quais fictícios");
    expect(juntos).toContain("demonstração, não é dado real");
    expect(juntos, "os rótulos das seções sumiram do resumo").toMatch(/Severidade/);
  });

  it("sem caso fictício, a linha de aviso não aparece", async () => {
    // Contraprova: sem isto, um resumo que imprimisse o aviso SEMPRE passaria
    // no teste acima e assustaria o médico com dado real.
    const lido = await reabrir([caso()]);
    const resumo = lido.getWorksheet("Resumo")!;
    const texto: string[] = [];
    resumo.eachRow((linha) => {
      (linha.values as unknown[]).forEach((v) => {
        if (typeof v === "string") texto.push(v);
      });
    });
    expect(texto.join(" | ")).not.toContain("Dos quais fictícios");
  });

  it("o exceljs em uso é o 4.x, e não a versão que o audit fix instalaria", async () => {
    // A guarda contra a "correção" que regride: `npm audit fix --force`
    // instala exceljs@3.4.0. Se alguém rodar isso, este teste avisa antes de a
    // planilha do médico mudar de gerador sem ninguém decidir.
    const { version } = await import("exceljs/package.json");
    expect(version, `exceljs regrediu para ${version}`).toMatch(/^4\./);
  });
});
