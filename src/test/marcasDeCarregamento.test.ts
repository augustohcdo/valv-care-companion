/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

/**
 * O verificador de rotas espera o fallback de rota SAIR — e nada além dele.
 *
 * ## Quatro versões desta espera, e os quatro jeitos de errar
 *
 * 1ª — não esperava nada: media o `index.html`.
 *
 * 2ª — esperava `.animate-spin`, com o comentário afirmando que "tanto o
 *      fallback de rota quanto o das telas usam a mesma classe". Falso: o
 *      fallback de rota é `<Suspense fallback={<PageSkeleton …/>}>`, feito de
 *      `<Skeleton>`, que é `animate-pulse`. A espera nunca disparava e o
 *      verificador media o ESQUELETO — 18 das 61 rotas com 1237 caracteres de
 *      invólucro, contra páginas de 3 640 a 13 120.
 *
 * 3ª — esperava as duas classes. **Minha regressão, e o erro foi de método.**
 *      Eu medi "0 de 61 rotas mantêm o esqueleto depois de 12 s" e concluí que
 *      era seguro. A amostra excluía todas as telas autenticadas: sem sessão,
 *      as 39 rotas de `/app/*` redirecionam para o login e nunca foram
 *      medidas. E `animate-pulse` é ENFEITE em quatro lugares — três em
 *      `PacienteHome` e `MedicoHome`, um blob de `animationDuration: 6s` e dois
 *      pontinhos —, que são exatamente as duas telas da prova de sessão.
 *
 *      Em produção: `/app/paciente ficou 15s no spinner`, sobre uma tela que
 *      renderiza. O número estava certo sobre o que mediu e errado sobre o uso
 *      que eu fiz dele: medir 61 rotas não é medir as rotas que importam.
 *
 * 4ª — esta. Classe de animação não distingue "estou carregando" de "sou
 *      decorativo", então a espera passa a olhar um ATRIBUTO dedicado que só o
 *      fallback de rota carrega: `data-carregando`.
 *
 * ## As regras
 *
 *   A. o fallback de rota carrega a marca que o verificador espera;
 *   B. a marca é EXCLUSIVA do fallback — nenhum outro arquivo de `src/` a usa,
 *      senão enfeite volta a envenenar a espera pelo caminho novo;
 *   C. toda CLASSE na lista de espera foi conferida como só-de-carregamento, e
 *      a conferência está escrita;
 *   D. a espera consulta a lista, e não uma classe fixa;
 *   E. o limiar de tela vazia é o compartilhado, não uma segunda régua.
 *
 * ## O que esta guarda NÃO garante
 *
 * Que o verificador meça a tela certa — disso cuida o próprio script. E ela não
 * olha telas autenticadas, que é justamente onde a 3ª versão falhou: para isso
 * existe o `rotas-autenticadas.yml`, que cunha sessão e varre de verdade. Uma
 * guarda que lê arquivo não substitui a que abre o navegador.
 */

const APP = "src/App.tsx";
const VERIFICADOR = "scripts/rotas-renderizam.mjs";
const MARCA = "data-carregando";

/**
 * Classes que o verificador pode esperar, cada uma com a conferência escrita.
 *
 * Acrescentar uma classe aqui obriga a dizer por que ela significa "carregando"
 * e nada mais. Foi a falta disso que deixou `animate-pulse` entrar.
 */
const CLASSES_CONFERIDAS: Record<string, string> = {
  "animate-spin":
    "92 ocorrências em `src/`, todas `Loader2` dentro de estado de carregamento " +
    "— inclusive a do `ProtectedRoute`, que é o que a prova de sessão precisa " +
    "esperar. Nenhuma decorativa.",
};

