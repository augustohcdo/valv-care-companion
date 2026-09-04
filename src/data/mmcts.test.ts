import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TUTORIAIS, SEM_TUTORIAL, MMCTS, urlDoTutorial, tutoriaisDoTopico } from "./mmcts";
import { clinicalLibrary } from "./clinicalLibrary";

/**
 * A forma dos links do MMCTS, conferida sem rede.
 *
 * O `scripts/conferir-mmcts.mjs` abre cada página e compara o título — e por
 * isso fica fora da CI, como o `conferir-pmids.mjs`: depende do servidor da
 * EACTS estar no ar, e a CI não deve quebrar por causa disso.
 *
 * O que dá para cobrar offline é o resto, e não é pouco: que todo tópico da
 * biblioteca esteja resolvido (com tutorial ou com motivo escrito para não ter),
 * que nenhum id se repita, e que nenhum tutorial aponte para um tópico que não
 * existe — este último é o erro que passa despercebido, porque o link fica
 * cadastrado e simplesmente nunca aparece em tela nenhuma.
 */

const SLUGS = new Set(clinicalLibrary.map((t) => t.slug));

describe("tutoriais do MMCTS", () => {
  it("todo tutorial aponta para um tópico que existe na biblioteca", () => {
    // Sem isto, um slug com erro de digitação vira link órfão: cadastrado,
    // conferido pelo guarda de rede, e invisível para sempre.
    const orfaos = TUTORIAIS.filter((t) => !SLUGS.has(t.topico));
    expect(
      orfaos.map((t) => `${t.id} → "${t.topico}"`),
      "tutorial apontando para tópico inexistente",
    ).toEqual([]);
  });

  it("todo tópico da biblioteca está resolvido: tem tutorial, ou tem motivo", () => {
    // O terceiro estado de sempre. Tópico sem tutorial e sem motivo é
    // indistinguível de esquecimento.
    const semDestino = [...SLUGS].filter(
      (s) => tutoriaisDoTopico(s).length === 0 && !SEM_TUTORIAL[s],
    );
    expect(
      semDestino,
      "tópico sem tutorial e sem motivo escrito para não ter",
    ).toEqual([]);
  });

  it("o motivo de não ter tutorial é escrito, não um rótulo", () => {
    for (const [slug, motivo] of Object.entries(SEM_TUTORIAL)) {
      expect(SLUGS.has(slug), `${slug} não é tópico da biblioteca`).toBe(true);
      expect(motivo.length, `${slug}: motivo curto demais para ser decisão`).toBeGreaterThan(60);
    }
  });

  it("nenhum id repetido, e todo título é substantivo", () => {
    expect(new Set(TUTORIAIS.map((t) => t.id)).size).toBe(TUTORIAIS.length);
    for (const t of TUTORIAIS) {
      expect(t.titulo.length, `${t.id}: título curto demais para ter vindo da página`).toBeGreaterThan(15);
      expect(t.porque.length, `${t.id}: sem justificativa de estar neste tópico`).toBeGreaterThan(25);
    }
  });

  it("a URL é montada do id, e não digitada", () => {
    // Endereço escrito à mão diverge do id no primeiro ajuste, e aí o guarda de
    // rede confere uma página e a tela abre outra.
    expect(urlDoTutorial(76)).toBe("https://mmcts.org/tutorial/76");
    expect(readFileSync("src/data/mmcts.ts", "utf8"), "há URL digitada à mão entre os tutoriais")
      .not.toMatch(/"https:\/\/mmcts\.org\/tutorial\//);
  });

  it("a fonte declara acesso aberto e a data em que foi conferida", () => {
    // O MMCTS é aberto — é o que permite linkar sem barreira. Se um dia deixar
    // de ser, esta linha é onde a mudança fica visível.
    expect(MMCTS.issn).toBe("1813-9175");
    expect(MMCTS.acesso).toMatch(/aberto/);
    expect(MMCTS.conferidoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
