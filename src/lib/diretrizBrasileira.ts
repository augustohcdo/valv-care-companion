/**
 * O que a Diretriz Brasileira de Valvopatias – 2026 diz sobre ESTE caso.
 *
 * ## Por que é um módulo separado do motor da ESC
 *
 * O motor de `guidelines.ts` foi escrito, medido e guardado sobre a ESC/EACTS
 * 2025. Reescrevê-lo para "a diretriz vigente" produziria uma conduta só, de
 * origem misturada, em que ninguém mais sabe qual sociedade disse o quê — e
 * numa divergência o médico leria uma frase que nenhuma das duas escreveu.
 *
 * Então são duas camadas, e a tela mostra as duas. A europeia continua sendo a
 * referência internacional; a brasileira é a local, e é ela que fala a
 * realidade de disponibilidade, perfil etário e febre reumática daqui.
 *
 * ## O que este módulo NÃO faz
 *
 * **Não traduz GRADE para Classe/Nível.** "Forte/Alta" não é "Classe I Nível
 * A": são escalas de significado diferente, e a própria diretriz brasileira
 * imprime as duas lado a lado em vez de converter uma na outra. Converter aqui
 * seria inventar uma equivalência que ninguém publicou.
 *
 * **Não escolhe entre as duas quando divergem.** Mostra as duas e diz que
 * divergem. Escolher em silêncio é decidir pelo médico sem dizer que decidiu.
 *
 * **Não seleciona linha que o caso não sustenta.** Sem idade registrada não há
 * faixa etária; sem risco cirúrgico não há escolha de técnica. Falta de dado
 * vira item em `faltam`, que a tela mostra — e não um ramo "por padrão".
 */

import {
  FONTE_BR_2026, NOTAS_QUADRO_27, QUADRO_27_ESCOLHA_DA_INTERVENCAO,
  QUADRO_27_ESTENOSE_AORTICA, TABELA_1_NOVIDADES, type RecomendacaoBr,
} from "@/data/diretrizBr2026";

export interface CasoBr {
  valve_type: string;
  valve_disease: string;
  severity: string;
  patient_age?: number | null;
  risco_cirurgico?: string | null;
  /**
   * Três estados, decididos pelo motor da ESC e repassados: `true`, `false` e
   * **`null` para "ninguém informou"**.
   *
   * Recebido pronto de propósito. Reimplementar a leitura de sintomas aqui
   * criaria uma segunda definição de "sintomático" que pode divergir da
   * primeira, e as duas camadas passariam a falar de pacientes diferentes.
   */
  sintomatico: boolean | null;
}

export interface LinhaSelecionada {
  chave: string;
  r: RecomendacaoBr;
  /** Por que esta linha foi selecionada para este caso, em uma frase. */
  porque: string;
}

export interface SelecaoBr {
  linhas: LinhaSelecionada[];
  /** Dados que faltam e que impedem uma seleção — não um ramo "por padrão". */
  faltam: string[];
  /** A nota obrigatória do Quadro 27, quando alguma linha dele foi mostrada. */
  notaObrigatoria?: string;
  fonte: typeof FONTE_BR_2026;
}

const grave = (c: CasoBr) => c.severity === "critica" || c.severity === "importante";
const temIdade = (c: CasoBr): c is CasoBr & { patient_age: number } =>
  c.patient_age !== null && c.patient_age !== undefined && Number.isFinite(c.patient_age);

/**
 * A faixa etária da ESCOLHA DA TÉCNICA, como o Quadro 27 a divide.
 *
 * Três faixas, e os limites são os impressos: abaixo de 70, de 70 a 80, acima
 * de 80. Note que a diretriz escreve "Baixo risco 70 a 80 anos" — 70 e 80
 * inclusive —, e é assim que está aqui.
 */
export function faixaDaEscolha(idade: number): "abaixo70" | "de70a80" | "acima80" {
  if (idade < 70) return "abaixo70";
  if (idade <= 80) return "de70a80";
  return "acima80";
}

