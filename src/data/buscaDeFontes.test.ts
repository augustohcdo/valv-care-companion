import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BUSCA_DE_FONTES, buscaDaFamilia, TEXTO_DO_RESULTADO, N_MINIMO, BUSCA_FEITA_EM } from "./buscaDeFontes";

/**
 * O registro da busca por fonte, cobrado.
 *
 * Este arquivo é o que separa "ninguém procurou" de "procurou-se e não há" — e
 * a segunda é uma afirmação: ela diz ao médico que a literatura acessível não
 * publica EOA por tamanho daquele modelo. Afirmação sem lastro é o defeito que
 * este projeto persegue, então cada entrada precisa dizer o que foi consultado.
 */

describe("registro da busca por EOA de referência", () => {
  it("toda entrada explica o que foi procurado, em frase de verdade", () => {
    expect(BUSCA_DE_FONTES.length).toBeGreaterThan(5);
    for (const b of BUSCA_DE_FONTES) {
      expect(b.familia, "família fora do formato fabricante|modelo").toMatch(/^[^|]+\|[^|]+$/);
      expect(b.nota.length, `${b.familia}: nota curta demais para ser explicação`).toBeGreaterThan(60);
      expect(TEXTO_DO_RESULTADO[b.resultado], `${b.familia}: resultado sem texto`).toBeTruthy();
    }
  });

  it("quando cita um estudo, o link é de PubMed", () => {
    for (const b of BUSCA_DE_FONTES) {
      if (!b.referencia) continue;
      expect(b.referencia.url, `${b.familia}`).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
      expect(b.referencia.citacao.length).toBeGreaterThan(40);
    }
  });

  it("`sem_dado_por_tamanho` sempre aponta o estudo que existe", () => {
    // É a diferença entre "não achei nada" e "achei, e não serve": a segunda
    // precisa mostrar o que foi achado, senão é indistinguível da primeira.
    for (const b of BUSCA_DE_FONTES.filter((x) => x.resultado === "sem_dado_por_tamanho")) {
      if (b.familia === "Abbott|Epic") continue; // explicado pela tabela da ASE, sem artigo próprio
      expect(b.referencia, `${b.familia} diz que há estudo e não aponta qual`).toBeTruthy();
    }
  });

  it("nenhuma família aparece duas vezes", () => {
    const vistas = BUSCA_DE_FONTES.map((b) => b.familia);
    expect(new Set(vistas).size).toBe(vistas.length);
  });

  it("a busca tem data, e a tela a mostra", () => {
    expect(BUSCA_FEITA_EM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const arquivo of [
      "src/components/ferramentas/CatalogoProteses.tsx",
      "src/components/ferramentas/RecomendadorProtese.tsx",
    ]) {
      expect(readFileSync(arquivo, "utf8"), `${arquivo} não mostra a data da busca`)
        .toMatch(/BUSCA_FEITA_EM/);
    }
  });

  it("`buscaDaFamilia` acha o que está registrado e não inventa o resto", () => {
    expect(buscaDaFamilia("Braile", "Biocor")?.resultado).toBe("sem_estudo");
    expect(buscaDaFamilia("Meril", "Myval")?.resultado).toBe("sem_dado_por_tamanho");
    expect(buscaDaFamilia("Fabricante", "Que Não Existe")).toBeUndefined();
  });

  it("o piso de amostra é o mesmo no código e no script que grava", () => {
    // Divergir aqui deixaria a tela dizendo uma regra e o banco obedecendo outra.
    const script = readFileSync("scripts/catalogo/aplicar-estudos.mjs", "utf8");
    expect(script).toMatch(new RegExp(`N_MINIMO\\s*=\\s*${N_MINIMO}\\b`));
  });

  it("as duas telas distinguem os três estados do campo vazio", () => {
    const catalogo = readFileSync("src/components/ferramentas/CatalogoProteses.tsx", "utf8");
    expect(catalogo, "não trata o caso de ninguém ter procurado").toMatch(/ainda não pesquisado/);
    // Com fronteira de palavra: sem ela, `buscaDaFamiliaX` satisfazia a busca —
    // e a inversão desta guarda mostrou exatamente isso.
    expect(catalogo, "não usa o registro da busca").toMatch(/\bbuscaDaFamilia\b/);
    const rec = readFileSync("src/components/ferramentas/RecomendadorProtese.tsx", "utf8");
    expect(rec, "junta 'não serve' com 'não há dado'").toMatch(/Fora da conta por falta de EOA publicada/);
  });
});
