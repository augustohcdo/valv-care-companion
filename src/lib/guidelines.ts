// Sugestão de conduta baseada em diretrizes ESC 2021 / AHA-ACC 2020
// para doenças valvares. Apoio à decisão — NÃO substitui julgamento clínico.

export type Recommendation = {
  level: "info" | "watch" | "consider" | "urgent";
  classRec?: string; // Classe de recomendação (I, IIa, IIb, III)
  evidence?: string; // Nível de evidência (A, B, C)
  title: string;
  detail: string;
  source: string;
};

interface Input {
  valve_type: string;
  valve_disease: string;
  severity: string;
  nyha?: string | null;
  ejection_fraction?: number | null;
  mean_gradient?: number | null;
  peak_gradient?: number | null;
  valve_area?: number | null;
  symptoms?: string[] | null;
  patient_age?: number | null;
}

/**
 * Status sintomático: `true`, `false` ou **`null` para "ninguém informou"**.
 *
 * Os três estados existem porque o caminho da diretriz se divide exatamente
 * aqui, e antes a ausência de dado era tratada como ausência de sintoma. Um
 * caso recém-aberto, sem NYHA e sem a lista de sintomas preenchida, caía no
 * ramo assintomático — que não é neutro: ele afirma "Assintomático com função
 * ventricular preservada" e carimba ESC 2021.
 *
 * A direção do erro era a perigosa: para estenose aórtica importante, o ramo
 * sintomático é Classe I para troca valvar e o assintomático é vigilância a
 * cada seis meses. Faltando o dado, o sistema recomendava esperar.
 */
type StatusSintomatico = boolean | null;

const statusSintomatico = (i: Input): StatusSintomatico => {
  const temNyha = !!i.nyha;
  const temSintomas = (i.symptoms || []).length > 0;
  if (!temNyha && !temSintomas) return null;

  return (
    (!!i.nyha && ["II", "III", "IV"].includes(i.nyha)) ||
    (i.symptoms || []).some((s) => !/assintom/i.test(s))
  );
};

/**
 * O aviso que substitui o ramo assintomático quando o status é desconhecido.
 *
 * **Sem `classRec`, `evidence` ou `source` de diretriz, de propósito**: isto
 * não é recomendação, é pedido de dado. Carimbá-lo com "ESC 2021" repetiria,
 * num lugar novo, o defeito que ele existe para corrigir.
 */
const statusNaoInformado = (): Recommendation => ({
  level: "info",
  title: "Status sintomático não informado",
  detail:
    "A conduta recomendada pela diretriz se divide conforme o paciente esteja " +
    "sintomático ou não, e esse dado não foi registrado neste caso. Informe a " +
    "classe NYHA ou a lista de sintomas para que a sugestão apareça.",
  source: "Dado ausente no caso",
});

/** FE medida? `0` é valor, não ausência — o `&&` cru confundia os dois. */
const temFE = (i: Input): boolean =>
  i.ejection_fraction !== null && i.ejection_fraction !== undefined;

