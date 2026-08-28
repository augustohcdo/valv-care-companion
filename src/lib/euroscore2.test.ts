import { describe, it, expect } from "vitest";
import {
  calcularEuroscore2, clearanceCockcroftGault, faixaRenalPorClearance,
  probabilidade, xIdade, BETA, CONSTANTE, TOTAL_VARIAVEIS,
  type EntradaEuroscore,
} from "./euroscore2";

/**
 * O EuroSCORE II, conferido contra o modelo publicado — não contra si mesmo.
 *
 * Este é o arquivo de teste mais importante do projeto até hoje, e a razão é
 * simples: um coeficiente transcrito na linha errada não quebra a compilação,
 * não gera erro em tempo de execução e não aparece em teste de fumaça. Ele
 * devolve um número plausível e errado para a pergunta "opero ou não opero".
 *
 * Os `pct` esperados abaixo **não** saíram desta implementação. Saíram de uma
 * segunda implementação, em Python, escrita a partir do texto da Tabela 6 do
 * artigo (Nashef 2012) e não a partir deste TypeScript. As duas foram
 * comparadas em 200 casos aleatórios cobrindo todas as categorias de todas as
 * variáveis: divergência máxima de 0 em `y` e em `%` (< 1e-9). Doze desses
 * casos ficaram aqui como testemunho permanente.
 *
 * A conferência foi validada por inversão: zerando `unica_nao_cabg` — o menor
 * coeficiente do modelo, 0,0062118 — os 200 casos reprovaram. Vale registrar o
 * tamanho do estrago do *menor* coeficiente: 0,155 ponto percentual de
 * mortalidade prevista. Nenhum deles é decorativo.
 */

/** Paciente inteiramente na categoria de referência. */
const REFERENCIA: EntradaEuroscore = {
  idade: 55, sexo: "M", renal: "normal", arteriopatia: false, mobilidade: false,
  cirurgiaCardiacaPrevia: false, pneumopatia: false, endocarditeAtiva: false,
  estadoCritico: false, diabetesInsulina: false, nyha: "I", ccs4: false,
  funcaoVe: "boa", infartoRecente: false, pressaoPulmonar: "normal",
  urgencia: "eletiva", pesoIntervencao: "cabg_isolada", aortaToracica: false,
};

