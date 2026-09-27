/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ipDoChamador, ipPermitido } from "../../supabase/functions/_shared/ipDoChamador.ts";

/**
 * O IP de quem chama: de onde vem, e o que acontece quando não vem.
 *
 * ## O que havia
 *
 * Três funções leem o IP do chamador. **Uma fazia certo** —
 * `access-request` usava `cf-connecting-ip`, posto pela borda — e as duas que
 * servem dado clínico a hospital faziam:
 *
 *     req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
 *
 * `X-Forwarded-For` é lista, e cada intermediário acrescenta ao FIM. A entrada
 * da ESQUERDA é a que o cliente pode escrever antes de o primeiro proxy anexar
 * o endereço real. Quer dizer: `split(",")[0]` deixa quem chama escolher o
 * próprio IP.
 *
 * E ali o IP tem dois papéis, não um:
 *
 *   · **portão** — `ip_allowlist` da chave de API do hospital;
 *   · **trilha** — `integration_audit_log` e `requester_ip`, que registram de
 *     onde o prontuário de um paciente foi lido.
 *
 * ## E o portão abria quando não sabia
 *
 *     if (keyRow.ip_allowlist?.length && ip && !keyRow.ip_allowlist.includes(ip))
 *
 * O `&& ip &&` no meio: sem IP determinável, a lista de permissão era pulada —
 * "não sei de onde veio" valendo como "veio de onde eu permito". Na mesma base
 * em que todo script separa 1 de 2 para não confundir "está errado" com "não deu
 * para olhar".
 *
 * ## O que esta guarda NÃO prova
 *
 * Que a entrada da esquerda seja forjável NESTA plataforma — isso depende do que
 * a borda do Supabase faz com um `X-Forwarded-For` que o cliente manda, e não
 * consigo medir daqui sem chamar a função publicada. O que está medido é o
 * resto, e basta para a decisão: a forma segura já existia neste repositório, em
 * `access-request`, e a insegura estava nas duas funções de dado clínico.
 */

const helperFalso = (cabecalhos: Record<string, string>) => ({
  headers: { get: (n: string) => cabecalhos[n.toLowerCase()] ?? null },
});

