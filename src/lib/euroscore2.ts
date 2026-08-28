/**
 * EuroSCORE II — mortalidade operatória prevista em cirurgia cardíaca.
 *
 * Modelo publicado: Nashef SAM, Roques F, Sharples LD, Nashef S, Roques F,
 * Michel P, Gauducheau E, Lemeshow S, Salamon R.
 * "EuroSCORE II", Eur J Cardiothorac Surg 2012;41(4):734-745.
 * https://academic.oup.com/ejcts/article/41/4/734/646622
 *
 * Os 18 coeficientes e a constante abaixo saíram da **Tabela 6 do artigo
 * original**, lida na fonte, não de memória. Isso importa mais aqui do que em
 * qualquer outro arquivo deste projeto: um coeficiente trocado de linha não
 * quebra nada, não gera erro e não aparece em teste de fumaça — ele só devolve
 * um número plausível e errado para uma decisão de operar ou não operar.
 *
 * Um valor que quase escapou por ser contraintuitivo: `unica_nao_cabg` **não é
 * zero** (0,0062118). A categoria de referência é a CABG isolada.
 *
 * ## O que este módulo faz de diferente das calculadoras de internet
 *
 * Toda calculadora online começa com os campos já nas categorias de referência.
 * Quem não responde "estado crítico pré-operatório" recebe a resposta de quem
 * respondeu "não" — e não tem como saber disso. Aqui, campo não respondido é
 * **lacuna**, e a saída devolve a faixa entre o melhor e o pior caso possível
 * com o que falta, em vez de um número que finge completude. É a mesma regra já
 * provada em `riskScore.ts` e em `guidelines.ts`.
 *
 * ## Limite do modelo, e ele é clínico
 *
 * O EuroSCORE II foi derivado e validado em **cirurgia cardíaca**. Não é escore
 * de TAVI. Quem o usa para planejar transcateter está fora da população de
 * derivação, e a tela diz isso antes de mostrar o número.
 */

export type Sexo = "F" | "M";
export type FaixaRenal = "normal" | "moderada" | "grave" | "dialise";
export type FuncaoVE = "boa" | "moderada" | "ruim" | "muito_ruim";
export type ClasseNyha = "I" | "II" | "III" | "IV";
export type PressaoPulmonar = "normal" | "31_55" | "55_ou_mais";
export type Urgencia = "eletiva" | "urgente" | "emergencia" | "salvamento";
export type PesoIntervencao = "cabg_isolada" | "unica_nao_cabg" | "duas" | "tres_ou_mais";

/**
 * A constante do modelo. Um paciente inteiramente na categoria de referência
 * (≤ 60 anos, homem, CABG isolada eletiva, sem nenhum fator) tem `y` igual a
 * ela e mortalidade prevista de ~0,49% — o piso conhecido do EuroSCORE II, e o
 * primeiro teste de sanidade que este arquivo tem que passar.
 */
export const CONSTANTE = -5.324537;

