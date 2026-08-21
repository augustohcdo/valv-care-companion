import { describe, it, expect } from "vitest";
import {
  MEDIDAS, MEDIDAS_DO_EXAME, validarMedida, paraBanco, diferencas,
  doExameParaFormulario, medidasFaltantesNoCaso,
  compararComExame, suspeitaDeErro,
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

describe("unidades do par caso × exame", () => {
  /**
   * A garantia mais silenciosa das quatro: os dois lados de cada par usam a
   * mesma unidade, então copiar é copiar — nunca converter. Um campo futuro que
   * quebrasse isso (área em mm², gradiente em kPa) copiaria o número e mudaria
   * o significado, e o prontuário ficaria errado sem nada acusar.
   */
  it("todo campo do exame mapeia para o campo do caso de mesmo nome", () => {
    for (const campo of MEDIDAS_DO_EXAME) {
      expect(campo.doExame, `${campo.key} mapeia para outro nome`).toBe(campo.key);
    }
  });
});

describe("suspeitaDeErro", () => {
  it("FE menor que 1 é fração escrita onde se espera porcentagem", () => {
    // 0,45 passa no CHECK (0 a 100) e entraria como "FE 0,45%".
    expect(suspeitaDeErro("ejection_fraction", 0.45, {})).toMatch(/fração/);
    expect(suspeitaDeErro("ejection_fraction", 45, {})).toBeNull();
  });

  it("FE zero não é confundida com fração", () => {
    // Zero é ausência de contração, não erro de escala — e o `> 0` do teste
    // impede o alarme falso.
    expect(suspeitaDeErro("ejection_fraction", 0, {})).toBeNull();
  });

  it("área valvar acima de 6 cm² sai da escala do que se mede", () => {
    expect(suspeitaDeErro("valve_area", 8, {})).toMatch(/6 cm²/);
    expect(suspeitaDeErro("valve_area", 0.8, {})).toBeNull();
  });

  it("gradiente médio maior que o máximo marca os dois", () => {
    const exame = { mean_gradient: 75, peak_gradient: 42 };
    expect(suspeitaDeErro("mean_gradient", 75, exame)).toMatch(/impossível/);
    expect(suspeitaDeErro("peak_gradient", 42, exame)).toMatch(/impossível/);
  });

  it("ordem correta de gradiente não vira suspeita", () => {
    const exame = { mean_gradient: 42, peak_gradient: 75 };
    expect(suspeitaDeErro("mean_gradient", 42, exame)).toBeNull();
    expect(suspeitaDeErro("peak_gradient", 75, exame)).toBeNull();
  });
});

describe("compararComExame", () => {
  /** O exame e o caso reais do print que originou esta rodada. */
  const EXAME = {
    ejection_fraction: 45, mean_gradient: 42, peak_gradient: 75,
    valve_area: 0.8, regurgitation_grade: "3+4+",
  };

  it("acha as cinco lacunas do caso do print", () => {
    const r = compararComExame({}, EXAME);
    expect(r.lacunas.map((l) => l.key)).toEqual([
      "ejection_fraction", "mean_gradient", "peak_gradient",
      "valve_area", "regurgitation_grade",
    ]);
    expect(r.divergencias).toEqual([]);
    expect(r.recusados).toEqual([]);
  });

  it("cada lacuna carrega rótulo, valor e unidade para a tela mostrar a origem", () => {
    const fe = compararComExame({}, EXAME).lacunas[0];
    expect(fe.label).toBe("Fração de ejeção");
    expect(fe.valor).toBe(45);
    expect(fe.unidade).toBe("%");
    expect(fe.suspeita).toBeNull();
  });

  it("campo já preenchido e igual não vira lacuna nem divergência", () => {
    const r = compararComExame({ ejection_fraction: 45 }, EXAME);
    expect(r.lacunas.map((l) => l.key)).not.toContain("ejection_fraction");
    expect(r.divergencias.map((d) => d.key)).not.toContain("ejection_fraction");
  });

  /**
   * O caso que o usuário pediu para não passar despercebido: o prontuário diz
   * uma coisa e o eco de ontem diz outra. Aparece — e não é trocado sozinho.
   */
  it("valor diferente nos dois lados vira divergência, nunca lacuna", () => {
    const r = compararComExame({ ejection_fraction: 60 }, EXAME);
    expect(r.lacunas.map((l) => l.key)).not.toContain("ejection_fraction");
    expect(r.divergencias[0]).toEqual({
      key: "ejection_fraction", label: "Fração de ejeção", unidade: "%",
      noCaso: 60, noExame: 45,
    });
  });

  it("regurgitação divergente compara texto, não número", () => {
    const r = compararComExame({ regurgitation_grade: "1+/4+" }, EXAME);
    const d = r.divergencias.find((x) => x.key === "regurgitation_grade");
    expect(d).toEqual({
      key: "regurgitation_grade", label: "Regurgitação", unidade: "",
      noCaso: "1+/4+", noExame: "3+4+",
    });
  });

  it("valor fora da faixa do banco é recusado, não oferecido", () => {
    // Se fosse oferecido, o médico marcaria e o Postgres recusaria com erro
    // cru — depois do clique, longe da causa.
    const r = compararComExame({}, { ...EXAME, ejection_fraction: 150 });
    expect(r.lacunas.map((l) => l.key)).not.toContain("ejection_fraction");
    expect(r.recusados[0].motivo).toMatch(/entre 0 e 100/);
  });

  it("valor implausível entra como lacuna, porém marcado", () => {
    const r = compararComExame({}, { ...EXAME, ejection_fraction: 0.45 });
    const fe = r.lacunas.find((l) => l.key === "ejection_fraction");
    expect(fe?.valor).toBe(0.45);
    expect(fe?.suspeita).toMatch(/fração/);
  });

  it("gradiente zero é medida, não ausência", () => {
    const r = compararComExame({}, { mean_gradient: 0 });
    expect(r.lacunas.map((l) => l.key)).toEqual(["mean_gradient"]);
  });

  it("exame sem nada não produz lacuna", () => {
    expect(compararComExame({}, {})).toEqual({
      lacunas: [], divergencias: [], recusados: [],
    });
  });
});
