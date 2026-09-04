// Sugestão de conduta baseada na diretriz ESC/EACTS 2025 para doenças valvares.
// Apoio à decisão — NÃO substitui julgamento clínico.
//
// ## O que mudou, e por quê
//
// Até agora este arquivo carimbava "ESC 2021" em 18 condutas, enquanto duas
// páginas públicas do ValvePath afirmavam ao médico que o conteúdo seguia a
// diretriz de 2025. A tela prometia o que o código não fazia.
//
// Os limiares NÃO estão escritos aqui. Ficam em `src/data/diretriz2025.ts`, ao
// lado do texto verbatim da diretriz de onde saíram, e um teste reprova se um
// número do código não aparecer na citação. A razão é registrada lá: nesta
// mesma base eu já inventei dois PMIDs e um registro ANVISA que tinham cara de
// conferidos. Um "FE < 55%" trocado por "FE < 50%" tem a mesma aparência
// inofensiva e muda a conduta de um paciente.
//
// ## A regra que governa o arquivo inteiro
//
// **Medida ausente nunca escolhe ramo em silêncio.** A diretriz de 2025 decide
// por Vmax, volume sistólico indexado, DSVE, teste de esforço e risco
// cirúrgico. Quando falta um desses, o motor PEDE o exame — não cai no ramo de
// vigilância. A direção do erro é o que importa: faltando o dado, o sistema
// antigo mandava esperar, e esperar é a conduta errada em estenose aórtica
// grave sintomática.

import {
  DIRETRIZ_2025, RISCO_BAIXO,
  type ChaveDaDiretriz, type RecomendacaoCitada,
} from "@/data/diretriz2025";
import { superficieCorporal } from "@/lib/bsa";

export type Recommendation = {
  level: "info" | "watch" | "consider" | "urgent";
  classRec?: string; // Classe de recomendação (I, IIa, IIb, III)
  evidence?: string; // Nível de evidência (A, B, C)
  title: string;
  detail: string;
  source: string;
  /**
   * A chave da recomendação em `DIRETRIZ_2025`, quando ela veio de lá.
   *
   * Existe para a tela poder ligar a sugestão a outra coisa — hoje, ao tutorial
   * de técnica correspondente — sem sair procurando palavra no `title`.
   * Casar por texto quebraria na primeira vez que alguém melhorasse a redação
   * de um título, e quebraria em silêncio: o link simplesmente sumiria.
   */
  chave?: ChaveDaDiretriz;
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
  // Medidas que a diretriz de 2025 exige. Todas podem faltar, e faltar é um
  // estado com significado próprio — ver `faltando()`.
  vmax_m_s?: number | null;
  svi_ml_m2?: number | null;
  lvesd_mm?: number | null;
  altura_cm?: number | null;
  peso_kg?: number | null;
  teste_esforco?: string | null;
  risco_cirurgico?: string | null;
  fibrilacao_atrial?: boolean | null;
  em_etiologia?: string | null;
}

/**
 * Status sintomático: `true`, `false` ou **`null` para "ninguém informou"**.
 *
 * Os três estados existem porque o caminho da diretriz se divide exatamente
 * aqui, e antes a ausência de dado era tratada como ausência de sintoma. Um
 * caso recém-aberto, sem NYHA e sem a lista de sintomas preenchida, caía no
 * ramo assintomático — que não é neutro: ele afirma "Assintomático com função
 * ventricular preservada" e carimba a diretriz.
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
 * O aviso que substitui um ramo quando falta a medida que o decide.
 *
 * **Sem `classRec`, `evidence` ou fonte de diretriz, de propósito**: isto não é
 * recomendação, é pedido de dado. Carimbá-lo com "ESC/EACTS 2025" repetiria,
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

/** Mesmo espírito, para as medidas novas: diz QUAL exame falta e para quê. */
const faltando = (medidas: string[], paraQue: string): Recommendation => ({
  level: "info",
  title: `Falta registrar: ${medidas.join(", ")}`,
  detail:
    `A diretriz de 2025 decide ${paraQue} por ${medidas.join(" e ")}, e ` +
    "esse dado não consta deste caso. Enquanto ele faltar, a sugestão não é " +
    "exibida — ausência de recomendação aqui significa ausência de medida, não " +
    "ausência de indicação.",
  source: "Dado ausente no caso",
});

