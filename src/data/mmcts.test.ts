import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  TUTORIAIS, SEM_TUTORIAL, MMCTS, urlDoTutorial, tutoriaisDoTopico,
  PROCEDIMENTOS, ORDEM_DOS_PROCEDIMENTOS, GESTO_DA_RECOMENDACAO,
  tutoriaisDoProcedimento, tutoriaisDaConduta, tutoriaisParaProtese,
  procedimentosDaValvopatia,
} from "./mmcts";
import { clinicalLibrary } from "./clinicalLibrary";
import { DIRETRIZ_2025 } from "./diretriz2025";
import { getRecommendations } from "@/lib/guidelines";

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

/**
 * A segunda organização dos mesmos vídeos: por OPERAÇÃO.
 *
 * A biblioteca pergunta "que doença é esta"; a tela de técnica, o detalhe do
 * caso e o catálogo perguntam "que operação é esta". As duas leituras têm de
 * cobrir os mesmos 17 tutoriais — um vídeo que exista só numa delas some da
 * outra sem ninguém notar.
 */
describe("tutoriais por procedimento", () => {
  it("todo tutorial tem ao menos um gesto, e todo gesto declarado existe", () => {
    for (const t of TUTORIAIS) {
      expect(t.procedimentos.length, `${t.id} sem procedimento`).toBeGreaterThan(0);
      for (const p of t.procedimentos) {
        expect(PROCEDIMENTOS[p], `${t.id} aponta para procedimento inexistente: ${p}`).toBeDefined();
      }
    }
  });

  it("a tela por operação mostra os 17, sem repetir nem perder nenhum", () => {
    // A soma dos grupos pode passar de 17 (um vídeo de operação combinada entra
    // em mais de um), mas o conjunto tem de ser exatamente o mesmo.
    const vistos = new Set(
      ORDEM_DOS_PROCEDIMENTOS.flatMap((c) => tutoriaisDoProcedimento(c)).map((t) => t.id),
    );
    expect([...vistos].sort(), "vídeo cadastrado que nenhuma operação mostra").toEqual(
      TUTORIAIS.map((t) => t.id).sort(),
    );
  });

  it("todo procedimento declarado é usado por algum vídeo", () => {
    // Grupo vazio viraria seção vazia na tela — ou, pior, uma promessa de
    // cobertura que não existe.
    for (const chave of ORDEM_DOS_PROCEDIMENTOS) {
      expect(
        tutoriaisDoProcedimento(chave).length,
        `${chave} não tem nenhum vídeo — tire-o de PROCEDIMENTOS ou cadastre um`,
      ).toBeGreaterThan(0);
    }
    expect(ORDEM_DOS_PROCEDIMENTOS.sort()).toEqual(Object.keys(PROCEDIMENTOS).sort());
  });
});

describe("a ligação com a conduta sugerida", () => {
  it("toda chave de GESTO_DA_RECOMENDACAO existe na diretriz", () => {
    // Esta é a que protege contra o erro silencioso: uma chave renomeada em
    // `diretriz2025.ts` faria o link sumir da tela do caso sem nada reprovar.
    const inexistentes = Object.keys(GESTO_DA_RECOMENDACAO).filter(
      (k) => !(k in DIRETRIZ_2025),
    );
    expect(inexistentes, "gesto ligado a recomendação que não existe mais").toEqual([]);
  });

  it("o motor devolve a chave junto da recomendação", () => {
    // Sem `chave`, `tutoriaisDaConduta` não teria o que casar e devolveria
    // vazio para todo caso — a ligação inteira viraria enfeite.
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      nyha: "III", mean_gradient: 50, vmax_m_s: 4.5,
    });
    expect(recs.some((r) => r.chave), "nenhuma recomendação trouxe a chave da diretriz").toBe(true);
  });

  it("estenose aórtica grave sintomática oferece a troca aórtica", () => {
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "critica",
      nyha: "III", mean_gradient: 50, vmax_m_s: 4.5,
    });
    const tutoriais = tutoriaisDaConduta(recs.map((r) => r.chave));
    expect(tutoriais.length).toBeGreaterThan(0);
    expect(tutoriais.every((t) => t.procedimentos.includes("troca-aortica"))).toBe(true);
  });

  it("paciente em vigilância não recebe vídeo de técnica", () => {
    // O ponto do bloco ser discreto: quem não tem indicação de operar não vê a
    // sugestão de operação de esguelha, por um link.
    const recs = getRecommendations({
      valve_type: "aortica", valve_disease: "estenose", severity: "moderada",
      nyha: "I", symptoms: ["Assintomático"],
    });
    expect(tutoriaisDaConduta(recs.map((r) => r.chave))).toEqual([]);
  });

  it("as valvopatias com caso clínico têm gesto mapeado", () => {
    for (const par of [
      ["aortica", "estenose"], ["aortica", "insuficiencia"],
      ["mitral", "estenose"], ["mitral", "insuficiencia"], ["mitral", "prolapso"],
      ["tricuspide", "insuficiencia"], ["multipla", "mista"],
    ]) {
      expect(
        procedimentosDaValvopatia(par[0], par[1]).length,
        `${par.join(":")} sem procedimento`,
      ).toBeGreaterThan(0);
    }
    expect(procedimentosDaValvopatia("pulmonar", "estenose")).toEqual([]);
  });
});

describe("a ligação com o catálogo de próteses", () => {
  it("bioprótese e mecânica aórticas caem na troca aórtica", () => {
    for (const tipo of ["biologica_aortica", "mecanica"]) {
      const achado = tutoriaisParaProtese(tipo, "aortica");
      expect(achado?.procedimento, `${tipo}/aortica`).toBe("troca-aortica");
    }
  });

  it("anel de anuloplastia cai na plástica, não na troca", () => {
    expect(tutoriaisParaProtese("anel_anuloplastia", "mitral")?.procedimento).toBe("plastica-mitral");
    expect(tutoriaisParaProtese("anel_anuloplastia", "tricuspide")?.procedimento)
      .toBe("plastica-tricuspide");
  });

  it("combinação sem vídeo conferido não recebe o vídeo da vizinha", () => {
    // Prótese mecânica em posição tricúspide: não há tutorial de troca
    // tricúspide na lista. Oferecer o da mitral seria dizer, por link, uma
    // coisa que ninguém conferiu.
    expect(tutoriaisParaProtese("mecanica", "tricuspide")).toBeNull();
    expect(tutoriaisParaProtese("biologica_aortica", "pulmonar")).toBeNull();
  });

  it("nenhum vídeo é oferecido como sendo de um modelo", () => {
    // A ressalva não pode virar decoração: o rótulo do procedimento é sobre o
    // gesto, e nenhum título de tutorial nomeia um produto do catálogo.
    const marcas = /Perimount|Inspiris|Epic|Mosaic|Hancock|Trifecta|Avalus|Magna|Braile|Labcor/i;
    const comMarca = TUTORIAIS.filter((t) => marcas.test(t.titulo));
    expect(comMarca.map((t) => t.titulo), "tutorial nomeando um modelo de prótese").toEqual([]);
  });
});
