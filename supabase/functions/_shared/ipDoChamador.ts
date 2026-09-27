/**
 * De onde vem o IP de quem chamou — e por que isso mora num lugar só.
 *
 * ## O que havia
 *
 * Três funções leem o IP do chamador. Uma fazia certo:
 *
 *     access-request  →  req.headers.get("cf-connecting-ip")
 *
 * E as duas que servem dado clínico a hospital faziam:
 *
 *     fhir-read / fhir-ingest
 *       →  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
 *
 * `X-Forwarded-For` é uma LISTA que cada intermediário acrescenta ao FIM. A
 * entrada da esquerda é a que o cliente pode escrever antes de o primeiro proxy
 * anexar o endereço real — quer dizer, `split(",")[0]` deixa quem chama escolher
 * o próprio IP. `cf-connecting-ip` é posto pela borda e não vem do cliente.
 *
 * E o IP não é só registro nestas duas funções: ele é **portão**
 * (`ip_allowlist` da chave de API do hospital) e **campo de trilha**
 * (`integration_audit_log` e `requester_ip`, que dizem de onde o prontuário de
 * um paciente foi lido). Origem escolhida por quem chama, nos dois papéis.
 *
 * ## E o portão abria quando não sabia
 *
 *     if (keyRow.ip_allowlist?.length && ip && !keyRow.ip_allowlist.includes(ip))
 *
 * O `&& ip &&` no meio: sem IP determinável, a lista de permissão era pulada. É
 * "não sei" tratado como "autorizado", na mesma casa que trata 2 como NÃO
 * CONFERIDO em todo script.
 *
 * ## A regra
 *
 * `cf-connecting-ip` primeiro. Faltando ele, a ÚLTIMA entrada do
 * `X-Forwarded-For` — a que o intermediário mais próximo anexou, e não a que o
 * cliente mandou. Faltando as duas, `null`, e quem tem lista de permissão
 * RECUSA em vez de deixar passar.
 */

/** O IP de quem chamou, ou `null` quando não há como saber. */
export function ipDoChamador(req: { headers: { get(nome: string): string | null } }): string | null {
  const daBorda = req.headers.get("cf-connecting-ip")?.trim();
  if (daBorda) return daBorda;

  // A última entrada, não a primeira: quem acrescenta é o intermediário, então
  // o fim da lista é o trecho que o cliente não escreveu.
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) {
    const partes = encaminhado.split(",").map((p) => p.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  return null;
}

/**
 * A chave pode ser usada deste IP?
 *
 * Três estados, e o do meio é o que faltava:
 *
 *   · sem lista de permissão configurada → pode, de qualquer lugar;
 *   · com lista e SEM IP determinável    → NÃO pode. "Não sei de onde veio" não
 *     é "veio de onde eu permito" — e quem configurou uma lista pediu
 *     explicitamente para restringir por origem;
 *   · com lista e com IP                 → pode se estiver na lista.
 */
export function ipPermitido(
  lista: readonly string[] | null | undefined,
  ip: string | null,
): { ok: true } | { ok: false; motivo: "fora_da_lista" | "ip_indeterminado" } {
  if (!lista || lista.length === 0) return { ok: true };
  if (!ip) return { ok: false, motivo: "ip_indeterminado" };
  return lista.includes(ip) ? { ok: true } : { ok: false, motivo: "fora_da_lista" };
}
