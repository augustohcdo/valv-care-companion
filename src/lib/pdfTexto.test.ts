import { describe, it, expect } from "vitest";
import { juntarItens, proporcaoLegivel, resumirExtracao } from "./pdfTexto";

/**
 * A extração em si depende do pdf.js e de um navegador — está provada por
 * script separado, contra um PDF de verdade. O que se testa aqui é a parte
 * pura, e ela guarda as duas decisões que sustentam o resto:
 * a página numerada (senão a citação perde precisão) e a recusa de obra
 * escaneada (senão sobe um arquivo que parece certo e está vazio).
 */

describe("juntarItens", () => {
  it("separa os fragmentos em vez de grudar palavras", () => {
    // O pdf.js devolve pedaços posicionados, não linhas. Emendar direto
    // produziria "gradientemédio", que quebra busca e leitura.
    expect(juntarItens([{ str: "gradiente" }, { str: "médio" }, { str: "48 mmHg" }])).toBe(
      "gradiente médio 48 mmHg",
    );
  });

  it("normaliza espaço em excesso e item vazio", () => {
    expect(juntarItens([{ str: "  FE  " }, { str: "" }, { str: " 42 % " }])).toBe("FE 42 %");
  });

  it("aguenta item sem `str`", () => {
    expect(juntarItens([{}, { str: "ok" }])).toBe("ok");
  });
});

describe("resumirExtracao", () => {
  const pagina = (n: number, texto: string) => ({ n, texto });

  it("conta páginas e caracteres", () => {
    const r = resumirExtracao([pagina(1, "a".repeat(500)), pagina(2, "b".repeat(300))]);
    expect(r.totalPaginas).toBe(2);
    expect(r.caracteres).toBe(800);
    expect(r.semTextoLegivel).toBe(false);
  });

  it("acusa obra escaneada, em vez de deixar subir arquivo vazio", () => {
    // Digitalização de imagem devolve string vazia em toda página. Se isso
    // passasse, o resultado seria um JSON com a cara certa e nada dentro.
    const r = resumirExtracao([pagina(1, ""), pagina(2, ""), pagina(3, "")]);
    expect(r.semTextoLegivel).toBe(true);
  });

  /**
   * O caso que só apareceu testando com PDF de verdade: a camada de texto
   * existe, tem milhares de caracteres e não decodifica. Pela contagem passaria
   * — e subiria lixo com cara de livro.
   */
  it("acusa camada de texto ilegível, que a contagem sozinha deixaria passar", () => {
    const lixo = "\ufffd:8\ufffdB\ufffd\ufffd\ufffdt~\ufffd\\nq\ufffd\ufffd\ufffd\ufffdI\ufffd)\ufffd\ufffd\ufffdh\ufffd\ufffd\ufffd/\ufffd\ufffd&\\j\u05dd\ufffdd\ufffd\ufffdy\ufffd\ufffd:";
    const r = resumirExtracao([pagina(1, lixo.repeat(20))]);
    expect(r.caracteres).toBeGreaterThan(200); // passaria pela checagem antiga
    expect(r.semTextoLegivel).toBe(true);
  });

  it("não confunde livro de texto com escaneado por causa da capa", () => {
    // A primeira página pode ser só a capa, com pouquíssimo texto. O limiar
    // olha o total, não a página.
    const r = resumirExtracao([pagina(1, "Capa"), pagina(2, "x".repeat(400))]);
    expect(r.semTextoLegivel).toBe(false);
  });

  it("preserva o número da página, que é o que sustenta a citação", () => {
    const r = resumirExtracao([pagina(1180, "estenose aórtica"), pagina(1181, "conduta")]);
    expect(r.paginas.map((p) => p.n)).toEqual([1180, 1181]);
  });
});

describe("proporcaoLegivel", () => {
  it("texto clínico em português é quase todo legível", () => {
    const t =
      "Estenose aórtica grave: gradiente médio ≥ 40 mmHg, área valvar < 1,0 cm². " +
      "Intervenção é Classe I quando há sintomas (ESC 2021).";
    expect(proporcaoLegivel(t)).toBeGreaterThan(0.9);
  });

  it("lixo de fonte quebrada fica muito abaixo do limiar", () => {
    expect(proporcaoLegivel("\ufffd:8\ufffdB\ufffd\ufffd\ufffdt~\ufffd\ufffd\ufffd\ufffdI\ufffd)\ufffd\ufffd\ufffdh\ufffd\ufffd\ufffd")).toBeLessThan(0.5);
  });

  it("string vazia é zero, não divisão por zero", () => {
    expect(proporcaoLegivel("")).toBe(0);
  });
});
