import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const patientKey = (userId?: string) => ["patient", userId] as const;

/**
 * Resolve o registro de paciente do usuário logado.
 *
 * Antes, cada tela da área do paciente refazia essa mesma consulta na mão e
 * guardava o resultado em useState só para alimentar a query seguinte. Com o
 * cache do react-query, a resolução acontece uma vez e é compartilhada por
 * todas as telas.
 *
 * Retorna `null` (não erro) quando o usuário não tem registro de paciente —
 * é o caso legítimo de quem ainda não completou o perfil. As telas usam isso
 * tanto para o estado vazio quanto para o `enabled` das queries dependentes.
 */
export function usePatient() {
  const { user } = useAuth();

  return useQuery({
    queryKey: patientKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .is("deleted_at", null)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