/** O componente que o `App.tsx` usa como fallback de Suspense de rota. */
export function componenteDeFallback(appTsx: string): string | null {
  return /<Suspense\s+fallback=\{\s*<(\w+)/.exec(appTsx)?.[1] ?? null;
}

/**
 * Os seletores dentro de `MARCAS_DE_CARREGAMENTO`.
 *
 * Ancorado no `];` e não em `[^\]]*`: a lista contém `"[data-carregando]"`, e
 * um `[^\]]*` para no `]` de DENTRO da string, devolvendo só o primeiro
 * seletor. Foi o que aconteceu, e a guarda reprovou dizendo que o verificador
 * não espera pela marca — sobre um verificador que espera.
 *
 * Mesma classe de erro que esta base já pagou três vezes no mesmo arquivo de
 * `prazoDeSubprocesso`: delimitador contado sem olhar se está dentro de string.
 */
export function marcasEsperadas(verificador: string): string[] {
  const lista = /const MARCAS_DE_CARREGAMENTO\s*=\s*\[([\s\S]*?)\]\s*;/.exec(verificador)?.[1] ?? "";
  return [...lista.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

/** Tira comentários, preservando as quebras de linha. */
function semComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1) => p1);
}

const app = readFileSync(APP, "utf8");
/**
 * Sem comentários: o próprio script EXPLICA, em comentário, as classes que
 * deixou de esperar e por quê. Uma guarda que lê comentário não confere código
 * — foi a oitava vez nesta base, e a primeira em que eu plantei a armadilha e
 * caí nela no mesmo dia.
 */
const verificador = semComentarios(readFileSync(VERIFICADOR, "utf8"));
const esperadas = marcasEsperadas(verificador);

