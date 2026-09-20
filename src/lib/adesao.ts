/**
 * Adesão ao tratamento: doses tomadas ÷ doses **previstas**.
 *
 * ## O número que existia e significava outra coisa
 *
 * A conta era `tomadas ÷ registradas`. Uma dose que o paciente nunca toca
 * **não cria linha** em `medication_logs` — a tela do paciente só grava ao
 * tocar "tomei" ou "pulei". Quer dizer: um paciente com noventa doses
 * previstas no mês, que abriu o aplicativo duas vezes e tocou "tomei" nas
 * duas, aparecia para o cardiologista como **"Aderência (30d): 100%"**.
 *
 * O número não era inventado: era taxa de concordância entre as doses que ele
 * registrou. Só que o rótulo dizia adesão, e em valvopatia com anticoagulação
 * adesão é decisão clínica.
 *
 * ## O denominador vem da prescrição
 *
 * `medications` tem `times` (os horários de cada dia), `start_date` e
 * `end_date`. Para cada medicamento, as doses previstas na janela são os dias
 * em que ele esteve vigente × quantos horários tem por dia.
 *
 * ## O que esta função NÃO finge saber
 *
 * Uma prescrição sem horário (`times` vazio, que o esquema permite) não
 * permite prever dose nenhuma. Ela **não entra no denominador** e é contada à
 * parte, em `semHorario`, para quem exibe poder dizer que ficou de fora. Teto
 * que ninguém escreve é teto que ninguém vê chegar — e esta base já pagou por
 * isso na varredura de alerta que cobria 42% dizendo estar conferida.
 */

export interface PrescricaoParaAdesao {
  times: string[] | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface RegistroDeDose {
  status: string;
}

export interface Adesao {
  /** `null` quando não há dose previsível — diferente de 0%. */
  percentual: number | null;
  tomadas: number;
  previstas: number;
  /** Prescrições sem horário definido, fora do denominador. */
  semHorario: number;
}

const MS_POR_DIA = 86_400_000;

/** Meia-noite local de uma data `yyyy-MM-dd`. */
const dia = (iso: string) => new Date(`${iso}T00:00:00`);

/**
 * Doses previstas numa janela fechada `[deISO, ateISO]`, ambas inclusivas.
 */
export function dosesPrevistas(
  prescricoes: PrescricaoParaAdesao[],
  deISO: string,
  ateISO: string,
): { previstas: number; semHorario: number } {
  const inicio = dia(deISO);
  const fim = dia(ateISO);
  let previstas = 0;
  let semHorario = 0;

  for (const p of prescricoes) {
    const horarios = Array.isArray(p.times) ? p.times.length : 0;
    if (horarios === 0) {
      semHorario++;
      continue;
    }
    // A vigência do medicamento cortada pela janela. Sem `start_date`, assume-se
    // que já valia; sem `end_date`, que ainda vale.
    const comeca = p.start_date ? dia(p.start_date) : inicio;
    const termina = p.end_date ? dia(p.end_date) : fim;
    const de = comeca > inicio ? comeca : inicio;
    const ate = termina < fim ? termina : fim;
    if (ate < de) continue; // a vigência não cruza a janela
    const dias = Math.floor((ate.getTime() - de.getTime()) / MS_POR_DIA) + 1;
    previstas += dias * horarios;
  }
  return { previstas, semHorario };
}

/**
 * A adesão da janela.
 *
 * `percentual` é `null` quando não há dose previsível no período — que é
 * diferente de 0% ("não tomou nenhuma") e diferente de 100% ("tomou todas").
 * Quem exibe precisa dos três casos separados.
 *
 * O teto de 100% existe porque o paciente pode registrar a mesma dose por
 * caminhos diferentes, ou a prescrição pode ter mudado no meio da janela: um
 * "112% de adesão" na tela de um médico destrói a confiança no resto dos
 * números mais do que informa.
 */
export function calcularAdesao(
  registros: RegistroDeDose[],
  prescricoes: PrescricaoParaAdesao[],
  deISO: string,
  ateISO: string,
): Adesao {
  const tomadas = registros.filter((l) => l.status === "tomado").length;
  const { previstas, semHorario } = dosesPrevistas(prescricoes, deISO, ateISO);
  return {
    percentual: previstas > 0 ? Math.min(100, (tomadas / previstas) * 100) : null,
    tomadas,
    previstas,
    semHorario,
  };
}

/**
 * A frase que acompanha o número, com a conta à vista.
 *
 * Percentual sem denominador não é auditável: quem lê não tem como saber se
 * "100%" são duas doses de duas ou noventa de noventa.
 */
export function explicarAdesao(a: Adesao): string {
  if (a.percentual === null) {
    return a.semHorario
      ? `Sem dose previsível no período — ${a.semHorario} prescrição(ões) sem horário definido.`
      : "Nenhuma medicação prescrita no período.";
  }
  const base = `${a.tomadas} de ${a.previstas} doses previstas`;
  return a.semHorario
    ? `${base} · ${a.semHorario} prescrição(ões) sem horário ficam fora da conta.`
    : `${base}.`;
}
