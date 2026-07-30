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
