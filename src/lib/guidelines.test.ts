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
        title: "Intervenção mesmo assintomático (FE < 50%)",
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
      // Novo em 2025: a IIa de gradiente muito elevado só vale com risco do
      // procedimento baixo. Não é detalhe de fixture — é a condição que a
      // diretriz acrescentou, e sem ela o motor pede o dado em vez de sugerir.
      risco_cirurgico: "baixo",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({
        level: "consider",
        classRec: "IIa",
        title: "Considerar intervenção (estenose muito grave)",
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
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia mesmo assintomático" })
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
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Comissurotomia mitral percutânea" })
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
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia mesmo assintomático (disfunção ventricular)" })
    );
  });

  it("insuficiência tricúspide crítica sintomática: cirurgia indicada (2025 subiu para Classe I)", () => {
    const recs = getRecommendations({
      valve_type: "tricuspide",
      valve_disease: "insuficiencia",
      severity: "critica",
      nyha: "III",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Cirurgia tricúspide indicada" })
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
    // Três, e não mais duas: 2025 acrescentou a recomendação sobre o MODO de
    // intervenção (cirurgia ou transcateter), que antes não existia no motor.
    expect(recs).toHaveLength(3);
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "Substituição valvar aórtica indicada" })
    );
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "Modo de intervenção: decisão do Heart Team" })
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
      expect.objectContaining({ classRec: "I", title: "Intervenção mesmo assintomático (FE < 50%)" }),
    );
  });

  it("o gradiente ≥ 60 (IIa) só vale com assintomático confirmado", () => {
    const semInfo = getRecommendations({ ...semStatus, mean_gradient: 65, risco_cirurgico: "baixo" });
    expect(semInfo).not.toContainEqual(
      expect.objectContaining({ title: "Considerar intervenção (estenose muito grave)" }),
    );
    const confirmado = getRecommendations({
      ...semStatus, mean_gradient: 65, symptoms: ["Assintomático"], risco_cirurgico: "baixo",
    });
    expect(confirmado).toContainEqual(
      expect.objectContaining({ title: "Considerar intervenção (estenose muito grave)" }),
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
      expect.objectContaining({ title: "Intervenção mesmo assintomático (FE < 50%)" }),
    );
    expect(recs).toContainEqual(
      expect.objectContaining({ title: "Otimizar tratamento de IC com FE reduzida" }),
    );
  });
});

/**
 * O que a diretriz de 2025 mudou.
 *
 * Cada conduta nova com seu caso, e cada limiar exercitado **dos dois lados da
 * fronteira**. Testar só o lado que dispara deixa passar o erro mais comum de
 * todos — o `>=` escrito onde devia ser `>`, que muda a conduta de quem está
 * exatamente no valor de corte.
 */
