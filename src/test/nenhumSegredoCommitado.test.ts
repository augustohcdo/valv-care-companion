/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

/**
 * Nenhuma chave de verdade entra neste repositório — que é PÚBLICO.
 *
 * ## Por que isto existe
 *
 * A conferência `git diff --cached | grep -c "sbp_\|sb_secret_\|eyJhbGciOi"`
 * é o passo manual que eu repito antes de cada commit desta sessão. Passo
 * manual repetido é passo que uma hora não acontece — é o que o cabeçalho do
 * `db.yml` já diz sobre aplicar migration à mão, e vale igual aqui.
 *
 * E ela pegou uma de verdade: escrevendo o teste de
 * `chavesPublicasDoSite.test.ts` eu usei os oito primeiros caracteres da chave
 * publishable de PRODUÇÃO numa fixture, copiados do bundle que tinha acabado de
 * baixar. Aquela chave é pública — vai embutida em todo navegador —, mas
 * prefixo real commitado faz qualquer busca pela chave acertar o repositório, e
 * o próximo a copiar o padrão pode não estar lidando com uma chave pública.
 *
 * ## A régua
 *
 * Uma cadeia com FORMA de chave só pode estar aqui se for obviamente um
 * exemplo — e "obviamente" tem um teste: o próprio valor contém `EXEMPLO`.
 *
 * Não é rigor estético. Os quatro formatos têm consequências muito diferentes:
 *
 *   · `sbp_…`        o token de gestão. **Root sobre a conta inteira.** Com ele
 *                    se lê, apaga e recria qualquer projeto;
 *   · `sb_secret_…`  chave secreta de projeto;
 *   · `eyJ…`         JWT — é a forma da `service_role`, que ignora toda a RLS;
 *   · `sb_publishable_…` pública por construção, e mesmo assim não entra com
 *                    valor real, pelo motivo acima.
 *
 * ## O que esta guarda NÃO garante
 *
 * Ela olha o que está **rastreado pelo git**, como texto. Não olha o histórico
 * (um segredo que já foi commitado e removido continua no histórico e precisa
 * de rotação, não de `git rm`), não olha arquivos binários, e não reconhece
 * segredo que não tenha um destes quatro formatos — uma senha de banco, por
 * exemplo, passa por aqui. Guarda cujo nome promete mais do que ela confere é
 * pior que nenhuma.
 */

/** Binário e travas: não são texto, e não é nelas que uma chave é digitada. */
const NAO_E_TEXTO = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|mp4|mp3|zip|gz|lock)$/i;

/** Dois megabytes: acima disso é dado, e ler custa mais do que informa. */
const TAMANHO_MAXIMO = 2_000_000;

export interface FormaDeChave {
  nome: string;
  consequencia: string;
  re: RegExp;
}

export const FORMAS: FormaDeChave[] = [
  {
    nome: "sbp_",
    consequencia: "token de gestão — ROOT sobre a conta inteira do Supabase",
    re: /\bsbp_[A-Za-z0-9_-]{20,}/g,
  },
  {
    nome: "sb_secret_",
    consequencia: "chave secreta de projeto",
    re: /\bsb_secret_[A-Za-z0-9_-]{20,}/g,
  },
  {
    nome: "JWT de três segmentos",
    consequencia: "é a forma da `service_role`, que ignora toda a RLS",
    re: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g,
  },
  {
    nome: "cabeçalho de JWT (eyJhbGciOi…)",
    consequencia: "um JWT cortado ou concatenado ainda é um JWT",
    re: /\beyJhbGciOi[A-Za-z0-9_-]{6,}/g,
  },
  {
    nome: "sb_publishable_",
    consequencia: "pública por construção, mas valor real não entra no repositório",
    re: /\bsb_publishable_[A-Za-z0-9_-]{20,}/g,
  },
];

/** É um exemplo evidente? O próprio valor tem de dizer. */
export function eExemplo(valor: string): boolean {
  return /EXEMPLO/i.test(valor);
}

/** As cadeias com forma de chave num texto, já classificadas. */
export function chavesNoTexto(texto: string): { forma: FormaDeChave; valor: string; indice: number }[] {
  const achados: { forma: FormaDeChave; valor: string; indice: number }[] = [];
  for (const forma of FORMAS) {
    forma.re.lastIndex = 0;
    for (const m of texto.matchAll(forma.re)) {
      achados.push({ forma, valor: m[0], indice: m.index });
    }
  }
  return achados;
}

