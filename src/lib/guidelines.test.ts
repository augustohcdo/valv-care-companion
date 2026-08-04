import { describe, it, expect } from "vitest";
import { getRecommendations } from "./guidelines";

describe("getRecommendations", () => {
  it("estenose aórtica crítica sintomática: SVA indicada (urgent, Classe I)", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "estenose",
      severity: "critica",
      nyha: "III",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({
        level: "urgent",
        classRec: "I",
        title: "Substituição valvar aórtica indicada",
      })
    );
  });

  it("estenose aórtica importante assintomática com FE < 50: SVA mesmo assintomático", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "estenose",
      severity: "importante",
      ejection_fraction: 45,
    });
    expect(recs).toContainEqual(
      expect.objectContaining({
        level: "urgent",
        classRec: "I",
        title: "SVA mesmo assintomático (FE < 50%)",
      })
    );
  });

  it("estenose aórtica crítica assintomática, FE preservada, gradiente médio >= 60: considerar SVA (IIa)", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "estenose",
      severity: "critica",
      ejection_fraction: 55,
      mean_gradient: 65,
      // O nome do teste diz "assintomática"; agora o dado diz também. Antes,
      // não informar nada bastava — era exatamente o defeito.
      symptoms: ["Assintomático"],
    });
    expect(recs).toContainEqual(
      expect.objectContaining({
        level: "consider",
        classRec: "IIa",
        title: "Considerar SVA (gradiente muito elevado)",
      })
    );
  });

  it("estenose aórtica crítica assintomática, FE preservada, gradiente médio baixo: vigilância clínica", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "estenose",
      severity: "critica",
      ejection_fraction: 55,
      mean_gradient: 30,
      symptoms: ["Assintomático"],
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "watch", title: "Vigilância clínica e ecocardiográfica" })
    );
  });

  it("estenose aórtica moderada: seguimento anual", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "estenose",
      severity: "moderada",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "watch", title: "Seguimento com ECO anual" })
    );
  });

  it("estenose aórtica leve, sem outro gatilho: cai no default 'sem recomendação automática'", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "estenose",
      severity: "leve",
    });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ level: "info", title: "Sem recomendação automática específica" });
  });

  it("insuficiência aórtica importante sintomática: cirurgia indicada", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "insuficiencia",
      severity: "importante",
      nyha: "II",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia valvar aórtica indicada" })
    );
  });

  it("insuficiência aórtica crítica assintomática com FE <= 50: cirurgia mesmo assintomático", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "insuficiencia",
      severity: "critica",
      ejection_fraction: 45,
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia mesmo assintomático (FE ≤ 50%)" })
    );
  });

  it("estenose mitral crítica sintomática: comissurotomia ou cirurgia", () => {
    const recs = getRecommendations({
      valve_type: "mitral",
      valve_disease: "estenose",
      severity: "critica",
      nyha: "III",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Comissurotomia percutânea ou cirurgia" })
    );
  });

  it("insuficiência mitral crítica sintomática: cirurgia mitral indicada", () => {
    const recs = getRecommendations({
      valve_type: "mitral",
      valve_disease: "insuficiencia",
      severity: "critica",
      nyha: "III",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia mitral indicada" })
    );
  });

  it("prolapso mitral é tratado como alias de insuficiência mitral (mesmo resultado)", () => {
    const recs = getRecommendations({
      valve_type: "mitral",
      valve_disease: "prolapso",
      severity: "critica",
      nyha: "III",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia mitral indicada" })
    );
  });

  it("insuficiência mitral crítica assintomática com FE <= 60: cirurgia mesmo assintomático", () => {
    const recs = getRecommendations({
      valve_type: "mitral",
      valve_disease: "insuficiencia",
      severity: "critica",
      ejection_fraction: 55,
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia mesmo assintomático (FE ≤ 60%)" })
    );
  });

  it("insuficiência tricúspide crítica sintomática: avaliar intervenção tricúspide (consider)", () => {
    const recs = getRecommendations({
      valve_type: "tricuspide",
      valve_disease: "insuficiencia",
      severity: "critica",
      nyha: "III",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "consider", classRec: "IIa", title: "Avaliar intervenção tricúspide" })
    );
  });

  it("recomendações se acumulam: estenose aórtica crítica sintomática + FE < 40 adiciona a recomendação geral de IC", () => {
    const recs = getRecommendations({
      valve_type: "aortica",
      valve_disease: "estenose",
      severity: "critica",
      nyha: "III",
      ejection_fraction: 35,
    });
    expect(recs).toHaveLength(2);
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "Substituição valvar aórtica indicada" })
    );
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "Otimizar tratamento de IC com FE reduzida" })
    );
  });
});

