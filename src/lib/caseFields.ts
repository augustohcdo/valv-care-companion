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
