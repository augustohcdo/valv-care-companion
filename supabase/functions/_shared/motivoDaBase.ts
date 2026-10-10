/**
 * Por que a resposta clínica saiu SEM trecho da base ValvePath.
 *
 * ## O defeito que isto conserta
 *
 * A `clinical-ai` devolvia um booleano, `rag_hit: sourcesOut.length > 0`, e a
 * tela transformava o `false` neste aviso vermelho:
 *
 *   > "**Sem trecho ancorado.** A base ValvePath **não retornou referência para
 *   >  este tópico**. A resposta abaixo é conhecimento geral do modelo."
 *
 * Quatro caminhos chegam a esse `false`, e dois deles tornam a frase falsa:
 *
 *   · a base foi consultada e não tinha nada para o tópico — a frase está certa;
 *   · **a geração do embedding falhou** (429 de cota, 5xx, rede): `embedQuery`
 *     devolve `null`, o `if` interno nem roda e a base **nunca foi consultada**;
 *   · **falta `SUPABASE_SERVICE_ROLE_KEY`**: o bloco inteiro é pulado, e a base
 *     também nunca foi consultada;
 *   · o modo é a orientação de alta ao paciente, que não usa a base de
 *     propósito.
 *
 * Nos dois do meio, o médico lê uma afirmação sobre o CONTEÚDO da base — "não
 * existe recomendação sobre isto aqui" — quando o fato é "não deu para olhar".
 * São conclusões diferentes: a primeira convida a cadastrar a diretriz que
 * falta, ou a concluir que as diretrizes são silentes; a segunda pede repetir a
 * consulta em cinco minutos.
 *
 * E havia a assimetria pior: no caminho benigno a função injetava no prompt um
 * aviso mandando o modelo abrir a resposta com o disclaimer. Nos dois caminhos
 * em que a base não foi consultada, o modelo recebia **nada** — respondia de
 * conhecimento geral sem uma palavra a respeito. A falha mais grave era a
 * silenciosa.
 *
 * ## O padrão já existia, quatro linhas abaixo
 *
 * A camada EXTERNA de literatura resolveu exatamente isto, e o comentário dela
 * está no mesmo arquivo:
 *
 *   > "'desligada' e 'não encontrei nada' são estados diferentes, e confundi-los
 *   >  é o `ok: true, sent: 0` do digest, que escondeu por semanas que ninguém
 *   >  recebia o resumo."
 *
 * `MotivoSemLiteratura` tem cinco estados, incluindo um explícito para "não se
 * sabe". A camada PRIMÁRIA — a das diretrizes, a que sustenta a recomendação —
 * tinha um booleano.
 */

/**
 * Os quatro estados. Separar "não achei" de "não consultei" é a razão de o tipo
 * existir; o resto é consequência.
 */
export type MotivoSemTrecho =
  /** A base foi consultada e não tinha trecho para o tópico. */
  | "sem_resultado"
  /**
   * Não deu para gerar o vetor da pergunta, então a base NÃO foi consultada.
   *
   * Cota do provedor de embedding estourada, 5xx, rede. É o caminho que
   * `embedQuery` sinaliza devolvendo `null` — e era o que chegava à tela
   * disfarçado de "a base não tem isto".
   */
  | "consulta_falhou"
  /**
   * Falta `SUPABASE_SERVICE_ROLE_KEY` no ambiente da função: a base NÃO foi
   * consultada. É defeito de configuração, não de conteúdo, e some de vista se
   * for contado como "não achei".
   */
  | "sem_credencial"
  /**
   * O modo não usa a base de propósito — a orientação de alta ao paciente.
   *
   * Trecho de diretriz e regra de citação são material do médico, e é deles que
   * vinha "[Fonte: SBC 2024 (aguardando revisão médica)]" no papel que o
   * paciente leva para casa.
   */
  | "nao_pedida";

/**
 * O motivo, a partir do que de fato aconteceu. `null` quando houve trecho.
 *
 * Função pura, e é o ponto: o bloco de RAG da `clinical-ai` depende de rede, de
 * credencial e de um RPC com vetor de 768 posições — nada disso se exercita num
 * teste. A decisão sai dele.
 */
export function motivoSemTrecho({
  pedeBase, temCredencial, temEmbedding, achou,
}: {
  pedeBase: boolean;
  temCredencial: boolean;
  temEmbedding: boolean;
  achou: boolean;
}): MotivoSemTrecho | null {
  // A ordem é a dos fatos, do mais externo para o mais interno: quem não pediu
  // não consultou; quem não tem credencial não consultou; quem não tem vetor
  // não consultou. Só depois de passar pelos três é que "não achei" quer dizer
  // alguma coisa sobre a base.
  if (!pedeBase) return "nao_pedida";
  if (!temCredencial) return "sem_credencial";
  if (!temEmbedding) return "consulta_falhou";
  return achou ? null : "sem_resultado";
}

/**
 * O que o MODELO recebe no prompt, por motivo.
 *
 * `null` quer dizer "não diga nada ao modelo", e só o modo do paciente tem esse
 * valor: a orientação de alta não cita fonte nenhuma, e um aviso sobre base de
 * diretriz no prompt dela é justamente o material que não pode vazar para o
 * papel do paciente.
 *
 * Os outros três avisam, e avisam COISAS DIFERENTES. Mandar o modelo escrever
 * "não encontrei na base" quando a base não foi consultada é fazê-lo afirmar,
 * no corpo do texto clínico, algo que ninguém verificou.
 */
export const AVISO_AO_MODELO: Record<MotivoSemTrecho, string | null> = {
  nao_pedida: null,

  sem_resultado:
    "\n\n⚠️ AVISO PARA VOCÊ (assistente): Nenhum trecho relevante foi encontrado na base " +
    "ValvePath para esta consulta. INICIE sua resposta com o disclaimer: \"⚠️ Não encontrei " +
    "essa recomendação na base carregada da ValvePath. A resposta abaixo baseia-se no " +
    "conhecimento geral do modelo e deve ser verificada em fonte primária antes de qualquer " +
    "decisão.\"",

  consulta_falhou:
    "\n\n⚠️ AVISO PARA VOCÊ (assistente): A base ValvePath NÃO PÔDE SER CONSULTADA nesta " +
    "resposta — a busca por similaridade não chegou a ser feita. Não afirme que a " +
    "recomendação não existe na base: isso não foi verificado. INICIE sua resposta com o " +
    "disclaimer: \"⚠️ Não foi possível consultar a base de diretrizes da ValvePath agora. A " +
    "resposta abaixo baseia-se apenas no conhecimento geral do modelo, não foi comparada com " +
    "a base, e deve ser verificada em fonte primária antes de qualquer decisão.\"",

  sem_credencial:
    "\n\n⚠️ AVISO PARA VOCÊ (assistente): A base ValvePath NÃO PÔDE SER CONSULTADA nesta " +
    "resposta, por falta de configuração do servidor. Não afirme que a recomendação não " +
    "existe na base. INICIE sua resposta com o disclaimer: \"⚠️ A base de diretrizes da " +
    "ValvePath não está acessível nesta instalação. A resposta abaixo baseia-se apenas no " +
    "conhecimento geral do modelo e deve ser verificada em fonte primária antes de qualquer " +
    "decisão.\"",
};

/** Os motivos em que a base NÃO foi consultada — e a frase não pode falar do conteúdo dela. */
export const NAO_CONSULTOU: readonly MotivoSemTrecho[] = [
  "consulta_falhou", "sem_credencial", "nao_pedida",
];
