import { describe, it, expect } from "vitest";
import { recomendarProteses, menoresPorModelo, ehSubstituicao } from "./recomendacaoProtese";
import { superficieCorporal } from "./bsa";
import type { ProteseDoCatalogo } from "@/hooks/useCatalogoProteses";

/**
 * O recomendador, medido nas fronteiras.
 *
 * O risco desta ferramenta não é errar a conta — é **acertar a conta e o médico
 * ler a lista como se ela decidisse a prótese**. Quem decide é o anel do
 * paciente, que este módulo não conhece. Por isso há teste para a faixa de anel
 * viajar junto de cada opção, e para nenhuma linha sair sem procedência.
 */

const linha = (over: Partial<ProteseDoCatalogo>): ProteseDoCatalogo => ({
  id: Math.random().toString(36).slice(2),
  manufacturer: "Edwards", model_name: "Perimount", type: "biologica_aortica",
  valve_position: "aortica", size: 21, effective_orifice_area: 1.3, eoa_reference_sd: 0.3,
  eoa_source_label: "ASE 2024 — Tabela A4", eoa_source_url: "https://pubmed.ncbi.nlm.nih.gov/38182282/",
  mean_gradient_ref: 12.6, mean_gradient_ref_sd: 4.7,
  annulus_min_mm: 20, annulus_max_mm: 22, description: null, reference_url: null,
  image_url: null, display_order: 1, ...over,
});

/** 170 cm / 70 kg → 1,8097 m². Limiar aórtico de mismatch: iEOA > 0,85. */
const BSA = superficieCorporal(170, 70)!;
/** Nesta superfície, 0,85 × 1,8097 = 1,538 cm² é a EOA mínima que serve. */
const EOA_MINIMA = 0.85 * BSA;

