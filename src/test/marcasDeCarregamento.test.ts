/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * O verificador de rotas espera as animações que SIGNIFICAM "carregando" — e
 * não espera as outras.
 *
 * ## O defeito, e o comentário que o escondia
 *
 * `scripts/rotas-renderizam.mjs` existe porque uma versão anterior relatava
 * "60 de 61 renderizaram" medindo o `index.html`. Consertado, passou a esperar
 * o spinner sair — e o comentário afirmava, com todas as letras:
 *
 *   > "O spinner é a marca visual do projeto para 'carregando' — tanto o
 *   >  fallback de rota quanto o das telas usam a mesma classe."
 *
 * Não usam. O fallback de rota é `<Suspense fallback={<PageSkeleton …/>}>`, e o
 * `PageSkeleton` é feito de `<Skeleton>`, que é `animate-pulse`. Nenhum
 * `.animate-spin` aparece ali. A espera nunca disparava, e o verificador media
 * o ESQUELETO.
 *
 * ## O que foi medido, nas 61 rotas contra o preview
 *
 *   · **18 rotas** tinham o texto crescendo depois de o esqueleto sair: o
 *     script media 1237 caracteres — invólucro, menu, rodapé e banner de
 *     cookies, idênticos em todas — e a página real tinha de 3 640 a 13 120.
 *     `/privacidade`: 1237 → 13 120. `/aprender`: 1237 → 7 026;
 *   · **0 rotas** deixaram de limpar `animate-pulse` em 12 s, então esperar por
 *     ele não produz falso vermelho. Espera máxima: 213 ms;
 *   · e o veredito de uma rota estava errado: `/auth/callback` era contada como
 *     "renderizou a tela pedida" sendo um redirecionamento para `/auth/login`.
 *     O script media antes de o redirecionamento acontecer.
 *
 * ## A regra, e a regra INVERSA que me corrigiu
 *
 * A primeira versão desta guarda cobrava "toda classe `animate-*` do fallback
 * está na lista de espera". Ela reprovou, apontando `animate-fade-in` — e tinha
 * razão em apontar e estava errada em exigir.
 *
 * `animate-fade-in` é entrada, não carregamento: `fade-in 0.4s ease-out`, uma
 * vez, e a classe FICA no elemento depois. Medido em quatro rotas, 5 s após
 * abrir: `animate-fade*` = 1 elemento em todas, `pulse` e `spin` = 0. Esperar
 * por ela nunca terminaria — falso vermelho em 61 de 61 rotas.
 *
 * Então são duas regras, e a segunda é a que importa mais:
 *
 *   A. toda animação **infinita** do fallback está entre as marcas esperadas —
 *      senão o verificador mede a tela enquanto o esqueleto está lá;
 *   B. nenhuma animação **de uma vez** está entre elas — senão a espera não
 *      termina e toda rota vira "ainda carregando".
 *
 * A distinção é mecânica: `infinite` na definição da animação. O que não se
 * consegue classificar entra numa lista de NÃO CONFERIDO que precisa estar
 * vazia — "não sei" não é "está tudo bem".
 *
 * ## O que esta guarda NÃO garante
 *
 * Que o verificador meça a tela certa — disso cuida o próprio script. E ela
 * olha UM nível de importação a partir do componente de fallback (ele e os
 * primitivos de `components/ui` que ele traz). Um esqueleto montado três
 * camadas abaixo escapa; está escrito para ninguém supor alcance que não existe.
 */

const APP = "src/App.tsx";
const VERIFICADOR = "scripts/rotas-renderizam.mjs";
const TAILWIND = "tailwind.config.ts";

/**
 * As animações do Tailwind que rodam para sempre, e não estão no config do
 * projeto porque vêm do próprio Tailwind.
 *
 * Fonte: `tailwindcss/src/public/default-theme` — `animate-spin`,
 * `animate-ping`, `animate-pulse` e `animate-bounce` são todas `infinite`.
 */
const INFINITAS_DO_TAILWIND = new Set(["spin", "ping", "pulse", "bounce"]);

/**
 * Classes de animação de um texto.
 *
 * `[a-z0-9-]+` e não `[a-z]+`: a primeira versão capturava `animate-fade` de
 * `animate-fade-in`, porque `\b` depois de `[a-z]+` casa no hífen. Nome errado
 * é guarda apontando para coisa que não existe.
 */
export function classesDeAnimacao(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\banimate-([a-z0-9-]+)/g)].map((m) => m[1]))];
}