describe("ESC/EACTS 2025 — estenose aórtica", () => {
  const assintomaticoGrave = {
    valve_type: "aortica",
    valve_disease: "estenose",
    severity: "critica",
    symptoms: ["Assintomático"],
    ejection_fraction: 60,
    mean_gradient: 45,
  };

  it("a mudança principal: intervenção como alternativa à vigilância (IIa A)", () => {
    const recs = getRecommendations({
      ...assintomaticoGrave,
      teste_esforco: "normal",
      risco_cirurgico: "baixo",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({
        classRec: "IIa",
        evidence: "A",
        title: "Intervenção como alternativa à vigilância",
      }),
    );
  });

  it("sem teste de esforço normal, a IIa A não aparece — e o motor DIZ o que falta", () => {
    // A contraprova. Se ela aparecesse sem o teste, o motor estaria afirmando
    // uma condição da diretriz que ninguém verificou.
    const recs = getRecommendations({ ...assintomaticoGrave, risco_cirurgico: "baixo" });
    expect(recs).not.toContainEqual(
      expect.objectContaining({ title: "Intervenção como alternativa à vigilância" }),
    );
    expect(recs.some((r) => /Falta registrar/.test(r.title) && /teste de esforço/.test(r.title))).toBe(true);
  });

  it("FE < 55% entrou como critério em 2025; 55% exato não dispara", () => {
    const base = { ...assintomaticoGrave, risco_cirurgico: "baixo", teste_esforco: "sintomas" };
    const dispara = getRecommendations({ ...base, ejection_fraction: 54 });
    const naoDispara = getRecommendations({ ...base, ejection_fraction: 55 });
    expect(dispara).toContainEqual(
      expect.objectContaining({ classRec: "IIa", title: "Considerar intervenção (FE < 55%)" }),
    );
    expect(naoDispara).not.toContainEqual(
      expect.objectContaining({ title: "Considerar intervenção (FE < 55%)" }),
    );
  });

  it("Vmax > 5,0 m/s também caracteriza estenose muito grave; 5,0 exato não", () => {
    const base = { ...assintomaticoGrave, risco_cirurgico: "baixo", mean_gradient: 45 };
    expect(getRecommendations({ ...base, vmax_m_s: 5.2 })).toContainEqual(
      expect.objectContaining({ title: "Considerar intervenção (estenose muito grave)" }),
    );
    expect(getRecommendations({ ...base, vmax_m_s: 5.0 })).not.toContainEqual(
      expect.objectContaining({ title: "Considerar intervenção (estenose muito grave)" }),
    );
  });

  it("queda de PA no esforço é critério próprio (IIa C)", () => {
    const recs = getRecommendations({ ...assintomaticoGrave, teste_esforco: "queda_pa" });
    expect(recs).toContainEqual(
      expect.objectContaining({
        classRec: "IIa", evidence: "C",
        title: "Considerar intervenção (queda de PA no esforço)",
      }),
    );
  });

  it("baixo fluxo e baixo gradiente com FE reduzida: Classe I, que o motor não tinha", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      nyha: "III", mean_gradient: 30, svi_ml_m2: 30, ejection_fraction: 40,
    });
    expect(recs).toContainEqual(
      expect.objectContaining({
        classRec: "I", evidence: "B",
        title: "Intervenção indicada (baixo fluxo, baixo gradiente, FE reduzida)",
      }),
    );
  });

  it("baixo fluxo com FE normal é IIa, e o texto manda excluir as causas de erro", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      nyha: "III", mean_gradient: 30, svi_ml_m2: 30, ejection_fraction: 60,
    });
    const rec = recs.find((r) => r.title === "Considerar intervenção (baixo fluxo paradoxal)")!;
    expect(rec.classRec).toBe("IIa");
    expect(rec.detail, "não alerta para as causas de área pequena com gradiente baixo").toMatch(
      /erro de medida|pressão arterial não controlada/i,
    );
  });

  it("sintomático com gradiente baixo e SEM volume sistólico: pede o exame, não conclui", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      nyha: "III", mean_gradient: 30,
    });
    expect(recs.some((r) => /volume sistólico indexado/.test(r.title))).toBe(true);
  });

  it("PORÉM: sintomático sem gradiente nenhum NÃO segura a Classe I", () => {
    // A direção do erro. Os dois ramos possíveis são Classe I nível B, então
    // exigir o gradiente antes de indicar mandaria esperar um paciente
    // sintomático com estenose grave — que é a conduta errada.
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica", nyha: "III",
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ level: "urgent", classRec: "I", title: "Substituição valvar aórtica indicada" }),
    );
  });
});