describe("nenhuma chave de verdade commitada", () => {
  it("o repositório rastreado está limpo", () => {
    const rastreados = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .trim().split("\n").filter((f) => f && !NAO_E_TEXTO.test(f));

    const culpados: string[] = [];
    let lidos = 0;
    for (const arquivo of rastreados) {
      let texto: string;
      try {
        if (statSync(arquivo).size > TAMANHO_MAXIMO) continue;
        texto = readFileSync(arquivo, "utf8");
      } catch {
        continue; // arquivo que não abre como texto não é onde se digita chave
      }
      lidos++;
      for (const { forma, valor, indice } of chavesNoTexto(texto)) {
        if (eExemplo(valor)) continue;
        const linha = texto.slice(0, indice).split("\n").length;
        // O valor NÃO vai na mensagem: ela aparece em log de CI, que é copiado
        // sem contexto. O prefixo e o tamanho bastam para achar.
        culpados.push(
          `  · ${arquivo}:${linha} — forma \`${forma.nome}\`, ` +
          `${valor.length} caracteres começando em "${valor.slice(0, 12)}…"\n` +
          `      consequência: ${forma.consequencia}`,
        );
      }
    }

    /**
     * Pisos. Este repositório tem 596 arquivos rastreados em 23 diretórios de
     * topo; os pisos são bem abaixo porque apagar código legítimo não pode
     * reprovar. O que eles pegam é a varredura que parou de achar arquivo —
     * nesta guarda, varrer nada é aprovar tudo.
     */
    expect(lidos, "a varredura não leu arquivo nenhum").toBeGreaterThanOrEqual(400);
    expect(
      new Set(rastreados.map((f) => f.split("/")[0])).size,
      "a varredura ficou presa a um diretório",
    ).toBeGreaterThanOrEqual(3);

    expect(
      culpados,
      `\n${culpados.join("\n")}\n\n` +
        "Este repositório é PÚBLICO. Uma cadeia com forma de chave só pode estar\n" +
        "aqui se for obviamente um exemplo — e o teste de 'obviamente' é o próprio\n" +
        "valor conter `EXEMPLO`.\n\n" +
        "Se o valor for real: NÃO basta apagar o arquivo. O que já foi commitado\n" +
        "continua no histórico, e o que vale é ROTACIONAR a chave no painel do\n" +
        "Supabase. Depois disso, tire do arquivo e use uma fixture com `EXEMPLO`.",
    ).toEqual([]);
    /**
     * Prazo declarado porque este bloco sobe `git ls-files`. O padrão do Vitest
     * são 5 s, e `prazoDeSubprocesso.test.ts` cobra — com razão: numa máquina
     * de CI disputada 5 s já produziu vermelho sem causa nesta base.
     */
  }, 30_000);

  it("o detector reconhece as cinco formas", () => {
    /**
     * Provado em cadeia sintética, e não pela varredura: hoje o repositório
     * está limpo, então a varredura passa sem exercitar nenhum dos padrões. Uma
     * guarda cujo detector nunca dispara é uma guarda não conferida.
     */
    /**
     * As fixtures são MONTADAS em tempo de execução, e o motivo é concreto.
     *
     * Escritas como literal, o push foi RECUSADO: a proteção de push do GitHub
     * reconheceu `sbp_` seguido de 40 hexadecimais como "Supabase Personal
     * Access Token" e barrou o commit inteiro — sem se importar que o valor era
     * obviamente sintético, o que é o comportamento conservador certo.
     *
     *     remote: - Push cannot contain secrets
     *     remote:   —— Supabase Personal Access Token ——
     *     remote:     path: src/test/nenhumSegredoCommitado.test.ts:169
     *
     * Havia o atalho de abrir a URL de desbloqueio que a mensagem oferece.
     * Desbloquear uma varredura de segredos para fazer passar a fixture da
     * guarda ANTI-SEGREDO é trocar a proteção pela aparência dela — e seria uma
     * decisão de segurança tomada em nome de quem não foi perguntado.
     *
     * Montando em pedaços, o literal nunca existe no arquivo: nem a proteção do
     * GitHub o vê, nem a varredura desta própria guarda — que lê texto de
     * arquivo —, e o detector continua recebendo a cadeia completa em memória,
     * que é o que precisa ser exercitado.
     *
     * É a mesma lição que o cabeçalho de `prazoDeSubprocesso` registra sobre
     * manter as fixtures fora dos `it`: a guarda não pode tropeçar na própria
     * amostra.
     */
    const hex = "0123456789abcdef";
    const casos: [string, string][] = [
      ["sbp_", `sbp${"_"}${hex}${hex}0123456789`],
      ["sb_secret_", `sb${"_"}secret${"_"}${hex}${hex}`],
      ["sb_publishable_", `sb${"_"}publishable${"_"}${hex}${hex}`],
      [
        "JWT de três segmentos",
        `ey${"J"}0eXAiOiJKV1QiLCJhbA.ey${"J"}yb2xlIjoic2VydmljZV9yb2xl.${hex}`,
      ],
      ["cabeçalho de JWT (eyJhbGciOi…)", `ey${"J"}hbGciOiJIUzI1NiJ9`],
    ];
    for (const [nomeEsperado, valor] of casos) {
      const achados = chavesNoTexto(`const k = "${valor}";`);
      expect(
        achados.map((a) => a.forma.nome),
        `o detector não viu a forma \`${nomeEsperado}\``,
      ).toContain(nomeEsperado);
      expect(eExemplo(valor), "um valor real não pode passar por exemplo").toBe(false);
    }
  });

  it("exemplo evidente passa — guarda que pune quem fez certo é desligada", () => {
    const exemplo = "sb_publishable_EXEMPLO_NAO_E_CHAVE_REAL_00";
    expect(chavesNoTexto(`k="${exemplo}"`).length, "o detector precisa VER o exemplo")
      .toBeGreaterThan(0);
    expect(eExemplo(exemplo), "o exemplo foi tratado como chave real").toBe(true);
    // E minúsculo também, porque ninguém vai lembrar da caixa.
    expect(eExemplo("sb_publishable_exemplo_qualquer_coisa_0000")).toBe(true);
  });

  it("texto comum não vira falso vermelho", () => {
    /**
     * Os vizinhos perigosos: um identificador que começa com `sb`, uma palavra
     * curta parecida com JWT, e uma menção ao FORMATO sem valor nenhum — que é
     * o que os cabeçalhos desta base fazem o tempo todo ao explicar a regra.
     */
    for (const inocente of [
      "const sbp = 1; const sb_secretario = nome;",
      "o token de gestão tem prefixo `sbp_` e a chave secreta `sb_secret_`",
      "eyJ é o começo de todo JWT em base64",
      'import { supabase } from "@/integrations/supabase/client";',
    ]) {
      expect(chavesNoTexto(inocente), `acusou texto inocente: ${inocente}`).toEqual([]);
    }
  });
});
