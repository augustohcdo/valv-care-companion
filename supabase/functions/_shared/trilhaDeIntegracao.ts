import { logError } from "./logError.ts";

/**
 * A trilha de integração — e a garantia de que um buraco nela não passa calado.
 *
 * ## O que foi medido
 *
 * `log_integration_event` é chamada SETE vezes nas edge functions:
 * `fhir-ingest` (3), `fhir-read` (3) e `hospital-api-key-create` (1). Nenhuma
 * das sete recebia o resultado — zero de sete. O cliente do Supabase devolve
 * `{ error }` em vez de lançar, então um `await` cru engole qualquer recusa: o
 * evento simplesmente não entrava, a requisição respondia 200, e nada dizia.
 *
 * ## Por que isto importa mais do que uma linha de log
 *
 * Esta é a trilha que registra qual hospital leu ou gravou dados de qual
 * paciente. O comentário em `fhir-ingest`, três linhas acima de uma das
 * chamadas, diz o que está em jogo:
 *
 *   > "A trilha passaria a dizer que não havia consentimento numa noite em que
 *   >  havia, e é dela que sai a prova em auditoria de LGPD."
 *
 * O autor estava pensando exatamente na veracidade da trilha. O que faltava era
 * conferir a escrita que a produz. Uma trilha incompleta faz quem a lê procurar
 * em outro lugar; uma trilha com buraco silencioso faz quem a lê concluir que o
 * acesso não houve.
 *
 * `integration_audit_log` está, de propósito, fora de toda lista de expurgo
 * desta base — é tratada como prova. Prova que pode perder linhas sem avisar
 * não é prova.
 *
 * ## Por que NÃO derruba a requisição
 *
 * Nos caminhos de sucesso, o dado já foi gravado quando a trilha é escrita.
 * Responder 500 faria o hospital reenviar e duplicar o recurso — trocaria um
 * buraco na trilha por dado duplicado no prontuário. É o mesmo raciocínio que
 * `src/lib/auditLog.ts` já registrou:
 *
 *   > "Continua sem lançar: a ação registrada já aconteceu, e travá-la depois
 *   >  do fato é impossível — o que dá para fazer é garantir que alguém saiba
 *   >  que o registro não entrou."
 *
 * Então o canal é o `logError`, que alimenta `client_errors` → painel de admin
 * → resumo semanal por e-mail. E o `console.error` fica como rede de baixo,
 * para o caso de o próprio `logError` não gravar — ele agora devolve se gravou.
 */

export interface EventoDeIntegracao {
  _hospital_id: string;
  _patient_id: string | null;
  _actor: string | null;
  _api_key: string | null;
  _action: string;
  _resource_type: string | null;
  _resource_id: string | null;
  _success: boolean;
  _error: string | null;
  _ip: string | null;
  _ua: string | null;
  _meta: Record<string, unknown> | null;
}

/**
 * Grava um evento na trilha de integração. Devolve se gravou.
 *
 * Nunca lança, pelo motivo acima. Mas nunca cala: a falha vai para o
 * `logError` e para o log da função.
 */
export async function registrarEventoDeIntegracao(
  // deno-lint-ignore no-explicit-any -- o cliente do supabase-js não exporta
  // o tipo do retorno de `createClient` de um jeito utilizável aqui, e tipar
  // isto como `any` é preferível a inventar uma interface que vai divergir.
  admin: any,
  campos: EventoDeIntegracao,
): Promise<boolean> {
  const { error } = await admin.rpc("log_integration_event", campos);
  if (!error) return true;

  const descricao =
    `trilha de integração NÃO gravou o evento "${campos._action}" ` +
    `(hospital ${campos._hospital_id}, recurso ${campos._resource_type ?? "—"}): ` +
    error.message;

  // O grito, nos dois canais. O `logError` é o que alguém vê sem abrir log de
  // função; o `console.error` é o que sobra se o próprio `logError` falhar.
  console.error(descricao);
  await logError({
    source: "edge_function",
    context: `trilha-de-integracao:${campos._action}`,
    message: descricao,
    metadata: {
      hospital_id: campos._hospital_id,
      // O `patient_id` fica FORA: esta mensagem vai para `client_errors`, que o
      // painel de admin mostra, e o paciente não precisa ser identificado para
      // alguém consertar a trilha. O `hospital_id` basta para localizar.
      action: campos._action,
      resource_type: campos._resource_type,
      success_pretendido: campos._success,
    },
  });
  return false;
}
