/**
 * As medidas do caso, num lugar só.
 *
 * Elas aparecem em três telas — no cadastro, na exibição do caso e agora na
 * edição — e o rótulo, a unidade e a faixa precisam ser os mesmos nas três.
 * Descrições duplicadas divergem: foi assim que a lista de tabelas do backup
 * ficou quinze tabelas atrasada.
 *
 * **As faixas são as mesmas dos `CHECK` do banco**, copiadas de
 * `pg_constraint` (`clinical_cases_*_range`). A validação daqui existe para a
 * recusa chegar ao médico com mensagem legível em vez de erro cru do Postgres —
 * quem de fato barra continua sendo o banco. Se as duas divergirem, o servidor
 * vence, e é isso que se quer.
 */

export interface CampoMedida {
  key: string;
  label: string;
  unidade: string;
  min: number;
  max: number;
  /** Casas decimais aceitas. Idade é inteira; área valvar tem duas. */
  decimais: number;
  /** Campo correspondente em `case_exams`, quando existe. */
  doExame?: string;
}

export const MEDIDAS: CampoMedida[] = [
  { key: "patient_age", label: "Idade", unidade: "anos", min: 0, max: 120, decimais: 0 },
  {
    key: "ejection_fraction", label: "Fração de ejeção", unidade: "%",
    min: 0, max: 100, decimais: 0, doExame: "ejection_fraction",
  },
  {
    key: "mean_gradient", label: "Gradiente médio", unidade: "mmHg",
    min: 0, max: 200, decimais: 1, doExame: "mean_gradient",
  },
  {
    key: "peak_gradient", label: "Gradiente máximo", unidade: "mmHg",
    min: 0, max: 250, decimais: 1, doExame: "peak_gradient",
  },
  {
    key: "valve_area", label: "Área valvar", unidade: "cm²",
    min: 0, max: 10, decimais: 2, doExame: "valve_area",
  },
];

/** Os campos que o botão "preencher com o exame" consegue trazer. */
export const MEDIDAS_DO_EXAME = MEDIDAS.filter((m) => m.doExame);

/**
 * Valida um valor digitado. Devolve `null` quando está bom.
 *
 * Vazio é válido: medida ausente é informação legítima — e a rodada do score de
 * risco existiu justamente para o sistema parar de tratar ausência como zero.
 */
export function validarMedida(campo: CampoMedida, texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;

  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return `${campo.label}: use apenas números`;
  if (n < campo.min || n > campo.max) {
    return `${campo.label}: o valor precisa estar entre ${campo.min} e ${campo.max} ${campo.unidade}`;
  }
  return null;
}

/** Texto do formulário → o que vai para o banco. Vazio vira `null`, não zero. */
export function paraBanco(campo: CampoMedida, texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  // `toFixed` seria o caminho óbvio e erra: `(0.825).toFixed(2)` devolve "0.82",
  // porque em binário 0,825 é 0,8249…. Numa área valvar isso é a diferença
  // entre dois valores que o médico digitou e o que ficou gravado. Multiplicar,
  // arredondar e dividir não depende dessa representação.
  const fator = 10 ** campo.decimais;
  return Math.round(n * fator) / fator;
}

/** As medidas de um exame que interessam ao caso. `case_exams` tem mais. */
export interface ExameMedidas {
  ejection_fraction?: number | null;
  mean_gradient?: number | null;
  peak_gradient?: number | null;
  valve_area?: number | null;
  regurgitation_grade?: string | null;
}

/**
 * O que o exame consegue trazer para o formulário do caso, já como texto.
 *
 * `case_exams` guarda exatamente as medidas que o caso exibe, e até aqui as
 * duas conviviam sem se falarem: o médico digitava o mesmo número duas vezes.
 * Quem decide continua sendo ele — isto só monta o preenchimento; nada é
 * gravado sem o botão de salvar.
 */
export function doExameParaFormulario(exame: ExameMedidas): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const campo of MEDIDAS_DO_EXAME) {
    const v = exame[campo.doExame as keyof ExameMedidas];
    // `typeof v === "number"` e não `v ?? `: FE zero não existe, mas gradiente
    // zero existe, e um teste de veracidade descartaria justamente esse.
    if (typeof v === "number" && Number.isFinite(v)) saida[campo.key] = String(v);
  }
  const grau = exame.regurgitation_grade?.trim();
  if (grau) saida["regurgitation_grade"] = grau;
  return saida;
}

/**
 * As medidas que o exame tem e o caso **ainda não** — o que vale oferecer para
 * levar adiante quando um exame novo é salvo.
 *
 * Campo já preenchido no caso não entra: sobrescrever em silêncio o que o
 * médico digitou seria o oposto do que esta rodada existe para fazer.
 */
export function medidasFaltantesNoCaso(
  caso: Record<string, unknown>,
  exame: ExameMedidas,
): Record<string, number | string> {
  const doExame = doExameParaFormulario(exame);
  const saida: Record<string, number | string> = {};
  for (const [chave, texto] of Object.entries(doExame)) {
    if (caso[chave] != null && caso[chave] !== "") continue;
    saida[chave] = chave === "regurgitation_grade" ? texto : Number(texto);
  }
  return saida;
}

/** O grau de regurgitação é texto e não tem faixa — mas tem rótulo e origem. */
const CAMPO_REGURGITACAO = {
  key: "regurgitation_grade", label: "Regurgitação", unidade: "",
} as const;

