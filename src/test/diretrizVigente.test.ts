// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DIRETRIZ_2025 } from "@/data/diretriz2025";
import { clinicalLibrary } from "@/data/clinicalLibrary";

/**
 * A varredura que faltava: sobrou algum lugar ensinando a diretriz de 2021?
 *
 * ## Por que esta guarda existe
 *
 * O motor de conduta foi para a ESC/EACTS 2025 numa rodada, a biblioteca clínica
 * na seguinte, o rodapé do painel de conduta na seguinte. **Cada correção foi
 * feita à mão, mirando o que eu lembrava**, e nenhuma guarda perguntava "sobrou
 * algum?". O usuário — cardiologista — abriu a parte médica e achou o que eu não
 * tinha achado: uma seção inteira da biblioteca intitulada "Indicações de
 * intervenção (ESC 2021 / ACC 2020)", o prompt da IA mandando raciocinar por
 * 2021, e a base de trechos que a IA consulta ensinando `TAVI ≥ 75 anos`.
 *
 * Consertar aqueles cinco lugares não impede o sexto. Esta varredura impede.
 *
 * ## As três regras
 *
 * 1. **Edição afirmada como vigente.** Citar a ESC 2021 é legítimo — ela existiu,
 *    e mostrar o que mudou é justamente o que o médico pergunta. O que não pode
 *    é apresentá-la como a diretriz que vale hoje. Então toda menção em texto
 *    que chega ao usuário precisa carregar a marca de que foi superada.
 * 2. **Números que 2025 aposentou.** Nos arquivos que falam pela conduta
 *    vigente, os valores de 2021 não podem aparecer. O valor certo de cada par
 *    vem de `DIRETRIZ_2025` — não é digitado aqui, senão a guarda viraria uma
 *    terceira versão dos limiares.
 * 3. **Duas edições da mesma diretriz no mesmo arquivo**, como se ambas
 *    valessem. O prompt da IA citava "SBC 2020" numa linha e "SBC 2024" noutra.
 *
 * ## O que a guarda NÃO faz
 *
 * Não julga o conteúdo clínico — isso é a `diretriz2025.test.ts`, que amarra
 * cada número à frase citada da diretriz. Aqui se cobra só que nenhuma parte do
 * produto continue falando pela edição antiga.
 */

const RAIZES = ["src", "supabase/functions"];

function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === "dist") continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) arquivos(full, out);
    else if (/\.(tsx?|mjs)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

const TODOS = RAIZES.flatMap((r) => arquivos(r));

/**
 * O texto do arquivo com os COMENTÁRIOS apagados, preservando a numeração.
 *
 * Comentário é documentação do histórico — "esta biblioteca ficou em ESC 2021
 * enquanto o motor foi para 2025" precisa continuar escrito, e é justamente o
 * tipo de linha que explica a correção a quem vier depois.
 *
 * A primeira versão desta função olhava linha a linha procurando `//` ou `*` no
 * começo, e produziu dois falsos positivos: o comentário JSX de
 * `GuidelineRecommendations.tsx` abre com `{/*`, e suas linhas seguintes não
 * começam com nada reconhecível. Guarda que acusa código correto é guarda que
 * alguém desliga — então aqui os blocos são apagados de verdade, da abertura à
 * fechadura do comentário, e as quebras de linha ficam para os números não
 * escorregarem.
 */
function textoVisivel(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => (/^\s*(\/\/|--)/.test(l) ? "" : l))
    .join("\n");
}

/** Só para as contraprovas: a linha, isolada, é comentário? */
const ehComentario = (l: string) => textoVisivel(l).trim() === "";

/**
 * A marca que torna a menção honesta. Basta uma delas na linha.
 *
 * `insuficiência cardíaca` está aqui porque a ESC 2021 de IC é OUTRO documento,
 * que continua vigente: `guidelines.ts` a cita ao recomendar otimizar o
 * tratamento da IC, e essa citação está certa.
 *
 * O último padrão cobre a frase que ENSINA a mudança — "O corte era 75 anos em
 * 2021", "Em 2021 o gatilho era Vmax ≥ 5,5 m/s". As duas ordens contam: a
 * primeira versão exigia o verbo ANTES do ano e acusou a segunda frase, que é
 * exatamente o texto certo. Guarda sensível à ordem das palavras é guarda
 * casando com a redação em vez da garantia — o erro que já cometi nesta sessão
 * com o "esquema" da foto de prótese.
 */
const VERBO_DE_PASSADO = "(era|eram|foi|foram|entrava|entravam|usava|usavam)";
const MARCA_DE_SUPERADA = new RegExp(
  "superad|históric|substituíd|até 2025|antes de 2025|insuficiência cardíaca|o que mudou" +
    `|\\b${VERBO_DE_PASSADO}\\b[^.]*\\b2021\\b|\\b2021\\b[^.]*\\b${VERBO_DE_PASSADO}\\b`,
  "i",
);

