import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GuidelineRecommendations } from "./GuidelineRecommendations";
import { FONTE_2025 } from "@/data/diretriz2025";

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
