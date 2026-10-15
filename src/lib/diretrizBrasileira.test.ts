import { describe, it, expect } from "vitest";
import {
  divergeNaEscolhaDaTecnica, escTemCondicaoPropria, faixaDaEscolha,
  recomendacoesBrasileiras, type CasoBr,
} from "./diretrizBrasileira";
import { QUADRO_27_ESTENOSE_AORTICA } from "@/data/diretrizBr2026";

/**
 * A camada da diretriz brasileira: o que ela seleciona, e o que ela se RECUSA a
 * selecionar.
 *
 * A segunda metade é a que importa. Um seletor de conduta que, na falta de um
 * dado, cai num ramo "por padrão" afirma sobre o paciente uma coisa que ninguém
 * mediu — e é a forma mais cara do defeito que este projeto persegue, porque a
 * tela fica igualzinha à de um caso completo.
 *
 * O motor da ESC já tem essa cicatriz escrita: faltando o status sintomático,
 * ele caía no ramo assintomático e recomendava esperar, em estenose aórtica
 * importante, onde o ramo sintomático é troca valvar.
 */

const EA_BASE: CasoBr = {
  valve_type: "aortica", valve_disease: "estenose", severity: "importante",
  sintomatico: true, patient_age: 72, risco_cirurgico: "baixo",
};

const chaves = (c: CasoBr) => recomendacoesBrasileiras(c).linhas.map((l) => l.chave);

describe("as faixas etárias da escolha da técnica", () => {
  it("os limites são os impressos: 70 e 80, inclusive", () => {
    /**
     * A diretriz escreve "Baixo risco 70 a 80 anos". Um `< 80` em vez de
     * `<= 80` jogaria o paciente de 80 anos para a faixa de cima, onde a
     * recomendação é outra (preferência para TAVI em vez de equivalência).
     * Erro de um ano numa borda não parece defeito nenhum na revisão.
     */
    expect(faixaDaEscolha(69)).toBe("abaixo70");
    expect(faixaDaEscolha(70), "70 anos caiu na faixa de baixo").toBe("de70a80");
    expect(faixaDaEscolha(75)).toBe("de70a80");
    expect(faixaDaEscolha(80), "80 anos caiu na faixa de cima").toBe("de70a80");
    expect(faixaDaEscolha(81)).toBe("acima80");
  });

  it("a divergência com a europeia é exatamente a faixa de 70 a 80", () => {
    // Abaixo de 70 as duas dizem cirurgia; acima de 80, as duas preferem TAVI.
    // No meio, a ESC recomenda TAVI (I A) e a brasileira chama de equivalente.
    expect(divergeNaEscolhaDaTecnica(69)).toBe(false);
    expect(divergeNaEscolhaDaTecnica(70)).toBe(true);
    expect(divergeNaEscolhaDaTecnica(80)).toBe(true);
    expect(divergeNaEscolhaDaTecnica(81)).toBe(false);
  });
});

describe("o que a camada brasileira seleciona", () => {
  it("estenose aórtica importante sintomática traz a linha de sintomas", () => {
    expect(chaves(EA_BASE)).toContain("sintomas");
  });

  it("com idade e risco baixo, traz as DUAS técnicas da faixa", () => {
    // As duas, e não uma: na faixa de 70 a 80 a diretriz diz que são
    // equivalentes. Mostrar só uma seria escolher pelo Heart Team.
    const c = chaves({ ...EA_BASE, patient_age: 75 });
    expect(c).toContain("baixoRisco70a80Cirurgia");
    expect(c).toContain("baixoRisco70a80Tavi");

    const acima = chaves({ ...EA_BASE, patient_age: 84 });
    expect(acima).toContain("baixoRiscoAcima80Tavi");
    expect(acima).toContain("baixoRiscoAcima80Cirurgia");

    const abaixo = chaves({ ...EA_BASE, patient_age: 61 });
    expect(abaixo).toContain("baixoRiscoAbaixo70Cirurgia");
    expect(abaixo).toContain("baixoRiscoAbaixo70Tavi");
  });

  it("assintomático traz a recomendação NOVA de 2026, com a nota", () => {
    const sel = recomendacoesBrasileiras({ ...EA_BASE, sintomatico: false });
    expect(sel.linhas.map((l) => l.chave)).toContain("eaAssintomaticaPrecoce");
    const linha = sel.linhas.find((l) => l.chave === "eaAssintomaticaPrecoce")!;
    expect(linha.r.forca, "a intervenção precoce é recomendação FRACA").toBe("Fraca");
    expect(
      linha.r.nota,
      "a nota da intervenção precoce sumiu — sem ela a recomendação muda de sentido",
    ).toMatch(/sem benefício prognóstico/);
  });
});

