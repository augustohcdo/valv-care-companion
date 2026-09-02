import { describe, it, expect } from "vitest";
import { DIRETRIZ_2025, RISCO_BAIXO, FONTE_2025, type RecomendacaoCitada } from "./diretriz2025";

/**
 * A guarda que torna o arquivo de citações útil em vez de decorativo.
 *
 * Guardar a frase da diretriz ao lado do número não serve de nada se ninguém
 * conferir que os dois combinam. Um `limiares: [50]` embaixo de uma citação que
 * diz 55 passaria despercebido em qualquer revisão de código — e mudaria a
 * conduta de um paciente.
 *
 * Aqui se cobra o vínculo: **todo número que o motor usa tem de aparecer no
 * texto citado**. Assim, escrever o limiar errado exige escrever a citação
 * errada junto — e a citação é conferível por um cardiologista sem ler uma
 * linha de TypeScript.
 *
 * O que este teste NÃO faz, e é bom deixar claro: ele não prova que a citação
 * corresponde ao que a ESC publicou. Isso foi conferido à mão, em duas cópias
 * hospedadas por sociedades diferentes, e está registrado no cabeçalho do
 * `diretriz2025.ts`. Guarda automática cuida da consistência interna; a
 * procedência é trabalho humano e fica documentada.
 */

const TODAS: [string, RecomendacaoCitada][] = [
  ...Object.entries(DIRETRIZ_2025),
  ["RISCO_BAIXO", RISCO_BAIXO],
];

/**
 * O número aparece no texto?
 *
 * `4` tem de casar com "≥4.0 m/s" mas **não** com "40 mmHg" — daí as bordas.
 * Sem elas o teste passaria por acidente em quase tudo, que é o pior resultado
 * possível para uma guarda.
 */
function citaONumero(texto: string, n: number): boolean {
  const base = String(n).replace(".", "\\.");
  const comZeros = Number.isInteger(n) ? `${base}(\\.0+)?` : base;
  return new RegExp(`(?<![\\d.])${comZeros}(?![\\d.]*\\d)`).test(texto);
}

describe("citações da diretriz 2025", () => {
  it("todo limiar usado pelo motor aparece no texto citado", () => {
    const orfaos: string[] = [];
    for (const [chave, r] of TODAS) {
      for (const n of r.limiares ?? []) {
        if (!citaONumero(r.verbatim, n)) orfaos.push(`${chave}: ${n} não aparece na citação`);
      }
    }
    expect(
      orfaos,
      `\n${orfaos.join("\n")}\n\n` +
        "Um número no código sem respaldo na frase citada é um limiar inventado.\n" +
        "Corrija o número ou traga a citação certa da diretriz.",
    ).toEqual([]);
  });

  it("a varredura sabe distinguir 4 de 40", () => {
    // Contraprova do detector. Sem isto, um `citaONumero` que devolvesse sempre
    // `true` faria o teste acima passar com qualquer besteira.
    expect(citaONumero("mean gradient ≥40 mmHg", 4), "confundiu 4 com 40").toBe(false);
    expect(citaONumero("Vmax ≥4.0 m/s", 4), "não achou 4 em 4.0").toBe(true);
    expect(citaONumero("LVEF <55%", 5), "confundiu 5 com 55").toBe(false);
    expect(citaONumero("LVEF ≤50%", 50)).toBe(true);
    expect(citaONumero("BSA <1.68 m2", 1.68)).toBe(true);
    expect(citaONumero("MVA ≤2.0 cm2", 2.0)).toBe(true);
  });

  it("classe e nível são valores de diretriz, não texto livre", () => {
    for (const [chave, r] of TODAS) {
      expect(["I", "IIa", "IIb", "III"], `${chave}`).toContain(r.classe);
      expect(["A", "B", "C"], `${chave}`).toContain(r.nivel);
    }
  });

  it("nenhuma citação foi copiada por engano sobre outra", () => {
    // Duas recomendações com o mesmo verbatim significa que uma delas perdeu o
    // texto próprio num copiar-colar — e passa a citar o que não é.
    const vistos = new Map<string, string>();
    for (const [chave, r] of TODAS) {
      const anterior = vistos.get(r.verbatim);
      expect(anterior, `${chave} tem a mesma citação de ${anterior}`).toBeUndefined();
      vistos.set(r.verbatim, chave);
    }
  });

  it("toda citação é substantiva e traz a tabela de origem", () => {
    for (const [chave, r] of TODAS) {
      expect(r.verbatim.length, `${chave}: citação curta demais para ser verificável`).toBeGreaterThan(60);
      expect(r.tabela, `${chave}: sem tabela de origem`).toMatch(/Recommendation Table \d+/);
    }
  });

  it("a fonte declara DOI e as cópias em que foi conferida", () => {
    expect(FONTE_2025.doi).toBe("10.1093/eurheartj/ehaf194");
    expect(
      FONTE_2025.copiasConferidas.length,
      "uma cópia só não pega corrupção de arquivo nem adulteração de host",
    ).toBeGreaterThanOrEqual(2);
  });

  it("as contraindicações de DOAC estão presentes e são Classe III", () => {
    // Não é um detalhe entre outros: o motor antigo mandava anticoagular sem
    // dizer com quê, e na estenose mitral o DOAC é contraindicado. Se estas
    // duas sumirem do arquivo, o defeito volta em silêncio.
    const reumatica = DIRETRIZ_2025.faDoacContraindicadoEmReumatica;
    const moderada = DIRETRIZ_2025.faDoacContraindicadoEmModeradaGrave;
    expect(reumatica.classe).toBe("III");
    expect(moderada.classe).toBe("III");
    expect(reumatica.verbatim).toMatch(/not recommended/i);
    expect(moderada.verbatim).toMatch(/not recommended/i);
  });
});
