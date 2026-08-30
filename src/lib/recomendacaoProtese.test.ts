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
  image_url: null, image_kind: null, display_order: 1,
  advisory: null, advisory_note: null, advisory_url: null, advisory_date: null, ...over,
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

  it("a ordem dos fabricantes é cobertura de evidência, não EOA e não alfabeto", () => {
    const catalogo = [
      // Abbott: uma EOA altíssima, um tamanho só com dado.
      linha({ manufacturer: "Abbott", model_name: "Trifecta GT", size: 21, effective_orifice_area: 3.0 }),
      // Edwards: EOA menor, três tamanhos com dado.
      ...[21, 23, 25].map((size) =>
        linha({ manufacturer: "Edwards", size, effective_orifice_area: 2.0 })),
      // Medtronic: dois tamanhos com dado.
      ...[21, 23].map((size) =>
        linha({ manufacturer: "Medtronic", model_name: "Avalus", size, effective_orifice_area: 2.1 })),
    ];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(
      r.fabricantes.map((f) => f.fabricante),
      "por EOA seria Abbott (3,0) primeiro; por alfabeto também. É por cobertura.",
    ).toEqual(["Edwards", "Medtronic", "Abbott"]);
    expect(r.fabricantes.map((f) => f.comEoaPublicada)).toEqual([3, 2, 1]);
  });

  it("empatados em tamanhos, desempata quem cobre mais modelos", () => {
    // Os nomes vão CONTRA o alfabeto de propósito: "Zeta" precisa vir antes de
    // "Alfa". Sem isso o teste passaria mesmo sem o desempate por modelos, só
    // pelo alfabeto — foi assim que ele nasceu, e a mutação o pegou vazio.
    const catalogo = [
      // Zeta: 2 tamanhos espalhados em 2 modelos.
      linha({ manufacturer: "Zeta", model_name: "Perimount", size: 21, effective_orifice_area: 2.0 }),
      linha({ manufacturer: "Zeta", model_name: "Inspiris Resilia", size: 23, effective_orifice_area: 2.0 }),
      // Alfa: 2 tamanhos, 1 modelo só.
      ...[21, 23].map((size) =>
        linha({ manufacturer: "Alfa", model_name: "Avalus", size, effective_orifice_area: 2.0 })),
    ];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(r.fabricantes.map((f) => [f.fabricante, f.comEoaPublicada, f.modelosComDado])).toEqual([
      ["Zeta", 2, 2],
      ["Alfa", 2, 1],
    ]);
  });

  it("empatados em tamanhos e em modelos, aí sim vale o alfabeto", () => {
    const catalogo = ["Zeta", "Alfa"].flatMap((manufacturer) =>
      [21, 23].map((size) => linha({ manufacturer, size, effective_orifice_area: 2.0 })));
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(r.fabricantes.map((f) => f.fabricante)).toEqual(["Alfa", "Zeta"]);
  });

  it("tamanho sem dado publicado não conta a favor de ninguém na ordem", () => {
    const catalogo = [
      linha({ manufacturer: "Abbott", model_name: "Epic", size: 21, effective_orifice_area: 2.0 }),
      linha({ manufacturer: "Abbott", model_name: "Epic", size: 23, effective_orifice_area: 2.0 }),
      // Edwards com muitos tamanhos, e nenhum com EOA: fica atrás.
      ...[19, 21, 23, 25, 27].map((size) =>
        linha({ manufacturer: "Edwards", size, effective_orifice_area: null })),
      linha({ manufacturer: "Edwards", size: 29, effective_orifice_area: 2.0 }),
    ];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(r.fabricantes.map((f) => f.fabricante)).toEqual(["Abbott", "Edwards"]);
    expect(r.fabricantes.map((f) => f.semEoaPublicada)).toEqual([0, 5]);
  });

  it("a tela recebe o critério da ordem por escrito", () => {
    const r = recomendarProteses([linha({})], BSA, "aortica", 24);
    expect(r.criterioDeOrdem).toContain("cobertura de evidência");
    expect(r.criterioDeOrdem, "precisa negar que seja ranking").toMatch(/não é ranking/i);
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

  it("ficam de fora o anel e o transcateter — por motivos diferentes, e isso importa", () => {
    // O anel sai porque **não substitui a valva**: é fato sobre o dispositivo, e
    // projetar mismatch nele não significaria nada.
    expect(ehSubstituicao("anel_anuloplastia")).toBe(false);
    expect(ehSubstituicao("biologica_aortica")).toBe(true);
    expect(ehSubstituicao("mecanica")).toBe(true);

    // O transcateter sai por outra razão: **este site é de cirurgia valvar**. A
    // conta valeria para ele, e a ASE publica a tabela — não é que a válvula
    // seja pior nem que falte dado. Guardar os dois no mesmo teste sem dizer a
    // diferença faria o código parecer estar afirmando que TAVI não tem EOA.
    expect(ehSubstituicao("tavi")).toBe(false);

    const catalogo = [
      linha({ type: "anel_anuloplastia", effective_orifice_area: 2.2 }),
      linha({ id: "tavi", type: "tavi", effective_orifice_area: 2.2 }),
    ];
    const r = recomendarProteses(catalogo, BSA, "aortica", 24);
    expect(r.avaliadas).toBe(0);
    expect(r.fabricantes, "fabricante sem prótese de substituição nesta posição não vira cartão")
      .toHaveLength(0);
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

  describe("alerta regulatório", () => {
    /**
     * O caso real: a Trifecta GT tem EOA excelente (1,41 a 2,35 cm²) e a conta
     * de mismatch a aprova em quase todo paciente. A Abbott a retirou do
     * mercado em 31/07/2023 por deterioração estrutural precoce. O recomendador
     * a indicava — medido, antes desta correção.
     */
    const comAlerta = () => linha({
      manufacturer: "Abbott", model_name: "Trifecta GT", size: 19,
      effective_orifice_area: 2.2,
      advisory: "retirada_do_mercado",
      advisory_note: "Retirada do mercado dos EUA em 31/07/2023 por deterioração estrutural precoce.",
      advisory_url: "https://www.cardiovascular.abbott/exemplo.pdf",
      advisory_date: "2023-07-31",
    });

    it("prótese com alerta NUNCA entra em adequadas, mesmo com EOA ótima", () => {
      const r = recomendarProteses([comAlerta()], BSA, "aortica", 24);
      const f = r.fabricantes[0]!;
      expect(f.adequadas, "recomendou uma prótese retirada do mercado").toHaveLength(0);
      expect(f.insuficientes, "escondeu na lista errada").toHaveLength(0);
      expect(f.desaconselhadas).toHaveLength(1);
      expect(r.desaconselhadas).toBe(1);
    });

    it("o alerta viaja com a opção — motivo, link e data", () => {
      const o = recomendarProteses([comAlerta()], BSA, "aortica", 24).fabricantes[0]!.desaconselhadas[0]!;
      expect(o.alerta!.tipo).toBe("retirada_do_mercado");
      expect(o.alerta!.nota).toMatch(/deterioração estrutural precoce/);
      expect(o.alerta!.url).toMatch(/^https:/);
      expect(o.alerta!.data).toBe("2023-07-31");
    });

    it("sem alerta, nada muda: a prótese continua sendo indicada", () => {
      const r = recomendarProteses([linha({ effective_orifice_area: 2.2 })], BSA, "aortica", 24);
      expect(r.fabricantes[0]!.adequadas).toHaveLength(1);
      expect(r.desaconselhadas).toBe(0);
    });

    it("a prótese com alerta continua no catálogo — não é escondida", () => {
      // Quem já tem uma implantada precisa das medidas para valve-in-valve e
      // para ler o eco de seguimento. Sumir com ela tiraria a informação de
      // quem mais precisa dela.
      const r = recomendarProteses([comAlerta()], BSA, "aortica", 24);
      expect(r.avaliadas, "a prótese sumiu da avaliação").toBe(1);
      expect(r.fabricantes).toHaveLength(1);
    });
  });

  it("superfície corporal impossível não produz recomendação", () => {
    const r = recomendarProteses([linha({ effective_orifice_area: 2.2 })], 0, "aortica", 24);
    expect(r.avaliadas).toBe(0);
  });
});
