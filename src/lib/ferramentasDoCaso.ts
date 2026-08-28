import type { EntradaEuroscore, FuncaoVE, ClasseNyha, Sexo } from "@/lib/euroscore2";
import type { PosicaoValvar } from "@/lib/mismatch";

/**
 * A tradução do caso clínico para as entradas das ferramentas.
 *
 * Está numa função pura, fora da tela, porque é exatamente o lugar onde se
 * inventa dado sem querer: um `?? false` aqui transformaria "o caso não
 * registra endocardite" em "o paciente não tem endocardite", e o EuroSCORE II
 * sairia com um número único, aparentemente completo, mais baixo do que se
 * sabe. **Só migra o que o caso realmente afirma.**
 *
 * O que fica de fora, e por quê:
 *
 * - `comorbidities` é lista de texto livre com rótulos do formulário, e nenhum
 *   deles corresponde às definições do EuroSCORE II (que exige, por exemplo,
 *   "diabetes **em uso de insulina**" e não "diabetes"). Casar por aproximação
 *   seria pior que não casar.
 * - `patient_sex` aceita `"O"` — rotulado "Outro / não informado" no formulário.
 *   O rótulo mistura duas coisas, e o modelo só tem duas categorias; a leitura
 *   honesta da mistura é deixar o campo em branco para o médico responder.
 */

export interface CasoParaFerramentas {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_sex: string | null;
  nyha: string | null;
  ejection_fraction: number | null;
  mean_gradient: number | null;
  valve_type: string | null;
  prosthesis_id: string | null;
}

/** As faixas de FEVE do EuroSCORE II: ≥51 boa · 31–50 moderada · 21–30 ruim · ≤20 muito ruim. */
export function funcaoVeDaFe(fe: number | null | undefined): FuncaoVE | undefined {
  if (fe == null) return undefined;
  if (fe >= 51) return "boa";
  if (fe >= 31) return "moderada";
  if (fe >= 21) return "ruim";
  return "muito_ruim";
}

const NYHA_VALIDAS: ClasseNyha[] = ["I", "II", "III", "IV"];

export function euroscoreDoCaso(caso: CasoParaFerramentas | null): Partial<EntradaEuroscore> | undefined {
  if (!caso) return undefined;
  const entrada: Partial<EntradaEuroscore> = {};
  if (caso.patient_age != null) entrada.idade = caso.patient_age;
  if (caso.patient_sex === "M" || caso.patient_sex === "F") entrada.sexo = caso.patient_sex as Sexo;
  if (caso.nyha && NYHA_VALIDAS.includes(caso.nyha as ClasseNyha)) entrada.nyha = caso.nyha as ClasseNyha;
  const ve = funcaoVeDaFe(caso.ejection_fraction);
  if (ve) entrada.funcaoVe = ve;
  return entrada;
}

/** O catálogo só tem próteses aórticas, mitrais e tricúspides; a ferramenta, as duas primeiras. */
export function posicaoDaValva(valvula: string | null | undefined): PosicaoValvar | undefined {
  if (valvula === "aortica" || valvula === "mitral") return valvula;
  return undefined;
}

export function mismatchDoCaso(caso: CasoParaFerramentas | null) {
  if (!caso) return undefined;
  return {
    posicao: posicaoDaValva(caso.valve_type),
    proteseId: caso.prosthesis_id ?? undefined,
    gradienteMedio: caso.mean_gradient,
  };
}
