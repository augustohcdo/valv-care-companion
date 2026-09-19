/**
 * O motivo que a edge function escreveu, e que o cliente jogava fora.
 *
 * ## O que acontece de verdade num `functions.invoke`
 *
 * Conferido no fonte do `@supabase/functions-js`, não deduzido:
 *
 *     if (!response.ok) { throw new FunctionsHttpError(response); }
 *     ...
 *     catch (error) { return { data: null, error, ... }; }
 *
 * e o `FunctionsHttpError` é construído assim:
 *
 *     super('Edge Function returned a non-2xx status code', 'FunctionsHttpError', context)
 *
 * Quer dizer: **em qualquer resposta não-2xx, `data` vem `null`** e
 * `error.message` é aquela frase, sempre a mesma. O corpo — onde a função
 * escreveu o motivo — só existe dentro de `error.context`, que é um `Response`
 * ainda não lido.
 *
 * ## Por que isso é o defeito desta sessão, de novo
 *
 * As funções desta base escrevem motivos cuidadosos. O `account-close` devolve
 * `{ error: "rpc_failed", detail: "é a única conta de administrador" }`. O
 * `access-decide`, quando a aprovação fica pela metade, devolve a lista do que
 * não persistiu e um `o_que_fazer`:
 *
 *   > "A conta existe e a pessoa já recebeu o e-mail de aprovação. Corrija os
 *   >  itens acima à mão antes que ela tente entrar — sem o papel de médico ela
 *   >  será barrada."
 *
 * Nada disso chegava a ninguém. Os dez chamadores faziam
 * `description: (error as Error)?.message` e mostravam **"Edge Function
 * returned a non-2xx status code"** — e o `EncerrarContaDialog`, que tinha um
 * `data?.detail ?? data?.error` escrito justamente para pegar a recusa de
 * regra, nunca disparava: naquele caminho `data` é `null`.
 *
 * O pior deles é o `AdminAcessos`. Numa aprovação incompleta, o administrador
 * lê "Não foi possível aprovar" — e a conta EXISTE, e o e-mail JÁ SAIU. Ele
 * tende a clicar de novo; a guarda de duplicidade depende do `status` do
 * pedido, que é justamente um dos itens que podem não ter persistido. Segundo
 * e-mail, segundo link de senha.
 *
 * O `TurnstileWidget` já lia o `error.context` — foi o que permitiu dizer
 * "falta a chave do Turnstile" em vez de um erro genérico, quando o login caiu.
 * Esta função é aquilo, generalizado, para os outros dez.
 */

export interface MotivoDaFuncao {
  /** O código curto, quando a função devolveu um (`rpc_failed`, `forbidden`). */
  codigo: string | null;
  /** O texto para mostrar a quem está olhando a tela. Nunca vazio. */
  texto: string;
  /** O corpo inteiro, para quem precisar de um campo próprio da função. */
  corpo: Record<string, unknown> | null;
  /** `true` quando nem chegamos a receber resposta (rede, CORS, função fora). */
  semResposta: boolean;
}

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/**
 * Um campo do corpo, por nome.
 *
 * Existe por causa do `noPropertyAccessFromIndexSignature` do
 * `tsconfig.strict.json`: num `Record<string, unknown>` o acesso por ponto é
 * erro, porque `corpo.detial` compilaria como `undefined` em vez de acusar o
 * erro de digitação. A regra está certa — o corpo vem de fora e ninguém
 * garante o formato — e um acessor resolve sem espalhar colchetes.
 */
const campo = (corpo: Record<string, unknown> | null, nome: string): unknown =>
  corpo ? corpo[nome] : undefined;

/** O corpo JSON de um erro de `invoke`, quando há um. */
async function corpoDoErro(erro: unknown): Promise<Record<string, unknown> | null> {
  const contexto = (erro as { context?: unknown } | null)?.context;
  if (!(contexto instanceof Response)) return null;
  try {
    // `clone()` porque o corpo só pode ser lido uma vez, e quem chamou pode
    // querer lê-lo também.
    const corpo = await contexto.clone().json();
    return corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : null;
  } catch {
    // Corpo não-JSON (uma página de erro do gateway, por exemplo). Não é motivo
    // para esconder o que se sabe: sobra o genérico.
    return null;
  }
}

/**
 * Lê o motivo de uma chamada a edge function, venha ele de onde vier.
 *
 * Cobre os três caminhos, que hoje chegavam misturados a quem lê a tela:
 *
 *   1. resposta não-2xx — o corpo está em `error.context`, e `data` é `null`;
 *   2. resposta 2xx com `{ error }` ou `{ ok: false }` no corpo — recusa de
 *      regra que a função escolheu não mandar como erro de HTTP;
 *   3. nenhuma resposta — rede, CORS, função fora do ar.
 *
 * O `generico` é o que sobra quando a função não disse nada legível. Escreva-o
 * no idioma de quem vai ler, e sobre a ação — "Não foi possível aprovar" —, não
 * sobre a infraestrutura.
 */
export async function motivoDaFuncao(
  erro: unknown,
  data: unknown,
  generico: string,
): Promise<MotivoDaFuncao> {
  const doCorpo = await corpoDoErro(erro);
  const daResposta =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const corpo = doCorpo ?? daResposta;

  // Sem corpo e com erro: ou a resposta não era JSON, ou nem houve resposta.
  const semResposta = !!erro && !doCorpo &&
    !(((erro as { context?: unknown } | null)?.context) instanceof Response);

  const codigo = texto(campo(corpo, "error")) ?? texto(campo(corpo, "status"));

  // A ordem importa: `o_que_fazer` diz a quem lê o que fazer agora, e ganha de
  // um código de erro. `detail` vem depois, `error` por último — ele costuma
  // ser o código curto, que sozinho não explica nada a ninguém.
  const explicacao =
    texto(campo(corpo, "o_que_fazer")) ??
    texto(campo(corpo, "detail")) ??
    texto(campo(corpo, "detalhe")) ??
    texto(campo(corpo, "error"));

  // A lista do que não persistiu entra junto: é ela que diz QUAIS itens ficaram
  // para trás, e sem ela o "corrija os itens acima" não tem "acima".
  const lista = campo(corpo, "nao_persistiu");
  const naoPersistiu = Array.isArray(lista)
    ? lista.filter((x): x is string => typeof x === "string")
    : [];

  const partes = [explicacao ?? generico];
  if (naoPersistiu.length) partes.push(`Não persistiu: ${naoPersistiu.join("; ")}.`);
  if (semResposta) {
    partes.push("Não chegou resposta do servidor — pode ser conexão ou a função fora do ar.");
  }

  return { codigo, texto: partes.join(" "), corpo, semResposta };
}

/**
 * A resposta chegou, mas a função disse que não deu certo?
 *
 * Algumas funções devolvem `ok: false` com HTTP 200 — o `knowledge-ingest` faz
 * isso quando parte dos trechos falhou. `invoke` não marca erro nenhum nesse
 * caso, e quem só olha o `error` anuncia sucesso sobre um trabalho parcial.
 */
export function funcaoRecusou(erro: unknown, data: unknown): boolean {
  if (erro) return true;
  if (!data || typeof data !== "object") return false;
  const corpo = data as Record<string, unknown>;
  if (campo(corpo, "ok") === false) return true;
  return texto(campo(corpo, "error")) !== null;
}
