import { describe, it, expect } from "vitest";
import { MEDIDAS, MEDIDAS_DO_EXAME, validarMedida, paraBanco, diferencas } from "./caseFields";

const campo = (k: string) => MEDIDAS.find((m) => m.key === k)!;

describe("validarMedida", () => {
  it("aceita vazio — medida ausente é informação legítima", () => {
    // Foi para isso que a rodada do score existiu: ausência não pode virar zero.
    expect(validarMedida(campo("ejection_fraction"), "")).toBeNull();
    expect(validarMedida(campo("ejection_fraction"), "   ")).toBeNull();
  });

  it("aceita vírgula decimal, que é como se digita em português", () => {
    expect(validarMedida(campo("valve_area"), "0,8")).toBeNull();
  });

  it("recusa fora da faixa que o banco impõe", () => {
    // FE 150 existe no mundo real como erro de digitação, e o CHECK do banco
    // recusaria com erro cru. Aqui a recusa chega legível.
    expect(validarMedida(campo("ejection_fraction"), "150")).toMatch(/entre 0 e 100/);
    expect(validarMedida(campo("valve_area"), "12")).toMatch(/entre 0 e 10/);
    expect(validarMedida(campo("patient_age"), "130")).toMatch(/entre 0 e 120/);
  });

  it("recusa texto que não é número", () => {
    expect(validarMedida(campo("mean_gradient"), "quarenta")).toMatch(/apenas números/);
  });
});

describe("paraBanco", () => {
  it("vazio vira null, nunca zero", () => {
    expect(paraBanco(campo("ejection_fraction"), "")).toBeNull();
  });

  it("idade é inteira; área valvar guarda duas casas", () => {
    expect(paraBanco(campo("patient_age"), "65,4")).toBe(65);
    expect(paraBanco(campo("valve_area"), "0,825")).toBe(0.83);
  });
});

describe("MEDIDAS_DO_EXAME", () => {
  it("são as que o exame consegue preencher, e a idade não é uma delas", () => {
    const chaves = MEDIDAS_DO_EXAME.map((m) => m.key);
    expect(chaves).toContain("ejection_fraction");
    expect(chaves).toContain("valve_area");
    expect(chaves).not.toContain("patient_age");
  });
});

describe("diferencas", () => {
  it("registra o antes e o depois de cada campo alterado", () => {
    // "Caso atualizado" sem dizer o que mudou não serve de trilha de prontuário.
    const d = diferencas(
      { ejection_fraction: 60, nyha: "II" },
      { ejection_fraction: 42, nyha: "II" },
    );
    expect(d).toEqual({ ejection_fraction: { de: 60, para: 42 } });
  });

  it("compara lista por conteúdo, não por referência", () => {
    const iguais = diferencas({ symptoms: ["Fadiga"] }, { symptoms: ["Fadiga"] });
    expect(iguais).toEqual({});

    const mudou = diferencas({ symptoms: ["Fadiga"] }, { symptoms: ["Fadiga", "Tontura"] });
    expect(mudou.symptoms).toEqual({ de: ["Fadiga"], para: ["Fadiga", "Tontura"] });
  });

  it("enxerga preenchimento de campo que estava vazio", () => {
    const d = diferencas({ ejection_fraction: null }, { ejection_fraction: 42 });
    expect(d.ejection_fraction).toEqual({ de: null, para: 42 });
  });
});
