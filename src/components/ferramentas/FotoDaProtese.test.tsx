import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FotoDaProtese } from "./FotoDaProtese";

/**
 * O quadro da prótese, e a legenda que impede uma leitura errada.
 *
 * Quando não há foto oficial, o cartão desenha um **esquema da família
 * construtiva** — bioprótese com stent, mecânica de dois folhetos, anel de
 * anuloplastia. O desenho não é a geometria daquele modelo, e nunca foi.
 *
 * O cartão avisava disso de um jeito indireto: uma linha explicando por que
 * faltava a foto ("o site do fabricante bloqueia robôs"). Esse texto saiu — é
 * registro do meu processo, não informação clínica. Mas a ambiguidade que ele
 * tapava é real: um desenho rotulado só com o nome da família passa por
 * geometria do produto.
 *
 * ## Por que este arquivo existe
 *
 * A guarda anterior vivia em `buscaDeFontes.test.ts` e lia o CÓDIGO-FONTE
 * procurando a palavra "esquema". Ela passou na inversão — com a legenda
 * apagada, continuou verde, porque a palavra aparece no nome do componente
 * `EsquemaProtese` e nos comentários. Guarda que casa com o arquivo em vez de
 * com a tela é verde que não prova nada, e foi exatamente o defeito que esta
 * sessão persegue, escrito por mim.
 *
 * Aqui se renderiza o componente e se lê o que o médico lê.
 */

const base = {
  fabricante: "Medtronic",
  modelo: "Avalus",
  tipo: "biologica_aortica",
  tamanhoQuadro: "w-24 h-24",
  tamanhoEsquema: "w-16 h-16",
};

describe("quadro da prótese", () => {
  it("SEM foto: a legenda declara que é esquema, não o produto", () => {
    const { container } = render(<FotoDaProtese {...base} imagem={null} imagemE={null} />);
    const texto = container.textContent ?? "";
    expect(texto, "a legenda não diz que é esquema").toMatch(/esquema/i);
    expect(container.querySelector("img"), "desenhou <img> sem ter imagem").toBeNull();
  });

  it("SEM foto: a legenda também nomeia a família construtiva", () => {
    // As duas coisas juntas: o que é (esquema) e de que família. Só "esquema"
    // seria menos informativo que antes.
    const { container } = render(<FotoDaProtese {...base} imagem={null} imagemE={null} />);
    expect((container.textContent ?? "").replace(/esquema\s*·?\s*/i, "").trim().length)
      .toBeGreaterThan(3);
  });

  it("COM foto: a legenda diz de onde a imagem veio, e não fala em esquema", () => {
    const { container } = render(
      <FotoDaProtese {...base} imagem="https://exemplo.invalid/avalus.png" imagemE="foto" />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/foto do fabricante/i);
    expect(texto, "chamou de esquema uma foto de verdade").not.toMatch(/esquema/i);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("imagem que FALHA ao carregar leva a legenda junto", () => {
    // O cenário que motivou juntar quadro e legenda no mesmo componente, e o
    // único que uma leitura de código-fonte nunca conseguiu cobrar de verdade.
    //
    // Quando estavam separados, a legenda dizia "foto do fabricante" sempre que
    // houvesse `image_url` — INCLUSIVE quando a imagem falhava e a tela caía no
    // esquema. O médico via um desenho legendado como fotografia, ou seja, uma
    // geometria que ninguém desenhou apresentada como o produto.
    const { container } = render(
      <FotoDaProtese {...base} imagem="https://exemplo.invalid/morta.png" imagemE="foto" />,
    );
    expect(container.textContent).toMatch(/foto do fabricante/i);

    const img = container.querySelector("img")!;
    fireEvent.error(img);

    const depois = container.textContent ?? "";
    expect(depois, "a imagem caiu e a legenda continuou dizendo que era foto").not.toMatch(/foto do fabricante/i);
    expect(depois, "caiu no esquema sem dizer que é esquema").toMatch(/esquema/i);
    expect(container.querySelector("img"), "manteve o <img> quebrado na tela").toBeNull();
  });

  it("ilustração não é chamada de foto", () => {
    // A distinção existe porque parte das imagens oficiais é render, não
    // fotografia — e apresentar render como foto é afirmar procedência errada.
    const { container } = render(
      <FotoDaProtese {...base} imagem="https://exemplo.invalid/x.png" imagemE="ilustracao" />,
    );
    const texto = container.textContent ?? "";
    expect(texto).toMatch(/ilustração do fabricante/i);
    expect(texto).not.toMatch(/foto do fabricante/i);
  });
});
