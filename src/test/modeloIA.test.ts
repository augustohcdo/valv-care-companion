import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guarda: a IA clínica não pode depender de um único modelo.
 *
 * **Cada modelo tem cota própria no nível gratuito.** Com um modelo cravado no
 * código, o dia em que a cota dele acaba a IA inteira responde "limite de uso
 * atingido" — enquanto outros cinco modelos da mesma chave atendem
 * normalmente. Foi o que aconteceu: medido na mesma chave e no mesmo minuto,
 * `gemini-3.5-flash` devolvia 429 e `gemini-3.6-flash`, `gemini-flash-latest`
 * e os três "lite" respondiam.
 *
 * A segunda metade da guarda é sobre `thinkingConfig`. Ele estava lá como
 * economia e era exatamente o que quebrava a reserva: os modelos novos não
 * deixam desligar o raciocínio e recusam `thinkingBudget: 0` com 400. Uma
 * cadeia de reserva que só funciona no primeiro elo não é reserva — e o
 * sintoma seria "Erro do provedor de IA" no lugar certo pelo motivo errado.
 */

const fonte = readFileSync(
  resolve(__dirname, "../../supabase/functions/clinical-ai/index.ts"), "utf8",
);

/** Os modelos da cadeia, na ordem em que a função os tenta. */
function cadeia(): string[] {
  const bloco = fonte.slice(fonte.indexOf("const MODELOS = ["));
  return [...bloco.slice(0, bloco.indexOf("]")).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("cadeia de modelos", () => {
  const modelos = cadeia();

  it("tem reserva de verdade, não um modelo só", () => {
    expect(modelos.length).toBeGreaterThanOrEqual(3);
    expect(new Set(modelos).size).toBe(modelos.length);
  });

  it("os modelos que responderam na medição estão na cadeia", () => {
    // Se alguém trocar a lista por um modelo só, ou remover os que de fato
    // atendem hoje, isto quebra em vez de a IA cair em produção.
    expect(modelos).toContain("gemini-3.6-flash");
    expect(modelos.some((m) => m.includes("lite"))).toBe(true);
  });

  it("troca de modelo só por indisponibilidade — 429, 404 e 503", () => {
    expect(fonte).toContain(
      "resp.status !== 429 && resp.status !== 404 && resp.status !== 503",
    );
  });

  /**
   * A inversão que importa: reintroduzir `thinkingBudget: 0` derruba três dos
   * cinco modelos da cadeia com 400, e o sintoma aparece como erro do
   * provedor, longe da causa.
   *
   * A varredura olha **todos** os `generationConfig` do arquivo, não um bloco
   * fixo. A primeira versão ancorava numa string do corpo do `callGemini`; ao
   * mover a montagem para `tentarNaCadeia`, ela perdeu o alvo — e só não passou
   * a inspecionar o nada porque a asserção de âncora existia. E olhar só um
   * bloco deixaria de fora justamente o `extract_echo`, que era onde o
   * `thinkingConfig` tinha ficado para trás.
   */
  it("nenhum generationConfig manda thinkingConfig", () => {
    const blocos = [...fonte.matchAll(/generationConfig:\s*\{[^}]*\}/g)].map((m) => m[0]);
    expect(blocos.length).toBeGreaterThanOrEqual(2);
    for (const b of blocos) {
      expect(b, `generationConfig com thinkingConfig: ${b}`).not.toContain("thinkingBudget");
    }
  });

  /**
   * Um caminho de rede só. `extract_echo` falava direto com um modelo fixo, e
   * quando a cadeia substituiu a constante da URL aquele caminho passou a
   * referenciar um nome que não existia mais — em produção, sem nada acusar.
   */
  it("só a cadeia monta URL de geração de texto", () => {
    // O `embedContent` é outro endpoint, com modelo próprio, e continua tendo
    // o fetch dele. O que não pode voltar é um segundo caminho de
    // `generateContent` fora de `urlDoModelo`.
    const geracao = [...fonte.matchAll(/:generateContent/g)].length;
    expect(geracao, "há mais de um lugar montando URL de generateContent").toBe(1);
    expect(fonte).toContain("tentarNaCadeia(GEMINI_API_KEY");
  });

  it("a resposta diz de qual modelo veio, e se foi reserva", () => {
    expect(fonte).toContain("modelo: modeloUsado");
    expect(fonte).toContain("modelo_reserva: reserva");
  });
});
