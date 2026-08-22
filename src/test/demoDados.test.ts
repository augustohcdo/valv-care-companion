import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, nyhaLabels, caseStatusLabels,
  examTypeLabels, eventTypeLabels, appointmentTypeLabels, appointmentStatusLabels,
  commonSymptoms, commonComorbidities,
} from "@/lib/clinicalLabels";

/**
 * Guarda: dado de demonstração não pode virar número real, nem sair do sistema
 * sem se identificar.
 *
 * A base fictícia existe para o produto poder ser mostrado com as telas
 * cheias. Ela cria dois riscos, e os dois são da família que esta sessão
 * inteira persegue — algo que relata uma coisa e é outra:
 *
 * 1. `admin_site_metrics()` faz `count(*)` sobre `clinical_cases` e `doctors`.
 *    Sem filtro, o painel do administrador e o resumo semanal passariam a
 *    contar paciente inventado como uso real, com o relatório "correto" sobre
 *    a pergunta errada.
 * 2. Um PDF de prontuário ou uma planilha de casos sobrevive à conversa em que
 *    ficou claro que era demonstração. Se o papel não se explica sozinho,
 *    ninguém depois tem como saber.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");

/** A definição de `admin_site_metrics` que vale é a da migration mais recente. */
function metricasVigentes(): string {
  const dir = resolve(raiz, "supabase/migrations");
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const comFuncao = arquivos.filter((f) =>
    /(create or replace )?function public\.admin_site_metrics/i.test(readFileSync(resolve(dir, f), "utf8")),
  );
  expect(comFuncao.length, "nenhuma migration define admin_site_metrics").toBeGreaterThan(0);
  const texto = readFileSync(resolve(dir, comFuncao[comFuncao.length - 1]), "utf8");
  const inicio = texto.toLowerCase().indexOf("function public.admin_site_metrics");
  return texto.slice(inicio);
}

describe("a demonstração fica fora das métricas de uso real", () => {
  const def = metricasVigentes();

  it("as contagens de caso excluem o que é demonstração", () => {
    // Cada uma separadamente: filtrar só o total e esquecer os recortes de 7 e
    // 30 dias deixaria o painel dizendo "0 casos, +12 na semana".
    for (const chave of ["'casos'", "'casos_30d'", "'casos_7d'"]) {
      const i = def.indexOf(chave);
      expect(i, `${chave} ausente de admin_site_metrics`).toBeGreaterThan(0);
      const linha = def.slice(i, def.indexOf("\n", i));
      expect(linha, `${chave} conta caso de demonstração`).toMatch(/not is_demo/);
    }
  });

  it("as contagens de médico excluem os médicos fictícios", () => {
    for (const chave of ["'medicos'", "'medicos_30d'", "'medicos_7d'"]) {
      const i = def.indexOf(chave);
      expect(i, `${chave} ausente`).toBeGreaterThan(0);
      expect(def.slice(i, def.indexOf("\n", i)), `${chave} conta médico fictício`)
        .toMatch(/not is_demo/);
    }
  });

  it("o volume fictício aparece, em vez de sumir", () => {
    // Trocar um número inflado por um número ausente não é correção: o
    // administrador precisa poder ver que a demonstração existe.
    expect(def).toContain("'casos_demo'");
    expect(def).toContain("'medicos_demo'");
    expect(ler("supabase/functions/_shared/adminDigest.ts")).toContain("casos_demo");
  });

  it("contas de médico fictício não contam como conta confirmada", () => {
    const i = def.indexOf("'contas_confirmadas'");
    expect(i).toBeGreaterThan(0);
    expect(def.slice(i, def.indexOf("'views_30d'"))).toMatch(/is_demo/);
  });
});