/** Tabela 6 do artigo. Nomes em inglês do artigo ao lado, para conferência. */
export const BETA = {
  idade: 0.0285181,                    // age (por ano acima de 60; ver `xIdade`)
  feminino: 0.2196434,                 // female
  renal: {
    normal: 0,                         // CC > 85 ml/min — referência
    moderada: 0.303553,                // CC 50-85
    grave: 0.8592256,                  // CC < 50
    dialise: 0.6421508,                // on dialysis, independente da creatinina
  },
  arteriopatia: 0.5360268,             // extracardiac arteriopathy
  mobilidade: 0.2407181,               // poor mobility
  cirurgiaCardiacaPrevia: 1.118599,    // previous cardiac surgery
  pneumopatia: 0.1886564,              // chronic lung disease
  endocarditeAtiva: 0.6194522,         // active endocarditis
  estadoCritico: 1.086517,             // critical preoperative state
  diabetesInsulina: 0.3542749,         // diabetes on insulin
  nyha: { I: 0, II: 0.1070545, III: 0.2958358, IV: 0.5597929 },
  ccs4: 0.2226147,                     // CCS class 4 angina
  funcaoVe: {
    boa: 0,                            // FEVE >= 51% — referência
    moderada: 0.3150652,               // 31-50%
    ruim: 0.8084096,                   // 21-30%
    muito_ruim: 0.9346919,             // <= 20%
  },
  infartoRecente: 0.1528943,           // recent MI (<= 90 dias)
  pressaoPulmonar: { normal: 0, "31_55": 0.1788899, "55_ou_mais": 0.3491475 },
  urgencia: {
    eletiva: 0,                        // referência
    urgente: 0.3174673,
    emergencia: 0.7039121,
    salvamento: 1.362947,
  },
  pesoIntervencao: {
    cabg_isolada: 0,                   // referência
    unica_nao_cabg: 0.0062118,         // pequeno, mas NÃO é zero
    duas: 0.5521478,
    tres_ou_mais: 0.9724533,
  },
  aortaToracica: 0.6527205,            // surgery on thoracic aorta
} as const;

export interface EntradaEuroscore {
  /** Obrigatória: é a única variável contínua, e sem ela não há faixa possível. */
  idade?: number | null;
  /** Obrigatório: `F` soma; `M` é a referência. */
  sexo?: Sexo | null;
  renal?: FaixaRenal | null;
  arteriopatia?: boolean | null;
  mobilidade?: boolean | null;
  cirurgiaCardiacaPrevia?: boolean | null;
  pneumopatia?: boolean | null;
  endocarditeAtiva?: boolean | null;
  estadoCritico?: boolean | null;
  diabetesInsulina?: boolean | null;
  nyha?: ClasseNyha | null;
  ccs4?: boolean | null;
  funcaoVe?: FuncaoVE | null;
  infartoRecente?: boolean | null;
  pressaoPulmonar?: PressaoPulmonar | null;
  urgencia?: Urgencia | null;
  pesoIntervencao?: PesoIntervencao | null;
  aortaToracica?: boolean | null;
}

export interface ContribuicaoEuroscore {
  rotulo: string;
  beta: number;
}

export interface ResultadoEuroscore {
  /** Mortalidade prevista em %, **só quando todas as 18 variáveis foram respondidas**. */
  mortalidade: number | null;
  /** Piso: o que sairia se tudo o que falta fosse a categoria de referência. */
  minimo: number;
  /** Teto: o que sairia se tudo o que falta fosse a pior categoria. */
  maximo: number;
  /** Soma dos betas do que foi respondido, mais a constante. */
  y: number;
  /** O que cada resposta somou — só o que soma aparece, como em `riskScore`. */
  contribuicoes: ContribuicaoEuroscore[];
  /** Rótulos das variáveis que ninguém respondeu. */
  faltando: string[];
  /** Idade e sexo respondidos? Sem eles não há nem faixa. */
  calculavel: boolean;
}

/**
 * A codificação da idade no artigo: 1 até 60 anos, e mais um ponto por ano
 * acima disso. Não é "idade × beta" — é o erro clássico de quem implementa de
 * memória, e infla a mortalidade de um paciente de 45 anos em vinte vezes.
 */
export const xIdade = (idade: number): number => (idade <= 60 ? 1 : idade - 59);

/** Logística do modelo. Exportada porque o teste confere `y` e `p` separados. */
export const probabilidade = (y: number): number => {
  const e = Math.exp(y);
  return e / (1 + e);
};

/**
 * Clearance de creatinina por Cockcroft-Gault, que é a fórmula que o próprio
 * artigo manda usar.
 *
 * A creatinina entra em **mg/dL**, que é a unidade do laboratório brasileiro.
 * Quem tiver µmol/L divide por 88,4 antes — e a tela diz isso, porque trocar a
 * unidade aqui muda a faixa renal e a faixa renal vale até 0,86 no expoente.
 */
