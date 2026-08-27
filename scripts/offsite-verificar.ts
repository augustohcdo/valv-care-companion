#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Verifica a cópia externa contra o provedor de verdade, antes de confiar nela.
 *
 *   OFFSITE_ENDPOINT=... OFFSITE_REGION=... OFFSITE_BUCKET=... \
 *   OFFSITE_KEY_ID=... OFFSITE_SECRET=... \
 *   deno run --allow-net --allow-env scripts/offsite-verificar.ts
 *
 * Existe porque `offsite-copy` tinha **zero execuções** quando isto foi escrito
 * — `select count(*) from job_runs where job = 'offsite-copy'` — e as guardas
 * dela só varriam o texto do módulo. Sem este ensaio, o código rodaria pela
 * primeira vez na vida às 03h45 de uma segunda-feira, sozinho, no dia em que a
 * credencial fosse configurada.
 *
 * Roda em Deno e importa `_shared/offsite.ts`, **o mesmo módulo da edge
 * function**. Uma segunda implementação de assinatura divergiria com o tempo, e
 * a que menos roda seria justamente a do dia do desastre — é o alerta que o
 * próprio módulo carrega.
 *
 * Serve para qualquer provedor S3-compatível: MinIO local no ensaio, Backblaze
 * B2 quando as variáveis apontarem para lá. É a mesma prova nos dois.
 */
import { copiarEConferir, enviarObjeto, lerObjeto, sha256 } from "../supabase/functions/_shared/offsite.ts";
import { lerConfig } from "../supabase/functions/_shared/offsiteConfig.ts";

const cfg = lerConfig();
if (!cfg) {
  console.error(
    "Faltam variáveis. Defina OFFSITE_ENDPOINT, OFFSITE_REGION, OFFSITE_BUCKET, " +
    "OFFSITE_KEY_ID e OFFSITE_SECRET.\n" +
    "Meia configuração é pior que nenhuma: enviaria para o lugar errado.",
  );
  Deno.exit(1);
}

const enc = new TextEncoder();
const marca = new Date().toISOString().replace(/[:.]/g, "-");
const caminho = `_verificacao/${marca}.txt`;
const conteudo = enc.encode(
  `Verificação da cópia externa — ${new Date().toISOString()}\n` +
  "Este arquivo é descartável e apagado ao fim do ensaio.\n" +
  "x".repeat(5000),
);

let falhas = 0;
const ok = (t: string) => console.log(`✓ ${t}`);
const nok = (t: string) => { falhas++; console.log(`✗ ${t}`); };

console.log(`Verificando ${cfg.endpoint}/${cfg.bucket}\n`);

// ---------------------------------------------------------------- 1. ida e volta
try {
  const r = await copiarEConferir(cfg, caminho, conteudo, "text/plain");
  ok(`gravou e releu ${r.bytes} bytes — sha256 ${r.sha256.slice(0, 12)}…`);
} catch (e) {
  nok(`gravar e reler falhou: ${e instanceof Error ? e.message : String(e)}`);
}

// ---------------------------------------------------- 2. o que veio é o que foi
try {
  const devolta = await lerObjeto(cfg, caminho);
  const igual = await sha256(devolta) === await sha256(conteudo);
  if (igual) ok("leitura independente confere byte a byte");
  else nok("leitura independente devolveu conteúdo diferente");
} catch (e) {
  nok(`leitura independente falhou: ${e instanceof Error ? e.message : String(e)}`);
}

// ------------------------------------------------- 3. a defesa detecta corrupção
//
// O teste que dá sentido aos outros dois: se a releitura de `copiarEConferir`
// for decorativa, tudo acima passa e só isto denuncia.
//
// Comparar dois conteúdos diferentes e concluir que diferem não testaria nada —
// testaria que o SHA-256 funciona. O que precisa ser exercitado é a **reação**
// da função quando o que volta não é o que saiu. Então o `fetch` global é
// envolvido: a requisição vai ao provedor de verdade, é assinada de verdade, e
// só o corpo da resposta do GET deste caminho volta com um byte trocado. É a
// falha silenciosa de armazenamento que a conferência existe para pegar.
const caminhoCanario = `${caminho}.canario`;
const fetchOriginal = globalThis.fetch;
let lancou = false;
try {
  globalThis.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const r = await fetchOriginal(entrada, init);
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase();
    if (metodo === "GET" && url.includes(caminhoCanario) && r.ok) {
      const corpo = new Uint8Array(await r.arrayBuffer());
      if (corpo.length) corpo[0] = corpo[0] ^ 0xff;
      return new Response(corpo as BodyInit, { status: r.status, headers: r.headers });
    }
    return r;
  };
  try {
    await copiarEConferir(cfg, caminhoCanario, conteudo, "text/plain");
  } catch (e) {
    lancou = /confer/i.test(e instanceof Error ? e.message : String(e));
  }
} finally {
  globalThis.fetch = fetchOriginal;
}
if (lancou) ok("um byte trocado na volta faz a conferência lançar — ela não é decorativa");
else nok("PERIGO: byte trocado na volta passou como cópia íntegra");

// -------------------------------------------------------------- 4. faxina
//
// Com versionamento ligado, um DELETE sem versão **não apaga**: coloca uma marca
// de exclusão e a versão anterior continua lá. E se o bucket tiver retenção
// (Object Lock), a versão fica intocável até o prazo vencer — nem o dono da
// conta apaga, em modo compliance.
//
// Ou seja: dizer "apagou" aqui seria mentira. O objeto some da listagem comum e
// ocupa alguns kB até o prazo passar. Isso é aceitável para um arquivo de teste
// de 5 kB, mas quem lê o relatório precisa saber o que de fato aconteceu.
for (const c of [caminho, caminhoCanario]) {
  try {
    const { AwsClient } = await import("npm:aws4fetch@1.0.20");
    const aws = new AwsClient({
      accessKeyId: cfg.keyId, secretAccessKey: cfg.secret, service: "s3", region: cfg.region,
    });
    const r = await aws.fetch(`${cfg.endpoint}/${cfg.bucket}/${c}`, { method: "DELETE" });
    if (r.status === 204 || r.status === 200) {
      console.log(`· ${c} — marcado como excluído (a versão fica retida se o bucket tiver Object Lock)`);
    } else {
      // 403 é chave sem permissão de exclusão, o que é o desejável em produção.
      console.log(`· ${c} — não pôde ser excluído (${r.status}); se a chave não tem delete, está correto`);
    }
  } catch {
    console.log(`· não deu para excluir ${c}`);
  }
}

console.log(falhas === 0
  ? "\n✓ a cópia externa grava, relê e confere. Pode ser ligada."
  : `\n✗ ${falhas} verificação(ões) falharam — NÃO ligue a cópia externa ainda.`);
Deno.exit(falhas === 0 ? 0 : 1);
