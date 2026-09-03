import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  BUSCA_DE_FONTES, BUSCA_DE_FOTOS, buscaDaFamilia, motivoSemFoto,
  TEXTO_DO_RESULTADO, N_MINIMO, BUSCA_FEITA_EM,
} from "./buscaDeFontes";

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
      expect(b.referencia, `${b.familia} diz que há estudo e não aponta qual`).toBeTruthy();
    }
  });

  it("nenhuma família aparece duas vezes", () => {
    const vistas = BUSCA_DE_FONTES.map((b) => b.familia);
    expect(new Set(vistas).size).toBe(vistas.length);
  });

  it("`coberta_em_parte` nomeia os tamanhos que ficaram de fora", () => {
    // Este estado diz "tem dado em uns tamanhos e não em outros". Se a nota não
    // disser QUAIS faltam, o médico fica sem saber se o tamanho dele é um dos
    // cobertos — e a frase vira tranquilizante em vez de informação.
    const parciais = BUSCA_DE_FONTES.filter((x) => x.resultado === "coberta_em_parte");
    expect(parciais.length, "o estado existe mas ninguém o usa").toBeGreaterThan(0);
    for (const b of parciais) {
      // Duas exigências, e a primeira sozinha não bastava: a inversão mostrou
      // que trocar "27 a 33 mm cobertos" por "faltam alguns tamanhos" ainda
      // passava, porque havia outro "mm" adiante na mesma nota.
      const medidas = b.nota.match(/\d+(?:,\d+)?\s*mm/g) ?? [];
      expect(medidas.length, `${b.familia}: não nomeia tamanho nenhum`).toBeGreaterThanOrEqual(2);
      expect(b.nota, `${b.familia}: não separa o que tem do que falta`)
        .toMatch(/sem valor|falta|não (o )?(traz|tem)|continua sem/i);
    }
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
    expect(buscaDaFamilia("Braile", "Prótese de Pericárdio Bovino")?.resultado).toBe("sem_estudo");
    expect(buscaDaFamilia("Meril", "Myval")?.resultado).toBe("sem_dado_por_tamanho");
    expect(buscaDaFamilia("Fabricante", "Que Não Existe")).toBeUndefined();
  });

  it("o piso de amostra é o mesmo no código e no script que grava", () => {
    // Divergir aqui deixaria a tela dizendo uma regra e o banco obedecendo outra.
    const script = readFileSync("scripts/catalogo/aplicar-estudos.mjs", "utf8");
    expect(script).toMatch(new RegExp(`N_MINIMO\\s*=\\s*${N_MINIMO}\\b`));
  });

  it("a ausência de foto tem motivo — e a lista vazia só é segura porque a guarda de rede existe", () => {
    // Esta guarda exigia `BUSCA_DE_FOTOS.length > 5`, e passou a reprovar quando
    // a lista zerou: em 30/08/2026 as 36 famílias do catálogo cirúrgico ganharam
    // imagem oficial. Exigir que a lista tenha conteúdo era cobrar um NÚMERO, e
    // o número mudou por um motivo bom.
    //
    // Só que uma lista vazia deixaria este teste passando por vacuidade — o laço
    // não roda, e o arquivo continuaria "verde" mesmo se `motivoSemFoto` fosse
    // apagada. Então o que se cobra aqui é o que sobrevive à lista vazia: a forma
    // de cada entrada que exista, o fato de a tela consultar o registro, e a
    // EXISTÊNCIA da guarda que de fato garante a cobertura — a dos dois sentidos
    // no `ferramentas:verificar`, que compara esta lista com o catálogo servido
    // e não tem como rodar aqui, porque depende de rede.
    for (const b of BUSCA_DE_FOTOS) {
      expect(b.familia, "família fora do formato fabricante|modelo").toMatch(/^[^|]+\|[^|]+$/);
      expect(b.motivo.length, `${b.familia}: motivo curto demais para ser explicação`).toBeGreaterThan(60);
    }
    expect(new Set(BUSCA_DE_FOTOS.map((b) => b.familia)).size).toBe(BUSCA_DE_FOTOS.length);
    expect(motivoSemFoto("Edwards", "Inspiris Resilia"), "tem foto, não deveria ter motivo")
      .toBeUndefined();
    // A cobertura da tela NÃO é conferida aqui.
    //
    // Havia neste lugar uma asserção lendo o código-fonte do cartão à procura de
    // uma palavra. Ela passou na inversão — com a legenda apagada, continuou
    // verde, porque a palavra aparecia no nome de um componente e num comentário.
    // Casar com o arquivo em vez de com a tela é verde que não prova nada.
    //
    // Quem cobra isso agora é `FotoDaProtese.test.tsx`, que renderiza e lê o que
    // o médico lê. A cobertura do registro em si continua no
    // `ferramentas:verificar`, que compara esta lista com o catálogo servido.

    const verificador = readFileSync("scripts/ferramentas-verificar.mjs", "utf8");
    for (const [rotulo, padrao] of [
      ["família sem foto tem de ter motivo", /fotos: família sem foto tem motivo registrado/],
      ["motivo não pode sobreviver à foto", /fotos: nenhum motivo sobrevive à foto que o desmente/],
      ["motivo não pode apontar para fora do catálogo", /fotos: nenhum motivo aponta para família fora do catálogo/],
    ] as [string, RegExp][]) {
      expect(padrao.test(verificador), `a guarda de rede sumiu: ${rotulo}`).toBe(true);
    }
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