/**
 * A divergência que mais importa entre as duas diretrizes na estenose aórtica.
 *
 * A ESC/EACTS 2025 recomenda TAVI **a partir de 70 anos** (Classe I A) e
 * cirurgia abaixo de 70 com risco baixo (I B). A brasileira concorda abaixo de
 * 70 e acima de 80, mas na faixa de 70 a 80 anos ela diz outra coisa:
 * **TAVI = Cirurgia**, as duas Forte/Alta.
 *
 * Quer dizer que, para um paciente de 75 anos, a europeia prefere o transcateter
 * e a brasileira chama as duas de equivalentes. Não é detalhe de redação: é a
 * decisão da mesa. Por isso a tela mostra as duas, e esta função existe para a
 * tela saber QUANDO avisar.
 */
export function divergeNaEscolhaDaTecnica(idade: number): boolean {
  return faixaDaEscolha(idade) === "de70a80";
}

/** As linhas da diretriz brasileira que se aplicam a este caso. */
export function recomendacoesBrasileiras(c: CasoBr): SelecaoBr {
  const linhas: LinhaSelecionada[] = [];
  const faltam: string[] = [];
  let usouQuadro27 = false;

  const push = (chave: string, r: RecomendacaoBr, porque: string) => {
    linhas.push({ chave, r, porque });
    if (r.quadro === "Quadro 27") usouQuadro27 = true;
  };

  if (!grave(c)) {
    return { linhas, faltam, fonte: FONTE_BR_2026 };
  }

  // ===================== ESTENOSE AÓRTICA =====================
  if (c.valve_type === "aortica" && c.valve_disease === "estenose") {
    if (c.sintomatico === true) {
      push("sintomas", QUADRO_27_ESTENOSE_AORTICA.sintomas,
        "o caso registra sintomas (classe funcional ≥ 2, síncope ou angina)");
    } else if (c.sintomatico === false) {
      // A novidade de 2026 — e ela é Fraca/Alta, com nota longa. Mostrar sem a
      // nota seria mostrar outra recomendação.
      push("eaAssintomaticaPrecoce", TABELA_1_NOVIDADES.eaAssintomaticaPrecoce,
        "assintomático: é a recomendação nova de 2026 sobre intervenção precoce");
    } else {
      faltam.push("se há sintomas (NYHA ou lista de sintomas)");
    }

    // A escolha da técnica só se pergunta depois de haver indicação, e só se
    // sustenta com idade e risco registrados.
    if (c.sintomatico === true) {
      if (!temIdade(c)) {
        faltam.push("a idade, que define a faixa da escolha entre cirurgia e TAVI");
      } else if (c.risco_cirurgico !== "baixo") {
        if (c.risco_cirurgico === "alto") {
          push("altoRiscoTavi", QUADRO_27_ESCOLHA_DA_INTERVENCAO.altoRiscoTavi,
            "risco cirúrgico alto registrado no caso");
          push("altoRiscoCirurgia", QUADRO_27_ESCOLHA_DA_INTERVENCAO.altoRiscoCirurgia,
            "risco cirúrgico alto registrado no caso");
        } else if (c.risco_cirurgico === "intermediario") {
          push("intermediarioTavi", QUADRO_27_ESCOLHA_DA_INTERVENCAO.intermediarioTavi,
            "risco cirúrgico intermediário registrado no caso");
          push("intermediarioCirurgia", QUADRO_27_ESCOLHA_DA_INTERVENCAO.intermediarioCirurgia,
            "risco cirúrgico intermediário registrado no caso");
        } else {
          faltam.push("o risco cirúrgico, que divide as recomendações de técnica");
        }
      } else {
        const faixa = faixaDaEscolha(c.patient_age);
        const porque = `risco baixo e ${c.patient_age} anos`;
        if (faixa === "abaixo70") {
          push("baixoRiscoAbaixo70Cirurgia", QUADRO_27_ESCOLHA_DA_INTERVENCAO.baixoRiscoAbaixo70Cirurgia, porque);
          push("baixoRiscoAbaixo70Tavi", QUADRO_27_ESCOLHA_DA_INTERVENCAO.baixoRiscoAbaixo70Tavi, porque);
        } else if (faixa === "de70a80") {
          push("baixoRisco70a80Cirurgia", QUADRO_27_ESCOLHA_DA_INTERVENCAO.baixoRisco70a80Cirurgia, porque);
          push("baixoRisco70a80Tavi", QUADRO_27_ESCOLHA_DA_INTERVENCAO.baixoRisco70a80Tavi, porque);
        } else {
          push("baixoRiscoAcima80Tavi", QUADRO_27_ESCOLHA_DA_INTERVENCAO.baixoRiscoAcima80Tavi, porque);
          push("baixoRiscoAcima80Cirurgia", QUADRO_27_ESCOLHA_DA_INTERVENCAO.baixoRiscoAcima80Cirurgia, porque);
        }
      }
    }
  }

  // ===================== INSUFICIÊNCIA AÓRTICA =====================
  if (c.valve_type === "aortica" && c.valve_disease === "insuficiencia" && c.sintomatico === true) {
    push("iaTaviRiscoProibitivo", TABELA_1_NOVIDADES.iaTaviRiscoProibitivo,
      "insuficiência aórtica importante sintomática — a linha vale para " +
      "contraindicação ou risco proibitivo à cirurgia, que este caso não registra");
  }

  // ===================== INSUFICIÊNCIA MITRAL =====================
  if (
    c.valve_type === "mitral"
    && (c.valve_disease === "insuficiencia" || c.valve_disease === "prolapso")
    && c.sintomatico === true
  ) {
    push("imPrimariaReparoPercutaneo", TABELA_1_NOVIDADES.imPrimariaReparoPercutaneo,
      "insuficiência mitral sintomática — a linha é da forma PRIMÁRIA não reumática, com alto risco cirúrgico");
    push("imSecundariaReparoPercutaneo", TABELA_1_NOVIDADES.imSecundariaReparoPercutaneo,
      "insuficiência mitral sintomática — a linha é da forma SECUNDÁRIA ventricular, após otimização clínica");
  }

  // ===================== INSUFICIÊNCIA TRICÚSPIDE =====================
  if (c.valve_type === "tricuspide" && c.valve_disease === "insuficiencia") {
    push("itReparoBordaABorda", TABELA_1_NOVIDADES.itReparoBordaABorda,
      "insuficiência tricúspide importante — refratária ao tratamento clínico, com anatomia favorável");
    push("itImplanteOrtotopico", TABELA_1_NOVIDADES.itImplanteOrtotopico,
      "insuficiência tricúspide importante — refratária ao tratamento clínico, com anatomia favorável");
    push("itImplanteHeterotopico", TABELA_1_NOVIDADES.itImplanteHeterotopico,
      "insuficiência tricúspide importante — refratária ao tratamento clínico, com anatomia favorável");
  }

  return {
    linhas,
    faltam,
    notaObrigatoria: usouQuadro27 ? NOTAS_QUADRO_27.intervencao : undefined,
    fonte: FONTE_BR_2026,
  };
}

/**
 * A coluna ESC desta linha traz condição PRÓPRIA, diferente da brasileira?
 *
 * O Quadro 27 imprime a posição da ESC entre parênteses quando a condição
 * europeia não é a mesma — por exemplo, na queda progressiva de FE a SBC fala
 * em 60% e a ESC, em 55%. Marcar essas linhas é diferente de dizer qual está
 * certa: a tela mostra as duas e aponta onde olhar.
 *
 * "–" é a tabela dizendo que aquela sociedade não trata da situação, o que
 * também merece marca: é a brasileira sozinha.
 */
export function escTemCondicaoPropria(r: RecomendacaoBr): boolean {
  if (!r.esc) return false;
  return r.esc.includes("(") || r.esc.trim() === "–";
}
