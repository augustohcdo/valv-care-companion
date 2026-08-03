import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * O usuário logado tem papel de administrador?
 *
 * A checagem já existia dentro do `ProtectedRoute`, num efeito próprio, e
 * agora é precisa em mais de um lugar (a navegação também). Duplicar a
 * consulta seria repetir o caminho que `usePatient` e `useDoctor` já
 * desfizeram — com o agravante de que aqui a resposta decide permissão.
 *
 * A chave inclui o id do usuário de propósito: sem isso, a segunda conta a
 * usar o mesmo navegador herdaria do cache o "é admin" da primeira.
 */
export const isAdminKey = (userId?: string) => ["is-admin", userId] as const;

export function useIsAdmin() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: isAdminKey(user?.id),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
    // O papel praticamente não muda durante uma sessão, e a resposta é usada
    // em toda troca de rota protegida.
    staleTime: 5 * 60_000,
  });

  return {
    isAdmin: query.data === true,
    /**
     * "Ainda não sei" não é "não é admin". Tratar os dois como falso mandaria
     * o administrador para a tela do médico durante um carregamento normal —
     * a mesma armadilha já encontrada em `AdminIntegracoes`.
     *
     * Sem usuário a consulta fica desabilitada (e portanto `pending` para
     * sempre no v5), então o `!!user` precisa vir antes.
     */
    carregando: !!user && query.isLoading,
  };
}