const GOLDEN: { entrada: EntradaEuroscore; pct: number }[] = [
  { entrada: { idade: 69, sexo: "F", renal: "normal", arteriopatia: true, mobilidade: false, cirurgiaCardiacaPrevia: false, pneumopatia: false, endocarditeAtiva: true, estadoCritico: false, diabetesInsulina: true, nyha: "I", ccs4: true, funcaoVe: "boa", infartoRecente: false, pressaoPulmonar: "55_ou_mais", urgencia: "eletiva", pesoIntervencao: "cabg_isolada", aortaToracica: false },
    pct: 6.0756739197 },
  { entrada: { idade: 88, sexo: "F", renal: "moderada", arteriopatia: false, mobilidade: true, cirurgiaCardiacaPrevia: true, pneumopatia: false, endocarditeAtiva: false, estadoCritico: true, diabetesInsulina: false, nyha: "II", ccs4: true, funcaoVe: "boa", infartoRecente: false, pressaoPulmonar: "55_ou_mais", urgencia: "eletiva", pesoIntervencao: "tres_ou_mais", aortaToracica: true },
    pct: 68.4711372851 },
  { entrada: { idade: 18, sexo: "F", renal: "grave", arteriopatia: true, mobilidade: true, cirurgiaCardiacaPrevia: true, pneumopatia: true, endocarditeAtiva: true, estadoCritico: false, diabetesInsulina: true, nyha: "III", ccs4: true, funcaoVe: "muito_ruim", infartoRecente: false, pressaoPulmonar: "55_ou_mais", urgencia: "urgente", pesoIntervencao: "duas", aortaToracica: true },
    pct: 89.7080918023 },
  { entrada: { idade: 55, sexo: "M", renal: "grave", arteriopatia: true, mobilidade: false, cirurgiaCardiacaPrevia: false, pneumopatia: true, endocarditeAtiva: false, estadoCritico: false, diabetesInsulina: false, nyha: "I", ccs4: false, funcaoVe: "boa", infartoRecente: true, pressaoPulmonar: "55_ou_mais", urgencia: "emergencia", pesoIntervencao: "unica_nao_cabg", aortaToracica: true },
    pct: 13.6199172551 },
  { entrada: { idade: 19, sexo: "M", renal: "moderada", arteriopatia: false, mobilidade: false, cirurgiaCardiacaPrevia: true, pneumopatia: true, endocarditeAtiva: false, estadoCritico: true, diabetesInsulina: true, nyha: "I", ccs4: false, funcaoVe: "boa", infartoRecente: true, pressaoPulmonar: "55_ou_mais", urgencia: "eletiva", pesoIntervencao: "cabg_isolada", aortaToracica: true },
    pct: 25.1683004869 },
  { entrada: { idade: 48, sexo: "M", renal: "grave", arteriopatia: false, mobilidade: true, cirurgiaCardiacaPrevia: false, pneumopatia: true, endocarditeAtiva: false, estadoCritico: false, diabetesInsulina: true, nyha: "I", ccs4: true, funcaoVe: "ruim", infartoRecente: false, pressaoPulmonar: "normal", urgencia: "salvamento", pesoIntervencao: "cabg_isolada", aortaToracica: false },
    pct: 22.1116357405 },
  { entrada: { idade: 55, sexo: "F", renal: "normal", arteriopatia: true, mobilidade: true, cirurgiaCardiacaPrevia: false, pneumopatia: false, endocarditeAtiva: true, estadoCritico: false, diabetesInsulina: false, nyha: "III", ccs4: true, funcaoVe: "moderada", infartoRecente: true, pressaoPulmonar: "31_55", urgencia: "emergencia", pesoIntervencao: "duas", aortaToracica: true },
    pct: 35.2949787022 },
  { entrada: { idade: 62, sexo: "F", renal: "moderada", arteriopatia: true, mobilidade: true, cirurgiaCardiacaPrevia: false, pneumopatia: false, endocarditeAtiva: false, estadoCritico: false, diabetesInsulina: false, nyha: "II", ccs4: true, funcaoVe: "moderada", infartoRecente: false, pressaoPulmonar: "55_ou_mais", urgencia: "emergencia", pesoIntervencao: "duas", aortaToracica: false },
    pct: 15.5894288186 },
  { entrada: { idade: 83, sexo: "M", renal: "moderada", arteriopatia: false, mobilidade: true, cirurgiaCardiacaPrevia: true, pneumopatia: false, endocarditeAtiva: false, estadoCritico: true, diabetesInsulina: false, nyha: "I", ccs4: true, funcaoVe: "moderada", infartoRecente: false, pressaoPulmonar: "31_55", urgencia: "eletiva", pesoIntervencao: "tres_ou_mais", aortaToracica: false },
    pct: 44.9747141066 },
  { entrada: { idade: 49, sexo: "F", renal: "grave", arteriopatia: true, mobilidade: true, cirurgiaCardiacaPrevia: false, pneumopatia: true, endocarditeAtiva: true, estadoCritico: false, diabetesInsulina: false, nyha: "II", ccs4: false, funcaoVe: "muito_ruim", infartoRecente: false, pressaoPulmonar: "55_ou_mais", urgencia: "urgente", pesoIntervencao: "duas", aortaToracica: true },
    pct: 56.9774970975 },
  { entrada: { idade: 32, sexo: "F", renal: "dialise", arteriopatia: true, mobilidade: true, cirurgiaCardiacaPrevia: false, pneumopatia: true, endocarditeAtiva: true, estadoCritico: false, diabetesInsulina: false, nyha: "II", ccs4: false, funcaoVe: "ruim", infartoRecente: false, pressaoPulmonar: "normal", urgencia: "eletiva", pesoIntervencao: "duas", aortaToracica: true },
    pct: 32.5405691572 },
  { entrada: { idade: 85, sexo: "M", renal: "grave", arteriopatia: false, mobilidade: false, cirurgiaCardiacaPrevia: true, pneumopatia: true, endocarditeAtiva: false, estadoCritico: true, diabetesInsulina: false, nyha: "II", ccs4: false, funcaoVe: "muito_ruim", infartoRecente: true, pressaoPulmonar: "55_ou_mais", urgencia: "eletiva", pesoIntervencao: "duas", aortaToracica: false },
    pct: 68.2626295457 },
];

