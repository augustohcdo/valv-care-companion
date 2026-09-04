// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * Guarda: a tela do paciente não pode servir conteúdo do médico.
 *
 * ## O defeito que ela fecha
 *
 * `/app/paciente/aprender` promete, no próprio cabeçalho, "linguagem cuidadosa"
 * — e servia `src/data/clinicalLibrary.ts`, a biblioteca escrita para o
 * cardiologista. O paciente logado lia "Indicação Classe I", "IIa B no
 * assintomático de risco baixo", "DSVE indexado > 25 mm/m²". Não era conteúdo
 * errado: era conteúdo certo para o leitor errado.
 *
 * ## Por que a varredura é transitiva
 *
 * Trocar o import na página resolveria hoje e reabriria amanhã: bastaria um
 * componente compartilhado — um cartão, um bloco de "referências" — importar a
 * biblioteca para o texto voltar à tela do paciente sem que nenhuma página
 * mencionasse `clinicalLibrary`. Então a guarda segue o grafo de imports a
 * partir de cada rota `/app/paciente/*` declarada em `src/App.tsx`, e reprova se
 * alcançar qualquer fonte de conteúdo do médico.
 *
 * As rotas saem do `App.tsx`, não de um padrão de nome de arquivo: quem criar
 * `NovaTelaDoPaciente.tsx` fora do padrão `Paciente*` entra na varredura assim
 * mesmo, porque o que a define é a rota que o usuário abre.
 */

const APP = "src/App.tsx";

/** Arquivos de conteúdo endereçados ao médico. Nenhum pode ser alcançado. */
const FONTES_DO_MEDICO = [
  "src/data/clinicalLibrary.ts",
  "src/data/diretriz2025.ts",
];

/** `const Nome = lazy(() => import("./caminho"))` */
function componentesDeclarados(fonte: string): Map<string, string> {
  const mapa = new Map<string, string>();
  const re = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']/g;
  for (const m of fonte.matchAll(re)) mapa.set(m[1], m[2]);
  // Também os imports estáticos de página, se houver.
  const est = /import\s+(\w+)\s+from\s+["'](\.[^"']+)["']/g;
  for (const m of fonte.matchAll(est)) mapa.set(m[1], m[2]);
  return mapa;
}

/** Componentes que aparecem em `<Route path="/app/paciente...">`. */
function componentesDasRotasDoPaciente(fonte: string): string[] {
  const nomes = new Set<string>();
  for (const linha of fonte.split("\n")) {
    if (!/path="\/app\/paciente/.test(linha)) continue;
    for (const m of linha.matchAll(/<(\w+)\s*\/?>/g)) {
      // `ProtectedRoute` e `Route` são estrutura, não conteúdo.
      if (m[1] === "Route" || m[1] === "ProtectedRoute") continue;
      nomes.add(m[1]);
    }
  }
  return [...nomes];
}

const EXTENSOES = [".tsx", ".ts", "/index.tsx", "/index.ts"];

/** Resolve um especificador de import para um caminho dentro de `src/`. */
function resolver(deArquivo: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = relative(process.cwd(), resolve(dirname(deArquivo), spec));
  else return null; // pacote de node_modules
  for (const ext of EXTENSOES) {
    if (existsSync(base + ext)) return base + ext;
  }
  return existsSync(base) ? base : null;
}

/** Todos os arquivos de `src/` alcançáveis a partir das raízes dadas. */
function fecho(raizes: string[]): Map<string, string[]> {
  const visto = new Map<string, string[]>(); // arquivo -> caminho até ele
  const fila: { arquivo: string; trilha: string[] }[] = raizes.map((r) => ({
    arquivo: r,
    trilha: [r],
  }));
  while (fila.length) {
    const { arquivo, trilha } = fila.shift()!;
    if (visto.has(arquivo)) continue;
    visto.set(arquivo, trilha);
    const fonte = readFileSync(arquivo, "utf8");
    const specs = [
      ...fonte.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g),
    ].map((m) => m[1]);
    for (const spec of specs) {
      const alvo = resolver(arquivo, spec);
      if (alvo) fila.push({ arquivo: alvo, trilha: [...trilha, alvo] });
    }
  }
  return visto;
}

