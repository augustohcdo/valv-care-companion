import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const doctorKey = (userId?: string) => ["doctor", userId] as const;

/**
 * Resolve o registro de médico do usuário logado.
 *
 * Irmão do `usePatient()`, pelo mesmo motivo: nove telas da área médica
 * refaziam esta consulta na mão antes de buscar o que realmente queriam.
 * Com o cache, ela acontece uma vez e vale para todas.
 *
 * Duas diferenças em relação ao `usePatient()`: `doctors` não tem
 * `deleted_at` (não há soft-delete nessa tabela), e várias telas só precisam
 * do `id` — mas a consulta traz a linha inteira mesmo assim, senão o cache
 * seria inútil para quem precisa do CRM ou da especialidade.
 *
 * Retorna `null` (não erro) quando o usuário não tem registro de médico.
 */
export function useDoctor() {
  const { user } = useAuth();

  return useQuery({
    queryKey: doctorKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