/**
 * As frases de uma linha, avaliadas UMA A UMA.
 *
 * A primeira versão isentava a linha inteira quando qualquer parte dela
 * carregasse a marca de superada — e a inversão me pegou: pus `TAVI preferido a
 * partir de 75 anos` como recomendação vigente na MESMA linha que terminava com
 * "Em 2021 o corte era 75 anos", e a guarda ficou verde. Uma cláusula histórica
 * imunizava a afirmação errada ao lado dela.
 *
 * O bloco de limiares do prompt da IA é feito de linhas longas, com várias
 * frases cada — exatamente onde esse buraco mais custa.
 */
// Corta em ponto e em ponto-e-vírgula, NÃO em dois-pontos: dois-pontos
// introduzem a continuação da mesma ideia, e cortar ali separava "Comparado com
// o que era em 2021:" do que vinha depois — deixando a metade de trás órfã da
// moldura que a explica.
const frases = (linha: string) => linha.split(/(?<=[.;])\s+/).filter((f) => f.trim() !== "");

/**
 * A PRIMEIRA frase emoldura o resto.
 *
 * Apertar a regra para frase a frase criou o erro simétrico: um trecho da base
 * que abre com "REFERÊNCIA HISTÓRICA — esta recomendação foi SUPERADA pela
 * ESC/EACTS 2025" e depois enumera os números de 2021 passou a ser acusado,
 * frase por frase — sendo que a moldura é justamente o que o leitor lê primeiro
 * e o que vale para tudo que vem depois.
 *
 * Então: abertura histórica emoldura o trecho inteiro; marca no meio vale só
 * para a frase dela. É como um humano lê, e fecha os dois buracos.
 */
const emolduradoComoHistorico = (linha: string) =>
  MARCA_DE_SUPERADA.test(frases(linha)[0] ?? "");

/** A frase afirma a edição antiga como vigente? */
const afirmaComoVigente = (linha: string, padrao: RegExp) =>
  !emolduradoComoHistorico(linha) &&
  frases(linha).some((f) => padrao.test(f) && !MARCA_DE_SUPERADA.test(f));

describe("nenhuma parte do produto fala pela diretriz antiga", () => {
  const EDICOES_ANTIGAS: [string, RegExp][] = [
    ["ESC 2021 / ESC-EACTS 2021", /\bESC(\/EACTS)?\s*2021\b|\b2021\s*ESC\b/],
  ];

  it.each(EDICOES_ANTIGAS)("%s só aparece marcada como superada", (_rotulo, padrao) => {
    const achados: string[] = [];
    for (const arquivo of TODOS) {
      textoVisivel(readFileSync(arquivo, "utf8")).split("\n").forEach((linha, i) => {
        if (!afirmaComoVigente(linha, padrao)) return;
        achados.push(`${arquivo}:${i + 1}: ${linha.trim().slice(0, 120)}`);
      });
    }
    expect(
      achados.join("\n"),
      "edição antiga apresentada como se fosse a vigente — cite-a como superada ou troque pela 2025",
    ).toBe("");
  });

  it("reconhece a menção quando ela existe", () => {
    // Contraprova: um padrão que nunca casasse deixaria os testes acima verdes
    // com o produto inteiro em 2021.
    const p = /\bESC(\/EACTS)?\s*2021\b|\b2021\s*ESC\b/;
    expect(p.test('heading: "Indicações de intervenção (ESC 2021 / ACC 2020)"')).toBe(true);
    expect(p.test("- 2021 ESC/EACTS Guidelines for VHD")).toBe(true);
    expect(p.test("ESC/EACTS 2025")).toBe(false);
    expect(ehComentario("// a biblioteca ficou em ESC 2021")).toBe(true);
    expect(ehComentario('  section: "ESC 2021 — indicações"')).toBe(false);
  });

  it("uma cláusula histórica não absolve a afirmação errada ao lado", () => {
    // A contraprova do buraco que a inversão me mostrou: eu havia posto o
    // TAVI de volta em 75 anos como recomendação vigente, na mesma linha que
    // terminava explicando o que era em 2021, e a guarda ficou verde.
    const errada = "TAVI preferido a partir de 75 anos. Em 2021 o corte era 75 anos.";
    const certa = "TAVI a partir de 70 anos (I A). Em 2021 o corte era 75 anos.";
    const so75 = /75/;
    expect(afirmaComoVigente(errada, so75), "a linha inteira foi absolvida").toBe(true);
    expect(afirmaComoVigente(certa, so75), "a frase histórica sozinha reprovou").toBe(false);

    // E o erro simétrico: a moldura na ABERTURA vale para o trecho inteiro.
    const emoldurado =
      "REFERÊNCIA HISTÓRICA — superada pela ESC/EACTS 2025. TAVI preferido a partir de 75 anos.";
    expect(
      afirmaComoVigente(emoldurado, so75),
      "trecho aberto como histórico foi acusado frase a frase",
    ).toBe(false);
  });
});