const fonteApp = readFileSync(APP, "utf8");
const declarados = componentesDeclarados(fonteApp);
const nomesDoPaciente = componentesDasRotasDoPaciente(fonteApp);
const raizes = nomesDoPaciente
  .map((n) => declarados.get(n))
  .filter((s): s is string => !!s)
  .map((s) => resolver(APP, s))
  .filter((a): a is string => !!a);

const alcancavel = fecho(raizes);

describe("as telas do paciente e o conteúdo do médico", () => {
  // Sem esta conferência, um `App.tsx` renomeado zeraria as raízes e o teste
  // passaria varrendo nada — que é exatamente a falha que esta sessão persegue.
  it("encontra as rotas do paciente para varrer", () => {
    expect(
      nomesDoPaciente.length,
      "nenhuma rota /app/paciente encontrada em App.tsx — a varredura não teria o que fazer",
    ).toBeGreaterThanOrEqual(10);
    expect(
      raizes.length,
      `rotas achadas: ${nomesDoPaciente.join(", ")}; arquivos resolvidos: ${raizes.length}`,
    ).toBe(nomesDoPaciente.length);
    expect(raizes).toContain("src/pages/app/PacienteAprender.tsx");
    expect(raizes).toContain("src/pages/app/PacienteAprenderDetalhe.tsx");
  });

  it.each(FONTES_DO_MEDICO)("não alcança %s", (fonteDoMedico) => {
    const trilha = alcancavel.get(fonteDoMedico);
    expect(
      trilha,
      trilha
        ? `Conteúdo escrito para o cardiologista chega à tela do paciente por:\n  ${trilha.join("\n  → ")}\n\n` +
          "O conteúdo de paciente está em src/data/patientContent.ts."
        : "",
    ).toBeUndefined();
  });
});

/**
 * Recorta os tópicos do array `patientTopics`, cada um com o intervalo de
 * linhas que ocupa. O glossário e o FAQ, exportados no mesmo arquivo, ficam de
 * fora: são páginas públicas, não a tela do paciente logado.
 */
function topicosComLinhas(): { slug: string; texto: string; linha: number }[] {
  const linhas = readFileSync("src/data/patientContent.ts", "utf8").split("\n");
  const inicio = linhas.findIndex((l) => l.startsWith("export const patientTopics"));
  const fim = linhas.findIndex((l, i) => i > inicio && l === "];");
  const marcos: { slug: string; linha: number }[] = [];
  for (let i = inicio; i < fim; i++) {
    const m = linhas[i].match(/^\s{4}slug:\s*"([^"]+)"/);
    if (m) marcos.push({ slug: m[1], linha: i });
  }
  return marcos.map((marco, i) => ({
    slug: marco.slug,
    linha: marco.linha + 1,
    texto: linhas.slice(marco.linha, marcos[i + 1]?.linha ?? fim).join("\n"),
  }));
}

