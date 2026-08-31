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
  /** Gradiente médio de referência, em mmHg — mesma fonte da EOA. */
  mean_gradient_ref: number | null;
  mean_gradient_ref_sd: number | null;
  annulus_min_mm: number | null;
  annulus_max_mm: number | null;
  description: string | null;
  reference_url: string | null;
  image_url: string | null;
  /**
   * `foto` ou `ilustracao` — e a legenda da tela obedece.
   *
   * Nem toda imagem oficial é fotografia: a Medtronic e a Abbott publicam foto
   * de estúdio, a Corcym publica renderização 3D. Chamar as duas de "foto do
   * fabricante" diria ao médico que aquilo é o objeto retratado quando é o
   * objeto desenhado.
   */
  image_kind: "foto" | "ilustracao" | null;
  display_order: number | null;
  /**
   * Situação regulatória que o médico precisa saber **antes** de escolher.
   *
   * Não é `active = false` de propósito: uma prótese pode ter alerta e
   * continuar à venda. O que sai de vez do catálogo — transcateter, fora de
   * linha, tamanho que não existe — sai por `inactive_reason`, do lado do
   * banco, e as fora de linha reaparecem por `referencia_historica()`.
   */
  advisory: "retirada_do_mercado" | "alerta_de_seguranca" | "descontinuada" | null;
  advisory_note: string | null;
  advisory_url: string | null;
  advisory_date: string | null;
  /**
   * Se esta prótese é vendida **no Brasil** — e os três estados que isso tem.
   *
   * `"confirmado"` e `"nao_confirmado"` são resultado de busca; **nulo quer dizer
   * que ninguém procurou ainda**, e a tela precisa saber a diferença. Campo vazio
   * que pode significar "procurei e não achei" ou "não olhei" é campo que engana,
   * e é a mesma disciplina já aplicada à EOA e à foto.
   *
   * `nao_confirmado` NÃO tira a prótese do catálogo: tirar uma que talvez esteja
   * na prateleira do serviço é pior do que mantê-la com ressalva.
   */
  mercado_br: "confirmado" | "nao_confirmado" | null;
  /** Número do registro na ANVISA, quando ele aparece publicamente. */
  anvisa_registro: string | null;
  mercado_br_conferido_em: string | null;
  mercado_br_fonte: string | null;
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