export function clearanceCockcroftGault(
  idade: number, pesoKg: number, creatininaMgDl: number, sexo: Sexo,
): number | null {
  if (!(idade > 0) || !(pesoKg > 0) || !(creatininaMgDl > 0)) return null;
  const base = ((140 - idade) * pesoKg) / (72 * creatininaMgDl);
  return sexo === "F" ? base * 0.85 : base;
}

/** A faixa renal do modelo a partir do clearance. Diálise não passa por aqui. */
export function faixaRenalPorClearance(clearance: number): FaixaRenal {
  if (clearance > 85) return "normal";
  if (clearance >= 50) return "moderada";
  return "grave";
}

/**
 * As 16 variáveis que admitem lacuna (idade e sexo são exigidas à parte).
 *
 * Cada entrada traz o rótulo que a pessoa lê quando falta, o beta do que foi
 * respondido, e o **pior beta possível** — que é o que constrói o teto da
 * faixa. Ficam na mesma tabela de propósito: separar "quanto soma" de "quanto
 * poderia somar" é como as duas divergem na primeira revisão de coeficiente.
 */
type Variavel = {
  rotulo: string;
  ausente: (e: EntradaEuroscore) => boolean;
  beta: (e: EntradaEuroscore) => number;
  pior: number;
};

const VARIAVEIS: Variavel[] = [
  {
    rotulo: "função renal",
    ausente: (e) => !e.renal,
    beta: (e) => (e.renal ? BETA.renal[e.renal] : 0),
    pior: BETA.renal.grave,
  },
  {
    rotulo: "arteriopatia extracardíaca",
    ausente: (e) => e.arteriopatia == null,
    beta: (e) => (e.arteriopatia ? BETA.arteriopatia : 0),
    pior: BETA.arteriopatia,
  },
  {
    rotulo: "mobilidade reduzida",
    ausente: (e) => e.mobilidade == null,
    beta: (e) => (e.mobilidade ? BETA.mobilidade : 0),
    pior: BETA.mobilidade,
  },
  {
    rotulo: "cirurgia cardíaca prévia",
    ausente: (e) => e.cirurgiaCardiacaPrevia == null,
    beta: (e) => (e.cirurgiaCardiacaPrevia ? BETA.cirurgiaCardiacaPrevia : 0),
    pior: BETA.cirurgiaCardiacaPrevia,
  },
  {
    rotulo: "doença pulmonar crônica",
    ausente: (e) => e.pneumopatia == null,
    beta: (e) => (e.pneumopatia ? BETA.pneumopatia : 0),
    pior: BETA.pneumopatia,
  },
  {
    rotulo: "endocardite ativa",
    ausente: (e) => e.endocarditeAtiva == null,
    beta: (e) => (e.endocarditeAtiva ? BETA.endocarditeAtiva : 0),
    pior: BETA.endocarditeAtiva,
  },
  {
    rotulo: "estado crítico pré-operatório",
    ausente: (e) => e.estadoCritico == null,
    beta: (e) => (e.estadoCritico ? BETA.estadoCritico : 0),
    pior: BETA.estadoCritico,
  },
  {
    rotulo: "diabetes em uso de insulina",
    ausente: (e) => e.diabetesInsulina == null,
    beta: (e) => (e.diabetesInsulina ? BETA.diabetesInsulina : 0),
    pior: BETA.diabetesInsulina,
  },
  {
    rotulo: "classe NYHA",
    ausente: (e) => !e.nyha,
    beta: (e) => (e.nyha ? BETA.nyha[e.nyha] : 0),
    pior: BETA.nyha.IV,
  },
  {
    rotulo: "angina CCS classe 4",
    ausente: (e) => e.ccs4 == null,
    beta: (e) => (e.ccs4 ? BETA.ccs4 : 0),
    pior: BETA.ccs4,
  },
  {
    rotulo: "função do ventrículo esquerdo",
    ausente: (e) => !e.funcaoVe,
    beta: (e) => (e.funcaoVe ? BETA.funcaoVe[e.funcaoVe] : 0),
    pior: BETA.funcaoVe.muito_ruim,
  },
  {
    rotulo: "infarto recente (≤ 90 dias)",
    ausente: (e) => e.infartoRecente == null,
    beta: (e) => (e.infartoRecente ? BETA.infartoRecente : 0),
    pior: BETA.infartoRecente,
  },
  {
    rotulo: "pressão sistólica da artéria pulmonar",
    ausente: (e) => !e.pressaoPulmonar,
    beta: (e) => (e.pressaoPulmonar ? BETA.pressaoPulmonar[e.pressaoPulmonar] : 0),
    pior: BETA.pressaoPulmonar["55_ou_mais"],
  },
  {
    rotulo: "urgência da operação",
    ausente: (e) => !e.urgencia,
    beta: (e) => (e.urgencia ? BETA.urgencia[e.urgencia] : 0),
    pior: BETA.urgencia.salvamento,
  },
  {
    rotulo: "peso da intervenção",
    ausente: (e) => !e.pesoIntervencao,
    beta: (e) => (e.pesoIntervencao ? BETA.pesoIntervencao[e.pesoIntervencao] : 0),
    pior: BETA.pesoIntervencao.tres_ou_mais,
  },
  {
    rotulo: "cirurgia da aorta torácica",
    ausente: (e) => e.aortaToracica == null,
    beta: (e) => (e.aortaToracica ? BETA.aortaToracica : 0),
    pior: BETA.aortaToracica,
  },
];