/**
 * Status sintomático ausente.
 *
 * O caminho da diretriz se divide exatamente aqui, e antes a ausência de dado
 * era tratada como ausência de sintoma: um caso recém-aberto caía no ramo
 * "assintomático", que não é neutro — ele afirma, com selo ESC 2021.
 *
 * A direção do erro era a perigosa: para estenose aórtica importante, o ramo
 * sintomático é Classe I para troca valvar e o assintomático é vigilância a
 * cada seis meses. Faltando o dado, o sistema recomendava esperar.
 */
describe("status sintomático não informado", () => {
  const semStatus = {
    valve_type: "aortica",
    valve_disease: "estenose",
    severity: "critica",
    ejection_fraction: 55,
    mean_gradient: 30,
  };

  it("não afirma que o paciente é assintomático", () => {
    const recs = getRecommendations(semStatus);
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "Status sintomático não informado" }),
    );
    for (const r of recs) {
      expect(r.detail).not.toMatch(/assintom/i);
    }
  });

  // O aviso é pedido de dado, não conduta. Carimbá-lo com "ESC 2021" repetiria
  // num lugar novo exatamente o defeito que ele corrige.
  it("o aviso não se apresenta como recomendação de diretriz", () => {
    const aviso = getRecommendations(semStatus).find(
      (r) => r.title === "Status sintomático não informado",
    )!;
    expect(aviso.classRec).toBeUndefined();
    expect(aviso.evidence).toBeUndefined();
    expect(aviso.source).not.toMatch(/ESC|AHA|ACC|SBC/);
  });

  // Onde a diretriz indica Classe I independentemente dos sintomas, a
  // recomendação permanece: suprimi-la por falta do status seria trocar um
  // erro por outro.
  it("mantém a Classe I que não depende do status (EA importante, FE < 50%)", () => {
    const recs = getRecommendations({ ...semStatus, ejection_fraction: 45 });
    expect(recs).toContainEqual(
      expect.objectContaining({ classRec: "I", title: "SVA mesmo assintomático (FE < 50%)" }),
    );
  });

  it("o gradiente ≥ 60 (IIa) só vale com assintomático confirmado", () => {
    const semInfo = getRecommendations({ ...semStatus, mean_gradient: 65 });
    expect(semInfo).not.toContainEqual(
      expect.objectContaining({ title: "Considerar SVA (gradiente muito elevado)" }),
    );
    const confirmado = getRecommendations({
      ...semStatus, mean_gradient: 65, symptoms: ["Assintomático"],
    });
    expect(confirmado).toContainEqual(
      expect.objectContaining({ title: "Considerar SVA (gradiente muito elevado)" }),
    );
  });

  it("o comportamento correto não se perdeu: assintomático confirmado segue em vigilância", () => {
    const recs = getRecommendations({ ...semStatus, symptoms: ["Assintomático"] });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "watch", title: "Vigilância clínica e ecocardiográfica" }),
    );
    expect(recs).not.toContainEqual(
      expect.objectContaining({ title: "Status sintomático não informado" }),
    );
  });

  it("NYHA sozinho já é status informado", () => {
    const recs = getRecommendations({ ...semStatus, nyha: "I" });
    expect(recs).not.toContainEqual(
      expect.objectContaining({ title: "Status sintomático não informado" }),
    );
  });

  it("vale para as outras valvas, não só para a aórtica", () => {
    for (const caso of [
      { valve_type: "aortica", valve_disease: "insuficiencia" },
      { valve_type: "mitral", valve_disease: "estenose" },
      { valve_type: "mitral", valve_disease: "insuficiencia" },
      { valve_type: "tricuspide", valve_disease: "insuficiencia" },
    ]) {
      const recs = getRecommendations({ ...caso, severity: "importante" });
      expect(
        recs,
        `${caso.valve_type}/${caso.valve_disease}`,
      ).toContainEqual(expect.objectContaining({ title: "Status sintomático não informado" }));
    }
  });
});

/** FE ausente não pode virar "função ventricular preservada". */
describe("fração de ejeção ausente", () => {
  it("o texto de vigilância não afirma FE preservada quando ela não foi medida", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      symptoms: ["Assintomático"],
    });
    const vigilancia = recs.find((r) => r.title === "Vigilância clínica e ecocardiográfica")!;
    expect(vigilancia.detail).toContain("não informada");
    expect(vigilancia.detail).not.toContain("função ventricular preservada");
  });

  // `i.ejection_fraction && …` tratava zero como ausência. Não é fisiológico,
  // mas é a mesma armadilha do `&&` com número que já apareceu nesta base.
  it("FE zero é valor medido, não ausência", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      ejection_fraction: 0, symptoms: ["Assintomático"],
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "SVA mesmo assintomático (FE < 50%)" }),
    );
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "Otimizar tratamento de IC com FE reduzida" }),
    );
  });
});
