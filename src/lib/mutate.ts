import { toast } from "sonner";

/**
 * Escreve no banco e só deixa a ação seguir se ela realmente aconteceu.
 *
 * Dez lugares desta base ignoravam o retorno da escrita e emendavam direto no
 * `toast.success` — e, pior, no `logAudit`. Uma falha virava "Exame removido"
 * na tela e uma linha na trilha de auditoria dizendo que o exame foi removido.
 * Numa trilha de conformidade, afirmar o que não aconteceu é pior que omitir:
 * quem for lê-la depois não tem como saber quais linhas são verdade.
 *
 * **Duas formas de falhar, e só uma é `error`.** Testei contra o banco de
 * produção: quando a RLS recusa um UPDATE, o PostgREST responde **200 com
 * `error: null` e zero linhas** — para ele, atualizar nada é sucesso. Conferir
 * só o `error` deixaria passar justamente a causa mais provável: o médico
 * tentando mexer no caso de outro. Por isso o chamador encadeia `.select(...)`
 * e este helper trata lista vazia como falha.
 *
 * Uso:
 *
 * ```ts
 * const ok = await aplicar(
 *   supabase.from("case_exams").update({ deleted_at: agora }).eq("id", id).select("id"),
 *   { sucesso: "Exame removido", falha: "Não foi possível remover o exame" },
 * );
 * if (!ok) return;          // nada de auditoria de algo que não ocorreu
 * logAudit("exam_deleted", "case_exams", id);
 * ```
 */
export type RespostaEscrita = {
  error: { message: string } | null;
  data?: unknown[] | null;
};

/** O que o usuário lê quando a linha existe mas a permissão não alcança. */
const SEM_ALCANCE =
  "Nada foi alterado. Você pode não ter permissão sobre este registro.";

/**
 * O veredito, num lugar só.
 *
 * As duas formas de falhar vivem aqui porque quem as duplica esquece a segunda:
 * a primeira versão desta base conferia `error` em dez lugares e o número de
 * linhas em nenhum.
 */
async function conferir(
  operacao: PromiseLike<RespostaEscrita>,
  falha: string,
): Promise<boolean> {
  const { error, data } = await operacao;

  if (error) {
    // A mensagem crua do Postgres não serve como texto principal — é técnica e
    // muitas vezes em inglês —, mas some por completo é pior: sem ela ninguém
    // consegue distinguir "sem permissão" de "sem internet".
    toast.error(falha, { description: error.message });
    return false;
  }

  // `data` só é undefined quando o chamador não pediu `.select(...)`. Nesse
  // caso não dá para saber quantas linhas mudaram, e o helper não inventa —
  // segue como sucesso, que é o que o `error: null` diz.
  if (Array.isArray(data) && data.length === 0) {
    toast.error(falha, { description: SEM_ALCANCE });
    return false;
  }

  return true;
}

export async function aplicar(
  operacao: PromiseLike<RespostaEscrita>,
  mensagens: { sucesso: string; falha: string },
): Promise<boolean> {
  const ok = await conferir(operacao, mensagens.falha);
  if (ok) toast.success(mensagens.sucesso);
  return ok;
}

/**
 * Igual ao `aplicar`, sem o anúncio de sucesso.
 *
 * Para dois casos em que o toast de sucesso é o ruído, não a informação:
 *
 *  1. **a escrita é um passo, não o fim.** `MedicoPerfil.handleSave` grava em
 *     `profiles` e em `doctors` e dá UMA confirmação no fim, depois de invalidar
 *     o cache. Com `aplicar` nas duas, o médico leria dois toasts para um
 *     clique — e o primeiro apareceria antes de a segunda escrita acontecer.
 *
 *  2. **a escrita é repetitiva.** Marcar "tomei" em cada horário do dia são
 *     três a seis toques diários. Um toast por toque é aviso que se repete sem
 *     informação nova, e esta base já pagou por essa lição no aviso diário por
 *     issue: quem recebe aprende a ignorar.
 *
 * O que NÃO muda é a falha. Antes daqui, os dois casos eram `await` cru sem
 * olhar retorno nenhum — `logTake` não lia nem o `error`. Silêncio no sucesso é
 * escolha de interface; silêncio na falha é a tela afirmando que fez.
 */
export async function aplicarEmSilencio(
  operacao: PromiseLike<RespostaEscrita>,
  mensagens: { falha: string },
): Promise<boolean> {
  return conferir(operacao, mensagens.falha);
}
