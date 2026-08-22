import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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
