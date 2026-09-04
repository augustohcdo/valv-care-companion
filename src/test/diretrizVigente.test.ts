// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DIRETRIZ_2025 } from "@/data/diretriz2025";

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

/** Linha de comentário: documentação do histórico, não texto que o usuário lê. */
const ehComentario = (l: string) => /^\s*(\/\/|\/\*|\*|--)/.test(l);

/**
 * A marca que torna a menção honesta. Basta uma delas na linha.
 *
 * `insuficiência cardíaca` está aqui porque a ESC 2021 de IC é OUTRO documento,
 * que continua vigente: `guidelines.ts` a cita ao recomendar otimizar o
 * tratamento da IC, e essa citação está certa.
 */
const MARCA_DE_SUPERADA =
  /superad|históric|substituíd|até 2025|antes de 2025|insuficiência cardíaca|o que mudou/i;

describe("nenhuma parte do produto fala pela diretriz antiga", () => {
  const EDICOES_ANTIGAS: [string, RegExp][] = [
    ["ESC 2021 / ESC-EACTS 2021", /\bESC(\/EACTS)?\s*2021\b|\b2021\s*ESC\b/],
    ["SBC 2020", /\bSBC\s*2020\b/],
  ];

  it.each(EDICOES_ANTIGAS)("%s só aparece marcada como superada", (_rotulo, padrao) => {
    const achados: string[] = [];
    for (const arquivo of TODOS) {
      readFileSync(arquivo, "utf8").split("\n").forEach((linha, i) => {
        if (!padrao.test(linha)) return;
        if (ehComentario(linha)) return;
        if (MARCA_DE_SUPERADA.test(linha)) return;
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
        readFileSync(arquivo, "utf8").split("\n").forEach((linha, i) => {
          if (ehComentario(linha)) return;
          if (MARCA_DE_SUPERADA.test(linha)) return;
          // ACC/AHA tem números próprios, e citá-los com o nome da fonte é
          // correto — o defeito é o número solto passando por vigente.
          if (/ACC|AHA/.test(linha)) return;
          if (!alvo.tema.test(linha)) return;
          if (!citaONumero(linha, alvo.obsoleto)) return;
          achados.push(`${arquivo}:${i + 1}: ${linha.trim().slice(0, 140)}`);
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

describe("duas edições da mesma diretriz no mesmo arquivo", () => {
  const PARES: [string, RegExp, RegExp][] = [
    ["SBC", /\bSBC\s*2020\b/, /\bSBC\s*2024\b/],
    ["ESC/EACTS valvar", /\bESC(\/EACTS)?\s*2021\b/, /\bESC\/EACTS\s*2025\b/],
  ];

  it.each(PARES)("%s não é citada em duas edições fora de comentário", (_rotulo, antiga, nova) => {
    const achados: string[] = [];
    for (const arquivo of TODOS) {
      const texto = readFileSync(arquivo, "utf8").split("\n")
        .filter((l) => !ehComentario(l) && !MARCA_DE_SUPERADA.test(l))
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