export interface LacunaDoExame {
  key: string;
  label: string;
  unidade: string;
  valor: number | string;
  /**
   * Motivo pelo qual o valor é **suspeito**. Passa no `CHECK` do banco e quase
   * certamente é erro de digitação — por isso vem desmarcado na tela, com o
   * motivo à vista, em vez de entrar junto com os demais.
   */
  suspeita: string | null;
}

export interface DivergenciaDoExame {
  key: string;
  label: string;
  unidade: string;
  noCaso: number | string;
  noExame: number | string;
}

export interface ComparacaoComExame {
  /** Campo vazio no caso que o exame preenche. */
  lacunas: LacunaDoExame[];
  /** Os dois lados têm valor e eles diferem. Nunca sobrescrito sozinho. */
  divergencias: DivergenciaDoExame[];
  /** Fora da faixa do `CHECK`: nem chega a ser oferecido. */
  recusados: { label: string; valor: number; motivo: string }[];
}

/**
 * O valor é fisiologicamente plausível para este campo?
 *
 * Não é a mesma pergunta que "cabe na faixa do banco". O `CHECK` de FE aceita
 * qualquer coisa de 0 a 100, então **0,45 passa** — e 0,45 é a fração escrita
 * onde se esperava a porcentagem, um erro de digitação que entraria no
 * prontuário com cara de medida. Estas regras não bloqueiam: elas marcam, para
 * o médico decidir olhando.
 */
export function suspeitaDeErro(
  key: string, valor: number, exame: ExameMedidas,
): string | null {
  if (key === "ejection_fraction" && valor > 0 && valor < 1) {
    return "menor que 1: parece a fração (0,45) escrita onde se espera a porcentagem (45)";
  }
  if (key === "valve_area" && valor > 6) {
    return "acima de 6 cm²: fora do que se mede em doença valvar";
  }
  // Gradiente médio nunca é maior que o máximo. Marca os dois, porque daqui não
  // dá para saber qual dos dois foi digitado errado.
  const { mean_gradient: medio, peak_gradient: maximo } = exame;
  if (
    (key === "mean_gradient" || key === "peak_gradient") &&
    typeof medio === "number" && typeof maximo === "number" && medio > maximo
  ) {
    return `gradiente médio (${medio}) maior que o máximo (${maximo}) — impossível`;
  }
  return null;
}

/**
 * Compara os achados do caso com um exame, campo a campo.
 *
 * Três respostas, e a separação entre elas é o ponto: **lacuna** é campo vazio
 * que o exame preenche, e é o que o botão preenche; **divergência** é campo com
 * valor nos dois lados e valores diferentes, que aparece e nunca é trocado
 * sozinho — o valor do caso pode ter sido posto de propósito; **recusado** é o
 * que o banco não aceitaria, e por isso não é sequer oferecido.
 */
export function compararComExame(
  caso: Record<string, unknown>,
  exame: ExameMedidas,
): ComparacaoComExame {
  const saida: ComparacaoComExame = { lacunas: [], divergencias: [], recusados: [] };

  for (const campo of MEDIDAS_DO_EXAME) {
    const bruto = exame[campo.doExame as keyof ExameMedidas];
    // `typeof === "number"` e não veracidade: gradiente médio 0 existe em
    // prótese funcionante, e um teste de veracidade descartaria justamente ele.
    if (typeof bruto !== "number" || !Number.isFinite(bruto)) continue;

    const recusa = validarMedida(campo, String(bruto));
    if (recusa) {
      saida.recusados.push({ label: campo.label, valor: bruto, motivo: recusa });
      continue;
    }

    const noCaso = caso[campo.key];
    if (noCaso == null || noCaso === "") {
      saida.lacunas.push({
        key: campo.key, label: campo.label, unidade: campo.unidade,
        valor: bruto, suspeita: suspeitaDeErro(campo.key, bruto, exame),
      });
    } else if (Number(noCaso) !== bruto) {
      saida.divergencias.push({
        key: campo.key, label: campo.label, unidade: campo.unidade,
        noCaso: Number(noCaso), noExame: bruto,
      });
    }
  }

  const grau = exame.regurgitation_grade?.trim();
  if (grau) {
    const noCaso = caso[CAMPO_REGURGITACAO.key];
    const atual = typeof noCaso === "string" ? noCaso.trim() : "";
    if (!atual) {
      saida.lacunas.push({ ...CAMPO_REGURGITACAO, valor: grau, suspeita: null });
    } else if (atual !== grau) {
      saida.divergencias.push({ ...CAMPO_REGURGITACAO, noCaso: atual, noExame: grau });
    }
  }

  return saida;
}

/**
 * O que mudou entre o que estava gravado e o que o médico digitou.
 *
 * A trilha de um prontuário precisa dizer **o que** mudou, não só que "o caso
 * foi atualizado" — sem isso, quem lê a auditoria depois não consegue
 * reconstruir nada.
 */
export function diferencas(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): Record<string, { de: unknown; para: unknown }> {
  const saida: Record<string, { de: unknown; para: unknown }> = {};
  for (const chave of Object.keys(depois)) {
    const a = antes[chave] ?? null;
    const b = depois[chave] ?? null;
    // Lista (sintomas, comorbidades) compara por conteúdo, não por referência.
    const iguais = Array.isArray(a) || Array.isArray(b)
      ? JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
      : String(a) === String(b);
    if (!iguais) saida[chave] = { de: a, para: b };
  }
  return saida;
}
