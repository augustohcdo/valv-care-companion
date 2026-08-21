/**
 * A identificação que vem escrita no laudo — transcrita, conferida, nunca
 * inferida.
 *
 * O laudo que o médico anexa já traz, impressos, o nome do paciente, a data de
 * nascimento e o sexo. Redigitar isso é trabalho repetido e é onde entra erro
 * de digitação. Mas é também o dado mais sensível do prontuário, então a
 * leitura automática só se sustenta com três coisas:
 *
 * 1. **Transcrição, não dedução.** O que não estiver escrito volta nulo. Um
 *    nome "deduzido" de um cabeçalho é invenção com cara de identificação.
 * 2. **O médico confere antes.** Nada entra no formulário sozinho: os valores
 *    aparecem com a origem, e ele marca o que aceita.
 * 3. **O erro mais provável é nomeado.** Um laudo imprime o nome do paciente e
 *    o do médico solicitante lado a lado. Confundir os dois trocaria a
 *    identificação do prontuário inteiro — então o que parecer nome de médico
 *    é marcado como suspeito, e vem desmarcado.
 */

export interface IdentificacaoDoLaudo {
  patient_name?: string | null;
  patient_age?: number | null;
  patient_sex?: string | null;
  patient_birth_date?: string | null;
  exam_date?: string | null;
}

export interface CampoIdentificado {
  key: "patient_name" | "patient_age" | "patient_sex";
  label: string;
  valor: string;
  /** Como se chegou ao valor, quando não foi transcrição direta. */
  derivacao: string | null;
  /** Motivo da desconfiança. Preenchido = vem desmarcado. */
  suspeita: string | null;
}

const SEXO_ROTULO: Record<string, string> = {
  F: "Feminino", M: "Masculino", O: "Outro / não informado",
};

/**
 * O que o laudo escreveu sobre o sexo → o que o banco aceita.
 *
 * Devolve `null` para qualquer coisa fora do esperado, em vez de chutar: um
 * campo de sexo errado no prontuário é pior que um campo vazio.
 */
export function normalizarSexo(bruto: string | null | undefined): "F" | "M" | null {
  const t = (bruto ?? "").trim().toLowerCase();
  if (!t) return null;
  if (["f", "fem", "feminino", "female", "mulher"].includes(t)) return "F";
  if (["m", "masc", "masculino", "male", "homem"].includes(t)) return "M";
  return null;
}

/** Data no formato do banco (AAAA-MM-DD)? */
function dataValida(iso: string | null | undefined): string | null {
  const t = (iso ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(t + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : t;
}

/**
 * Idade em anos completos entre duas datas.
 *
 * Existe porque muitos laudos imprimem a data de nascimento e não a idade.
 * Calcular é aritmética verificável — diferente de deduzir —, e a tela mostra
 * de onde saiu, para o médico conferir a conta e não só o resultado.
 */
export function idadeEm(nascimento: string, referencia: string): number | null {
  const n = dataValida(nascimento);
  const r = dataValida(referencia);
  if (!n || !r) return null;
  const dn = new Date(n + "T00:00:00");
  const dr = new Date(r + "T00:00:00");
  if (dr < dn) return null;
  let anos = dr.getFullYear() - dn.getFullYear();
  const mes = dr.getMonth() - dn.getMonth();
  if (mes < 0 || (mes === 0 && dr.getDate() < dn.getDate())) anos--;
  return anos >= 0 && anos <= 120 ? anos : null;
}

/**
 * O nome lido parece ser de médico, e não do paciente?
 *
 * É o erro que mais custa caro nesta leitura: o laudo imprime "Paciente:
 * Fulano" e "Médico solicitante: Dr. Beltrano" a poucas linhas de distância, e
 * trocar os dois renomearia o prontuário inteiro. Também compara com o nome de
 * quem está usando o sistema — laudo emitido pelo próprio médico é comum.
 */
export function pareceNomeDeMedico(nome: string, nomeDoMedico?: string | null): string | null {
  const t = nome.trim();
  if (/^(dr|dra|drª|doutor|doutora)\b\.?/i.test(t)) {
    return "começa com tratamento de médico — o laudo também imprime o nome de quem solicitou";
  }
  if (/\bCRM\b/i.test(t)) return "contém CRM — é identificação de médico, não de paciente";
  const meu = (nomeDoMedico ?? "").trim().toLowerCase();
  if (meu && t.toLowerCase() === meu) {
    return "é o seu próprio nome — provavelmente o médico do laudo, não o paciente";
  }
  return null;
}

/**
 * Monta os campos de identificação para conferência, já com a suspeita quando
 * houver. Campo ausente no laudo simplesmente não aparece.
 */
export function camposDoLaudo(
  ident: IdentificacaoDoLaudo,
  opcoes: { nomeDoMedico?: string | null } = {},
): CampoIdentificado[] {
  const saida: CampoIdentificado[] = [];

  const nome = ident.patient_name?.trim();
  if (nome) {
    saida.push({
      key: "patient_name", label: "Nome / identificação", valor: nome,
      derivacao: null, suspeita: pareceNomeDeMedico(nome, opcoes.nomeDoMedico),
    });
  }

  // Idade escrita vence a calculada: transcrição é sempre mais forte que conta.
  const escrita = typeof ident.patient_age === "number" && Number.isFinite(ident.patient_age)
    ? ident.patient_age : null;
  const nascimento = dataValida(ident.patient_birth_date);
  const referencia = dataValida(ident.exam_date);
  const calculada = nascimento && referencia ? idadeEm(nascimento, referencia) : null;
  const idade = escrita ?? calculada;

  if (idade != null && idade >= 0 && idade <= 120) {
    const divergem = escrita != null && calculada != null && escrita !== calculada;
    saida.push({
      key: "patient_age", label: "Idade", valor: `${idade} anos`,
      derivacao: escrita == null && nascimento
        ? `calculada a partir do nascimento em ${nascimento} e da data do exame`
        : null,
      suspeita: divergem
        ? `o laudo escreve ${escrita} anos, mas a data de nascimento dá ${calculada}`
        : null,
    });
  }

  const sexo = normalizarSexo(ident.patient_sex);
  if (sexo) {
    saida.push({
      key: "patient_sex", label: "Sexo", valor: SEXO_ROTULO[sexo],
      derivacao: null, suspeita: null,
    });
  }

  return saida;
}

/** O valor que vai para o formulário, por campo. */
export function paraFormulario(campo: CampoIdentificado, ident: IdentificacaoDoLaudo): string {
  if (campo.key === "patient_sex") return normalizarSexo(ident.patient_sex) ?? "";
  if (campo.key === "patient_age") return campo.valor.replace(/\D/g, "");
  return campo.valor;
}
