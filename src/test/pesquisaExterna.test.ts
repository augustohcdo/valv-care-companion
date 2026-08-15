import { describe, it, expect } from "vitest";
import {
  hostDe, permitida, limparTexto, termoDeBusca, blocoDePesquisa,
} from "../../supabase/functions/_shared/pesquisaExterna";
import type {
  FonteConfiavel, ArtigoEncontrado,
} from "../../supabase/functions/_shared/pesquisaExterna";

/**
 * A parte que decide **onde** a IA pode olhar é pura, e é aqui que ela é
 * provada. A rede em si (PubMed, leitura de página) é exercitada contra os
 * serviços reais, fora do CI — mas o porteiro roda a cada push, porque é ele
 * que separa "pesquisa em fonte confiável" de "pesquisa na internet".
 */

const fontes: FonteConfiavel[] = [
  {
    domain: "abccardiol.org", name: "Arquivos Brasileiros de Cardiologia",
    category: "sociedade_medica",
    citable_for: "Diretriz brasileira de valvopatias.", never_for: null,
  },
  {
    domain: "pubmed.ncbi.nlm.nih.gov", name: "PubMed", category: "literatura",
    citable_for: "Artigos indexados, com PMID, periódico e ano.",
    never_for: "Resumo não é recomendação de diretriz.",
  },
  {
    domain: "www.edwards.com", name: "Edwards Lifesciences", category: "fabricante",
    citable_for: "Especificação técnica do próprio produto.",
    never_for: "Nunca para indicação nem comparação entre marcas.",
  },
];

describe("permitida", () => {
  it("aceita o domínio da lista e um subdomínio dele", () => {
    expect(permitida("https://abccardiol.org/artigo/123", fontes)?.name)
      .toBe("Arquivos Brasileiros de Cardiologia");
    expect(permitida("https://arquivos.abccardiol.org/x", fontes)?.category)
      .toBe("sociedade_medica");
  });

  it("recusa domínio de fora", () => {
    expect(permitida("https://blog-de-cardiologia.com/tavi", fontes)).toBeNull();
  });

  /**
   * O erro clássico de quem compara domínio com `includes`. Este endereço
   * contém "abccardiol.org" e pertence a outra pessoa — e seria justamente o
   * formato usado por quem quisesse passar conteúdo falso como se fosse da SBC.
   */
  it("recusa domínio que apenas contém o permitido", () => {
    expect(permitida("https://abccardiol.org.exemplo-falso.com/x", fontes)).toBeNull();
    expect(permitida("https://naoabccardiol.org/x", fontes)).toBeNull();
  });

  it("recusa URL inválida em vez de estourar", () => {
    expect(permitida("nao é uma url", fontes)).toBeNull();
    expect(hostDe("///")).toBeNull();
  });

  it("não se confunde com maiúsculas", () => {
    expect(permitida("https://ABCCardiol.ORG/artigo", fontes)).not.toBeNull();
  });
});