/** O componente que o `App.tsx` usa como fallback de Suspense de rota. */
export function componenteDeFallback(appTsx: string): string | null {
  return /<Suspense\s+fallback=\{\s*<(\w+)/.exec(appTsx)?.[1] ?? null;
}

/** Os caminhos de `@/components/...` que um arquivo importa. */
export function importesDeComponentes(texto: string): string[] {
  return [...texto.matchAll(/from\s+"@\/components\/([\w/.-]+)"/g)]
    .map((m) => `src/components/${m[1]}.tsx`);
}

/**
 * A animação roda para sempre? `null` quando não se consegue dizer.
 *
 * Três estados de propósito: esperar por uma animação de uma vez travaria o
 * verificador, e não esperar por uma infinita o faria medir esqueleto. Chutar
 * qualquer um dos dois lados é pior que relatar que não se sabe.
 */
export function eInfinita(nome: string, tailwindConfig: string): boolean | null {
  if (INFINITAS_DO_TAILWIND.has(nome)) return true;
  // No config do projeto: `"pulse-soft": "pulse-soft 2.5s ease-in-out infinite"`
  const linha = new RegExp(`["']${nome}["']\\s*:\\s*["']([^"']+)["']`).exec(tailwindConfig);
  if (!linha) return null;
  return /\binfinite\b/.test(linha[1]);
}

/** Tira comentários de um arquivo JS/TS, preservando as quebras de linha. */
function semComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1) => p1);
}