/**
 * Os arquivos cujo texto AFIRMA a conduta vigente ao médico ou ao paciente.
 *
 * A restrição de números vale aqui, e não no repositório inteiro, de propósito:
 * "75" e "65" são números legítimos da ACC/AHA 2020, que continua sendo fonte
 * válida e corretamente atribuída. O erro não é o número existir — é ele
 * aparecer como se fosse a recomendação em vigor.
 */
const FALAM_PELA_CONDUTA = [
  "src/data/clinicalLibrary.ts",
  "src/data/patientContent.ts",
  "supabase/functions/clinical-ai/index.ts",
  "supabase/functions/knowledge-seed/index.ts",
];

/** `4` casa com "≥4.0 m/s" e não com "40 mmHg" — o mesmo detector da citação. */
function citaONumero(texto: string, n: number): boolean {
  const base = String(n).replace(".", "[.,]");
  const comZeros = Number.isInteger(n) ? `${base}([.,]0+)?` : base;
  return new RegExp(`(?<![\\d.,])${comZeros}(?![\\d.,]*\\d)`).test(texto);
}

describe("os números que a diretriz de 2025 aposentou", () => {
  /**
   * Cada par: o valor de 2021 que saiu, e a chave de `DIRETRIZ_2025` de onde
   * sai o valor que entrou. O valor vigente NÃO é digitado aqui — vem do
   * arquivo de citações, senão a guarda seria mais uma cópia dos limiares.
   */
  const APOSENTADOS = [
    {
      rotulo: "idade de corte do TAVI (2021: 75 anos)",
      tema: /TAVI/i,
      obsoleto: 75,
      chave: "eaModoTavi" as const,
    },
    {
      rotulo: "Vmax de estenose muito grave (2021: 5,5 m/s)",
      tema: /Vmax/i,
      obsoleto: 5.5,
      chave: "eaAssintomaticaCriterioAdicional" as const,
    },
  ];

  it.each(APOSENTADOS.map((a) => [a.rotulo, a] as const))(
    "%s não aparece como recomendação vigente",
    (_rotulo, alvo) => {
      // O valor vigente tem de estar mesmo citado na diretriz, senão o par
      // aponta para uma recomendação que mudou de forma e a guarda cobre nada.
      const limiares = DIRETRIZ_2025[alvo.chave].limiares ?? [];
      expect(limiares.length, `${alvo.chave} sem limiares em DIRETRIZ_2025`).toBeGreaterThan(0);
      expect(
        limiares.includes(alvo.obsoleto),
        `${alvo.obsoleto} voltou a ser um limiar de 2025 — reveja este par`,
      ).toBe(false);

      const achados: string[] = [];
      for (const arquivo of FALAM_PELA_CONDUTA) {
        textoVisivel(readFileSync(arquivo, "utf8")).split("\n").forEach((linha, i) => {
          // Frase a frase, pelo mesmo motivo: "TAVI a partir de 75 anos" não
          // pode ser absolvido por um "em 2021 o corte era 75" na mesma linha.
          if (emolduradoComoHistorico(linha)) return;
          const culpada = frases(linha).find(
            (f) =>
              !MARCA_DE_SUPERADA.test(f) &&
              // Uma frase que NOMEIA sua fonte está atribuída, e atribuição
              // correta é o que se quer: a ACC/AHA 2020 e a diretriz brasileira
              // têm cortes próprios, e citá-los com o nome da fonte não engana
              // ninguém. O defeito é o número solto, sem dono, passando por
              // vigente.
              !/ACC|AHA|SBC/.test(f) &&
              alvo.tema.test(f) &&
              citaONumero(f, alvo.obsoleto),
          );
          if (!culpada) return;
          achados.push(`${arquivo}:${i + 1}: ${culpada.trim().slice(0, 140)}`);
        });
      }
      expect(achados.join("\n"), "limiar de 2021 apresentado como vigente").toBe("");
    },
  );

  it("o detector de número distingue 5,5 de 5,55 e 75 de 750", () => {
    expect(citaONumero("Vmax ≥ 5,5 m/s", 5.5)).toBe(true);
    expect(citaONumero("Vmax ≥ 5.5 m/s", 5.5)).toBe(true);
    expect(citaONumero("valor 5,55", 5.5)).toBe(false);
    expect(citaONumero("TAVI ≥ 75 anos", 75)).toBe(true);
    expect(citaONumero("750 pacientes", 75)).toBe(false);
    expect(citaONumero("175 anos", 75)).toBe(false);
  });

  it("os arquivos que falam pela conduta existem", () => {
    // Sem isto, renomear um deles esvaziaria a exigência em silêncio.
    for (const a of FALAM_PELA_CONDUTA) {
      expect(() => statSync(a), `${a} não existe mais`).not.toThrow();
    }
  });
});