describe("termoDeBusca", () => {
  it("traduz valva e lesão para o vocabulário da literatura", () => {
    expect(termoDeBusca({ valveType: "aortica", valveDisease: "estenose" }))
      .toBe("aortic valve stenosis");
    expect(termoDeBusca({ valveType: "mitral", valveDisease: "insuficiencia" }))
      .toBe("mitral valve regurgitation");
  });

  /**
   * O defeito que só apareceu medindo contra o PubMed de verdade. A
   * E-utilities faz AND entre os termos e indexa em inglês, então **uma**
   * palavra em português zera a busca:
   *
   *   "aortic valve stenosis TAVI low risk"    → 689 resultados
   *   "aortic valve stenosis TAVI baixo risco" →   0 resultados
   *
   * Mandar a pergunta crua faria a pesquisa externa responder "não encontrei
   * literatura" em toda consulta, para sempre, parecendo funcionar.
   */
  it("não deixa palavra em português entrar na busca", () => {
    const t = termoDeBusca({
      valveType: "aortica", valveDisease: "estenose",
      pergunta: "TAVI versus cirurgia em paciente de baixo risco: o que a literatura mostra?",
    });
    expect(t).not.toMatch(/paciente|literatura|versus|mostra/);
    expect(t).toContain("aortic valve stenosis");
  });

  it("traduz o que sabe traduzir e mantém a sigla que o médico escreveu", () => {
    const t = termoDeBusca({
      valveType: "aortica", valveDisease: "estenose",
      pergunta: "TAVI em baixo risco cirúrgico",
    });
    expect(t).toContain("TAVI");
    expect(t).toContain("low");
    expect(t).toContain("risk");
    expect(t).toContain("surgical");
  });

  it("aceita acento e caixa como o médico digita", () => {
    const t = termoDeBusca({ pergunta: "anticoagulação em prótese mecânica" });
    expect(t).toContain("anticoagulation");
    expect(t).toContain("prosthesis");
    expect(t).toContain("mechanical");
  });

  it("sigla solta que não é termo de busca fica de fora", () => {
    // "DR" e "SP" aparecem em pergunta e não são conceito indexado.
    const t = termoDeBusca({ valveType: "mitral", valveDisease: "estenose", pergunta: "Dr, e no SP?" });
    expect(t).toBe("mitral valve stenosis");
  });

  it("limita quantos termos da pergunta entram", () => {
    // Cada termo vira um AND; pergunta longa produziria conjunção que não casa
    // com artigo nenhum — o mesmo zero por outro caminho.
    const t = termoDeBusca({
      valveType: "aortica", valveDisease: "estenose",
      pergunta: "baixo alto risco cirurgia protese mecanica idoso gestante sobrevida mortalidade desfecho",
    });
    expect(t.split(" ").length).toBeLessThanOrEqual(3 + 8);
  });

  it("aguenta caso sem valva registrada e pergunta sem termo conhecido", () => {
    expect(termoDeBusca({})).toBe("");
    expect(termoDeBusca({ pergunta: "e aí, tudo certo?" })).toBe("");
  });
});

describe("limparTexto", () => {
  it("tira marcação e normaliza espaço", () => {
    expect(limparTexto("<b>Estenose</b>   a&oacute;rtica<i>grave</i>"))
      .toBe("Estenose a&oacute;rtica grave");
  });

  it("resolve as entidades comuns do XML do PubMed", () => {
    expect(limparTexto("gradiente &gt; 40 mmHg &amp; AVA &lt; 1,0"))
      .toBe("gradiente > 40 mmHg & AVA < 1,0");
  });
});

describe("blocoDePesquisa", () => {
  const artigo = (over: Partial<ArtigoEncontrado> = {}): ArtigoEncontrado => ({
    pmid: "34453165", titulo: "2021 ESC/EACTS Guidelines for valvular heart disease",
    revista: "European Heart Journal", ano: "2022",
    tipos: ["Journal Article", "Guideline"],
    resumo: "Recomendações para o manejo da doença valvar cardíaca.".repeat(3),
    url: "https://pubmed.ncbi.nlm.nih.gov/34453165/",
    ...over,
  });

  it("vazio quando não achou nada — sem bloco fantasma no prompt", () => {
    expect(blocoDePesquisa([], fontes)).toBe("");
  });

  it("carrega periódico, ano, tipo e PMID de cada achado", () => {
    const b = blocoDePesquisa([artigo()], fontes);
    expect(b).toContain("European Heart Journal");
    expect(b).toContain("2022");
    expect(b).toContain("Guideline");
    expect(b).toContain("PMID 34453165");
  });

  /**
   * O que impede a camada externa de virar diretriz. Sem esta linha no prompt,
   * um resumo de série de casos chegaria ao médico com o mesmo peso de uma
   * recomendação Classe I.
   */
  it("declara no prompt o que a literatura pode e o que não pode embasar", () => {
    const b = blocoDePesquisa([artigo()], fontes);
    expect(b).toContain("PODE EMBASAR");
    expect(b).toContain("Resumo não é recomendação de diretriz");
  });

  it("marca a literatura como camada distinta da base ValvePath", () => {
    expect(blocoDePesquisa([artigo()], fontes)).toContain("distinta da base ValvePath");
  });
});
