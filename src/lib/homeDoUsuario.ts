/**
 * Para onde uma conta vai depois de entrar.
 *
 * A decisão existia em três cópias — `Login.tsx`, `AuthCallback.tsx` e o
 * `correctHome` do `ProtectedRoute` — e as três discordavam. O login por senha
 * já mandava o administrador para o painel; o retorno do login com Google não,
 * então quem entrasse pelo Google caía numa área de médico. Cópia divergente de
 * uma regra é como a lista de tabelas do backup envelheceu.
 */
import { supabase } from "@/integrations/supabase/client";

export type ContextoDeConta = {
  /** `profiles.account_type`: só existe `medico` e `paciente` (CHECK do banco). */
  accountType?: string | null;
  ehAdmin: boolean;
  /** Existe linha em `doctors`/`patients` para este usuário? */
  temRegistroClinico: boolean;
};

export const HOME_ADMIN = "/app/admin";
export const HOME_MEDICO = "/app/medico";
export const HOME_PACIENTE = "/app/paciente";

/**
 * A conta de administrador é obrigada a declarar `account_type = 'medico'` —
 * o `profiles_account_type_check` só aceita `medico` e `paciente`, e não existe
 * tipo "admin". Sem esta regra ela aterrissa num painel de médico vazio, que
 * pede para completar um cadastro clínico que ela nunca vai ter.
 *
 * O registro clínico é o que separa os dois casos que o `account_type` sozinho
 * confunde: um médico recém-cadastrado **ainda não** tem linha em `doctors` e
 * precisa da área clínica para criá-la; a conta administrativa não tem e nunca
 * terá. Por isso a regra só desvia quem é **admin e** não tem registro.
 */
export function homeDoUsuario(ctx: ContextoDeConta): string {
  if (ctx.ehAdmin && !ctx.temRegistroClinico) return HOME_ADMIN;
  return ctx.accountType === "medico" ? HOME_MEDICO : HOME_PACIENTE;
}

/**
 * Junta o contexto no banco e devolve o destino. É o que `Login` e
 * `AuthCallback` chamam — a regra em si fica na função pura acima, testável
 * sem rede.
 *
 * As quatro consultas vão juntas de propósito: em série, elas seriam quatro
 * idas ao servidor entre o clique em "Entrar" e a primeira tela.
 */
export async function resolverHome(userId: string): Promise<string> {
  const [perfil, admin, medico, paciente] = await Promise.all([
    supabase.from("profiles").select("account_type").eq("user_id", userId).maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.from("doctors").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("patients").select("id").is("deleted_at", null).eq("user_id", userId).maybeSingle(),
  ]);

  return homeDoUsuario({
    accountType: perfil.data?.account_type ?? null,
    ehAdmin: admin.data === true,
    temRegistroClinico: !!medico.data || !!paciente.data,
  });
}
