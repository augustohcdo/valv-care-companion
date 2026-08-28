import { describe, it, expect } from "vitest";
import { superficieCorporal, imc } from "./bsa";
import {
  classificarPPM, eoaPorContinuidade, dvi, avaliarHemodinamica,
  LIMIARES_PPM, IMC_OBESIDADE,
} from "./mismatch";

/**
 * Os limiares da Tabela 12, 13 e 15 da EACVI, medidos **dos dois lados de cada
 * fronteira**.
 *
 * Testar só o meio da faixa é o jeito mais confortável de não testar nada: um
 * `<` trocado por `<=` continua devolvendo "moderado" para 0,75 e passa. O que
 * pega o erro é 0,65 contra 0,66, e é isso que está escrito abaixo.
 */

/** 170 cm e 70 kg → 1,81 m² por DuBois. Usado como corpo de referência. */
const BSA = superficieCorporal(170, 70)!;

describe("superfície corporal e IMC", () => {
  it("DuBois bate com a conta feita à mão", () => {
    // 0,007184 × 170^0,725 × 70^0,425
    expect(BSA).toBeCloseTo(1.80971, 5);
  });

  it("entrada impossível devolve nulo em vez de NaN", () => {
    expect(superficieCorporal(0, 70)).toBeNull();
    expect(superficieCorporal(170, -1)).toBeNull();
    expect(imc(0, 70)).toBeNull();
  });

  it("o IMC bate", () => {
    expect(imc(170, 70)!).toBeCloseTo(24.22, 2);
    expect(imc(170, 87)!).toBeGreaterThanOrEqual(IMC_OBESIDADE);
  });
});

describe("mismatch prótese-paciente (Tabela 12)", () => {
  /** Fabrica uma EOA que dá exatamente a EOA indexada pedida neste corpo. */
  const eoaPara = (ieoa: number) => ieoa * BSA;

  const faixas: [
    "aortica" | "mitral", number | null, number, "ausente" | "moderado" | "grave",
  ][] = [
    // aórtica, IMC < 30: > 0,85 ausente · 0,66–0,85 moderado · ≤ 0,65 grave
    ["aortica", 24, 0.86, "ausente"],
    ["aortica", 24, 0.85, "moderado"],
    ["aortica", 24, 0.66, "moderado"],
    ["aortica", 24, 0.65, "grave"],
    ["aortica", 24, 0.5, "grave"],
    // aórtica, IMC ≥ 30: > 0,70 ausente · 0,56–0,70 moderado · ≤ 0,55 grave
    ["aortica", 32, 0.71, "ausente"],
    ["aortica", 32, 0.70, "moderado"],
    ["aortica", 32, 0.56, "moderado"],
    ["aortica", 32, 0.55, "grave"],
    // mitral, IMC < 30: > 1,2 ausente · 0,91–1,2 moderado · ≤ 0,90 grave
    ["mitral", 24, 1.21, "ausente"],
    ["mitral", 24, 1.20, "moderado"],
    ["mitral", 24, 0.91, "moderado"],
    ["mitral", 24, 0.90, "grave"],
    // mitral, IMC ≥ 30: > 1,0 ausente · 0,76–1,0 moderado · ≤ 0,75 grave
    ["mitral", 32, 1.01, "ausente"],
    ["mitral", 32, 1.00, "moderado"],
    ["mitral", 32, 0.76, "moderado"],
    ["mitral", 32, 0.75, "grave"],
  ];

  it("cada fronteira cai do lado que a tabela publicada manda", () => {
    for (const [posicao, imcPaciente, ieoa, esperado] of faixas) {
      const r = classificarPPM(eoaPara(ieoa), BSA, posicao, "medida", imcPaciente)!;
      expect(r.ieoa).toBeCloseTo(ieoa, 9);
      expect(
        r.grau,
        `${posicao} IMC ${imcPaciente} iEOA ${ieoa} deveria ser ${esperado}, veio ${r.grau}`,
      ).toBe(esperado);
    }
  });

  it("IMC 30 já é a coluna de obesidade — 29,9 não é", () => {
    const eoa = eoaPara(0.6);
    expect(classificarPPM(eoa, BSA, "aortica", "medida", 30)!.faixaDeObesidade).toBe(true);
    expect(classificarPPM(eoa, BSA, "aortica", "medida", 29.9)!.faixaDeObesidade).toBe(false);
    // E a troca de coluna muda o grau: 0,60 é grave no magro e moderado no obeso.
    expect(classificarPPM(eoa, BSA, "aortica", "medida", 29.9)!.grau).toBe("grave");
    expect(classificarPPM(eoa, BSA, "aortica", "medida", 30)!.grau).toBe("moderado");
  });

  it("sem IMC informado usa a coluna mais exigente, nunca a mais permissiva", () => {
    // Não informar o IMC não pode fazer o resultado parecer melhor do que é.
    const eoa = eoaPara(0.6);
    const semImc = classificarPPM(eoa, BSA, "aortica", "medida", null)!;
    expect(semImc.faixaDeObesidade).toBe(false);
    expect(semImc.grau).toBe("grave");
  });

  it("a origem do dado viaja com o resultado", () => {
    // A tela precisa poder dizer "projetada" ou "medida"; são leituras
    // clinicamente diferentes, e a projeção superestima o mismatch.
    expect(classificarPPM(1.5, BSA, "aortica", "projetada")!.origem).toBe("projetada");
    expect(classificarPPM(1.5, BSA, "aortica", "medida")!.origem).toBe("medida");
  });

  it("os limiares publicados são os que a tela mostra", () => {
    const r = classificarPPM(1.5, BSA, "aortica", "medida", 24)!;
    expect(r.limiares).toEqual(LIMIARES_PPM.aortica.normal);
  });

  it("entrada impossível devolve nulo", () => {
    expect(classificarPPM(0, BSA, "aortica", "medida")).toBeNull();
    expect(classificarPPM(1.5, 0, "aortica", "medida")).toBeNull();
  });
});