describe("de onde vem o IP de quem chama", () => {
  it("a borda vence o `X-Forwarded-For`", () => {
    expect(
      ipDoChamador(helperFalso({
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "1.2.3.4, 203.0.113.9",
      })),
    ).toBe("203.0.113.9");
  });

  it("sem a borda, pega a ÚLTIMA entrada — não a primeira", () => {
    /**
     * É esta a linha que muda o resultado: a primeira entrada é a que o cliente
     * prefixa, a última é a que o intermediário mais próximo anexou.
     */
    expect(
      ipDoChamador(helperFalso({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 203.0.113.9" })),
      "pegou a entrada que quem chama escreveu",
    ).toBe("203.0.113.9");
  });

  it("sem cabeçalho nenhum, devolve `null` — e não um IP inventado", () => {
    expect(ipDoChamador(helperFalso({}))).toBeNull();
    expect(ipDoChamador(helperFalso({ "x-forwarded-for": "  ,  " }))).toBeNull();
  });

  it("espaços e valor vazio não viram IP", () => {
    expect(ipDoChamador(helperFalso({ "cf-connecting-ip": "   " }))).toBe(null);
    expect(ipDoChamador(helperFalso({ "cf-connecting-ip": " 203.0.113.9 " }))).toBe("203.0.113.9");
  });
});

describe("a lista de permissão da chave de API", () => {
  it("sem lista configurada, qualquer origem passa", () => {
    // Quem não pediu restrição de origem não pode ser barrado por ela.
    expect(ipPermitido(null, null)).toEqual({ ok: true });
    expect(ipPermitido([], "203.0.113.9")).toEqual({ ok: true });
  });

  it("com lista e IP na lista, passa", () => {
    expect(ipPermitido(["203.0.113.9"], "203.0.113.9")).toEqual({ ok: true });
  });

  it("com lista e IP fora dela, recusa", () => {
    expect(ipPermitido(["203.0.113.9"], "198.51.100.1")).toEqual({
      ok: false, motivo: "fora_da_lista",
    });
  });

  it("com lista e SEM IP, RECUSA — era aqui que abria", () => {
    /**
     * O terceiro estado. O `&& ip &&` anterior fazia este caso passar: chave
     * restrita a uma faixa de IP funcionava de qualquer lugar bastando o
     * cabeçalho não chegar.
     */
    expect(
      ipPermitido(["203.0.113.9"], null),
      "IP indeterminado com lista configurada precisa recusar",
    ).toEqual({ ok: false, motivo: "ip_indeterminado" });
  });

  it("o motivo distingue os dois jeitos de não passar", () => {
    // "você não está na lista" e "não sei quem você é" mandam o hospital
    // investigar coisas diferentes — foi a mesma correção que `key_check_failed`
    // recebeu por não poder se chamar `unauthorized`.
    const fora = ipPermitido(["1.1.1.1"], "2.2.2.2");
    const semIp = ipPermitido(["1.1.1.1"], null);
    expect(fora).not.toEqual(semIp);
  });
});

describe("nenhuma função decide por `X-Forwarded-For` na mão", () => {
  /** Comentários fora: guarda que lê comentário não confere código. */
  const semComentarios = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  function arquivosDeFuncao(): string[] {
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        if (nome === "node_modules") continue;
        const full = join(dir, nome);
        if (statSync(full).isDirectory()) { varrer(full); continue; }
        if (/\.ts$/.test(nome)) achados.push(full);
      }
    };
    varrer("supabase/functions");
    return achados;
  }

  it("a varredura acha as funções", () => {
    expect(arquivosDeFuncao().length, "nenhum arquivo de função encontrado")
      .toBeGreaterThanOrEqual(18);
  });

  it("a decisão mora em `_shared/ipDoChamador.ts`, e em nenhum outro lugar", () => {
    /**
     * Regra sobre a classe. Três cópias de uma regra garantem que uma divirja, e
     * esta sessão já pagou esse preço com o caminho do Chromium e com o limiar
     * de tela vazia. Aqui a cópia divergente era a que valia para dado clínico.
     */
    const fora: string[] = [];
    for (const arquivo of arquivosDeFuncao()) {
      if (arquivo.endsWith("_shared/ipDoChamador.ts")) continue;
      const texto = semComentarios(readFileSync(arquivo, "utf8"));
      if (/x-forwarded-for/i.test(texto)) fora.push(`  · ${arquivo} — lê o cabeçalho direto`);
      if (/headers\.get\(\s*["']cf-connecting-ip["']\s*\)/i.test(texto)) {
        fora.push(`  · ${arquivo} — lê a borda direto, fora do helper`);
      }
    }
    expect(
      fora,
      `\n${fora.join("\n")}\n\n` +
        "O IP de quem chama é decidido em `_shared/ipDoChamador.ts`: a borda\n" +
        "primeiro, depois a ÚLTIMA entrada do `X-Forwarded-For`, nunca a primeira.\n" +
        "Ler o cabeçalho na mão devolve a segunda cópia da regra, e foi a cópia\n" +
        "divergente que ficou nas duas funções que servem prontuário a hospital.",
    ).toEqual([]);
  });

  it("nenhum portão de origem é condicionado a o IP existir", () => {
    // A forma exata do defeito: `&& ip &&` no meio da checagem de lista.
    const ruins: string[] = [];
    for (const arquivo of arquivosDeFuncao()) {
      const texto = semComentarios(readFileSync(arquivo, "utf8"));
      if (/ip_allowlist[\s\S]{0,80}&&\s*ip\s*&&/.test(texto)) {
        ruins.push(`  · ${arquivo} — a lista de permissão é pulada sem IP`);
      }
    }
    expect(
      ruins,
      `\n${ruins.join("\n")}\n\n` +
        "Quem configurou uma lista de permissão pediu para restringir por origem.\n" +
        "Pular a checagem quando o IP não chega é tratar 'não sei' como\n" +
        "'autorizado' — e aqui o que está do outro lado é o prontuário.",
    ).toEqual([]);
  });
});