export function getRecommendations(i: Input): Recommendation[] {
  const recs: Recommendation[] = [];
  const status = statusSintomatico(i);
  const sympt = status === true;
  const assintomaticoConfirmado = status === false;

  // ============= ESTENOSE AÓRTICA =============
  if (i.valve_type === "aortica" && i.valve_disease === "estenose") {
    if (i.severity === "critica" || i.severity === "importante") {
      if (sympt) {
        recs.push({
          level: "urgent",
          classRec: "I",
          evidence: "B",
          title: "Substituição valvar aórtica indicada",
          detail:
            "Estenose aórtica grave sintomática (NYHA ≥ II ou síncope/angina) tem indicação Classe I para SVA (cirurgia ou TAVI), conforme decisão do Heart Team.",
          source: "ESC 2021 / AHA-ACC 2020",
        });
      } else if (temFE(i) && i.ejection_fraction! < 50) {
        recs.push({
          level: "urgent",
          classRec: "I",
          evidence: "B",
          title: "SVA mesmo assintomático (FE < 50%)",
          detail:
            "Estenose aórtica grave assintomática com FEVE < 50% sem outra causa aparente: SVA recomendada (Classe I).",
          source: "ESC 2021",
        });
      } else if (assintomaticoConfirmado && i.mean_gradient && i.mean_gradient >= 60) {
        recs.push({
          level: "consider",
          classRec: "IIa",
          evidence: "B",
          title: "Considerar SVA (gradiente muito elevado)",
          detail:
            "Estenose aórtica grave assintomática com gradiente médio ≥ 60 mmHg pode ter benefício precoce com SVA (Classe IIa).",
          source: "ESC 2021",
        });
      } else if (assintomaticoConfirmado) {
        recs.push({
          level: "watch",
          title: "Vigilância clínica e ecocardiográfica",
          detail:
            temFE(i)
              ? "Assintomático com função ventricular preservada: ECO seriado a cada 6 meses, teste de esforço para confirmar status sintomático."
              : "Assintomático, com fração de ejeção não informada: ECO seriado a cada 6 meses, teste de esforço para confirmar status sintomático.",
          source: "ESC 2021",
        });
      } else {
        recs.push(statusNaoInformado());
      }
    } else if (i.severity === "moderada") {
      recs.push({
        level: "watch",
        title: "Seguimento com ECO anual",
        detail:
          "Estenose aórtica moderada: reavaliação clínica e ECO a cada 12 meses. Otimizar fatores de risco cardiovascular.",
        source: "ESC 2021",
      });
    }
  }

  // ============= INSUFICIÊNCIA AÓRTICA =============
  if (i.valve_type === "aortica" && i.valve_disease === "insuficiencia") {
    if (i.severity === "critica" || i.severity === "importante") {
      if (sympt) {
        recs.push({
          level: "urgent",
          classRec: "I",
          evidence: "B",
          title: "Cirurgia valvar aórtica indicada",
          detail:
            "Insuficiência aórtica grave sintomática: cirurgia recomendada independentemente da FEVE (Classe I).",
          source: "ESC 2021",
        });
      } else if (temFE(i) && i.ejection_fraction! <= 50) {
        recs.push({
          level: "urgent",
          classRec: "I",
          evidence: "B",
          title: "Cirurgia mesmo assintomático (FE ≤ 50%)",
          detail:
            "IA grave assintomática com FEVE ≤ 50% tem indicação cirúrgica (Classe I).",
          source: "ESC 2021",
        });
      } else if (assintomaticoConfirmado) {
        recs.push({
          level: "watch",
          title: "Seguimento ecocardiográfico",
          detail:
            temFE(i)
              ? "Assintomático com FE preservada: ECO a cada 6 meses, atenção a diâmetros ventriculares (DSVE > 50 mm = indicação cirúrgica)."
              : "Assintomático, com FE não informada: ECO a cada 6 meses, atenção a diâmetros ventriculares (DSVE > 50 mm = indicação cirúrgica).",
          source: "ESC 2021",
        });
      } else {
        recs.push(statusNaoInformado());
      }
    }
  }

  // ============= ESTENOSE MITRAL =============
  if (i.valve_type === "mitral" && i.valve_disease === "estenose") {
    if (i.severity === "critica" || i.severity === "importante") {
      if (sympt) {
        recs.push({
          level: "urgent",
          classRec: "I",
          evidence: "B",
          title: "Comissurotomia percutânea ou cirurgia",
          detail:
            "Estenose mitral grave sintomática (área ≤ 1,5 cm²): valvuloplastia mitral por balão se anatomia favorável; cirurgia se contraindicada.",
          source: "ESC 2021",
        });
      } else if (assintomaticoConfirmado) {
        recs.push({
          level: "watch",
          title: "Seguimento e anticoagulação se FA",
          detail:
            "Reavaliação anual. Anticoagulação obrigatória se fibrilação atrial associada (Classe I).",
          source: "ESC 2021",
        });
      } else {
        recs.push(statusNaoInformado());
      }
    }
  }

  // ============= INSUFICIÊNCIA MITRAL =============
  if (i.valve_type === "mitral" && (i.valve_disease === "insuficiencia" || i.valve_disease === "prolapso")) {
    if (i.severity === "critica" || i.severity === "importante") {
      if (sympt) {
        recs.push({
          level: "urgent",
          classRec: "I",
          evidence: "B",
          title: "Cirurgia mitral indicada",
          detail:
            "IM primária grave sintomática: cirurgia (preferencialmente plástica). Considerar TEER (MitraClip) se alto risco cirúrgico.",
          source: "ESC 2021 / AHA-ACC 2020",
        });
      } else if (temFE(i) && i.ejection_fraction! <= 60) {
        recs.push({
          level: "urgent",
          classRec: "I",
          title: "Cirurgia mesmo assintomático (FE ≤ 60%)",
          detail:
            "IM primária grave assintomática com FEVE ≤ 60% ou DSVE ≥ 40 mm tem indicação cirúrgica.",
          source: "ESC 2021",
        });
      } else if (assintomaticoConfirmado) {
        recs.push({
          level: "watch",
          title: "Seguimento estrito",
          detail:
            "ECO a cada 6 meses, atenção à PSAP, FA paroxística e progressão dos diâmetros ventriculares.",
          source: "ESC 2021",
        });
      } else {
        recs.push(statusNaoInformado());
      }
    }
  }

  // ============= INSUFICIÊNCIA TRICÚSPIDE =============
  if (i.valve_type === "tricuspide" && i.valve_disease === "insuficiencia") {
    if (i.severity === "critica" || i.severity === "importante") {
      if (sympt) {
        recs.push({
          level: "consider",
          classRec: "IIa",
          title: "Avaliar intervenção tricúspide",
          detail:
            "IT grave sintomática isolada: cirurgia ou TTVI (transcateter) em centro experiente. Avaliar função do VD.",
          source: "ESC 2021",
        });
      } else if (status === null) {
        // Sem o status, este bloco ficava calado e o caso caía no texto
        // genérico de "nenhuma recomendação" — verdadeiro, mas escondendo que
        // a ausência é de dado, não de indicação.
        recs.push(statusNaoInformado());
      }
    }
  }

  // ============= GERAL: insuficiência cardíaca =============
  if (temFE(i) && i.ejection_fraction! < 40) {
    recs.push({
      level: "consider",
      title: "Otimizar tratamento de IC com FE reduzida",
      detail:
        "FEVE < 40%: instituir/otimizar quádrupla terapia (IECA/BRA/sacubitril-valsartana, betabloqueador, antagonista mineralocorticoide, iSGLT2).",
      source: "ESC 2021 HF",
    });
  }

  if (recs.length === 0) {
    recs.push({
      level: "info",
      title: "Sem recomendação automática específica",
      detail:
        "Os parâmetros atuais não disparam recomendação automatizada. Mantenha avaliação clínica individualizada e consulte a biblioteca clínica.",
      source: "Apoio à decisão",
    });
  }

  return recs;
}