/** FE medida? `0` é valor, não ausência — o `&&` cru confundia os dois. */
const temFE = (i: Input): boolean =>
  i.ejection_fraction !== null && i.ejection_fraction !== undefined;

const medida = (v: number | null | undefined): v is number => v !== null && v !== undefined;

/**
 * Monta a recomendação a partir da citação, para que Classe e Nível venham
 * sempre do arquivo de fonte e nunca sejam digitados aqui.
 */
function daDiretriz(
  chave: ChaveDaDiretriz,
  r: { level: Recommendation["level"]; title: string; detail: string },
): Recommendation {
  // Tipado como `RecomendacaoCitada` de propósito: o `satisfies` no arquivo de
  // dados preserva o tipo literal de cada entrada, e aí `secao` — que é
  // opcional — some do tipo das que não a têm.
  const c: RecomendacaoCitada = DIRETRIZ_2025[chave];
  return {
    ...r,
    chave,
    classRec: c.classe,
    evidence: c.nivel,
    source: `ESC/EACTS 2025 — ${c.tabela}${c.secao ? `, Seção ${c.secao}` : ""}`,
  };
}

/**
 * DSVE indexado pela superfície corporal.
 *
 * Reaproveita `src/lib/bsa.ts` (DuBois), que é a mesma função usada no cálculo
 * de mismatch. Guardar a superfície pronta no banco criaria um segundo número
 * que pode divergir do primeiro, e as duas ferramentas passariam a discordar
 * sobre o mesmo paciente.
 */
function dsveIndexado(i: Input): number | null {
  if (!medida(i.lvesd_mm) || !medida(i.altura_cm) || !medida(i.peso_kg)) return null;
  const bsa = superficieCorporal(i.altura_cm, i.peso_kg);
  if (!bsa || bsa <= 0) return null;
  return i.lvesd_mm / bsa;
}

const riscoBaixo = (i: Input): boolean => i.risco_cirurgico === "baixo";

/** Estenose aórtica de alto gradiente, pelos dois critérios que a diretriz dá. */
function altoGradiente(i: Input): boolean | null {
  if (medida(i.mean_gradient) && i.mean_gradient >= 40) return true;
  if (medida(i.vmax_m_s) && i.vmax_m_s >= 4.0) return true;
  if (!medida(i.mean_gradient) && !medida(i.vmax_m_s)) return null; // ninguém mediu
  return false;
}

