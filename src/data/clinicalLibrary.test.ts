import { describe, it, expect } from "vitest";
import { clinicalLibrary } from "./clinicalLibrary";
import { DIRETRIZ_2025 } from "./diretriz2025";

/**
 * A biblioteca não pode ensinar o que a ferramenta não faz.
 *
 * Este arquivo existe por um defeito real e publicado: o motor de conduta
 * (`src/lib/guidelines.ts`) passou para a ESC/EACTS 2025 enquanto a biblioteca
 * continuou em 2021. O médico via os dois na mesma sessão — a ferramenta
 * calculando por uma diretriz e o texto ao lado ensinando outra.
 *
 * Duas afirmações não estavam apenas velhas, estavam **erradas** em 2025:
 *
 *   · "indicação: EA sintomática ou FEVE < 50%" omitia a recomendação IIa A de
 *     intervir no assintomático, que é a mudança central da diretriz nova;
 *   · "FEVE ≤ 55%" aparecia como indicação cirúrgica na insuficiência aórtica.
 *     Em 2025 isso é **IIb**, e só com risco cirúrgico baixo; a Classe I é
 *     ≤ 50%. Tratar as duas como a mesma coisa manda para a cirurgia um paciente
 *     que a diretriz manda apenas considerar.
 *
 * O que se cobra aqui não é a redação — é que a afirmação superada não volte e
 * que a nova esteja presente.
 */

const topico = (slug: string) => {
  const t = clinicalLibrary.find((g) => g.slug === slug);
  if (!t) throw new Error(`tópico ${slug} não existe`);
  return t;
};

/**
 * As afirmações do tópico, uma a uma — **não concatenadas**.
 *
 * A primeira versão deste arquivo juntava tudo num texto só e procurava
 * palavras. Passou na inversão: apagar a recomendação nova de 2025 não reprovou
 * nada, porque "IIa" aparece cinco vezes no mesmo tópico e "teste de esforço",
 * duas. Presença de vocabulário não é presença de afirmação.
 *
 * Separadas, dá para exigir que UMA frase carregue a afirmação inteira.
 */
const afirmacoesDe = (slug: string): string[] => {
  const t = topico(slug);
  return [
    t.summary,
    ...t.keyPoints,
    ...t.sections.flatMap((s) => [s.heading, s.body ?? "", ...(s.bullets ?? [])]),
  ].filter(Boolean);
};

/** Existe UMA afirmação que casa com todos os pedaços? */
const afirma = (slug: string, ...partes: RegExp[]) =>
  afirmacoesDe(slug).some((a) => partes.every((r) => r.test(a)));

const textoDe = (slug: string) => afirmacoesDe(slug).join(" \n ");

describe("a biblioteca acompanha a diretriz de 2025", () => {
  it("estenose aórtica: a mudança central de 2025 está ensinada, numa frase só", () => {
    // A recomendação IIa A: intervir no assintomático como ALTERNATIVA à
    // vigilância. As quatro condições têm de estar na mesma afirmação — soltas
    // pelo tópico, elas não ensinam a regra, só espalham as palavras.
    expect(
      afirma("estenose-aortica", /IIa/, /assintom/i, /teste de esforço/i, /alternativa à vigilância/i),
      "nenhuma afirmação traz a IIa A de 2025 completa (assintomático + teste de esforço + alternativa à vigilância)",
    ).toBe(true);
  });

  it("estenose aórtica: o corte de idade é 70, e não o 75 de 2021", () => {
    const texto = textoDe("estenose-aortica");
    expect(texto).toMatch(/70 anos/);
    // O 75 pode aparecer, mas só dizendo que era o valor ANTIGO.
    const menciona75 = /75 anos/.test(texto);
    if (menciona75) {
      expect(texto, "cita 75 anos sem dizer que é o valor de 2021").toMatch(/(era|2021)[^.]*75 anos|75 anos[^.]*2021/);
    }
  });

  it("insuficiência aórtica: 55% não é apresentada como Classe I", () => {
    // O erro mais perigoso da versão anterior, porque empurra para a cirurgia um
    // paciente que a diretriz manda apenas considerar.
    expect(
      afirma("insuficiencia-aortica", /Classe I/, /≤\s*50\s*%/),
      "nenhuma afirmação diz que a Classe I é FEVE ≤ 50%",
    ).toBe(true);
    // Onde 55% aparecer, a MESMA frase tem de dizer que é IIb.
    for (const a of afirmacoesDe("insuficiencia-aortica")) {
      if (/55\s*%/.test(a)) {
        expect(a, "afirmação cita 55% sem marcar que é IIb").toMatch(/IIb/);
      }
    }
  });

  it("estenose mitral: o DOAC é contraindicação, não controvérsia", () => {
    const texto = textoDe("estenose-mitral");
    expect(
      afirma("estenose-mitral", /DOAC/i, /não (é|e) recomendado|Classe III|III B/i),
      "nenhuma afirmação diz, junto, que se trata de DOAC e que ele não é recomendado",
    ).toBe(true);
    expect(texto, "ainda trata a contraindicação como assunto controverso")
      .not.toMatch(/controverso/i);
  });

  it("os limiares citados batem com o arquivo da diretriz", () => {
    // Amarra a biblioteca à MESMA fonte que o motor usa. Se a diretriz for
    // corrigida em `diretriz2025.ts`, a divergência aparece aqui.
    const ea = textoDe("estenose-aortica");
    for (const n of DIRETRIZ_2025.eaAssintomaticaCriterioAdicional.limiares ?? []) {
      const alvo = String(n).replace(".", ",");
      expect(ea, `o limiar ${alvo} da IIa B não aparece no texto`).toContain(alvo);
    }
  });
});

describe("as referências da biblioteca são conferíveis", () => {
  it("toda referência tem PubMed, ou diz por que não tem", () => {
    // O terceiro estado de sempre. Referência sem link e sem motivo é
    // indistinguível de referência que ninguém conferiu.
    const soltas: string[] = [];
    for (const t of clinicalLibrary) {
      for (const r of t.references) {
        if (!r.url && !r.nota) soltas.push(`${t.slug}: ${r.citacao.slice(0, 60)}`);
      }
    }
    expect(soltas, "referência sem link e sem motivo escrito").toEqual([]);
  });

  it("todo link é do PubMed, para o npm run pmids alcançar", () => {
    // O guarda varre `src/` procurando `pubmed.ncbi.nlm.nih.gov/<pmid>`. Link de
    // outro domínio fica cadastrado e fora da conferência — que é pior do que
    // não ter link, porque parece conferido.
    for (const t of clinicalLibrary) {
      for (const r of t.references) {
        if (r.url) {
          expect(r.url, `${t.slug}: link fora do PubMed escapa do guarda`)
            .toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
        }
      }
    }
  });

  it("todo tópico cita a diretriz de 2025", () => {
    for (const t of clinicalLibrary) {
      const cita = t.references.some((r) => /2025 ESC\/EACTS|ESC Guidelines for the management of endocarditis/.test(r.citacao));
      expect(cita, `${t.slug} não cita a diretriz vigente`).toBe(true);
    }
  });
});
