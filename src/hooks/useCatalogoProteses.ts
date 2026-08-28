import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * O catálogo de próteses — **uma consulta só, para o aplicativo inteiro**.
 *
 * Antes desta rodada havia uma consulta direta a `prosthesis_catalog` dentro de
 * `NovoCaso.tsx`, e as ferramentas livres precisariam de outra, porque elas
 * rodam **sem sessão** e a policy da tabela é só para `authenticated`. Duas
 * consultas ao mesmo catálogo divergem no primeiro campo novo — foi assim que a
 * lista de tabelas do backup ficou quinze tabelas atrasada, e assim que os
 * nomes de modo da IA precisaram de um `aiModes.ts` para reconciliar.
 *
 * Então a leitura passa pela função `catalogo_proteses()`, que responde a
 * visitante e a médico logado do mesmo jeito e devolve exatamente as colunas
 * que a tela mostra. O `REVOKE` da mesma migration tirou INSERT/UPDATE/DELETE
 * de `anon` e `authenticated` na tabela: por aqui só se lê.
 */

export interface ProteseDoCatalogo {
  id: string;
  manufacturer: string;
  model_name: string;
  type: string;
  valve_position: string;
  size: number | null;
  /** EOA de referência publicada. Nula em 217 das 246 linhas — e isso é dito na tela. */
  effective_orifice_area: number | null;
  eoa_reference_sd: number | null;
  eoa_source_label: string | null;
  eoa_source_url: string | null;
  annulus_min_mm: number | null;
  annulus_max_mm: number | null;
  description: string | null;
  reference_url: string | null;
  image_url: string | null;
  display_order: number | null;
}

export const catalogoProtesesKey = ["catalogo-proteses"] as const;

export async function buscarCatalogoProteses(): Promise<ProteseDoCatalogo[]> {
  const { data, error } = await supabase.rpc("catalogo_proteses");
  if (error) throw error;
  return (data ?? []) as ProteseDoCatalogo[];
}

export function useCatalogoProteses() {
  return useQuery({
    queryKey: catalogoProtesesKey,
    queryFn: buscarCatalogoProteses,
    // Catálogo de fabricante muda em escala de meses, não de minutos.
    staleTime: 1000 * 60 * 60,
  });
}