describe("o que a camada brasileira se RECUSA a selecionar", () => {
  it("sem saber se há sintomas, não escolhe ramo nenhum", () => {
    const sel = recomendacoesBrasileiras({ ...EA_BASE, sintomatico: null });
    expect(sel.linhas, "escolheu um ramo sem saber se o paciente tem sintomas").toEqual([]);
    expect(sel.faltam.join(" "), "não disse o que falta").toMatch(/sintomas/);
  });

  it("sem idade, não inventa faixa etária", () => {
    const sel = recomendacoesBrasileiras({ ...EA_BASE, patient_age: null });
    const c = sel.linhas.map((l) => l.chave);
    expect(c, "a linha de sintomas é independente da idade e deve continuar").toContain("sintomas");
    for (const chave of c) {
      expect(chave, `escolheu a faixa ${chave} sem idade registrada`).not.toMatch(/baixoRisco/);
    }
    expect(sel.faltam.join(" ")).toMatch(/idade/);
  });

  it("sem risco cirúrgico, não assume risco baixo", () => {
    /**
     * Assumir "baixo" seria o pior dos dois erros: as recomendações de baixo
     * risco são as mais permissivas da tabela, e o paciente de risco alto
     * estaria lendo a conduta de outro.
     */
    const sel = recomendacoesBrasileiras({ ...EA_BASE, risco_cirurgico: null });
    for (const { chave } of sel.linhas) {
      expect(chave, `assumiu risco baixo (${chave}) sem o dado`).not.toMatch(/baixoRisco/);
    }
    expect(sel.faltam.join(" ")).toMatch(/risco cirúrgico/);
  });

  it("valvopatia que não é importante nem crítica não traz linha nenhuma", () => {
    const sel = recomendacoesBrasileiras({ ...EA_BASE, severity: "moderada" });
    expect(sel.linhas).toEqual([]);
    expect(sel.faltam, "pediu dado para um caso que a diretriz não alcança").toEqual([]);
  });

  it("risco alto e intermediário trazem as linhas do próprio risco", () => {
    const alto = chaves({ ...EA_BASE, risco_cirurgico: "alto" });
    expect(alto).toContain("altoRiscoTavi");
    expect(alto).toContain("altoRiscoCirurgia");
    expect(alto.join(" "), "misturou a faixa de risco baixo").not.toMatch(/baixoRisco/);

    const inter = chaves({ ...EA_BASE, risco_cirurgico: "intermediario" });
    expect(inter).toContain("intermediarioTavi");
    expect(inter).toContain("intermediarioCirurgia");
  });
});

describe("a nota obrigatória e a marcação de divergência", () => {
  it("toda linha do Quadro 27 vem com o pré-requisito do Heart Team", () => {
    const sel = recomendacoesBrasileiras(EA_BASE);
    expect(sel.linhas.some((l) => l.r.quadro === "Quadro 27"), "o caso não trouxe linha do Quadro 27").toBe(true);
    expect(
      sel.notaObrigatoria,
      "linha do Quadro 27 mostrada sem o pré-requisito obrigatório da tabela",
    ).toMatch(/Pré-requisito obrigatório/);
  });

  it("caso que só traz linhas da Tabela 1 não carimba nota do Quadro 27", () => {
    // A nota é do Quadro 27. Carimbá-la em linha de outra tabela seria atribuir
    // à diretriz uma condição que ela não pôs ali.
    const sel = recomendacoesBrasileiras({
      valve_type: "tricuspide", valve_disease: "insuficiencia", severity: "importante",
      sintomatico: true,
    });
    expect(sel.linhas.length).toBeGreaterThan(0);
    expect(sel.linhas.every((l) => l.r.quadro === "Tabela 1")).toBe(true);
    expect(sel.notaObrigatoria).toBeUndefined();
  });

  it("marca a linha em que a ESC usa condição própria", () => {
    // Queda progressiva de FE: a SBC fala em 60%, a ESC em 55%. É a diferença
    // que a tela precisa apontar — sem dizer qual está certa.
    expect(escTemCondicaoPropria(QUADRO_27_ESTENOSE_AORTICA.quedaProgressivaFe)).toBe(true);
    expect(escTemCondicaoPropria(QUADRO_27_ESTENOSE_AORTICA.sindromeDeHeyde), "'–' é posição e merece marca").toBe(true);
    expect(escTemCondicaoPropria(QUADRO_27_ESTENOSE_AORTICA.sintomas), "marcou linha em que as duas concordam").toBe(false);
  });

  it("toda linha selecionada diz POR QUE foi selecionada", () => {
    // Sem isso, a tela mostra uma recomendação sem dizer o que no caso a
    // trouxe — e o médico não tem como conferir se o site leu o caso certo.
    const sel = recomendacoesBrasileiras({ ...EA_BASE, patient_age: 75 });
    expect(sel.linhas.length).toBeGreaterThanOrEqual(3);
    for (const l of sel.linhas) {
      expect(l.porque.length, `${l.chave} sem justificativa`).toBeGreaterThan(10);
    }
    expect(sel.linhas.map((l) => l.porque).join(" "), "a justificativa não cita a idade do caso")
      .toContain("75");
  });
});
