import { describe, it, expect } from "vitest";
import {
  MEDIDAS, MEDIDAS_DO_EXAME, validarMedida, paraBanco, diferencas,
  doExameParaFormulario, medidasFaltantesNoCaso,
} from "./caseFields";

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

describe("doExameParaFormulario", () => {
  it("traz as medidas do exame já como texto do formulário", () => {
    const v = doExameParaFormulario({
      ejection_fraction: 42, mean_gradient: 48, valve_area: 0.8,
      regurgitation_grade: "2+/4+",
    });
    expect(v).toEqual({
      ejection_fraction: "42", mean_gradient: "48", valve_area: "0.8",
      regurgitation_grade: "2+/4+",
    });
  });

  it("ignora medida ausente em vez de preencher com vazio", () => {
    const v = doExameParaFormulario({ ejection_fraction: 55, mean_gradient: null });
    expect(v).toEqual({ ejection_fraction: "55" });
  });

  it("gradiente zero é medida, não ausência", () => {
    // `if (v)` descartaria o zero. Gradiente médio 0 mmHg existe em prótese
    // funcionante; perder esse valor seria apagar um achado normal.
    expect(doExameParaFormulario({ mean_gradient: 0 })).toEqual({ mean_gradient: "0" });
  });

  it("grau de regurgitação em branco não entra", () => {
    expect(doExameParaFormulario({ regurgitation_grade: "   " })).toEqual({});
  });
});

describe("medidasFaltantesNoCaso", () => {
  it("oferece só o que o caso não tem", () => {
    const faltam = medidasFaltantesNoCaso(
      { ejection_fraction: 60, mean_gradient: null, valve_area: null },
      { ejection_fraction: 42, mean_gradient: 48, valve_area: 0.8 },
    );
    // A FE do caso já está preenchida: sobrescrever o que o médico digitou,
    // em silêncio, é justamente o que não se quer.
    expect(faltam).toEqual({ mean_gradient: 48, valve_area: 0.8 });
  });

  it("não oferece nada quando o caso já está completo", () => {
    expect(
      medidasFaltantesNoCaso({ ejection_fraction: 60 }, { ejection_fraction: 42 }),
    ).toEqual({});
  });

  it("devolve número para medida e texto para o grau de regurgitação", () => {
    const faltam = medidasFaltantesNoCaso({}, { valve_area: 0.8, regurgitation_grade: "2+/4+" });
    expect(faltam.valve_area).toBe(0.8);
    expect(faltam.regurgitation_grade).toBe("2+/4+");
  });
});
