import { describe, it, expect } from "vitest";
import { calculateRisk } from "./riskScore";

describe("calculateRisk", () => {
  it("retorna score 0, categoria Baixo e breakdown vazio para input vazio", () => {
    const result = calculateRisk({});
    expect(result.score).toBe(0);
    expect(result.category).toBe("Baixo");
    expect(result.color).toBe("text-success");
    expect(result.breakdown).toEqual([]);
  });

  describe("idade", () => {
    it("não pontua abaixo de 50 anos", () => {
      expect(calculateRisk({ age: 49 }).score).toBe(0);
      expect(calculateRisk({ age: 49 }).breakdown).toEqual([]);
    });

    it("não pontua idade 0 (recém-nascido), mas processa o campo", () => {
      const result = calculateRisk({ age: 0 });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("pontua 5 para faixa [50, 60)", () => {
      expect(calculateRisk({ age: 50 }).score).toBe(5);
      expect(calculateRisk({ age: 59 }).score).toBe(5);
    });

    it("pontua 10 para faixa [60, 70)", () => {
      expect(calculateRisk({ age: 60 }).score).toBe(10);
      expect(calculateRisk({ age: 69 }).score).toBe(10);
    });

    it("pontua 18 para faixa [70, 80)", () => {
      expect(calculateRisk({ age: 70 }).score).toBe(18);
      expect(calculateRisk({ age: 79 }).score).toBe(18);
    });

    it("pontua 25 para 80+, sem teto adicional", () => {
      expect(calculateRisk({ age: 80 }).score).toBe(25);
      expect(calculateRisk({ age: 120 }).score).toBe(25);
    });

    it("ignora idade null, sem lançar erro", () => {
      const result = calculateRisk({ age: null });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("inclui detail com a idade no breakdown", () => {
      const result = calculateRisk({ age: 55 });
      expect(result.breakdown).toContainEqual({ label: "Idade", points: 5, detail: "55 anos" });
    });
  });

  describe("sexo", () => {
    it("pontua 3 para 'masculino'", () => {
      const result = calculateRisk({ sex: "masculino" });
      expect(result.score).toBe(3);
      expect(result.breakdown).toContainEqual({ label: "Sexo masculino", points: 3 });
    });

    it("não pontua para 'feminino'", () => {
      expect(calculateRisk({ sex: "feminino" }).score).toBe(0);
    });

    it("não pontua para variação de capitalização ('Masculino') — match é exato", () => {
      expect(calculateRisk({ sex: "Masculino" }).score).toBe(0);
    });

    it("ignora sex null", () => {
      expect(calculateRisk({ sex: null }).score).toBe(0);
    });
  });

  describe("NYHA", () => {
    it("classe I não pontua e não aparece no breakdown", () => {
      const result = calculateRisk({ nyha: "I" });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("classe II pontua 8", () => {
      const result = calculateRisk({ nyha: "II" });
      expect(result.score).toBe(8);
      expect(result.breakdown).toContainEqual({ label: "Classe NYHA II", points: 8 });
    });

    it("classe III pontua 18", () => {
      expect(calculateRisk({ nyha: "III" }).score).toBe(18);
    });

    it("classe IV pontua 28", () => {
      expect(calculateRisk({ nyha: "IV" }).score).toBe(28);
    });

    it("string desconhecida pontua 0 silenciosamente", () => {
      const result = calculateRisk({ nyha: "V" });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("ignora nyha null", () => {
      expect(calculateRisk({ nyha: null }).score).toBe(0);
    });
  });

  describe("fração de ejeção", () => {
    it("FE 0 é processada (checagem é != null, não truthy)", () => {
      const result = calculateRisk({ ejection_fraction: 0 });
      expect(result.score).toBe(22);
    });

    it("FE 29 pontua 22 (bucket <30)", () => {
      expect(calculateRisk({ ejection_fraction: 29 }).score).toBe(22);
    });

    it("FE exatamente 30 cai no bucket <40 (14 pts), não no bucket <30", () => {
      const result = calculateRisk({ ejection_fraction: 30 });
      expect(result.score).toBe(14);
      expect(result.breakdown).toContainEqual({
        label: "Disfunção sistólica",
        points: 14,
        detail: "FE 30%",
      });
    });

    it("FE 39 pontua 14", () => {
      expect(calculateRisk({ ejection_fraction: 39 }).score).toBe(14);
    });

    it("FE 40 pontua 7 (bucket <50)", () => {
      expect(calculateRisk({ ejection_fraction: 40 }).score).toBe(7);
    });

    it("FE 49 pontua 7", () => {
      expect(calculateRisk({ ejection_fraction: 49 }).score).toBe(7);
    });

    it("FE 50+ não pontua", () => {
      const result = calculateRisk({ ejection_fraction: 50 });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("ignora ejection_fraction null", () => {
      const result = calculateRisk({ ejection_fraction: null });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });
  });

  describe("severidade", () => {
    it("'leve' não pontua e não aparece no breakdown", () => {
      const result = calculateRisk({ severity: "leve" });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("'moderada' pontua 6", () => {
      expect(calculateRisk({ severity: "moderada" }).score).toBe(6);
    });

    it("'importante' pontua 14", () => {
      expect(calculateRisk({ severity: "importante" }).score).toBe(14);
    });

    it("'critica' pontua 22", () => {
      expect(calculateRisk({ severity: "critica" }).score).toBe(22);
    });

    it("'indeterminada' não pontua", () => {
      expect(calculateRisk({ severity: "indeterminada" }).score).toBe(0);
    });

    it("string desconhecida pontua 0 silenciosamente", () => {
      const result = calculateRisk({ severity: "gravissima" });
      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it("ignora severity null", () => {
      expect(calculateRisk({ severity: null }).score).toBe(0);
    });
  });

  describe("comorbidades", () => {
    it("array vazio não pontua", () => {
      expect(calculateRisk({ comorbidities: [] }).score).toBe(0);
    });

    it("null/undefined não pontua", () => {
      expect(calculateRisk({ comorbidities: null }).score).toBe(0);
      expect(calculateRisk({}).score).toBe(0);
    });

    it("1 comorbidade de alto risco pontua 4", () => {
      const result = calculateRisk({ comorbidities: ["DPOC"] });
      expect(result.score).toBe(4);
      expect(result.breakdown).toContainEqual({
        label: "Comorbidades de alto risco",
        points: 4,
        detail: "DPOC",
      });
    });

    it("4 comorbidades de alto risco atingem o teto de 16", () => {
      const result = calculateRisk({
        comorbidities: ["Doença renal crônica", "DPOC", "AVC prévio", "Doença arterial coronariana"],
      });
      expect(result.score).toBe(16);
    });

    it("5+ comorbidades de alto risco não ultrapassam o teto de 16", () => {
      const result = calculateRisk({
        comorbidities: [
          "Doença renal crônica",
          "DPOC",
          "AVC prévio",
          "Doença arterial coronariana",
          "Insuficiência cardíaca",
        ],
      });
      expect(result.score).toBe(16);
    });

    it("todas as 6 comorbidades de alto risco ainda ficam em 16 (teto)", () => {
      const result = calculateRisk({
        comorbidities: [
          "Doença renal crônica",
          "DPOC",
          "AVC prévio",
          "Doença arterial coronariana",
          "Insuficiência cardíaca",
          "Fibrilação atrial",
        ],
      });
      expect(result.score).toBe(16);
    });

    it("1 comorbidade 'outra' pontua 2", () => {
      const result = calculateRisk({ comorbidities: ["Diabetes"] });
      expect(result.score).toBe(2);
      expect(result.breakdown).toContainEqual({ label: "Outras comorbidades (1)", points: 2 });
    });

    it("3 comorbidades 'outras' atingem o teto de 6", () => {
      const result = calculateRisk({ comorbidities: ["Diabetes", "Obesidade", "Asma"] });
      expect(result.score).toBe(6);
    });

    it("4+ comorbidades 'outras' não ultrapassam o teto de 6", () => {
      const result = calculateRisk({ comorbidities: ["Diabetes", "Obesidade", "Asma", "Hipertensão"] });
      expect(result.score).toBe(6);
    });

    it("combina alto risco + outras em entradas separadas do breakdown", () => {
      const result = calculateRisk({
        comorbidities: ["DPOC", "AVC prévio", "Diabetes", "Obesidade"],
      });
      // 2 de alto risco (min(2*4,16)=8) + 2 outras (min(2*2,6)=4) = 12
      expect(result.score).toBe(12);
      expect(result.breakdown).toContainEqual({
        label: "Comorbidades de alto risco",
        points: 8,
        detail: "DPOC, AVC prévio",
      });
      expect(result.breakdown).toContainEqual({ label: "Outras comorbidades (2)", points: 4 });
    });

    it("string não reconhecida é tratada como 'outra' (diferente do comportamento de nyha/severity)", () => {
      const result = calculateRisk({ comorbidities: ["StringInventadaXYZ"] });
      expect(result.score).toBe(2);
      expect(result.breakdown).toContainEqual({ label: "Outras comorbidades (1)", points: 2 });
    });
  });

  describe("clamp em 100", () => {
    it("soma bruta acima de 100 é limitada a 100, mas o breakdown mantém os pontos não-escalados", () => {
      const result = calculateRisk({
        age: 85,
        sex: "masculino",
        nyha: "IV",
        ejection_fraction: 25,
        severity: "critica",
        comorbidities: [
          "Doença renal crônica",
          "DPOC",
          "AVC prévio",
          "Doença arterial coronariana",
          "Diabetes",
          "Obesidade",
          "Asma",
        ],
      });
      // 25 + 3 + 28 + 22 + 22 + 16 + 6 = 122 -> clamp em 100
      expect(result.score).toBe(100);
      expect(result.category).toBe("Muito alto");
      expect(result.breakdown).toContainEqual({ label: "Idade", points: 25, detail: "85 anos" });
      expect(result.breakdown).toContainEqual({ label: "Comorbidades de alto risco", points: 16, detail: "Doença renal crônica, DPOC, AVC prévio, Doença arterial coronariana" });
      expect(result.breakdown).toContainEqual({ label: "Outras comorbidades (3)", points: 6 });
    });
  });

  describe("categorias", () => {
    it("score 19 -> Baixo", () => {
      // importante(14) + idade 50-59(5) = 19
      const result = calculateRisk({ severity: "importante", age: 50 });
      expect(result.score).toBe(19);
      expect(result.category).toBe("Baixo");
      expect(result.color).toBe("text-success");
    });

    it("score 20 -> Intermediário", () => {
      // masculino(3) + nyha II(8) + FE 45 (7) + 1 outra comorbidade(2) = 20
      const result = calculateRisk({
        sex: "masculino",
        nyha: "II",
        ejection_fraction: 45,
        comorbidities: ["Diabetes"],
      });
      expect(result.score).toBe(20);
      expect(result.category).toBe("Intermediário");
      expect(result.color).toBe("text-accent-foreground");
    });

    it("score 39 -> Intermediário", () => {
      // idade 70-79(18) + nyha III(18) + masculino(3) = 39
      const result = calculateRisk({ age: 70, nyha: "III", sex: "masculino" });
      expect(result.score).toBe(39);
      expect(result.category).toBe("Intermediário");
    });

    it("score 40 -> Alto", () => {
      // masculino(3) + nyha II(8) + critica(22) + FE 45(7) = 40
      const result = calculateRisk({
        sex: "masculino",
        nyha: "II",
        severity: "critica",
        ejection_fraction: 45,
      });
      expect(result.score).toBe(40);
      expect(result.category).toBe("Alto");
      expect(result.color).toBe("text-warning");
    });

    it("score 64 -> Alto", () => {
      // idade 80+(25) + masculino(3) + nyha IV(28) + 2 comorbidades alto risco (8) = 64
      const result = calculateRisk({
        age: 80,
        sex: "masculino",
        nyha: "IV",
        comorbidities: ["DPOC", "AVC prévio"],
      });
      expect(result.score).toBe(64);
      expect(result.category).toBe("Alto");
    });

    it("score 65 -> Muito alto", () => {
      // idade 80+(25) + nyha IV(28) + 3 comorbidades alto risco (12) = 65
      const result = calculateRisk({
        age: 80,
        nyha: "IV",
        comorbidities: ["DPOC", "AVC prévio", "Doença renal crônica"],
      });
      expect(result.score).toBe(65);
      expect(result.category).toBe("Muito alto");
      expect(result.color).toBe("text-destructive");
    });
  });
});