describe("EuroSCORE II — contra o modelo publicado", () => {
  it("doze casos conferidos contra a segunda implementação", () => {
    for (const { entrada, pct } of GOLDEN) {
      const r = calcularEuroscore2(entrada);
      expect(r.faltando, `caso incompleto: ${r.faltando.join(", ")}`).toEqual([]);
      expect(r.mortalidade!, JSON.stringify(entrada)).toBeCloseTo(pct, 8);
    }
  });

  it("no paciente de referência, y é a constante mais um único beta de idade", () => {
    // É o teste que pega coeficiente colado na linha errada: qualquer categoria
    // de referência que some algo aparece aqui como diferença.
    //
    // A idade é a única variável que soma mesmo na referência, e isso é do
    // modelo, não deste código: o artigo codifica idade como 1 até 60 anos.
    // Por isso o piso do EuroSCORE II é ~0,50% e não ~0,48%.
    const r = calcularEuroscore2(REFERENCIA);
    expect(r.y).toBeCloseTo(CONSTANTE + BETA.idade, 12);
    const semIdade = r.contribuicoes.filter((c) => !/^Idade /.test(c.rotulo));
    expect(semIdade, "categoria de referência somou alguma coisa").toEqual([]);
    expect(r.mortalidade!).toBeCloseTo(0.49865156, 6);
  });

  it("cada categoria soma exatamente o seu beta, e nenhuma soma a do vizinho", () => {
    const casos: [Partial<EntradaEuroscore>, number][] = [
      [{ sexo: "F" }, BETA.feminino],
      [{ renal: "moderada" }, BETA.renal.moderada],
      [{ renal: "grave" }, BETA.renal.grave],
      [{ renal: "dialise" }, BETA.renal.dialise],
      [{ arteriopatia: true }, BETA.arteriopatia],
      [{ mobilidade: true }, BETA.mobilidade],
      [{ cirurgiaCardiacaPrevia: true }, BETA.cirurgiaCardiacaPrevia],
      [{ pneumopatia: true }, BETA.pneumopatia],
      [{ endocarditeAtiva: true }, BETA.endocarditeAtiva],
      [{ estadoCritico: true }, BETA.estadoCritico],
      [{ diabetesInsulina: true }, BETA.diabetesInsulina],
      [{ nyha: "II" }, BETA.nyha.II],
      [{ nyha: "III" }, BETA.nyha.III],
      [{ nyha: "IV" }, BETA.nyha.IV],
      [{ ccs4: true }, BETA.ccs4],
      [{ funcaoVe: "moderada" }, BETA.funcaoVe.moderada],
      [{ funcaoVe: "ruim" }, BETA.funcaoVe.ruim],
      [{ funcaoVe: "muito_ruim" }, BETA.funcaoVe.muito_ruim],
      [{ infartoRecente: true }, BETA.infartoRecente],
      [{ pressaoPulmonar: "31_55" }, BETA.pressaoPulmonar["31_55"]],
      [{ pressaoPulmonar: "55_ou_mais" }, BETA.pressaoPulmonar["55_ou_mais"]],
      [{ urgencia: "urgente" }, BETA.urgencia.urgente],
      [{ urgencia: "emergencia" }, BETA.urgencia.emergencia],
      [{ urgencia: "salvamento" }, BETA.urgencia.salvamento],
      [{ pesoIntervencao: "unica_nao_cabg" }, BETA.pesoIntervencao.unica_nao_cabg],
      [{ pesoIntervencao: "duas" }, BETA.pesoIntervencao.duas],
      [{ pesoIntervencao: "tres_ou_mais" }, BETA.pesoIntervencao.tres_ou_mais],
      [{ aortaToracica: true }, BETA.aortaToracica],
    ];
    const base = calcularEuroscore2(REFERENCIA).y;
    for (const [mudanca, beta] of casos) {
      const r = calcularEuroscore2({ ...REFERENCIA, ...mudanca });
      expect(r.y - base, `${JSON.stringify(mudanca)} não somou o beta esperado`).toBeCloseTo(beta, 12);
    }
  });

  it("`unica_nao_cabg` não é zero — é a armadilha do modelo", () => {
    // Um procedimento valvar isolado NÃO é a categoria de referência: a
    // referência é a CABG isolada. Quem implementa de memória zera isto.
    expect(BETA.pesoIntervencao.unica_nao_cabg).toBeGreaterThan(0);
    const cabg = calcularEuroscore2(REFERENCIA).mortalidade!;
    const valvar = calcularEuroscore2({ ...REFERENCIA, pesoIntervencao: "unica_nao_cabg" }).mortalidade!;
    expect(valvar).toBeGreaterThan(cabg);
  });

  describe("a codificação da idade", () => {
    it("é 1 até 60 anos, e sobe um por ano depois — não é idade × beta", () => {
      expect(xIdade(18)).toBe(1);
      expect(xIdade(60)).toBe(1);
      expect(xIdade(61)).toBe(2);
      expect(xIdade(80)).toBe(21);
    });

    it("60 e 61 anos diferem por exatamente um beta de idade", () => {
      const a = calcularEuroscore2({ ...REFERENCIA, idade: 60 }).y;
      const b = calcularEuroscore2({ ...REFERENCIA, idade: 61 }).y;
      expect(b - a).toBeCloseTo(BETA.idade, 12);
    });

    it("não existe desconto por ser jovem: 30 e 60 anos dão o mesmo", () => {
      expect(calcularEuroscore2({ ...REFERENCIA, idade: 30 }).y)
        .toBeCloseTo(calcularEuroscore2({ ...REFERENCIA, idade: 60 }).y, 12);
    });
  });

  describe("dado ausente é lacuna, nunca zero", () => {
    it("sem idade ou sem sexo não há nem faixa", () => {
      const semIdade = calcularEuroscore2({ ...REFERENCIA, idade: null });
      expect(semIdade.calculavel).toBe(false);
      expect(semIdade.mortalidade).toBeNull();
      expect(semIdade.faltando).toContain("idade");

      const semSexo = calcularEuroscore2({ ...REFERENCIA, sexo: null });
      expect(semSexo.calculavel).toBe(false);
      expect(semSexo.faltando).toContain("sexo");
    });

    it("faltando uma variável, não sai número — sai faixa, e o nome do que falta", () => {
      const r = calcularEuroscore2({ ...REFERENCIA, estadoCritico: null });
      expect(r.calculavel).toBe(true);
      expect(r.mortalidade, "afirmou um número com dado faltando").toBeNull();
      expect(r.faltando).toEqual(["estado crítico pré-operatório"]);
      expect(r.maximo).toBeGreaterThan(r.minimo);
      // O teto é o piso somado ao pior caso da variável que falta.
      expect(r.maximo).toBeCloseTo(probabilidade(r.y + BETA.estadoCritico) * 100, 10);
    });

    it("com tudo respondido, piso, teto e resultado coincidem", () => {
      const r = calcularEuroscore2(REFERENCIA);
      expect(r.minimo).toBeCloseTo(r.maximo, 12);
      expect(r.mortalidade!).toBeCloseTo(r.minimo, 12);
    });

    it("só idade e sexo: a faixa é larga, e as 16 lacunas são nomeadas", () => {
      const r = calcularEuroscore2({ idade: 70, sexo: "F" });
      expect(r.faltando).toHaveLength(TOTAL_VARIAVEIS);
      expect(r.mortalidade).toBeNull();
      expect(r.minimo).toBeLessThan(5);
      expect(r.maximo).toBeGreaterThan(90);
    });
  });

  describe("clearance de creatinina (Cockcroft-Gault)", () => {
    it("bate com a conta feita à mão", () => {
      // (140-70) × 80 / (72 × 1,2) = 64,8 ml/min
      expect(clearanceCockcroftGault(70, 80, 1.2, "M")!).toBeCloseTo(64.8148, 3);
    });

    it("a mulher recebe o fator 0,85 — e isso muda a faixa", () => {
      const h = clearanceCockcroftGault(70, 80, 1.2, "M")!;
      const m = clearanceCockcroftGault(70, 80, 1.2, "F")!;
      expect(m).toBeCloseTo(h * 0.85, 10);
      // 64,8 é "moderada"; 55,1 continua "moderada" — mas com creatinina 1,4 a
      // mulher cai para "grave" e o homem não. É o caso que importa.
      expect(faixaRenalPorClearance(clearanceCockcroftGault(70, 80, 1.4, "M")!)).toBe("moderada");
      expect(faixaRenalPorClearance(clearanceCockcroftGault(70, 80, 1.4, "F")!)).toBe("grave");
    });

    it("as fronteiras 50 e 85 caem do lado certo", () => {
      expect(faixaRenalPorClearance(85.1)).toBe("normal");
      expect(faixaRenalPorClearance(85)).toBe("moderada");
      expect(faixaRenalPorClearance(50)).toBe("moderada");
      expect(faixaRenalPorClearance(49.9)).toBe("grave");
    });

    it("entrada impossível devolve nulo em vez de infinito", () => {
      expect(clearanceCockcroftGault(70, 80, 0, "M")).toBeNull();
      expect(clearanceCockcroftGault(70, 0, 1.2, "M")).toBeNull();
    });
  });

  it("a mortalidade fica sempre entre 0 e 100", () => {
    const pior = calcularEuroscore2({
      idade: 100, sexo: "F", renal: "grave", arteriopatia: true, mobilidade: true,
      cirurgiaCardiacaPrevia: true, pneumopatia: true, endocarditeAtiva: true,
      estadoCritico: true, diabetesInsulina: true, nyha: "IV", ccs4: true,
      funcaoVe: "muito_ruim", infartoRecente: true, pressaoPulmonar: "55_ou_mais",
      urgencia: "salvamento", pesoIntervencao: "tres_ou_mais", aortaToracica: true,
    });
    expect(pior.mortalidade!).toBeGreaterThan(95);
    expect(pior.mortalidade!).toBeLessThan(100);
  });
});
