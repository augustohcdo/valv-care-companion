import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * As próteses que saíram de linha — fora do catálogo, e ainda assim necessárias.
 *
 * ## Por que não foram simplesmente apagadas
 *
 * Porque "não se vende mais" e "o dado não vale mais" são coisas diferentes, e
 * confundi-las cega a ferramenta justamente para o paciente que já tem prótese.
 * Duas razões clínicas, as duas cirúrgicas:
 *
 *   1. **É contra a PERIMOUNT que as próteses atuais são comparadas.** Ela é o
 *      braço de comparação dos estudos da geração nova — da Edwards e das
 *      outras. Apagá-la apagaria o denominador da comparação.
 *   2. **Quem operou um paciente com PERIMOUNT em 2015 precisa da EOA de
 *      referência dela hoje**, para dizer se o gradiente alto no eco de
 *      seguimento é mismatch prótese-paciente ou obstrução — e para planejar
 *      valve-in-valve, que é decisão de sala.
 *
 * Então elas saem do CATÁLOGO — não são oferecidas, não entram no recomendador,
 * não contam como produto — e passam a viver aqui, com a data e a fonte da
 * retirada gravadas. A separação é do lado do banco: `catalogo_proteses()`
 * filtra `active = true`, esta função filtra `discontinued_at IS NOT NULL`.
 */

export interface ProteseForaDeLinha {
  manufacturer: string;
  model_name: string;
  valve_position: string;
  size: number | null;
  effective_orifice_area: number | null;
  eoa_reference_sd: number | null;
  eoa_source_label: string | null;
  eoa_source_url: string | null;
  mean_gradient_ref: number | null;
  mean_gradient_ref_sd: number | null;
  discontinued_at: string;
  discontinued_note: string | null;
  discontinued_source_url: string | null;
}

export const referenciaHistoricaKey = ["referencia-historica"] as const;

export async function buscarReferenciaHistorica(): Promise<ProteseForaDeLinha[]> {
  const { data, error } = await supabase.rpc("referencia_historica");
  if (error) throw error;
  return (data ?? []) as ProteseForaDeLinha[];
}

export function useReferenciaHistorica() {
  return useQuery({
    queryKey: referenciaHistoricaKey,
    queryFn: buscarReferenciaHistorica,
    staleTime: 1000 * 60 * 60,
  });
}