describe("ESC/EACTS 2025 — modo de intervenção por idade", () => {
  const comIndicacao = (patient_age?: number, extra: Record<string, unknown> = {}) =>
    getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      nyha: "III", mean_gradient: 50, patient_age, ...extra,
    });

  it("70 anos ou mais: TAVI (I A)", () => {
    expect(comIndicacao(70)).toContainEqual(
      expect.objectContaining({ classRec: "I", evidence: "A", title: "Modo de intervenção: TAVI a partir de 70 anos" }),
    );
  });

  it("69 anos com risco baixo: cirurgia (I B) — o corte é 70, não 75", () => {
    // 2025 baixou o corte de 75 para 70. A redação de 75 anos existe no
    // documento, mas na coluna de 2021 da tabela comparativa; ver a nota em
    // `src/data/diretriz2025.ts`.
    const recs = comIndicacao(69, { risco_cirurgico: "baixo" });
    expect(recs).toContainEqual(
      expect.objectContaining({ classRec: "I", evidence: "B", title: "Modo de intervenção: cirurgia abaixo de 70 anos" }),
    );
    expect(recs).not.toContainEqual(
      expect.objectContaining({ title: "Modo de intervenção: TAVI a partir de 70 anos" }),
    );
  });

  it("abaixo de 70 sem risco baixo registrado: devolve ao Heart Team, não inventa", () => {
    expect(comIndicacao(60)).toContainEqual(
      expect.objectContaining({ title: "Modo de intervenção: decisão do Heart Team" }),
    );
  });

  it("não nomeia fabricante nem ordena marcas (CFM 2.336/2023)", () => {
    for (const idade of [60, 69, 70, 85]) {
      for (const r of comIndicacao(idade, { risco_cirurgico: "baixo" })) {
        expect(r.detail).not.toMatch(/Edwards|Medtronic|Abbott|Corcym|Braile|Meril|Labcor/i);
      }
    }
  });
});

describe("ESC/EACTS 2025 — DSVE como gatilho cirúrgico isolado", () => {
  it("IA: DSVE > 50 mm indica cirurgia mesmo com FE normal; 50 exato não", () => {
    const base = {
      valve_type: "aortica", valve_disease: "insuficiencia", severity: "critica",
      symptoms: ["Assintomático"], ejection_fraction: 65,
    };
    expect(getRecommendations({ ...base, lvesd_mm: 51 })).toContainEqual(
      expect.objectContaining({ classRec: "I", title: "Cirurgia mesmo assintomático" }),
    );
    expect(getRecommendations({ ...base, lvesd_mm: 50 })).not.toContainEqual(
      expect.objectContaining({ title: "Cirurgia mesmo assintomático" }),
    );
  });

  it("IA: DSVE indexado > 25 mm/m² pega o paciente de porte pequeno que o absoluto não pega", () => {
    // 48 mm num paciente de 1,50 m e 45 kg (superfície ≈ 1,37 m²) dá ≈ 35 mm/m².
    // Pelo critério absoluto passaria em branco; é exatamente para isto que a
    // diretriz indexa.
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "insuficiencia", severity: "critica",
      symptoms: ["Assintomático"], ejection_fraction: 65,
      lvesd_mm: 48, altura_cm: 150, peso_kg: 45,
    });
    expect(recs).toContainEqual(
      expect.objectContaining({ classRec: "I", title: "Cirurgia mesmo assintomático" }),
    );
  });

  it("IA: com DSVE mas sem altura e peso, o motor pede as duas medidas", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "insuficiencia", severity: "critica",
      symptoms: ["Assintomático"], ejection_fraction: 65, lvesd_mm: 45,
    });
    expect(recs.some((r) => /altura, peso/.test(r.title))).toBe(true);
  });

  it("IM: DSVE ≥ 40 mm indica cirurgia mesmo com FE > 60%; 39 não", () => {
    const base = {
      valve_type: "mitral", valve_disease: "insuficiencia", severity: "critica",
      symptoms: ["Assintomático"], ejection_fraction: 65,
    };
    expect(getRecommendations({ ...base, lvesd_mm: 40 })).toContainEqual(
      expect.objectContaining({ classRec: "I", title: "Cirurgia mesmo assintomático (disfunção ventricular)" }),
    );
    expect(getRecommendations({ ...base, lvesd_mm: 39 })).not.toContainEqual(
      expect.objectContaining({ title: "Cirurgia mesmo assintomático (disfunção ventricular)" }),
    );
  });
});