describe("equação de continuidade e DVI", () => {
  it("a EOA por continuidade bate com a conta à mão", () => {
    // VSVE 20 mm → área 3,1416 cm²; × VTI 20 cm ÷ VTI prótese 60 cm = 1,047 cm²
    expect(eoaPorContinuidade(20, 20, 60)!).toBeCloseTo(1.0472, 3);
  });

  it("1 mm a mais na VSVE muda a EOA em ~10% — o campo mais sensível da conta", () => {
    const a = eoaPorContinuidade(20, 20, 60)!;
    const b = eoaPorContinuidade(21, 20, 60)!;
    expect((b - a) / a).toBeGreaterThan(0.09);
  });

  it("o DVI se inverte entre aórtica e mitral", () => {
    // É o erro clássico: na aórtica é VSVE/prótese, na mitral é prótese/VSVE.
    expect(dvi("aortica", 20, 60)!).toBeCloseTo(1 / 3, 6);
    expect(dvi("mitral", 20, 60)!).toBeCloseTo(3, 6);
  });

  it("entrada impossível devolve nulo", () => {
    expect(eoaPorContinuidade(0, 20, 60)).toBeNull();
    expect(dvi("aortica", 20, 0)).toBeNull();
  });
});

describe("leitura do gradiente (Tabelas 13 e 15)", () => {
  it("aórtica: cada fronteira cai do lado publicado", () => {
    const casos: [Parameters<typeof avaliarHemodinamica>[1], string][] = [
      [{ velocidadePico: 2.9 }, "normal"], [{ velocidadePico: 3 }, "possivel"],
      [{ velocidadePico: 3.9 }, "possivel"], [{ velocidadePico: 4 }, "significativa"],
      [{ gradienteMedio: 19 }, "normal"], [{ gradienteMedio: 20 }, "possivel"],
      [{ gradienteMedio: 34 }, "possivel"], [{ gradienteMedio: 35 }, "significativa"],
      [{ dvi: 0.35 }, "normal"], [{ dvi: 0.34 }, "possivel"],
      [{ dvi: 0.25 }, "possivel"], [{ dvi: 0.24 }, "significativa"],
      [{ eoa: 1.2 }, "normal"], [{ eoa: 1.1 }, "possivel"],
      [{ eoa: 0.8 }, "possivel"], [{ eoa: 0.79 }, "significativa"],
      [{ tempoAceleracao: 79 }, "normal"], [{ tempoAceleracao: 80 }, "possivel"],
      [{ tempoAceleracao: 100 }, "possivel"], [{ tempoAceleracao: 101 }, "significativa"],
    ];
    for (const [entrada, esperado] of casos) {
      const r = avaliarHemodinamica("aortica", entrada);
      expect(r.achados, JSON.stringify(entrada)).toHaveLength(1);
      expect(r.achados[0]!.leitura, JSON.stringify(entrada)).toBe(esperado);
    }
  });

  it("mitral: cada fronteira cai do lado publicado", () => {
    const casos: [Parameters<typeof avaliarHemodinamica>[1], string][] = [
      [{ velocidadePico: 1.8 }, "normal"], [{ velocidadePico: 1.9 }, "possivel"],
      [{ velocidadePico: 2.4 }, "possivel"], [{ velocidadePico: 2.5 }, "significativa"],
      [{ gradienteMedio: 5 }, "normal"], [{ gradienteMedio: 6 }, "possivel"],
      [{ gradienteMedio: 9 }, "possivel"], [{ gradienteMedio: 10 }, "significativa"],
      [{ dvi: 2.1 }, "normal"], [{ dvi: 2.2 }, "possivel"],
      [{ dvi: 2.5 }, "possivel"], [{ dvi: 2.6 }, "significativa"],
      [{ eoa: 2 }, "normal"], [{ eoa: 1.9 }, "possivel"],
      [{ eoa: 1 }, "possivel"], [{ eoa: 0.9 }, "significativa"],
      [{ tempoHemipressao: 129 }, "normal"], [{ tempoHemipressao: 130 }, "possivel"],
      [{ tempoHemipressao: 200 }, "possivel"], [{ tempoHemipressao: 201 }, "significativa"],
    ];
    for (const [entrada, esperado] of casos) {
      const r = avaliarHemodinamica("mitral", entrada);
      expect(r.achados, JSON.stringify(entrada)).toHaveLength(1);
      expect(r.achados[0]!.leitura, JSON.stringify(entrada)).toBe(esperado);
    }
  });

  it("o tempo de aceleração é da aórtica, e o PHT é da mitral — não se cruzam", () => {
    expect(avaliarHemodinamica("aortica", { tempoHemipressao: 300 }).achados).toHaveLength(0);
    expect(avaliarHemodinamica("mitral", { tempoAceleracao: 300 }).achados).toHaveLength(0);
  });

  it("sem nenhuma medida não existe leitura — nem a leitura 'normal'", () => {
    // Ausência de dado nunca vira laudo tranquilizador.
    const r = avaliarHemodinamica("aortica", {});
    expect(r.informados).toBe(0);
    expect(r.pior).toBeNull();
    expect(r.conclusao).toBeNull();
  });

  it("gradiente alto com DVI preservado é lido como mismatch, não obstrução", () => {
    const r = avaliarHemodinamica("aortica", {
      gradienteMedio: 30, dvi: 0.4, eoa: 1.0, eoaReferencia: 1.1,
    });
    expect(r.conclusao).toMatch(/mismatch/i);
    expect(r.diferencaParaReferencia!).toBeCloseTo(0.1, 6);
  });

  it("gradiente alto com DVI baixo não é chamado de mismatch", () => {
    const r = avaliarHemodinamica("aortica", { gradienteMedio: 40, dvi: 0.2, eoa: 0.7 });
    expect(r.pior).toBe("significativa");
    expect(r.conclusao).not.toMatch(/mismatch/i);
  });

  it("a pior coluna atingida é a que sai, mesmo com outros parâmetros normais", () => {
    const r = avaliarHemodinamica("aortica", { velocidadePico: 2, gradienteMedio: 40 });
    expect(r.pior).toBe("significativa");
  });

  it("nenhuma conclusão emite conduta nem carimba diretriz", () => {
    // Número calculado não recebe classe de recomendação: é a regra que já vale
    // para o conteúdo gerado por IA neste projeto.
    const textos = [
      avaliarHemodinamica("aortica", { gradienteMedio: 40, dvi: 0.2 }).conclusao!,
      avaliarHemodinamica("aortica", { gradienteMedio: 30, dvi: 0.4 }).conclusao!,
      avaliarHemodinamica("aortica", { gradienteMedio: 5 }).conclusao!,
      avaliarHemodinamica("mitral", { gradienteMedio: 12 }).conclusao!,
    ];
    for (const t of textos) {
      expect(t).not.toMatch(/Classe I|Classe II|ESC 20|AHA|indica(do|ção) cir[úu]rgic/i);
    }
  });
});