/** Quantas variáveis admitem lacuna — o denominador de "N de 16 dados". */
export const TOTAL_VARIAVEIS = VARIAVEIS.length;

const ROTULOS: Record<string, string> = {
  renal_moderada: "Clearance de creatinina 50–85 ml/min",
  renal_grave: "Clearance de creatinina < 50 ml/min",
  renal_dialise: "Em diálise",
  ve_moderada: "FEVE 31–50%",
  ve_ruim: "FEVE 21–30%",
  ve_muito_ruim: "FEVE ≤ 20%",
  pap_31_55: "PSAP 31–55 mmHg",
  pap_55_ou_mais: "PSAP ≥ 55 mmHg",
  urg_urgente: "Cirurgia urgente",
  urg_emergencia: "Cirurgia de emergência",
  urg_salvamento: "Cirurgia de salvamento",
  peso_unica_nao_cabg: "Procedimento único que não CABG",
  peso_duas: "Dois procedimentos maiores",
  peso_tres_ou_mais: "Três ou mais procedimentos maiores",
};

export function calcularEuroscore2(e: EntradaEuroscore): ResultadoEuroscore {
  const contribuicoes: ContribuicaoEuroscore[] = [];

  if (e.idade == null || !e.sexo) {
    const faltando = [
      ...(e.idade == null ? ["idade"] : []),
      ...(!e.sexo ? ["sexo"] : []),
      ...VARIAVEIS.filter((v) => v.ausente(e)).map((v) => v.rotulo),
    ];
    return {
      mortalidade: null, minimo: 0, maximo: 0, y: CONSTANTE,
      contribuicoes: [], faltando, calculavel: false,
    };
  }

  let y = CONSTANTE;

  const bIdade = BETA.idade * xIdade(e.idade);
  if (bIdade > 0) contribuicoes.push({ rotulo: `Idade ${e.idade} anos`, beta: bIdade });
  y += bIdade;

  if (e.sexo === "F") {
    contribuicoes.push({ rotulo: "Sexo feminino", beta: BETA.feminino });
    y += BETA.feminino;
  }

  if (e.renal && e.renal !== "normal") {
    const b = BETA.renal[e.renal];
    contribuicoes.push({ rotulo: ROTULOS[`renal_${e.renal}`]!, beta: b });
    y += b;
  }
  if (e.arteriopatia) { contribuicoes.push({ rotulo: "Arteriopatia extracardíaca", beta: BETA.arteriopatia }); y += BETA.arteriopatia; }
  if (e.mobilidade) { contribuicoes.push({ rotulo: "Mobilidade gravemente reduzida", beta: BETA.mobilidade }); y += BETA.mobilidade; }
  if (e.cirurgiaCardiacaPrevia) { contribuicoes.push({ rotulo: "Cirurgia cardíaca prévia", beta: BETA.cirurgiaCardiacaPrevia }); y += BETA.cirurgiaCardiacaPrevia; }
  if (e.pneumopatia) { contribuicoes.push({ rotulo: "Doença pulmonar crônica", beta: BETA.pneumopatia }); y += BETA.pneumopatia; }
  if (e.endocarditeAtiva) { contribuicoes.push({ rotulo: "Endocardite ativa", beta: BETA.endocarditeAtiva }); y += BETA.endocarditeAtiva; }
  if (e.estadoCritico) { contribuicoes.push({ rotulo: "Estado crítico pré-operatório", beta: BETA.estadoCritico }); y += BETA.estadoCritico; }
  if (e.diabetesInsulina) { contribuicoes.push({ rotulo: "Diabetes em uso de insulina", beta: BETA.diabetesInsulina }); y += BETA.diabetesInsulina; }

  if (e.nyha && e.nyha !== "I") {
    const b = BETA.nyha[e.nyha];
    contribuicoes.push({ rotulo: `Classe NYHA ${e.nyha}`, beta: b });
    y += b;
  }
  if (e.ccs4) { contribuicoes.push({ rotulo: "Angina CCS classe 4", beta: BETA.ccs4 }); y += BETA.ccs4; }

  if (e.funcaoVe && e.funcaoVe !== "boa") {
    const b = BETA.funcaoVe[e.funcaoVe];
    contribuicoes.push({ rotulo: ROTULOS[`ve_${e.funcaoVe}`]!, beta: b });
    y += b;
  }
  if (e.infartoRecente) { contribuicoes.push({ rotulo: "Infarto nos últimos 90 dias", beta: BETA.infartoRecente }); y += BETA.infartoRecente; }

  if (e.pressaoPulmonar && e.pressaoPulmonar !== "normal") {
    const b = BETA.pressaoPulmonar[e.pressaoPulmonar];
    contribuicoes.push({ rotulo: ROTULOS[`pap_${e.pressaoPulmonar}`]!, beta: b });
    y += b;
  }
  if (e.urgencia && e.urgencia !== "eletiva") {
    const b = BETA.urgencia[e.urgencia];
    contribuicoes.push({ rotulo: ROTULOS[`urg_${e.urgencia}`]!, beta: b });
    y += b;
  }
  if (e.pesoIntervencao && e.pesoIntervencao !== "cabg_isolada") {
    const b = BETA.pesoIntervencao[e.pesoIntervencao];
    contribuicoes.push({ rotulo: ROTULOS[`peso_${e.pesoIntervencao}`]!, beta: b });
    y += b;
  }
  if (e.aortaToracica) { contribuicoes.push({ rotulo: "Cirurgia da aorta torácica", beta: BETA.aortaToracica }); y += BETA.aortaToracica; }

  const ausentes = VARIAVEIS.filter((v) => v.ausente(e));
  const faltando = ausentes.map((v) => v.rotulo);
  const potencial = ausentes.reduce((s, v) => s + v.pior, 0);

  const pct = (valor: number) => probabilidade(valor) * 100;

  return {
    mortalidade: ausentes.length === 0 ? pct(y) : null,
    // Piso e teto: o que falta na melhor e na pior categoria possível. Com tudo
    // respondido os três coincidem, e é assim que o teste confere a coerência.
    minimo: pct(y),
    maximo: pct(y + potencial),
    y,
    contribuicoes,
    faltando,
    calculavel: true,
  };
}