export function getRecommendations(i: Input): Recommendation[] {
  const recs: Recommendation[] = [];
  const status = statusSintomatico(i);
  const sympt = status === true;
  const assintomaticoConfirmado = status === false;
  const grave = i.severity === "critica" || i.severity === "importante";

  // ============= ESTENOSE AÓRTICA =============
  if (i.valve_type === "aortica" && i.valve_disease === "estenose") {
    if (grave) {
      const alto = altoGradiente(i);
      let intervencaoIndicada = false;

      if (sympt) {
        if (alto === true) {
          intervencaoIndicada = true;
          recs.push(daDiretriz("eaSintomaticaAltoGradiente", {
            level: "urgent",
            title: "Substituição valvar aórtica indicada",
            detail:
              "Estenose aórtica grave sintomática de alto gradiente (gradiente médio ≥ 40 mmHg, " +
              "Vmax ≥ 4,0 m/s, área ≤ 1,0 cm² ou ≤ 0,6 cm²/m²): intervenção recomendada.",
          }));
        } else if (alto === false) {
          // Baixo gradiente sintomático: o ramo que 2021 não cobria e que 2025
          // separa em dois, pelo volume sistólico indexado e pela FE.
          if (!medida(i.svi_ml_m2)) {
            recs.push(faltando(
              ["volume sistólico indexado"],
              "a estenose de baixo gradiente sintomática",
            ));
          } else if (i.svi_ml_m2 <= 35) {
            if (!temFE(i)) {
              recs.push(faltando(["fração de ejeção"], "a estenose de baixo fluxo e baixo gradiente"));
            } else if (i.ejection_fraction! < 50) {
              intervencaoIndicada = true;
              recs.push(daDiretriz("eaSintomaticaBaixoFluxoFeReduzida", {
                level: "urgent",
                title: "Intervenção indicada (baixo fluxo, baixo gradiente, FE reduzida)",
                detail:
                  "Estenose aórtica sintomática de baixo fluxo (VSi ≤ 35 mL/m²) e baixo gradiente " +
                  "(< 40 mmHg) com FE < 50%: intervenção recomendada, após confirmação cuidadosa " +
                  "de que a estenose é grave.",
              }));
            } else {
              intervencaoIndicada = true;
              recs.push(daDiretriz("eaSintomaticaBaixoFluxoFeNormal", {
                level: "consider",
                title: "Considerar intervenção (baixo fluxo paradoxal)",
                detail:
                  "Estenose aórtica sintomática de baixo fluxo (VSi ≤ 35 mL/m²) e baixo gradiente " +
                  "(< 40 mmHg) com FE ≥ 50%. A diretriz alerta que causas de área pequena com " +
                  "gradiente baixo — erro de medida, pressão arterial não controlada, condições que " +
                  "reduzem o volume sistólico — são frequentes e precisam ser excluídas antes.",
              }));
            }
          }
        } else {
          // Gradiente e Vmax não registrados. Aqui NÃO se segura a indicação:
          // em estenose aórtica grave sintomática os dois caminhos possíveis —
          // alto gradiente, e baixo fluxo com FE reduzida — são Classe I nível
          // B, então afirmar "Classe I B" é verdade em qualquer um deles. Pedir
          // o exame antes de indicar mandaria esperar um paciente sintomático,
          // que é exatamente o erro que este arquivo existe para não cometer.
          intervencaoIndicada = true;
          recs.push(daDiretriz("eaSintomaticaAltoGradiente", {
            level: "urgent",
            title: "Substituição valvar aórtica indicada",
            detail:
              "Estenose aórtica grave sintomática tem indicação Classe I para intervenção. O " +
              "gradiente médio e a Vmax não constam deste caso, então não dá para dizer se o " +
              "paciente está no ramo de alto gradiente ou no de baixo fluxo com FE reduzida — " +
              "ambos são Classe I. Registre as medidas para a sugestão ficar específica.",
          }));
        }
      }

      // Independe do status sintomático, e por isso fica FORA do `else`: FE
      // abaixo de 50% é Classe I por si só. Encaixar esta regra dentro do ramo
      // "assintomático confirmado" fazia um caso sem NYHA preenchido perder uma
      // recomendação Classe I — foi um defeito meu nesta mesma rodada, pego
      // pelo teste que já existia para exatamente isto.
      if (!sympt && temFE(i) && i.ejection_fraction! < 50) {
        intervencaoIndicada = true;
        recs.push(daDiretriz("eaAssintomaticaFeBaixa", {
          level: "urgent",
          title: "Intervenção mesmo assintomático (FE < 50%)",
          detail:
            "Estenose aórtica grave com FE < 50% sem outra causa: intervenção recomendada, " +
            "independentemente de sintomas.",
        }));
      }

      if (assintomaticoConfirmado && !intervencaoIndicada) {
        {
          const fePreservada = temFE(i) && i.ejection_fraction! >= 50;
          const muitoGrave =
            (medida(i.mean_gradient) && i.mean_gradient >= 60) ||
            (medida(i.vmax_m_s) && i.vmax_m_s > 5.0);
          const feLimitrofe = temFE(i) && i.ejection_fraction! < 55;

          // A mudança de 2025 que mais altera a conduta desta ferramenta:
          // operar assintomático deixou de ser exceção e virou alternativa
          // explícita à vigilância.
          if (fePreservada && riscoBaixo(i) && alto === true && i.teste_esforco === "normal") {
            intervencaoIndicada = true;
            recs.push(daDiretriz("eaAssintomaticaAlternativaVigilancia", {
              level: "consider",
              title: "Intervenção como alternativa à vigilância",
              detail:
                "Assintomático confirmado por teste de esforço normal, estenose grave de alto " +
                "gradiente, FE ≥ 50% e risco do procedimento baixo. A diretriz de 2025 coloca a " +
                "intervenção como alternativa à vigilância ativa — não mais apenas a espera.",
            }));
          }

          if (fePreservada && riscoBaixo(i) && (muitoGrave || feLimitrofe)) {
            intervencaoIndicada = true;
            recs.push(daDiretriz("eaAssintomaticaCriterioAdicional", {
              level: "consider",
              title: muitoGrave
                ? "Considerar intervenção (estenose muito grave)"
                : "Considerar intervenção (FE < 55%)",
              detail:
                "Assintomático com FE ≥ 50% e risco baixo, com pelo menos um critério adicional " +
                "presente: " +
                (muitoGrave
                  ? "estenose muito grave (gradiente médio ≥ 60 mmHg ou Vmax > 5,0 m/s)."
                  : "FE < 55% sem outra causa.") +
                " A diretriz aceita também calcificação valvar grave com progressão de Vmax " +
                "≥ 0,3 m/s por ano, e BNP/NT-proBNP mais de três vezes o normal para idade e sexo.",
            }));
          }

          if (i.teste_esforco === "queda_pa") {
            intervencaoIndicada = true;
            recs.push(daDiretriz("eaAssintomaticaQuedaPa", {
              level: "consider",
              title: "Considerar intervenção (queda de PA no esforço)",
              detail:
                "Queda sustentada da pressão arterial (> 20 mmHg) durante o teste de esforço em " +
                "paciente com estenose aórtica grave: critério próprio para considerar intervenção.",
            }));
          }

          if (!intervencaoIndicada) {
            const faltam: string[] = [];
            if (!temFE(i)) faltam.push("fração de ejeção");
            if (!i.teste_esforco) faltam.push("teste de esforço");
            if (!i.risco_cirurgico) faltam.push("risco cirúrgico");
            if (faltam.length) {
              recs.push(faltando(faltam, "a troca valvar em paciente assintomático"));
            }
            recs.push({
              level: "watch",
              title: "Vigilância clínica e ecocardiográfica",
              detail:
                (temFE(i)
                  ? "Assintomático com função ventricular preservada: "
                  : "Assintomático, com fração de ejeção não informada: ") +
                "ECO seriado a cada 6 meses e teste de esforço para confirmar o status sintomático. " +
                "Desde 2025 a vigilância ativa é uma das duas alternativas — a outra é intervir, " +
                "quando o risco do procedimento é baixo.",
              source: `ESC/EACTS 2025 — ${DIRETRIZ_2025.eaAssintomaticaAlternativaVigilancia.tabela}`,
            });
          }
        }
      } else if (status === null && !intervencaoIndicada) {
        recs.push(statusNaoInformado());
      }

      if (intervencaoIndicada) recs.push(...modoDeIntervencao(i));
    } else if (i.severity === "moderada") {
      recs.push({
        level: "watch",
        title: "Seguimento com ECO anual",
        detail:
          "Estenose aórtica moderada: reavaliação clínica e ECO a cada 12 meses. Otimizar fatores de risco cardiovascular.",
        source: "ESC/EACTS 2025",
      });
    }
  }

  // ============= INSUFICIÊNCIA AÓRTICA =============
  if (i.valve_type === "aortica" && i.valve_disease === "insuficiencia" && grave) {
    if (sympt) {
      recs.push(daDiretriz("iaSintomatica", {
        level: "urgent",
        title: "Cirurgia valvar aórtica indicada",
        detail:
          "Insuficiência aórtica grave sintomática: cirurgia recomendada independentemente da função ventricular.",
      }));
    } else {
      const dsvei = dsveIndexado(i);
      // Classe I que não depende do status sintomático — fica fora do ramo
      // "assintomático confirmado" pela mesma razão da estenose aórtica.
      const gatilhoClasseI =
        (temFE(i) && i.ejection_fraction! <= 50) ||
        (medida(i.lvesd_mm) && i.lvesd_mm > 50) ||
        (dsvei !== null && dsvei > 25);

      if (gatilhoClasseI) {
        recs.push(daDiretriz("iaAssintomatica", {
          level: "urgent",
          title: "Cirurgia mesmo assintomático",
          detail:
            "IA grave com FE em repouso ≤ 50%, ou DSVE > 50 mm, ou DSVE indexado " +
            "> 25 mm/m² — este último especialmente em pacientes de porte pequeno (superfície " +
            "corporal < 1,68 m²).",
        }));
      } else if (!assintomaticoConfirmado) {
        recs.push(statusNaoInformado());
      } else if (riscoBaixo(i) && ((dsvei !== null && dsvei > 22) || (temFE(i) && i.ejection_fraction! <= 55))) {
        recs.push(daDiretriz("iaAssintomaticaLimiteMenor", {
          level: "consider",
          title: "Cirurgia pode ser considerada (limiares menores)",
          detail:
            "Com risco cirúrgico baixo, a diretriz admite considerar cirurgia já com DSVE indexado " +
            "> 22 mm/m², volume sistólico final indexado > 45 mL/m², ou FE em repouso ≤ 55%.",
        }));
      } else {
        if (!medida(i.lvesd_mm)) {
          recs.push(faltando(["DSVE"], "a cirurgia em IA assintomática"));
        } else if (dsvei === null) {
          recs.push(faltando(["altura", "peso"], "o DSVE indexado, que é o critério de porte pequeno"));
        }
        recs.push({
          level: "watch",
          title: "Seguimento ecocardiográfico",
          detail:
            (temFE(i) ? "Assintomático com FE preservada: " : "Assintomático, com FE não informada: ") +
            "ECO a cada 6 meses, com atenção ao DSVE — desde 2025 ele é gatilho cirúrgico por si só, " +
            "acima de 50 mm, ou acima de 25 mm/m² quando indexado.",
          source: `ESC/EACTS 2025 — ${DIRETRIZ_2025.iaAssintomatica.tabela}`,
        });
      }
    }
  }

  // ============= ESTENOSE MITRAL =============
  if (i.valve_type === "mitral" && i.valve_disease === "estenose" && grave) {
    if (sympt) {
      recs.push(daDiretriz("emPmcSintomatica", {
        level: "urgent",
        title: "Comissurotomia mitral percutânea",
        detail:
          "Estenose mitral grave sintomática, na ausência de características desfavoráveis para o " +
          "procedimento: comissurotomia percutânea recomendada.",
      }));
      recs.push(daDiretriz("emCirurgiaSemPmc", {
        level: "consider",
        title: "Cirurgia se a valva não for adequada à comissurotomia",
        detail:
          "Quando a anatomia ou as condições clínicas contraindicam a comissurotomia percutânea, " +
          "a cirurgia valvar mitral é a recomendação.",
      }));
    } else if (assintomaticoConfirmado) {
      recs.push(daDiretriz("emPmcAssintomatica", {
        level: "consider",
        title: "Comissurotomia pode ser considerada mesmo assintomático",
        detail:
          "Sem características desfavoráveis, a diretriz considera a comissurotomia em assintomáticos " +
          "com alto risco tromboembólico (embolia sistêmica prévia, contraste espontâneo denso em AE, " +
          "FA nova ou paroxística) ou alto risco de descompensação hemodinâmica (PSAP > 50 mmHg em " +
          "repouso, cirurgia não cardíaca de grande porte, gestação ou desejo de gestar).",
      }));
    } else {
      recs.push(statusNaoInformado());
    }

    recs.push(...anticoagulacaoNaEstenoseMitral(i));
  }

  // ============= INSUFICIÊNCIA MITRAL =============
  if (i.valve_type === "mitral" && (i.valve_disease === "insuficiencia" || i.valve_disease === "prolapso") && grave) {
    if (sympt) {
      recs.push(daDiretriz("imSintomatica", {
        level: "urgent",
        title: "Cirurgia mitral indicada",
        detail:
          "IM primária grave sintomática, considerada operável pelo Heart Team: cirurgia recomendada.",
      }));
      recs.push(daDiretriz("imReparoPreferencial", {
        level: "consider",
        title: "Plástica é a técnica cirúrgica recomendada",
        detail:
          "Quando se espera resultado durável, o reparo valvar é a técnica recomendada — e não a " +
          "troca. Em anatomia complexa, o reparo deve ser tentado em centro experiente.",
      }));
    } else {
      const dsvei = dsveIndexado(i);
      // Idem: disfunção ventricular é Classe I independentemente de sintomas.
      const disfuncao =
        (temFE(i) && i.ejection_fraction! <= 60) ||
        (medida(i.lvesd_mm) && i.lvesd_mm >= 40) ||
        (dsvei !== null && dsvei >= 20);

      if (disfuncao) {
        recs.push(daDiretriz("imAssintomaticaDisfuncao", {
          level: "urgent",
          title: "Cirurgia mesmo assintomático (disfunção ventricular)",
          detail:
            "IM primária grave com disfunção do VE — DSVE ≥ 40 mm, DSVE indexado " +
            "≥ 20 mm/m², ou FE ≤ 60%: cirurgia recomendada.",
        }));
      } else if (!assintomaticoConfirmado) {
        recs.push(statusNaoInformado());
      } else {
        if (!medida(i.lvesd_mm)) {
          recs.push(faltando(["DSVE"], "a cirurgia em IM primária assintomática"));
        }
        recs.push(daDiretriz("imAssintomaticaBaixoRisco", {
          level: "watch",
          title: "Plástica pode ser recomendada mesmo sem disfunção",
          detail:
            "Sem disfunção ventricular e com risco cirúrgico baixo, a plástica é recomendada quando " +
            "o resultado durável é provável e pelo menos três destes estão presentes: fibrilação " +
            "atrial; PSAP em repouso > 50 mmHg; dilatação atrial esquerda (volume indexado ≥ 60 mL/m² " +
            "ou diâmetro ≥ 55 mm); insuficiência tricúspide secundária pelo menos moderada. " +
            "Estes quatro não são registrados neste caso — confira-os antes de decidir pela espera.",
        }));
      }
    }
  }

  // ============= INSUFICIÊNCIA TRICÚSPIDE =============
  if (i.valve_type === "tricuspide" && i.valve_disease === "insuficiencia" && grave) {
    recs.push(daDiretriz("itAvaliacao", {
      level: "info",
      title: "Avaliação pelo Heart Team antes de intervir",
      detail:
        "A diretriz recomenda avaliar etiologia, estágio da doença (grau da IT, função do VD e do VE, " +
        "hipertensão pulmonar), risco operatório e probabilidade de recuperação, por equipe " +
        "multidisciplinar, antes de qualquer intervenção tricúspide.",
    }));

    if (sympt) {
      recs.push(daDiretriz("itCirurgiaPrimariaSintomatica", {
        level: "urgent",
        title: "Cirurgia tricúspide indicada",
        detail:
          "IT primária grave sintomática, sem disfunção grave do VD nem hipertensão pulmonar grave: " +
          "cirurgia recomendada.",
      }));
      recs.push(daDiretriz("itTranscateter", {
        level: "consider",
        title: "Tratamento transcateter em paciente de alto risco",
        detail:
          "Para pacientes de alto risco com IT grave sintomática apesar de tratamento clínico otimizado, " +
          "sem disfunção grave do VD nem hipertensão pulmonar pré-capilar, o tratamento transcateter " +
          "deve ser considerado para melhorar qualidade de vida e remodelamento do VD.",
      }));
    } else if (assintomaticoConfirmado) {
      recs.push(daDiretriz("itAssintomaticaVd", {
        level: "consider",
        title: "Cirurgia pode ser considerada mesmo assintomático",
        detail:
          "Em IT primária grave assintomática com dilatação do VD ou deterioração da função do VD, " +
          "sem disfunção grave de VE/VD nem hipertensão pulmonar grave, a cirurgia deve ser " +
          "considerada. As medidas de VD não são registradas neste caso.",
      }));
    } else {
      // Sem o status, este bloco ficava calado e o caso caía no texto genérico
      // de "nenhuma recomendação" — verdadeiro, mas escondendo que a ausência é
      // de dado, não de indicação.
      recs.push(statusNaoInformado());
    }
  }

  // ============= FIBRILAÇÃO ATRIAL FORA DA ESTENOSE MITRAL =============
  if (
    i.fibrilacao_atrial === true &&
    !(i.valve_type === "mitral" && i.valve_disease === "estenose") &&
    (i.valve_type === "aortica" ||
      (i.valve_type === "mitral" && (i.valve_disease === "insuficiencia" || i.valve_disease === "prolapso")))
  ) {
    recs.push(daDiretriz("faDoacPreferencial", {
      level: "consider",
      title: "Anticoagulação: DOAC preferencial",
      detail:
        "Em fibrilação atrial com estenose aórtica, insuficiência aórtica ou insuficiência mitral, e " +
        "havendo indicação de anticoagulação, os DOACs são preferenciais em relação aos antagonistas " +
        "da vitamina K para prevenção de AVC.",
    }));
  }

  // ============= GERAL: insuficiência cardíaca =============
  if (temFE(i) && i.ejection_fraction! < 40) {
    recs.push({
      level: "consider",
      title: "Otimizar tratamento de IC com FE reduzida",
      detail:
        "FEVE < 40%: instituir/otimizar quádrupla terapia (IECA/BRA/sacubitril-valsartana, betabloqueador, antagonista mineralocorticoide, iSGLT2).",
      // Diretriz de insuficiência cardíaca, não a valvar — e a distinção fica
      // escrita para ninguém achar que veio da ESC/EACTS 2025.
      source: "ESC 2021 — diretriz de insuficiência cardíaca",
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

/**
 * O modo de intervenção na estenose aórtica.
 *
 * 2025 trocou o corte de idade: era 75 anos, passou a **70**. O número foi
 * conferido em três lugares do documento — a Tabela 4, o resumo de Classe I das
 * páginas 73–74, e a ausência de "75 anos" em qualquer tabela definitiva. A
 * redação de 75 anos existe no documento, mas na coluna de **2021** da tabela
 * comparativa; ver a nota sobre isso em `src/data/diretriz2025.ts`.
 *
 * Isto é critério clínico, não preferência comercial: a Resolução CFM
 * 2.336/2023 proíbe ranking de produto, e nada aqui nomeia fabricante.
 */
function modoDeIntervencao(i: Input): Recommendation[] {
  const idade = i.patient_age;
  if (!medida(idade)) {
    return [daDiretriz("eaHeartTeam", {
      level: "info",
      title: "Modo de intervenção: decisão do Heart Team",
      detail:
        "A escolha entre cirurgia e transcateter cabe ao Heart Team, considerando características " +
        "clínicas, anatômicas e do procedimento, o manejo ao longo da vida e a expectativa de vida. " +
        "A idade não consta deste caso, e ela é um dos critérios da diretriz.",
    })];
  }

  if (idade >= 70) {
    return [daDiretriz("eaModoTavi", {
      level: "consider",
      title: "Modo de intervenção: TAVI a partir de 70 anos",
      detail:
        "Em paciente com 70 anos ou mais e valva aórtica tricúspide, o implante transcateter é " +
        "recomendado se a anatomia for adequada — acesso transfemoral, dimensões do anel, padrão de " +
        "calcificação da zona de ancoragem e risco de obstrução coronariana.",
    })];
  }

  if (riscoBaixo(i)) {
    return [daDiretriz("eaModoCirurgia", {
      level: "consider",
      title: "Modo de intervenção: cirurgia abaixo de 70 anos",
      detail:
        `Em paciente com menos de 70 anos e risco cirúrgico baixo, a cirurgia é a recomendação. ` +
        `A diretriz define risco baixo como ${RISCO_BAIXO.verbatim.includes("<4%") ? "STS-PROM e EuroSCORE II abaixo de 4%" : ""} ` +
        "somados à avaliação do Heart Team — o ValvePath calcula o EuroSCORE II em Ferramentas.",
    })];
  }

  return [daDiretriz("eaHeartTeam", {
    level: "info",
    title: "Modo de intervenção: decisão do Heart Team",
    detail:
      "Abaixo de 70 anos, a recomendação de cirurgia depende de risco cirúrgico baixo, que não foi " +
      "registrado como tal neste caso. A escolha entre cirurgia e transcateter cabe ao Heart Team.",
  })];
}

/**
 * A correção mais importante desta rodada.
 *
 * O motor antigo dizia, na estenose mitral: "Anticoagulação obrigatória se
 * fibrilação atrial associada (Classe I)" — sem dizer **com quê**. Na estenose
 * mitral moderada a grave o DOAC é Classe III, ou seja, contraindicado, e a
 * frase genérica levava direto ao erro de prescrição.
 */
function anticoagulacaoNaEstenoseMitral(i: Input): Recommendation[] {
  if (i.fibrilacao_atrial === null || i.fibrilacao_atrial === undefined) {
    return [faltando(["fibrilação atrial"], "qual anticoagulante usar na estenose mitral")];
  }
  if (!i.fibrilacao_atrial) return [];

  const saida: Recommendation[] = [
    daDiretriz("faDoacContraindicadoEmModeradaGrave", {
      level: "urgent",
      title: "DOAC contraindicado — anticoagular com varfarina",
      detail:
        "Em fibrilação atrial com estenose mitral moderada a grave, os anticoagulantes orais diretos " +
        "NÃO são recomendados. A anticoagulação deve ser feita com antagonista da vitamina K.",
    }),
  ];

  if (i.em_etiologia === "reumatica") {
    saida.push(daDiretriz("faDoacContraindicadoEmReumatica", {
      level: "urgent",
      title: "Estenose mitral reumática: DOAC contraindicado",
      detail:
        "Em estenose mitral reumática com área valvar ≤ 2,0 cm² e fibrilação atrial, o uso de DOAC " +
        "não é recomendado.",
    }));
  } else if (!i.em_etiologia) {
    saida.push(faltando(["etiologia da estenose mitral"], "o grau da contraindicação ao DOAC"));
  }

  return saida;
}