describe("as marcas de carregamento que o verificador de rotas espera", () => {
  it("A) o fallback de rota carrega a marca que o verificador espera", () => {
    const nome = componenteDeFallback(app);
    expect(nome, "não achei `<Suspense fallback={<...}>` no App.tsx").not.toBeNull();
    const arquivo = `src/components/${nome}.tsx`;
    expect(existsSync(arquivo), `${arquivo} não existe`).toBe(true);

    /**
     * SEM comentários, e a inversão me cobrou isto na hora: o próprio
     * `PageSkeleton` EXPLICA no docstring por que carrega `data-carregando`.
     * Lendo o arquivo cru, tirar o atributo das quatro variantes não reprovava
     * — a menção no comentário satisfazia a regra.
     *
     * Nona vez nesta base que uma guarda lê comentário em vez de código, e a
     * segunda no mesmo dia em que fui eu quem plantou a armadilha.
     */
    const fallback = semComentarios(readFileSync(arquivo, "utf8"));
    expect(
      fallback,
      `o fallback de rota (${nome}) não carrega \`${MARCA}\`. Sem a marca o ` +
        "verificador não tem como saber que o conteúdo da rota ainda não chegou, e " +
        "volta a medir o esqueleto — 1237 caracteres de invólucro em 18 das 61 rotas.",
    ).toContain(MARCA);
    expect(
      esperadas,
      `o verificador não espera por \`[${MARCA}]\``,
    ).toContain(`[${MARCA}]`);
  });

  it("B) a marca é exclusiva do fallback — enfeite não a carrega", () => {
    /**
     * A regra que a 3ª versão não tinha. `animate-pulse` entrou na espera e
     * travou a prova de sessão porque a mesma classe serve o esqueleto E um
     * blob decorativo. Com um atributo dedicado isso não acontece — desde que
     * ele continue dedicado.
     */
    const nome = componenteDeFallback(app)!;
    const doFallback = `src/components/${nome}.tsx`;
    const arquivos = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
      .trim().split("\n")
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith("src/test/"));

    const intrusos = arquivos
      .filter((f) => f !== doFallback)
      // Também sem comentários: um arquivo que MENCIONA a marca para explicar a
      // regra não a carrega. Punir quem documentou é o falso vermelho que esta
      // base já pagou meia dúzia de vezes.
      .filter((f) => semComentarios(readFileSync(f, "utf8")).includes(MARCA));

    expect(arquivos.length, "a varredura não achou arquivo nenhum").toBeGreaterThanOrEqual(200);
    expect(
      intrusos.map((f) => `  · ${f}`),
      `\n${intrusos.map((f) => `  · ${f}`).join("\n")}\n\n` +
        `\`${MARCA}\` só pode existir no fallback de rota (${doFallback}).\n` +
        "Fora dele, a espera do verificador passa a travar em qualquer elemento que\n" +
        "carregue a marca — que é exatamente o que aconteceu com `animate-pulse`,\n" +
        "usado como enfeite em `PacienteHome` e `MedicoHome`, as duas telas da\n" +
        "prova de sessão.",
    ).toEqual([]);
  }, 30_000);

  it("C) toda CLASSE esperada foi conferida como só-de-carregamento", () => {
    const classes = esperadas.filter((s) => s.startsWith("."));
    expect(classes.length, "nenhuma classe na lista — a leitura quebrou?")
      .toBeGreaterThanOrEqual(1);

    const semConferencia = classes
      .map((s) => s.slice(1))
      .filter((c) => !(c in CLASSES_CONFERIDAS));
    expect(
      semConferencia.map((c) => `  · .${c}`),
      `\n${semConferencia.map((c) => `  · .${c}`).join("\n")}\n\n` +
        "Esta classe entrou na lista de espera sem conferência escrita. Antes de\n" +
        "acrescentar uma, conte os usos dela em `src/` e diga por que TODOS\n" +
        "significam carregamento.\n\n" +
        "`animate-pulse` entrou sem isso e travou a prova de sessão em produção:\n" +
        "é a animação do `<Skeleton>` e também de um blob decorativo de 6 s em\n" +
        "`PacienteHome` e `MedicoHome`.",
    ).toEqual([]);
  });

  it("C.2) `animate-pulse` NÃO é esperada, e o motivo continua valendo", () => {
    expect(
      esperadas,
      "`animate-pulse` voltou para a lista de espera. Ela é a animação do " +
        "`<Skeleton>` E de elementos decorativos: esperar por ela faz a espera " +
        "nunca terminar nas telas que têm enfeite.",
    ).not.toContain(".animate-pulse");

    // E o motivo é medido, não lembrado: se um dia não houver mais enfeite com
    // essa classe, esta contagem cai e a exclusão pode ser revista com dado.
    const decorativos = execFileSync(
      "git", ["grep", "-l", "animate-pulse", "--", "src/pages", "src/components"],
      { encoding: "utf8" },
    ).trim().split("\n").filter((f) => f && !f.endsWith("ui/skeleton.tsx"));
    expect(
      decorativos.length,
      "nenhum uso decorativo de `animate-pulse` foi achado — a premissa da " +
        "exclusão mudou, e vale remedir antes de confiar nela",
    ).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it("D) a espera consulta a lista, e não uma classe fixa", () => {
    const corpo = /async function esperarATela\(([\s\S]*?)\n\}/.exec(verificador)?.[1] ?? "";
    expect(corpo.length, "não achei o corpo de `esperarATela`").toBeGreaterThan(50);
    expect(corpo, "`esperarATela` não consulta MARCAS_DE_CARREGAMENTO")
      .toMatch(/MARCAS_DE_CARREGAMENTO/);
    expect(
      corpo,
      "`esperarATela` voltou a procurar uma classe fixa em vez da lista",
    ).not.toMatch(/querySelector\(\s*["'`]\./);
  });

  it("E) o limiar de tela vazia é o compartilhado, não uma segunda régua", () => {
    /**
     * Era `conteudoDoRoot === 0` — "reprova só se não houver NADA" —, mais
     * frouxo que o `pareceVazia()` de `scripts/lib/chromium.mjs`
     * (`elementos < 10 || texto < 50`) e cego para a contagem de elementos.
     *
     * Medido nas 61 rotas depois de o esqueleto sair: menor valor 237
     * caracteres e 28 elementos. A troca não mudou veredito nenhum.
     */
    expect(verificador, "o verificador não usa mais `pareceVazia()`").toMatch(/\bpareceVazia\(/);
    expect(
      verificador,
      "voltou a decidir tela vazia por conta própria, com `=== 0`",
    ).not.toMatch(/conteudoDoRoot\s*===\s*0/);
  });
});