/**
 * A diretriz brasileira: só o ano que o projeto consegue apontar.
 *
 * O produto citava "SBC 2024" em seis trechos da base da IA, no prompt (como
 * FONTE PRIMÁRIA BR) e em duas páginas públicas — e "SBC 2020" em outras duas.
 * Duas buscas, uma delas restrita ao site do próprio periódico, encontram a
 * linhagem 2011 → 2017 → **2020** (Arq Bras Cardiol 2020;115(4):720-775) e
 * nenhuma edição de 2024.
 *
 * Isso não prova que a de 2024 não exista — busca não prova ausência, foi essa
 * a lição do registro ANVISA. Mas atribuir recomendação clínica a um documento
 * que não se consegue apresentar é fabricar procedência, e a direção da cautela
 * é evidente. O ano vem da citação que a biblioteca já carrega, não é digitado
 * aqui: se o projeto passar a citar outra edição, a guarda acompanha sozinha.
 */
const ANO_SBC = (() => {
  const ref = clinicalLibrary
    .flatMap((t) => t.references)
    .find((r) => /Sociedade Brasileira de Cardiologia/i.test(r.citacao));
  const ano = ref?.citacao.match(/\b(20\d\d)\b/)?.[1];
  return { ano, citacao: ref?.citacao };
})();

describe("a diretriz brasileira citada é a que o projeto consegue apontar", () => {
  it("a citação de referência existe e traz um ano", () => {
    // Sem isto, uma citação renomeada zeraria a regra abaixo em silêncio.
    expect(ANO_SBC.citacao, "nenhuma referência à SBC em clinicalLibrary").toBeTruthy();
    expect(ANO_SBC.ano, `sem ano em "${ANO_SBC.citacao}"`).toMatch(/^20\d\d$/);
  });

  it("nenhum arquivo cita a SBC com outro ano", () => {
    const achados: string[] = [];
    for (const arquivo of TODOS) {
      textoVisivel(readFileSync(arquivo, "utf8")).split("\n").forEach((linha, i) => {
        for (const m of linha.matchAll(/\bSBC\s*(20\d\d)\b|Valvopatias\s*(20\d\d)\b/g)) {
          const ano = m[1] ?? m[2];
          if (ano === ANO_SBC.ano) continue;
          achados.push(`${arquivo}:${i + 1}: cita SBC ${ano} (a referência do projeto é ${ANO_SBC.ano})`);
        }
      });
    }
    expect(
      achados.join("\n"),
      "edição da diretriz brasileira que o projeto não consegue apresentar — " +
        "atribuir recomendação a documento inencontrável é fabricar procedência",
    ).toBe("");
  });
});

describe("duas edições da mesma diretriz no mesmo arquivo", () => {
  const PARES: [string, RegExp, RegExp][] = [
    ["ESC/EACTS valvar", /\bESC(\/EACTS)?\s*2021\b/, /\bESC\/EACTS\s*2025\b/],
  ];

  it.each(PARES)("%s não é citada em duas edições fora de comentário", (_rotulo, antiga, nova) => {
    const achados: string[] = [];
    for (const arquivo of TODOS) {
      const texto = textoVisivel(readFileSync(arquivo, "utf8")).split("\n")
        .filter((l) => !MARCA_DE_SUPERADA.test(l))
        .join("\n");
      if (antiga.test(texto) && nova.test(texto)) achados.push(arquivo);
    }
    expect(
      achados.join(", "),
      "o mesmo arquivo apresenta duas edições da mesma diretriz como se ambas valessem",
    ).toBe("");
  });
});

describe("a varredura cobre o que promete", () => {
  it("enxerga os arquivos das duas raízes", () => {
    // Uma varredura que não achasse arquivo nenhum passaria com o produto
    // inteiro errado — foi assim que a guarda do MMCTS me enganou uma vez.
    expect(TODOS.length).toBeGreaterThan(150);
    expect(TODOS).toContain("src/data/clinicalLibrary.ts");
    expect(TODOS).toContain("supabase/functions/clinical-ai/index.ts");
    expect(TODOS).toContain("supabase/functions/knowledge-seed/index.ts");
  });
});