describe("as marcas de carregamento que o verificador de rotas espera", () => {
  const app = readFileSync(APP, "utf8");
  const verificadorCru = readFileSync(VERIFICADOR, "utf8");
  /**
   * Sem comentários, e o motivo é imediato: o próprio script EXPLICA num
   * comentário o que ele deixou de fazer, citando `conteudoDoRoot === 0`. A
   * primeira versão desta guarda casou com essa explicação e reprovou o
   * conserto. Guarda que lê comentário não confere código — oitava vez nesta
   * base, e a primeira em que eu plantei a armadilha e caí nela no mesmo dia.
   */
  const verificador = semComentarios(verificadorCru);
  const tailwind = readFileSync(TAILWIND, "utf8");

  /** As animações que o fallback de rota realmente usa, com a classificação. */
  const doFallback = (() => {
    const nome = componenteDeFallback(app);
    if (nome === null) return null;
    const arquivo = `src/components/${nome}.tsx`;
    if (!existsSync(arquivo)) return null;
    const texto = readFileSync(arquivo, "utf8");
    const fontes = [arquivo];
    for (const dep of importesDeComponentes(texto)) if (existsSync(dep)) fontes.push(dep);
    const classes = [...new Set(fontes.flatMap((f) => classesDeAnimacao(readFileSync(f, "utf8"))))];
    return { nome, fontes, classes };
  })();

  const esperadas =
    /const MARCAS_DE_CARREGAMENTO\s*=\s*\[([^\]]*)\]/.exec(verificador)?.[1] ?? "";

  it("o `App.tsx` usa um componente de fallback que existe", () => {
    // Sem isto, a varredura abaixo não teria o que ler e passaria por vazio —
    // que é o jeito mais limpo de uma guarda não guardar nada.
    expect(componenteDeFallback(app), "não achei `<Suspense fallback={<...}>` no App.tsx")
      .not.toBeNull();
    expect(doFallback, "o componente de fallback não existe em src/components").not.toBeNull();
    expect(
      doFallback!.classes.length,
      `nenhuma classe \`animate-*\` saiu de ${doFallback!.fontes.join(", ")}`,
    ).toBeGreaterThanOrEqual(1);
    expect(esperadas.trim().length, "não achei `MARCAS_DE_CARREGAMENTO` no verificador")
      .toBeGreaterThan(0);
  });

  it("toda animação que não termina é classificável — nenhuma fica no escuro", () => {
    const naoSei = doFallback!.classes.filter((c) => eInfinita(c, tailwind) === null);
    expect(
      naoSei,
      `\n  ${naoSei.map((c) => `· animate-${c}`).join("\n  ")}\n\n` +
        "⚠️ NÃO CONFERIDO — não achei a definição destas animações nem entre as\n" +
        "infinitas do Tailwind nem no `tailwind.config.ts`, então não sei se elas\n" +
        "terminam.\n\n" +
        "Chutar os dois lados custa: esperar por uma que não termina travaria o\n" +
        "verificador em TODA rota; não esperar por uma infinita o faria medir o\n" +
        "esqueleto, que foi o defeito original.",
    ).toEqual([]);
  });

  it("A) toda animação INFINITA do fallback está entre as marcas esperadas", () => {
    const infinitas = doFallback!.classes.filter((c) => eInfinita(c, tailwind) === true);
    expect(
      infinitas.length,
      "o fallback não tem animação infinita nenhuma — ou ele mudou, ou a leitura quebrou",
    ).toBeGreaterThanOrEqual(1);

    const faltando = infinitas.filter((c) => !esperadas.includes(`animate-${c}`));
    expect(
      faltando,
      `\n  ${faltando.map((c) => `· .animate-${c}`).join("\n  ")}\n\n` +
        `O fallback de rota (${doFallback!.nome}) usa estas animações que rodam para\n` +
        "sempre, e o verificador de rotas não espera por elas: ele mede a tela\n" +
        "ENQUANTO o esqueleto está lá, e aprova o invólucro como se fosse a página.\n\n" +
        "Medido quando isto aconteceu: 18 das 61 rotas eram medidas pelo esqueleto,\n" +
        "com 1237 caracteres idênticos, e a página real tinha até 13 120. Uma delas,\n" +
        "`/auth/callback`, era contada como renderizada sendo um redirecionamento.\n\n" +
        `Acrescente \`.animate-${faltando[0] ?? "x"}\` em MARCAS_DE_CARREGAMENTO, em ${VERIFICADOR}.`,
    ).toEqual([]);
  });

  it("B) nenhuma animação DE UMA VEZ está entre as marcas esperadas", () => {
    /**
     * A regra que me corrigiu. `animate-fade-in` é `fade-in 0.4s ease-out`:
     * roda uma vez e a classe FICA no elemento. Medido em quatro rotas, 5 s
     * após abrir: `animate-fade*` = 1 em todas, `pulse` e `spin` = 0.
     *
     * Esperando por ela, `esperarATela` nunca retornaria e as 61 rotas virariam
     * "ainda carregando depois de 12s". Falso vermelho custa igual ao falso
     * verde: guarda que pune quem fez certo é guarda que alguém desliga.
     */
    const deUmaVez = doFallback!.classes.filter((c) => eInfinita(c, tailwind) === false);
    const indevidas = deUmaVez.filter((c) => esperadas.includes(`animate-${c}`));
    expect(
      indevidas,
      `\n  ${indevidas.map((c) => `· .animate-${c}`).join("\n  ")}\n\n` +
        "Estas animações rodam UMA vez e a classe fica no elemento. Esperar por\n" +
        "elas não termina nunca: toda rota passa a ser relatada como 'ainda\n" +
        "carregando', e o verificador deixa de dizer qualquer coisa sobre o site.\n\n" +
        "Tire de MARCAS_DE_CARREGAMENTO: ali só entra animação `infinite`.",
    ).toEqual([]);
  });

  it("a espera usa a lista, e não uma classe escrita à mão", () => {
    /**
     * A lista existir e ninguém consultá-la seria pior que não existir: as
     * regras acima ficariam verdes sobre uma espera que continua olhando só o
     * spinner. É a mesma distinção entre declarar e cumprir que esta base cobra
     * do `aplicar()` e do `ipDoChamador()`.
     */
    const corpo = /async function esperarATela\(([\s\S]*?)\n\}/.exec(verificador)?.[1] ?? "";
    expect(corpo.length, "não achei o corpo de `esperarATela`").toBeGreaterThan(50);
    expect(corpo, "`esperarATela` não consulta MARCAS_DE_CARREGAMENTO")
      .toMatch(/MARCAS_DE_CARREGAMENTO/);
    expect(
      corpo,
      "`esperarATela` voltou a procurar uma classe fixa em vez da lista",
    ).not.toMatch(/querySelector\(\s*["'`]\.animate-/);
  });

  it("o limiar de tela vazia é o compartilhado, não uma segunda régua", () => {
    /**
     * O verificador tinha `conteudoDoRoot === 0` — "reprova só se não houver
     * NADA" —, mais frouxo que o `pareceVazia()` de `scripts/lib/chromium.mjs`
     * (`elementos < 10 || texto < 50`) e cego para a contagem de elementos.
     *
     * Medido antes de trocar, nas 61 rotas e depois de o esqueleto sair: menor
     * valor 237 caracteres e 28 elementos. A troca não mudou veredito nenhum —
     * só tirou a segunda régua de circulação.
     */
    expect(verificador, "o verificador não usa mais `pareceVazia()`").toMatch(/\bpareceVazia\(/);
    expect(
      verificador,
      "voltou a decidir tela vazia por conta própria, com `=== 0`",
    ).not.toMatch(/conteudoDoRoot\s*===\s*0/);
  });

  it("`eInfinita` separa os dois casos, e diz quando não sabe", () => {
    // As contraprovas da classificação, que é o coração das duas regras.
    expect(eInfinita("pulse", tailwind), "`animate-pulse` do Tailwind é infinita").toBe(true);
    expect(eInfinita("spin", tailwind)).toBe(true);
    expect(eInfinita("fade-in", tailwind), "`fade-in 0.4s ease-out` roda uma vez").toBe(false);
    expect(eInfinita("pulse-soft", tailwind), "declarada `infinite` no config").toBe(true);
    expect(eInfinita("inventada-por-mim", tailwind), "não sei não pode virar false").toBeNull();
  });
});