describe("recomendador de prótese", () => {
  it("separa o que evita mismatch do que não evita, na fronteira exata", () => {
    const catalogo = [
      linha({ size: 21, effective_orifice_area: EOA_MINIMA + 0.01 }),
      linha({ size: 23, effective_orifice_area: EOA_MINIMA }),        // iEOA = 0,85 → moderado
      linha({ size: 25, effective_orifice_area: EOA_MINIMA - 0.01 }),
    ];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    const e = r.fabricantes[0]!;
    expect(e.adequadas.map((o) => o.tamanho), "só o que passa de 0,85 é adequado").toEqual([21]);
    expect(e.insuficientes.map((o) => o.tamanho).sort()).toEqual([23, 25]);
  });

  it("no obeso, a coluna muda e mais tamanhos passam a servir", () => {
    // iEOA 0,75: mismatch moderado no magro (limiar 0,85), sem mismatch no
    // obeso (limiar 0,70). É a troca de coluna da Tabela 12.
    const catalogo = [linha({ effective_orifice_area: 0.75 * BSA })];
    expect(recomendarProteses(catalogo, BSA, "aortica", 24).fabricantes[0]!.adequadas).toHaveLength(0);
    const obeso = recomendarProteses(catalogo, BSA, "aortica", 32);
    expect(obeso.fabricantes[0]!.adequadas).toHaveLength(1);
    expect(obeso.faixaDeObesidade).toBe(true);
  });

  it("sem IMC vale a coluna mais exigente — não informar não melhora o resultado", () => {
    const catalogo = [linha({ effective_orifice_area: 0.75 * BSA })];
    const semImc = recomendarProteses(catalogo, BSA, "aortica", null);
    expect(semImc.faixaDeObesidade).toBe(false);
    expect(semImc.fabricantes[0]!.adequadas).toHaveLength(0);
  });

  it("agrupa por fabricante, em ordem alfabética — não por mérito", () => {
    const catalogo = [
      linha({ manufacturer: "Medtronic", model_name: "Avalus", effective_orifice_area: 2.0 }),
      linha({ manufacturer: "Abbott", model_name: "Trifecta GT", effective_orifice_area: 1.9 }),
      linha({ manufacturer: "Edwards", effective_orifice_area: 2.2 }),
    ];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    // Se ordenasse por EOA, Edwards (2,2) viria primeiro. Vem por nome.
    expect(r.fabricantes.map((f) => f.fabricante)).toEqual(["Abbott", "Edwards", "Medtronic"]);
  });

  it("dentro do fabricante, o menor tamanho vem primeiro", () => {
    // Numa lista que já evita mismatch, a menor é a que mais provavelmente cabe.
    const catalogo = [25, 21, 23].map((size) => linha({ size, effective_orifice_area: 2.2 }));
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(r.fabricantes[0]!.adequadas.map((o) => o.tamanho)).toEqual([21, 23, 25]);
  });

  it("a faixa de anel viaja junto — é ela que decide o que cabe", () => {
    const catalogo = [linha({ effective_orifice_area: 2.2, annulus_min_mm: 20, annulus_max_mm: 22 })];
    const o = recomendarProteses(catalogo, BSA, "aortica", 24).fabricantes[0]!.adequadas[0]!;
    expect(o.anelMin).toBe(20);
    expect(o.anelMax).toBe(22);
  });

  it("nenhuma opção sai sem a procedência da EOA", () => {
    const catalogo = [linha({ effective_orifice_area: 2.2 })];
    const o = recomendarProteses(catalogo, BSA, "aortica", 24).fabricantes[0]!.adequadas[0]!;
    expect(o.fonteUrl).toMatch(/pubmed/);
    expect(o.fonteRotulo).toBeTruthy();
  });

  it("tamanho sem EOA publicada é contado, não escondido", () => {
    // O médico precisa saber que a lista está incompleta, e de quanto.
    const catalogo = [
      linha({ effective_orifice_area: 2.2 }),
      linha({ size: 23, effective_orifice_area: null, eoa_source_url: null }),
      linha({ size: 25, effective_orifice_area: null, eoa_source_url: null }),
    ];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(r.semEoaPublicada).toBe(2);
    expect(r.avaliadas).toBe(1);
    expect(r.fabricantes[0]!.semEoaPublicada).toBe(2);
  });

  it("anel de anuloplastia fica de fora: não substitui a valva", () => {
    expect(ehSubstituicao("anel_anuloplastia")).toBe(false);
    expect(ehSubstituicao("biologica_aortica")).toBe(true);
    expect(ehSubstituicao("tavi")).toBe(true);
    expect(ehSubstituicao("mecanica")).toBe(true);
    const catalogo = [linha({ type: "anel_anuloplastia", effective_orifice_area: 2.2 })];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(r.avaliadas).toBe(0);
    expect(r.fabricantes).toHaveLength(0);
  });

  it("a posição valvar filtra: mitral não aparece na busca aórtica", () => {
    const catalogo = [
      linha({ valve_position: "mitral", type: "biologica_mitral", effective_orifice_area: 2.2 }),
    ];
    expect(recomendarProteses(catalogo, BSA, "aortica", 24).avaliadas).toBe(0);
    expect(recomendarProteses(catalogo, BSA, "mitral", 24).avaliadas).toBe(1);
  });

  it("`menoresPorModelo` devolve o piso de cada modelo, não a lista inteira", () => {
    const opcoes = recomendarProteses(
      [21, 23, 25].map((size) => linha({ size, effective_orifice_area: 2.2 })).concat(
        [23, 25].map((size) => linha({ size, model_name: "Inspiris Resilia", effective_orifice_area: 2.2 })),
      ),
      BSA, "aortica", 24,
    ).fabricantes[0]!.adequadas;
    const menores = menoresPorModelo(opcoes);
    expect(menores.map((o) => [o.modelo, o.tamanho])).toEqual([
      ["Inspiris Resilia", 23],
      ["Perimount", 21],
    ]);
  });

  it("superfície corporal impossível não produz recomendação", () => {
    const r = recomendarProteses([linha({ effective_orifice_area: 2.2 })], 0, "aortica", 24);
    expect(r.avaliadas).toBe(0);
  });
});