describe("o caso fictício se identifica onde quer que apareça", () => {
  it("na tela do caso e na lista", () => {
    expect(ler("src/pages/app/CasoDetalhe.tsx")).toContain("DemoBanner");
    expect(ler("src/pages/app/ListaCasos.tsx")).toContain("DemoBadge");
  });

  it("no PDF do prontuário — cabeçalho e rodapé de toda página", () => {
    const pdf = ler("src/lib/casePdf.ts");
    expect(pdf).toContain("ehDemo(caso)");
    // O rodapé é desenhado uma vez por página; o aviso tem que estar nele, e
    // não só no bloco do topo, que só aparece na primeira folha.
    const rodape = pdf.slice(pdf.indexOf("const addFooter"), pdf.indexOf("const sectionTitle"));
    expect(rodape, "rodapé do PDF sem marca de demonstração").toMatch(/demo/);
  });

  it("na planilha e no CSV, que compartilham as mesmas colunas", () => {
    const csv = ler("src/lib/casesCsv.ts");
    const colunas = csv.slice(csv.indexOf("export const COLUMNS"));
    expect(colunas).toContain("Demonstração");
    // Primeira coluna: numa planilha larga, aviso à direita não é lido.
    expect(colunas.indexOf("Demonstração")).toBeLessThan(colunas.indexOf('"ID"'));
    expect(ler("src/lib/casesXlsx.ts")).toContain("is_demo");
  });

  it("o texto do aviso mora num lugar só", () => {
    // Três cópias do mesmo aviso divergem — foi assim que a lista de tabelas
    // do backup ficou quinze tabelas atrasada.
    const demo = ler("src/lib/demo.ts");
    expect(demo).toContain("export const AVISO_DEMO");
    expect(demo).toContain("export function ehDemo");
    for (const arquivo of ["src/lib/casePdf.ts", "src/components/DemoBadge.tsx"]) {
      expect(ler(arquivo), `${arquivo} não usa o texto compartilhado`).toMatch(/from "@\/lib\/demo"/);
    }
  });
});

/**
 * Guarda: a base fictícia só usa vocabulário que o app entende.
 *
 * Um enum errado aqui não falha no CI nem no build — falha na hora de inserir,
 * ou pior, insere e a tela mostra o código cru no lugar do rótulo. Foi assim
 * que um `'grave'` inválido (a coluna aceita `importante`) chegou ao digest
 * semanal e ao PDF mensal antes de alguém notar.
 */