describe("o texto que o paciente lê", () => {
  const topicos = topicosComLinhas();

  /**
   * ## Notação de conduta — proibida em todo lugar
   *
   * Classe e Nível são a gramática de uma ORDEM a um clínico. Não têm leitura
   * possível para quem não conhece a escala, e transformam uma conversa em
   * veredito. Foi o que a tela do paciente serviu até esta rodada.
   */
  const NOTACAO_DE_CONDUTA: [string, RegExp][] = [
    ["Classe de recomendação", /\bClasse\s+(I{1,3}|IV)\b/],
    ["Classe IIa/IIb", /\bII[ab]\b/],
    ["nível de evidência", /\bNível\s+[ABC]\b/],
  ];

  it.each(NOTACAO_DE_CONDUTA)("não traz %s em tópico nenhum", (_rotulo, padrao) => {
    const achados = topicos
      .flatMap((t) =>
        t.texto
          .split("\n")
          .map((l, i) => ({ t, l, n: t.linha + i }))
          .filter(({ l }) => padrao.test(l)),
      )
      .map(({ t, l, n }) => `${t.slug} (patientContent.ts:${n}): ${l.trim()}`);
    expect(achados.join("\n"), "notação de conduta no conteúdo do paciente").toBe("");
  });

  /**
   * ## Jargão de medida — permitido só onde o assunto é o próprio jargão
   *
   * A primeira versão desta guarda proibia DSVE, FEVE, cm²/m² e escore de risco
   * em qualquer lugar, e reprovou três tópicos legítimos. Estava errada: o
   * defeito nunca foi a palavra, foi a palavra SEM explicação, entregue como
   * instrução. "DSVE é o diâmetro no fim da sístole" é o oposto disso — é
   * justamente o serviço que a categoria "aprofundamento" promete prestar
   * ("para você conversar de igual para igual com sua equipe").
   *
   * Então o jargão fica restrito aos tópicos cujo trabalho declarado é
   * explicá-lo. Aparecer em outro tópico reprova — porque ali ele chegaria
   * solto, no meio de um texto que não o define.
   */
  const JARGAO: [string, RegExp][] = [
    ["DSVE/DDVE", /\bD[SD]VE\b/],
    ["FEVE", /\bFEVE\b/],
    ["medida indexada", /(mm|cm²|mL)\/m²/],
    ["escore de risco cirúrgico", /STS-PROM|EuroSCORE/],
  ];

  /** Tópicos que existem para traduzir o vocabulário técnico ao paciente. */
  const ONDE_O_JARGAO_E_O_ASSUNTO = ["entendendo-laudo-eco", "perguntas-heart-team"];

  it.each(JARGAO)("só usa %s onde o tópico explica o termo", (_rotulo, padrao) => {
    const fora = topicos
      .filter((t) => !ONDE_O_JARGAO_E_O_ASSUNTO.includes(t.slug))
      .filter((t) => padrao.test(t.texto))
      .map((t) => `${t.slug} (patientContent.ts:${t.linha})`);
    expect(
      fora.join(", "),
      "jargão técnico em tópico que não o define — o paciente lê a sigla sem tradução",
    ).toBe("");
  });

  it("os tópicos da lista de exceção existem e realmente usam o jargão", () => {
    // Sem isto, um slug renomeado esvaziaria a exceção sem ninguém notar, e a
    // permissão continuaria de pé cobrindo nada.
    for (const slug of ONDE_O_JARGAO_E_O_ASSUNTO) {
      const t = topicos.find((x) => x.slug === slug);
      expect(t, `${slug} não existe mais em patientTopics`).toBeDefined();
      expect(
        JARGAO.some(([, padrao]) => padrao.test(t!.texto)),
        `${slug} não usa mais jargão — tire-o da lista de exceção`,
      ).toBe(true);
    }
  });

  it("reconhece a notação quando ela existe", () => {
    // Contraprova: sem isto, um padrão que nunca casa passaria como aprovação.
    expect(/\bClasse\s+(I{1,3}|IV)\b/.test("Indicação Classe I para troca")).toBe(true);
    expect(/\bII[ab]\b/.test("recomendação IIa B")).toBe(true);
    expect(/\bClasse\s+(I{1,3}|IV)\b/.test("classe de aula")).toBe(false);
    expect(/\bD[SD]VE\b/.test("o DSVE ultrapassa 50 mm")).toBe(true);
  });

  it("varre todos os tópicos, e não um pedaço do arquivo", () => {
    expect(topicos.length).toBeGreaterThanOrEqual(38);
    expect(topicos.map((t) => t.slug)).toContain("estenose-aortica");
    expect(topicos.map((t) => t.slug)).toContain("perguntas-heart-team");
    // O glossário exporta `{ term: "FEVE" }` e fica fora do recorte de propósito.
    expect(topicos.some((t) => /term:\s*"FEVE"/.test(t.texto))).toBe(false);
  });
});

describe("os endereços dos tópicos do paciente", () => {
  it("não repete slug", () => {
    const conteudo = readFileSync("src/data/patientContent.ts", "utf8");
    const slugs = [...conteudo.matchAll(/^\s{4}slug:\s*"([^"]+)"/gm)].map((m) => m[1]);
    expect(slugs.length, "nenhum slug encontrado — o formato do arquivo mudou").toBeGreaterThan(30);
    const repetidos = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    expect(
      [...new Set(repetidos)].join(", "),
      "slug repetido: as duas fichas apontam para o mesmo endereço e `find` só devolve a primeira, " +
        "então a segunda nunca abre o texto que promete",
    ).toBe("");
  });
});
