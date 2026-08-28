import { describe, it, expect } from "vitest";
import { limparNotacaoMatematica } from "./textoDaIA";

/**
 * O caso que motivou este arquivo é o primeiro teste: veio da função publicada,
 * numa chamada real ao modo `trends` contra um caso real, e o médico lia
 * `$60\% \rightarrow 58\%$` no lugar de `60% → 58%`.
 */
describe("limpar a notação matemática da resposta da IA", () => {
  it("o texto que a IA devolveu de verdade vira legível", () => {
    const daIA = "*   **Fração de Ejeção (FEVE):** $60\\% \\rightarrow 58\\%$ em 2 meses";
    expect(limparNotacaoMatematica(daIA)).toBe(
      "*   **Fração de Ejeção (FEVE):** 60% → 58% em 2 meses",
    );
  });

  it("traduz cada símbolo que o modelo usa em prosa", () => {
    const casos: [string, string][] = [
      ["\\rightarrow", "→"], ["\\leftarrow", "←"], ["\\uparrow", "↑"], ["\\downarrow", "↓"],
      ["\\approx", "≈"], ["\\times", "×"], ["\\cdot", "·"], ["\\pm", "±"],
      ["\\leq", "≤"], ["\\geq", "≥"], ["\\neq", "≠"], ["\\%", "%"],
    ];
    for (const [entrada, esperado] of casos) {
      expect(limparNotacaoMatematica(`a ${entrada} b`), entrada).toBe(`a ${esperado} b`);
    }
  });

  it("`\\le` não é comido pelo prefixo de `\\leq`", () => {
    // A ordem da tabela importa: se `\le` viesse antes, `\leq` viraria "≤q".
    expect(limparNotacaoMatematica("AVA \\leq 1,0")).toBe("AVA ≤ 1,0");
    expect(limparNotacaoMatematica("AVA \\le 1,0")).toBe("AVA ≤ 1,0");
  });

  it("desembrulha `$...$`, `$$...$$`, `\\(...\\)` e `\\[...\\]`", () => {
    expect(limparNotacaoMatematica("GradMed $52$ mmHg")).toBe("GradMed 52 mmHg");
    expect(limparNotacaoMatematica("$$AVA = 0,8$$")).toBe("AVA = 0,8");
    expect(limparNotacaoMatematica("\\(FE 58\\)")).toBe("FE 58");
    expect(limparNotacaoMatematica("\\[FE 58\\]")).toBe("FE 58");
  });

  it("`$$x$$` não é lido como dois `$...$` vazios", () => {
    expect(limparNotacaoMatematica("$$60\\% \\rightarrow 58\\%$$")).toBe("60% → 58%");
  });

  it("tira o embrulho de `\\text{}` e mantém o conteúdo", () => {
    expect(limparNotacaoMatematica("\\text{FEVE} 58")).toBe("FEVE 58");
    expect(limparNotacaoMatematica("\\mathrm{cm}^2")).toBe("cm^2");
  });

  it("matemática de verdade fica intacta — não transforma pela metade", () => {
    // Uma fração LaTeX transformada por regex viraria número errado dentro de
    // conteúdo clínico, que é muito pior que uma barra invertida na tela.
    const fracao = "$\\frac{EOA}{BSA}$";
    expect(limparNotacaoMatematica(fracao)).toBe(fracao);
    const soma = "$$\\sum_{i=1}^{n} x_i$$";
    expect(limparNotacaoMatematica(soma)).toBe(soma);
  });

  it("texto sem LaTeX passa sem tocar", () => {
    const normal = "### Análise\n\n- FE 60% → 58%\n- Gradiente médio 52 mmHg (R$ 0 de custo)";
    expect(limparNotacaoMatematica(normal)).toBe(normal);
  });

  it("preço em reais não é confundido com delimitador", () => {
    // Um `$` sozinho não fecha par, então nada acontece — mas o teste existe
    // porque "R$ 1.200 e R$ 900" tem dois, e o par ganancioso engoliria o meio.
    const preco = "custa R$ 1.200 e o outro R$ 900";
    expect(limparNotacaoMatematica(preco)).toBe(preco);
  });

  it("string vazia não quebra", () => {
    expect(limparNotacaoMatematica("")).toBe("");
  });
});
