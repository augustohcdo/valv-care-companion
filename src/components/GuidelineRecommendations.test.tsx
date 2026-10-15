import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GuidelineRecommendations } from "./GuidelineRecommendations";
import { FONTE_2025 } from "@/data/diretriz2025";
import { FONTE_BR_2026 } from "@/data/diretrizBr2026";

/**
 * O painel de conduta do caso — na tela, não no código-fonte.
 *
 * ## Os dois defeitos que este arquivo guarda
 *
 * 1. **O rodapé nomeava outra diretriz.** Depois que o motor foi reescrito para
 *    a ESC/EACTS 2025, esta linha continuou dizendo "baseadas em diretrizes ESC
 *    2021 e AHA-ACC 2020". Nenhum teste reprovou, porque nenhum teste lia o que
 *    a tela escreve. É a família de defeito desta sessão inteira: a tela
 *    afirmando o que o código não faz — e aqui o médico estava sendo informado
 *    da procedência ERRADA de uma sugestão de cirurgia.
 *
 * 2. **O vídeo de técnica aparecendo onde não cabe.** O link para o MMCTS só
 *    pode existir quando a conduta sugerida é uma operação. Num paciente em
 *    vigilância ele seria uma sugestão de operar entrando pela porta dos fundos.
 */

const renderizar = (caso: Record<string, unknown>) =>
  render(
    <MemoryRouter>
      <GuidelineRecommendations caso={caso} />
    </MemoryRouter>,
  ).container.textContent ?? "";

const EA_GRAVE_SINTOMATICA = {
  valve_type: "aortica", valve_disease: "estenose", severity: "critica",
  nyha: "III", mean_gradient: 50, vmax_m_s: 4.5,
};

const EA_MODERADA_ASSINTOMATICA = {
  valve_type: "aortica", valve_disease: "estenose", severity: "moderada",
  nyha: "I", symptoms: ["Assintomático"],
};

describe("a procedência que o painel declara", () => {
  it("nomeia a ESC/EACTS 2025 e o DOI que o motor realmente usa", () => {
    const texto = renderizar(EA_GRAVE_SINTOMATICA);
    expect(texto).toContain("ESC/EACTS 2025");
    expect(texto).toContain(FONTE_2025.doi);
  });

  it("não nomeia diretriz que o motor não segue mais", () => {
    // Vale para os dois cenários: a linha é do rodapé, e o rodapé é sempre
    // impresso — inclusive quando não há nenhuma recomendação de intervenção.
    for (const caso of [EA_GRAVE_SINTOMATICA, EA_MODERADA_ASSINTOMATICA]) {
      const texto = renderizar(caso);
      expect(texto, "o rodapé cita ESC 2021").not.toMatch(/ESC\s*2021/);
      expect(texto, "o rodapé cita AHA-ACC 2020").not.toMatch(/AHA-?ACC\s*2020/);
    }
  });
});

