import { supabase } from "@/integrations/supabase/client";
import { reportError } from "@/lib/reportError";
import { toast } from "sonner";

/**
 * As remoções no bucket, com o resultado olhado.
 *
 * ## Por que isto virou helper
 *
 * Seis lugares faziam `await supabase.storage.from(B).remove([p]);` e seguiam
 * em frente. O `remove` devolve `{ data, error }` — não lança —, então a falha
 * sumia. Nos casos piores a linha seguinte era um `logAudit("…_removed")`: a
 * trilha de auditoria afirmando que o arquivo saiu do bucket sem ninguém ter
 * olhado se saiu. Trilha que afirma o que não aconteceu é pior que trilha
 * omissa — quem for lê-la depois não tem como saber quais linhas valem.
 *
 * O mais caro era o `PacienteDocumentos`, cujo comentário dizia, ali mesmo:
 * "documento do paciente é dele, e a LGPD lhe dá o direito de apagar de
 * verdade". A linha do banco saía, o titular lia "Documento removido", e o
 * arquivo podia continuar no bucket.
 *
 * ## Duas situações, duas funções
 *
 * Elas falham de jeitos diferentes e por isso não compartilham a mensagem:
 * uma é o titular apagando o que é dele, a outra é faxina depois de um envio
 * que não completou.
 */

/**
 * Remove arquivos que o usuário mandou remover. Devolve se saíram de fato.
 *
 * Falhando, avisa — porque a decisão seguinte é dele: tentar de novo, ou saber
 * que o arquivo continua guardado apesar de a lista não mostrá-lo mais.
 */
export async function removerDoBucket(
  bucket: string,
  caminhos: string[],
  oQue: string,
): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove(caminhos);
  if (error) {
    reportError(new Error(`falha ao remover do bucket ${bucket}: ${error.message}`));
    toast.error(`${oQue}: o arquivo em si não saiu`, {
      description:
        `O registro foi removido, mas o arquivo continua guardado (${error.message}). ` +
        "Tente de novo; se persistir, avise a administração.",
      duration: 12_000,
    });
    return false;
  }
  return true;
}

/**
 * Apaga o objeto que subiu quando o registro dele NÃO entrou.
 *
 * Sem isto o bucket acumula arquivos que nenhuma lista mostra. Falhando, quem
 * precisa saber é quem administra — não o usuário, que já recebeu o erro do
 * envio e não tem o que fazer com esta informação.
 */
export async function limparOrfao(bucket: string, caminho: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([caminho]);
  if (error) {
    reportError(
      new Error(
        `objeto órfão em ${bucket}: ${caminho} subiu, o registro não entrou, e a ` +
        `limpeza falhou (${error.message}). Nenhuma lista mostra este arquivo.`,
      ),
    );
    return false;
  }
  return true;
}