describe("a base fictícia fala a língua do app", () => {
  // `scripts/` fica fora do `src/`, então o import é dinâmico e o tipo é
  // declarado aqui — é dado de seed, não código de produção.
  type Caso = Record<string, unknown> & {
    exames: { tipo: string }[]; eventos: { tipo: string }[];
    compromissos: { tipo: string; status: string }[];
    comentarios: { autor: string | null; body: string }[];
    colaboradores?: string[];
  };

  let CASOS: Caso[] = [];
  let MEDICOS: { chave: string; email: string; crm: string }[] = [];

  beforeAll(async () => {
    const mod = await import("../../scripts/demo-data.mjs");
    CASOS = mod.CASOS as Caso[];
    MEDICOS = mod.MEDICOS as typeof MEDICOS;
  });

  it("há base para conferir — sem isso a varredura passaria vazia", () => {
    expect(CASOS.length).toBeGreaterThanOrEqual(10);
    expect(MEDICOS.length).toBeGreaterThanOrEqual(2);
  });

  it("todo enum bate com os rótulos do app", () => {
    const erros: string[] = [];
    const conferir = (valor: unknown, mapa: Record<string, string>, onde: string) => {
      if (valor == null || valor === "") return;
      if (!(String(valor) in mapa)) erros.push(`${onde}: "${valor}"`);
    };
    for (const c of CASOS) {
      conferir(c.valve_type, valveTypeLabels, "valve_type");
      conferir(c.valve_disease, valveDiseaseLabels, "valve_disease");
      conferir(c.severity, severityLabels, "severity");
      conferir(c.nyha, nyhaLabels, "nyha");
      conferir(c.status, caseStatusLabels, "status");
      for (const e of c.exames) conferir(e.tipo, examTypeLabels, "exam_type");
      for (const e of c.eventos) conferir(e.tipo, eventTypeLabels, "event_type");
      for (const a of c.compromissos) {
        conferir(a.tipo, appointmentTypeLabels, "appointment_type");
        conferir(a.status, appointmentStatusLabels, "appointment_status");
      }
    }
    expect(erros, "valores que o app não sabe rotular").toEqual([]);
  });

  it("sintomas e comorbidades saem das listas oferecidas na tela", () => {
    const fora: string[] = [];
    for (const c of CASOS) {
      for (const s of (c.symptoms as string[]) ?? []) {
        if (!commonSymptoms.includes(s)) fora.push(`sintoma "${s}"`);
      }
      for (const m of (c.comorbidities as string[]) ?? []) {
        if (!commonComorbidities.includes(m)) fora.push(`comorbidade "${m}"`);
      }
    }
    expect(fora, "texto livre onde a tela oferece lista fechada").toEqual([]);
  });

  it("as medidas cabem nas faixas dos CHECK do banco", () => {
    // O banco recusaria, mas com erro cru no meio do seed. Aqui a recusa vem
    // com o nome do caso.
    const fora: string[] = [];
    const faixa = (v: unknown, min: number, max: number, onde: string) => {
      if (typeof v === "number" && (v < min || v > max)) fora.push(onde);
    };
    for (const c of CASOS) {
      faixa(c.patient_age, 0, 120, `${c.patient_name}: idade`);
      faixa(c.ejection_fraction, 0, 100, `${c.patient_name}: FE`);
      faixa(c.mean_gradient, 0, 200, `${c.patient_name}: gradiente médio`);
      faixa(c.peak_gradient, 0, 250, `${c.patient_name}: gradiente máximo`);
      faixa(c.valve_area, 0, 10, `${c.patient_name}: área valvar`);
    }
    expect(fora).toEqual([]);
  });

  it("gradiente médio nunca é maior que o máximo", () => {
    // A mesma implausibilidade que `suspeitaDeErro` marca na tela. A base de
    // demonstração não pode conter justamente o erro que o produto detecta.
    const impossiveis = CASOS.filter((c) =>
      typeof c.mean_gradient === "number" && typeof c.peak_gradient === "number"
      && c.mean_gradient > c.peak_gradient).map((c) => c.patient_name);
    expect(impossiveis).toEqual([]);
  });

  it("nada aqui pode passar por dado real", () => {
    const texto = readFileSync(resolve(raiz, "scripts/demo-data.mjs"), "utf8");
    // CPF, telefone com DDD e e-mail de domínio que existe — três formas de o
    // fictício virar plausível demais.
    expect(texto, "algo com cara de CPF").not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    expect(texto, "algo com cara de telefone").not.toMatch(/\(\d{2}\)\s?9?\d{4}-\d{4}/);
    for (const m of MEDICOS) {
      expect(m.email, `${m.email} usa domínio que pode existir`).toMatch(/\.invalid$/);
    }
  });

  it("todo caso é marcado ao ser inserido, e a discussão tem decisão de Heart Team", () => {
    const seed = readFileSync(resolve(raiz, "scripts/demo-seed.mjs"), "utf8");
    // A marca é aplicada no insert, não no dado — conferir o script é o que
    // garante que nenhum caso entre sem ela.
    const insercao = seed.slice(seed.indexOf('inserir("clinical_cases"'), seed.indexOf("case_exams"));
    expect(insercao, "caso inserido sem is_demo").toContain("is_demo: true");
    expect(seed.slice(seed.indexOf('inserir("doctors"'), seed.indexOf("porChave[m.chave]")))
      .toContain("is_demo: true");
    expect(seed, "conta fictícia sem bloqueio de acesso").toContain("ban_duration");

    const decisoes = CASOS.filter((c) => c.comentarios.some((m) => "heart_team" in m));
    expect(decisoes.length, "nenhuma decisão de Heart Team na base").toBeGreaterThanOrEqual(4);
  });
});
