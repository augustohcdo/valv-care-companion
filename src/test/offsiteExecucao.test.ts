import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * A conferência da cópia externa, **executada** — não varrida por texto.
 *
 * `src/test/offsite.test.ts` confere que `copiarEConferir` existe e que ela
 * chama `lerObjeto`. Isso prova que as strings estão lá. Não prova que a função
 * reage quando o que volta não é o que saiu — e era só isso que havia, num
 * módulo que tinha **zero execuções registradas** (`job_runs`, job
 * `offsite-copy`) quando este arquivo foi escrito.
 *
 * Aqui o módulo roda de verdade contra um provedor S3 falso em processo. O que
 * cada camada prova, sem sobreposição:
 *
 * - o ensaio contra MinIO (`scripts/offsite-verificar.ts`) prova **uma vez**,
 *   fora do CI, que o formato do fio está certo: assinatura SigV4, URL,
 *   cabeçalhos. Precisa de um servidor S3 e por isso não roda aqui.
 * - **este arquivo** prova, a cada CI, que a comparação de hash não pode ser
 *   removida em silêncio. É a metade que regride sozinha numa refatoração.
 */

const cfg = {
  endpoint: "https://s3.exemplo.invalid",
  region: "us-east-1",
  bucket: "backup",
  keyId: "chave-de-teste",
  secret: "segredo-de-teste",
};

/**
 * Um S3 mínimo em memória. `transformar` permite devolver, no GET, algo
 * diferente do que foi gravado — que é a falha silenciosa de armazenamento que
 * a releitura existe para pegar.
 */
function provedorFalso(transformar?: (b: Uint8Array) => Uint8Array) {
  const objetos = new Map<string, Uint8Array>();
  const chamadas: string[] = [];

  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    // A `aws4fetch` assina e chama o fetch global com um `Request` **único**,
    // sem `init`. Ler o método de `init` fazia todo PUT ser tratado como GET —
    // o provedor falso respondia 404 e o teste acusava um defeito que não
    // existia no código sob teste, só no duplo.
    const req = entrada instanceof Request && !init ? entrada : new Request(String(entrada), init);
    const metodo = req.method.toUpperCase();
    const caminho = new URL(req.url).pathname;
    chamadas.push(`${metodo} ${caminho}`);

    // A credencial tem que ter sido usada: sem assinatura a chamada nem
    // deveria sair. Não valida SigV4 — isso é o ensaio contra MinIO
    // (`scripts/offsite-verificar.ts`) —, só exige que a assinatura exista.
    const assinada = (req.headers.get("authorization") ?? "").startsWith("AWS4-HMAC-SHA256");

    if (metodo === "PUT") {
      if (!assinada) return new Response("requisição sem assinatura", { status: 403 });
      // O S3 recusa PUT sem checksum quando o bucket tem Object Lock — foi
      // assim que a cópia real quebrou ao ligar a retenção. O duplo passa a
      // cobrar o mesmo, senão o teste ficaria verde com o defeito de volta.
      if (!req.headers.get("x-amz-checksum-sha256") && !req.headers.get("content-md5")) {
        return new Response(
          "<Error><Code>InvalidRequest</Code><Message>Content-MD5 OR x-amz-checksum- HTTP header is required for Put Object requests with Object Lock parameters</Message></Error>",
          { status: 400 },
        );
      }
      objetos.set(caminho, new Uint8Array(await req.arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    if (metodo === "GET") {
      if (!assinada) return new Response("requisição sem assinatura", { status: 403 });
      const guardado = objetos.get(caminho);
      if (!guardado) return new Response("no such key", { status: 404 });
      const saida = transformar ? transformar(guardado) : guardado;
      return new Response(saida as BodyInit, { status: 200 });
    }
    return new Response(null, { status: 405 });
  });

  return { objetos, chamadas };
}

const conteudo = new TextEncoder().encode("linha um\nlinha dois\nlinha três\n");

describe("copiarEConferir, executada", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ida e volta íntegra: devolve o hash e o tamanho", async () => {
    const { chamadas } = provedorFalso();
    const { copiarEConferir } = await import("../../supabase/functions/_shared/offsite.ts");
    const r = await copiarEConferir(cfg, "exports/x.ndjson", conteudo, "application/x-ndjson");

    expect(r.bytes).toBe(conteudo.length);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Gravou **e** releu: sem o GET, a conferência compararia o buffer local
    // com ele mesmo e passaria sempre.
    expect(chamadas).toContain("PUT /backup/exports/x.ndjson");
    expect(chamadas).toContain("GET /backup/exports/x.ndjson");
  });

  it("manda o checksum do conteúdo, e o valor confere", async () => {
    // Presença não basta: um checksum constante ou de outro conteúdo passaria
    // pelo provedor falso e seria recusado pelo real.
    let enviado: string | null = null;
    vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const req = entrada instanceof Request && !init ? entrada : new Request(String(entrada), init);
      if (req.method === "PUT") enviado = req.headers.get("x-amz-checksum-sha256");
      return new Response(req.method === "GET" ? (conteudo as BodyInit) : null, { status: 200 });
    });
    const { copiarEConferir } = await import("../../supabase/functions/_shared/offsite.ts");
    await copiarEConferir(cfg, "exports/x.ndjson", conteudo);

    const esperado = Buffer.from(
      await crypto.subtle.digest("SHA-256", conteudo as BufferSource),
    ).toString("base64");
    expect(enviado, "o PUT foi sem checksum — o S3 com Object Lock recusaria").not.toBeNull();
    expect(enviado, "o checksum não corresponde ao conteúdo enviado").toBe(esperado);
  });

  it("um byte trocado na volta faz lançar", async () => {
    provedorFalso((b) => {
      const c = new Uint8Array(b);
      c[0] = c[0] ^ 0xff;
      return c;
    });
    const { copiarEConferir } = await import("../../supabase/functions/_shared/offsite.ts");
    await expect(
      copiarEConferir(cfg, "exports/x.ndjson", conteudo),
    ).rejects.toThrow(/confer/i);
  });

  it("tamanho diferente na volta faz lançar, com os dois tamanhos na mensagem", async () => {
    provedorFalso((b) => b.slice(0, b.length - 3));
    const { copiarEConferir } = await import("../../supabase/functions/_shared/offsite.ts");
    // A mensagem precisa dizer quanto saiu e quanto voltou: "falhou" sem número
    // manda quem for investigar às cegas.
    await expect(
      copiarEConferir(cfg, "exports/x.ndjson", conteudo),
    ).rejects.toThrow(new RegExp(`${conteudo.length} vs ${conteudo.length - 3} bytes`));
  });

  it("erro do provedor no PUT sobe com status e corpo, e sem a credencial", async () => {
    vi.stubGlobal("fetch", async () => new Response("AccessDenied: chave sem permissão", { status: 403 }));
    const { copiarEConferir } = await import("../../supabase/functions/_shared/offsite.ts");
    try {
      await copiarEConferir(cfg, "exports/x.ndjson", conteudo);
      throw new Error("deveria ter lançado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toContain("403");
      expect(msg).toContain("AccessDenied");
      expect(msg, "a credencial vazou na mensagem de erro").not.toContain(cfg.secret);
      expect(msg).not.toContain(cfg.keyId);
    }
  });
});
