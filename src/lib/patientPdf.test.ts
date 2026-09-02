import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O documento que sai do aplicativo.
 *
 * Este arquivo produz o único artefato do ValvePath que é lido **fora** da
 * tela: um PDF que o médico imprime, anexa ou entrega. E ele não tinha teste
 * nenhum — 188 linhas gerando prontuário de portador de valvopatia, sem uma
 * asserção sequer.
 *
 * O defeito que motivou este teste: cada seção era `if (lista.length)`. Uma
 * consulta que falhasse caía em `meds || []` lá na tela, chegava aqui como
 * lista vazia, e a seção **sumia inteira** — sem cabeçalho, sem ressalva, sem
 * rodapé. Para quem lesse o PDF depois, "não toma medicação" e "não deu para
 * ler as medicações" eram o mesmo documento.
 *
 * Num portador de prótese mecânica essa leitura muda a conduta: a ausência da
 * seção "Medicações ativas" é lida como paciente sem anticoagulação.
 *
 * O que se cobra aqui é a distinção entre os três estados — tem, não tem, e
 * não deu para saber — em cada seção que vem de consulta.
 */

const textos: string[] = [];
const salvos: string[] = [];

vi.mock("jspdf", () => {
  // Um jsPDF de mentira que só registra o que foi escrito. Não se testa o
  // desenho do PDF aqui; testa-se o QUE ele afirma.
  class FakeDoc {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    getNumberOfPages() { return 1; }
    getCurrentPageInfo() { return { pageNumber: 1 }; }
    setFontSize() { return this; }
    setTextColor() { return this; }
    setFillColor() { return this; }
    setFont() { return this; }
    rect() { return this; }
    addPage() { return this; }
    splitTextToSize(t: string) { return [t]; }
    text(t: string | string[]) {
      textos.push(Array.isArray(t) ? t.join(" ") : String(t));
      return this;
    }
    save(nome: string) { salvos.push(nome); }
  }
  return { default: FakeDoc };
});

const { exportPatientPDF } = await import("./patientPdf");

const base = () => ({
  profile: { full_name: "Maria Silva", birth_date: "1958-03-02" },
  patient: { id: "p1", sex: "F", city: "Belo Horizonte", uf: "MG" },
  doctor: null,
  cases: [],
  exams: [],
  symptoms: [],
  medications: [],
  medLogs: [],
});

const tudo = () => textos.join("\n");

beforeEach(() => {
  textos.length = 0;
  salvos.length = 0;
});

describe("prontuário em PDF", () => {
  it("lista as medicações ativas quando elas existem", () => {
    exportPatientPDF({
      ...base(),
      medications: [{ name: "Varfarina", dose: "5 mg", times: ["20:00"] }],
    });
    expect(tudo()).toMatch(/MEDICAÇÕES ATIVAS/i);
    expect(tudo()).toMatch(/Varfarina/);
    expect(tudo()).toMatch(/5 mg/);
  });

  it("diz 'nenhuma medicação ativa' quando de fato não há — em vez de sumir", () => {
    // Antes, esta seção não era desenhada. O leitor não tinha como distinguir
    // este caso do próximo.
    exportPatientPDF({ ...base(), medications: [] });
    expect(tudo(), "a seção sumiu quando a lista está vazia").toMatch(/MEDICAÇÕES ATIVAS/i);
    expect(tudo()).toMatch(/Nenhuma medicação ativa registrada/i);
  });

  it("SEÇÃO QUE FALHOU não vira seção vazia: declara a lacuna e nega a leitura errada", () => {
    // A asserção central do arquivo.
    exportPatientPDF({ ...base(), medications: [], naoCarregadas: ["medicacoes"] });
    const t = tudo();
    expect(t, "não desenhou o cabeçalho, então o leitor não vê que faltou algo").toMatch(/MEDICAÇÕES ATIVAS/i);
    expect(t).toMatch(/NÃO FOI POSSÍVEL CARREGAR/i);
    // A frase que impede a conclusão clínica errada:
    expect(t, "não nega explicitamente a leitura de 'paciente sem medicação'").toMatch(
      /NÃO significa que o paciente não tenha/i,
    );
    // E não pode afirmar ausência ao mesmo tempo.
    expect(t, "afirmou ausência numa seção que nem foi lida").not.toMatch(
      /Nenhuma medicação ativa registrada/i,
    );
  });

  it("o aviso final nomeia as seções incompletas", () => {
    exportPatientPDF({
      ...base(),
      naoCarregadas: ["medicacoes", "exames"],
    });
    const t = tudo();
    expect(t).toMatch(/PRONTUÁRIO INCOMPLETO/i);
    expect(t).toMatch(/Medicações ativas/);
    expect(t).toMatch(/Exames seriados/);
    expect(t, "não orienta a reemitir").toMatch(/Emita novamente/i);
  });

  it("sem falha alguma, o aviso não inventa incompletude", () => {
    // A contraprova: se o aviso aparecesse sempre, ele viraria ruído e ninguém
    // leria justamente quando importa.
    exportPatientPDF({ ...base(), medications: [{ name: "Varfarina" }] });
    expect(tudo(), "alarmou incompletude num documento completo").not.toMatch(/PRONTUÁRIO INCOMPLETO/i);
  });

  it("aderência que falhou não vira 0%", () => {
    // O pior número possível: 0% de aderência é uma afirmação clínica forte, e
    // seria produzida por uma consulta que simplesmente não respondeu.
    exportPatientPDF({
      ...base(),
      medications: [{ name: "Varfarina" }],
      medLogs: [],
      naoCarregadas: ["aderencia"],
    });
    const t = tudo();
    expect(t, "afirmou 0% de doses confirmadas sem ter lido os registros").not.toMatch(/0%/);
    expect(t).toMatch(/não foi possível carregar os registros de dose/i);
  });

  it("exames e sintomas seguem a mesma regra", () => {
    exportPatientPDF({ ...base(), naoCarregadas: ["exames", "sintomas"] });
    const t = tudo();
    expect(t).toMatch(/EXAMES SERIADOS/i);
    expect(t).toMatch(/DIÁRIO DE SINTOMAS/i);
    expect(t.match(/NÃO FOI POSSÍVEL CARREGAR/gi)?.length).toBe(2);
  });

  it("casos clínicos: lista vazia de verdade continua dizendo 'nenhum caso'", () => {
    exportPatientPDF({ ...base(), cases: [] });
    expect(tudo()).toMatch(/Nenhum caso registrado/i);
    expect(tudo()).not.toMatch(/NÃO FOI POSSÍVEL CARREGAR/i);
  });

  it("mantém a ressalva de que não substitui prontuário oficial", () => {
    // Não é decoração: é o que separa este documento de um laudo.
    exportPatientPDF(base());
    expect(tudo()).toMatch(/não substitui prontuário oficial/i);
  });

  it("gera o arquivo com o nome do paciente", () => {
    exportPatientPDF(base());
    expect(salvos[0]).toBe("valvepath-prontuario-maria-silva.pdf");
  });
});