describe("as duas diretrizes na mesma tela", () => {
  /**
   * O pedido era juntar a diretriz brasileira de 2026 às que já existiam. O
   * risco de "juntar" é produzir uma conduta só, de origem indistinguível — e
   * numa divergência o médico leria uma frase que nenhuma das duas sociedades
   * escreveu.
   *
   * Então a tela mostra as duas, nomeadas, cada uma na sua escala, e grita onde
   * elas discordam.
   */
  const EA_75_BAIXO_RISCO = {
    ...EA_GRAVE_SINTOMATICA, patient_age: 75, risco_cirurgico: "baixo",
  };
  const EA_61_BAIXO_RISCO = {
    ...EA_GRAVE_SINTOMATICA, patient_age: 61, risco_cirurgico: "baixo",
  };

  it("o rodapé nomeia as duas, com os dois DOIs", () => {
    const texto = renderizar(EA_75_BAIXO_RISCO);
    expect(texto).toContain("ESC/EACTS 2025");
    expect(texto).toContain(FONTE_2025.doi);
    expect(texto).toContain("Diretriz Brasileira de Valvopatias 2026");
    expect(texto, "o DOI da diretriz brasileira não aparece").toContain(FONTE_BR_2026.doi);
  });

  it("O AVISO: entre 70 e 80 anos a tela diz que as duas divergem", () => {
    const texto = renderizar(EA_75_BAIXO_RISCO);
    expect(texto, "a tela não avisa da divergência na faixa de 70 a 80")
      .toMatch(/as duas diretrizes dizem coisas diferentes/i);
    expect(texto, "não diz o que a europeia recomenda").toMatch(/TAVI a partir de 70 anos/);
    expect(texto, "não diz o que a brasileira recomenda").toMatch(/equivalentes/);
    expect(texto, "a tela decide pelo médico").toMatch(/o site não escolhe por você/);
  });

  it("fora dessa faixa a tela não inventa divergência", () => {
    const texto = renderizar(EA_61_BAIXO_RISCO);
    expect(texto, "avisou de divergência onde as duas concordam")
      .not.toMatch(/as duas diretrizes dizem coisas diferentes/i);
    // Mas o bloco brasileiro continua lá: concordar não é motivo para sumir.
    expect(texto).toMatch(/Diretriz Brasileira de Valvopatias 2026/);
  });

  it("cada linha brasileira vem com a escala dela, o quadro e a página", () => {
    const texto = renderizar(EA_75_BAIXO_RISCO);
    expect(texto, "a força/certeza do GRADE não aparece").toMatch(/SBC Forte\/Alta/);
    expect(texto, "a linha não diz de que quadro saiu").toMatch(/Quadro 27, p\. 41/);
    // E a coluna das outras sociedades, que é a metade "juntar com as que já
    // temos" do pedido: sem ela, a tela mostra a brasileira sozinha e deixa o
    // médico sem saber que a europeia se posiciona sobre a mesma linha.
    expect(texto, "a coluna ESC do Quadro 27 não chegou à tela").toMatch(/ESC I A/);
    expect(texto, "a coluna AHA do Quadro 27 não chegou à tela").toMatch(/AHA I A/);
    // E a escala europeia não é convertida para a brasileira nem vice-versa.
    expect(texto, "a tela converteu GRADE em Classe/Nível").not.toMatch(/Classe Forte|Forte\/Alta\s*\(Classe/);
  });

  it("o pré-requisito do Heart Team aparece junto com o Quadro 27", () => {
    const texto = renderizar(EA_75_BAIXO_RISCO);
    expect(texto, "mostrou o Quadro 27 sem o pré-requisito obrigatório da tabela")
      .toMatch(/Pré-requisito do Quadro 27/);
    expect(texto).toMatch(/Heart Team institucional/);
  });

  it("caso sem os dados diz o que falta, em vez de escolher um ramo", () => {
    // `EA_GRAVE_SINTOMATICA` não tem idade nem risco cirúrgico.
    const texto = renderizar(EA_GRAVE_SINTOMATICA);
    expect(texto, "não disse que falta dado").toMatch(/A diretriz brasileira divide por dados que este caso não registra/);
    expect(texto).toMatch(/idade/);
    expect(texto, "escolheu faixa de risco sem o dado").not.toMatch(/SBC Forte\/Alta[\s\S]*Baixo risco/);
  });
});

describe("o vídeo de técnica no detalhe do caso", () => {
  it("aparece quando a conduta sugerida é uma operação", () => {
    const texto = renderizar(EA_GRAVE_SINTOMATICA);
    expect(texto).toMatch(/Técnica operatória em vídeo/);
    // E vem com a atribuição — o vídeo é da EACTS, não nosso.
    expect(texto).toMatch(/MMCTS/);
  });

  it("some por inteiro no paciente em vigilância", () => {
    const texto = renderizar(EA_MODERADA_ASSINTOMATICA);
    expect(texto, "vídeo de operação oferecido a quem não tem indicação de operar")
      .not.toMatch(/Técnica operatória em vídeo/);
  });

  it("os dois cenários realmente produzem recomendações diferentes", () => {
    // Contraprova: se ambos caíssem no mesmo ramo do motor, o teste acima
    // passaria sem provar nada sobre a condição que ele afirma cobrir.
    expect(renderizar(EA_GRAVE_SINTOMATICA)).not.toBe(renderizar(EA_MODERADA_ASSINTOMATICA));
  });
});