describe("ESC/EACTS 2025 — anticoagulação na estenose mitral", () => {
  const em = (extra: Record<string, unknown>) =>
    getRecommendations({
      valve_type: "mitral", valve_disease: "estenose", severity: "critica",
      nyha: "III", ...extra,
    });

  it("o defeito antigo: mandava anticoagular sem dizer com quê", () => {
    // A recomendação genérica "anticoagulação obrigatória se FA (Classe I)"
    // levava direto ao erro de prescrição, porque na estenose mitral moderada a
    // grave o DOAC é Classe III — contraindicado.
    const recs = em({ fibrilacao_atrial: true });
    expect(recs).toContainEqual(
      expect.objectContaining({
        level: "urgent", classRec: "III",
        title: "DOAC contraindicado — anticoagular com varfarina",
      }),
    );
  });

  it("estenose reumática acrescenta a contraindicação específica (III B)", () => {
    const recs = em({ fibrilacao_atrial: true, em_etiologia: "reumatica" });
    expect(recs).toContainEqual(
      expect.objectContaining({
        classRec: "III", evidence: "B",
        title: "Estenose mitral reumática: DOAC contraindicado",
      }),
    );
  });

  it("sem FA registrada, pede o dado — não conclui que não há", () => {
    const recs = em({});
    expect(recs.some((r) => /fibrilação atrial/.test(r.title))).toBe(true);
    expect(recs).not.toContainEqual(
      expect.objectContaining({ title: "DOAC contraindicado — anticoagular com varfarina" }),
    );
  });

  it("FA registrada como ausente não gera aviso de anticoagulante", () => {
    const recs = em({ fibrilacao_atrial: false });
    expect(recs).not.toContainEqual(
      expect.objectContaining({ title: "DOAC contraindicado — anticoagular com varfarina" }),
    );
    expect(recs.some((r) => /Falta registrar.*fibrilação/.test(r.title))).toBe(false);
  });

  it("fora da estenose mitral, o DOAC é o preferencial (I A) — a regra oposta", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      nyha: "III", mean_gradient: 50, fibrilacao_atrial: true,
    });
    expect(recs).toContainEqual(
      expect.objectContaining({
        classRec: "I", evidence: "A", title: "Anticoagulação: DOAC preferencial",
      }),
    );
  });
});

describe("toda recomendação de diretriz cita a diretriz", () => {
  it("nenhuma conduta com Classe sai sem fonte, e nenhum pedido de dado sai com Classe", () => {
    const casos = [
      { valve_type: "aortica", valve_disease: "estenose", severity: "critica", nyha: "III", mean_gradient: 50, patient_age: 72 },
      { valve_type: "aortica", valve_disease: "insuficiencia", severity: "critica", symptoms: ["Assintomático"], lvesd_mm: 55 },
      { valve_type: "mitral", valve_disease: "estenose", severity: "critica", nyha: "III", fibrilacao_atrial: true, em_etiologia: "reumatica" },
      { valve_type: "mitral", valve_disease: "insuficiencia", severity: "critica", nyha: "II" },
      { valve_type: "tricuspide", valve_disease: "insuficiencia", severity: "critica", nyha: "III" },
    ];
    for (const caso of casos) {
      for (const r of getRecommendations(caso)) {
        if (r.classRec) {
          // Tem Classe: então é recomendação de diretriz e precisa dizer de onde veio.
          expect(r.source, `${r.title}`).toMatch(/ESC\/EACTS 2025 — Recommendation Table \d+/);
          expect(r.evidence, `${r.title}: Classe sem Nível de evidência`).toBeTruthy();
        } else {
          // Não tem Classe: é pedido de dado ou vigilância. Não pode se
          // apresentar como recomendação carimbada.
          expect(r.evidence, `${r.title}: Nível sem Classe`).toBeUndefined();
        }
      }
    }
  });
});
