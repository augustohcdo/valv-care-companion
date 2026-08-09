/**
 * Cópia do backup para um provedor fora do Supabase.
 *
 * O backup semanal funciona, é conferido contra manifesto e já foi ensaiado numa
 * restauração de verdade — mas mora **dentro do mesmo projeto que ele protege**.
 * Cobre exclusão acidental de registro; não cobre perda do projeto. Este módulo
 * é a segunda camada.
 *
 * A assinatura é SigV4 pela `aws4fetch`: 6 kB, sem dependências, usa só `fetch`
 * e `SubtleCrypto`. Isso importa por um motivo prático — as mesmas funções
 * precisam rodar no Deno da edge function **e** no Node do script de
 * restauração. Duas implementações de assinatura divergiriam com o tempo, e a
 * que menos roda seria justamente a do dia do desastre.
 *
 * Qualquer provedor S3-compatível serve (Backblaze B2, Cloudflare R2, MinIO):
 * o que muda é o endpoint e a região, que são variáveis de ambiente.
 *
 * **Nasce inerte.** Sem as variáveis configuradas, `configurado()` devolve
 * `false` e nada é enviado — mesma disciplina de `sendAlert.ts`: uma peça
 * pronta e desligada é honesta; uma peça que finge ter enviado, não.
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";

export interface Config {
  endpoint: string;
  region: string;
  bucket: string;
  keyId: string;
  secret: string;
}

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

function cliente(cfg: Config): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.keyId,
    secretAccessKey: cfg.secret,
    service: "s3",
    region: cfg.region,
  });
}

const urlDe = (cfg: Config, caminho: string) =>
  `${cfg.endpoint}/${cfg.bucket}/${caminho.replace(/^\/+/, "")}`;

/** SHA-256 em hexadecimal — é por ele que se prova que o que chegou é o que saiu. */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function enviarObjeto(
  cfg: Config,
  caminho: string,
  bytes: Uint8Array,
  contentType = "application/octet-stream",
): Promise<void> {
  const r = await cliente(cfg).fetch(urlDe(cfg, caminho), {
    method: "PUT",
    body: bytes as BodyInit,
    headers: { "Content-Type": contentType },
  });
  if (!r.ok) {
    // O corpo do erro do provedor entra na mensagem; o segredo, nunca. Um log de
    // falha que vaza credencial troca um problema por outro maior.
    const corpo = (await r.text().catch(() => "")).slice(0, 300);
    throw new Error(`PUT ${caminho} devolveu ${r.status}: ${corpo}`);
  }
}

export async function lerObjeto(cfg: Config, caminho: string): Promise<Uint8Array> {
  const r = await cliente(cfg).fetch(urlDe(cfg, caminho), { method: "GET" });
  if (!r.ok) {
    const corpo = (await r.text().catch(() => "")).slice(0, 300);
    throw new Error(`GET ${caminho} devolveu ${r.status}: ${corpo}`);
  }
  return new Uint8Array(await r.arrayBuffer());
}

/**
 * Envia e **relê**, comparando o hash.
 *
 * A releitura é o ponto do módulo inteiro. "Enviado" é o que o provedor
 * respondeu; "chegou íntegro" é outra coisa, e foi exatamente essa distinção que
 * deixou este projeto semanas com um backup agendado que nunca gravou arquivo.
 */
export async function copiarEConferir(
  cfg: Config,
  caminho: string,
  bytes: Uint8Array,
  contentType?: string,
): Promise<{ sha256: string; bytes: number }> {
  const esperado = await sha256(bytes);
  await enviarObjeto(cfg, caminho, bytes, contentType);

  const devolta = await lerObjeto(cfg, caminho);
  const obtido = await sha256(devolta);
  if (obtido !== esperado) {
    throw new Error(
      `conferência falhou em ${caminho}: enviado ${esperado.slice(0, 12)}…, ` +
        `lido de volta ${obtido.slice(0, 12)}… (${bytes.length} vs ${devolta.length} bytes)`,
    );
  }
  return { sha256: esperado, bytes: bytes.length };
}
