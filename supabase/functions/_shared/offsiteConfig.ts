/**
 * A configuração da cópia externa, lida do ambiente.
 *
 * Separada de `offsite.ts` porque é a única parte que depende do `Deno` global.
 * Enquanto estava lá, o módulo de transporte não podia ser importado pelos
 * testes do app, e a conferência de integridade ficava coberta apenas por
 * varredura de texto.
 */
import type { Config } from "./offsite.ts";

/**
 * Lê a configuração do ambiente. Devolve `null` quando falta qualquer peça —
 * meia configuração é pior que nenhuma: enviaria para o lugar errado ou falharia
 * no meio, deixando o backup pela metade.
 */
export function lerConfig(): Config | null {
  const endpoint = Deno.env.get("OFFSITE_ENDPOINT");
  const region = Deno.env.get("OFFSITE_REGION");
  const bucket = Deno.env.get("OFFSITE_BUCKET");
  const keyId = Deno.env.get("OFFSITE_KEY_ID");
  const secret = Deno.env.get("OFFSITE_SECRET");
  if (!endpoint || !region || !bucket || !keyId || !secret) return null;
  return { endpoint: endpoint.replace(/\/+$/, ""), region, bucket, keyId, secret };
}

export function configurado(): boolean {
  return lerConfig() !== null;
}
