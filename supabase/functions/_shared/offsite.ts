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
 * **Nasce inerte.** Sem as variáveis configuradas, `configurado()` — que vive
 * em `offsiteConfig.ts` — devolve `false` e nada é enviado: mesma disciplina de
 * `sendAlert.ts`. Uma peça pronta e desligada é honesta; uma que finge ter
 * enviado, não.
 *
 * A leitura do ambiente mora **noutro arquivo** de propósito. Era a única parte
 * daqui que dependia do `Deno` global, e enquanto estava neste módulo ele não
 * podia ser importado pelos testes do app — o `tsc` do app não conhece `Deno`.
 * O efeito prático disso era feio: a conferência de integridade, num código com
 * **zero execuções registradas**, estava coberta só por varredura de texto.
 * Transporte de um lado, ambiente do outro, e o transporte passa a ser
 * exercitado de verdade a cada CI.
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";

export interface Config {
  endpoint: string;
  region: string;
  bucket: string;
  keyId: string;
  secret: string;
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

/**
 * O mesmo digest do `sha256`, em base64 — que é como o S3 espera o cabeçalho
 * `x-amz-checksum-sha256`.
 */
async function checksumBase64(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  let bin = "";
  for (const b of hash) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function enviarObjeto(
  cfg: Config,
  caminho: string,
  bytes: Uint8Array,
  contentType = "application/octet-stream",
): Promise<void> {
  // **O checksum não é opcional.** Assim que o bucket ganha uma política de
  // retenção (Object Lock), o S3 passa a recusar PUT sem `Content-MD5` ou
  // `x-amz-checksum-*`: "Content-MD5 OR x-amz-checksum- HTTP header is required
  // for Put Object requests with Object Lock parameters".
  //
  // Foi medido do jeito ruim: ligar a retenção quebrou a cópia inteira, e sem
  // isto o backup semanal falharia toda segunda até alguém olhar. Mandar sempre
  // — e não só quando há retenção — porque o código não sabe (nem deveria
  // precisar saber) como o bucket do outro lado está configurado.
  //
  // Vai o SHA-256, que já é calculado para a conferência de integridade: o
  // provedor passa a recusar o objeto se ele chegar corrompido, o que fecha a
  // mesma porta um passo antes da releitura.
  const r = await cliente(cfg).fetch(urlDe(cfg, caminho), {
    method: "PUT",
    body: bytes as BodyInit,
    headers: {
      "Content-Type": contentType,
      "x-amz-checksum-sha256": await checksumBase64(bytes),
    },
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
