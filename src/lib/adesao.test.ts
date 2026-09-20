import { describe, it, expect } from "vitest";
import { calcularAdesao, dosesPrevistas, explicarAdesao } from "./adesao";

/**
 * O defeito que estes testes impedem de voltar.
 *
 * A conta era `tomadas ÷ registradas`. Uma dose que o paciente nunca toca não
 * cria linha em `medication_logs`, então noventa doses previstas e dois
 * "tomei" davam **100%** na tela do cardiologista.
 */

const janela = (dias: number) => {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - (dias - 1) * 86_400_000);
  return [inicio.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)] as const;
};

const tomado = (n: number) => Array.from({ length: n }, () => ({ status: "tomado" }));
const pulado = (n: number) => Array.from({ length: n }, () => ({ status: "pulado" }));

describe("doses previstas", () => {
  it("conta dias da janela × horários do dia", () => {
    const [de, ate] = janela(30);
    const r = dosesPrevistas([{ times: ["08:00", "14:00", "20:00"] }], de, ate);
    expect(r.previstas, "30 dias × 3 horários").toBe(90);
    expect(r.semHorario).toBe(0);
  });

  it("recorta pela vigência do medicamento", () => {
    const [de, ate] = janela(30);
    // Começou na metade da janela: não dá para cobrar dose de antes de existir.
    const meio = new Date(new Date(`${ate}T00:00:00`).getTime() - 9 * 86_400_000)
      .toISOString().slice(0, 10);
    const r = dosesPrevistas([{ times: ["08:00"], start_date: meio }], de, ate);
    expect(r.previstas, "10 dias × 1 horário").toBe(10);
  });

  it("medicamento encerrado antes da janela não prevê dose nenhuma", () => {
    const [de, ate] = janela(30);
    const r = dosesPrevistas(
      [{ times: ["08:00"], start_date: "2020-01-01", end_date: "2020-02-01" }],
      de, ate,
    );
    expect(r.previstas).toBe(0);
  });

  it("prescrição sem horário fica FORA do denominador e é contada à parte", () => {
    // O esquema permite `times` vazio. Chutar um número ali seria inventar a
    // prescrição; ignorar em silêncio seria esconder que ficou de fora.
    const [de, ate] = janela(30);
    const r = dosesPrevistas([{ times: [] }, { times: null }, { times: ["08:00"] }], de, ate);
    expect(r.previstas, "só o que tem horário entra").toBe(30);
    expect(r.semHorario, "os dois sem horário precisam aparecer").toBe(2);
  });
});

describe("adesão", () => {
  it("o caso que originou tudo: 2 registros sobre 90 previstas NÃO é 100%", () => {
    const [de, ate] = janela(30);
    const a = calcularAdesao(tomado(2), [{ times: ["08:00", "14:00", "20:00"] }], de, ate);
    expect(a.previstas).toBe(90);
    expect(a.tomadas).toBe(2);
    expect(
      Math.round(a.percentual!),
      "pela conta antiga (tomadas ÷ registradas) daria 100%",
    ).toBe(2);
  });

  it("dose pulada conta no denominador e não no numerador", () => {
    const [de, ate] = janela(10);
    const a = calcularAdesao([...tomado(5), ...pulado(5)], [{ times: ["08:00"] }], de, ate);
    expect(a.previstas).toBe(10);
    expect(a.percentual).toBe(50);
  });

  it("sem dose prevista devolve `null`, que não é 0% nem 100%", () => {
    // Os três estados desta sessão inteira: "não tomou", "tomou tudo" e "não
    // há o que medir". Devolver 0 aqui diria ao médico que o paciente não
    // tomou nada; devolver 100 diria o contrário. As duas seriam invenção.
    const [de, ate] = janela(30);
    expect(calcularAdesao([], [], de, ate).percentual).toBeNull();
    expect(calcularAdesao(tomado(3), [{ times: [] }], de, ate).percentual).toBeNull();
  });

  it("não passa de 100% quando há mais registro que previsão", () => {
    // A prescrição pode ter mudado no meio da janela. "112% de adesão" numa
    // tela de médico destrói a confiança no resto dos números.
    const [de, ate] = janela(5);
    const a = calcularAdesao(tomado(20), [{ times: ["08:00"] }], de, ate);
    expect(a.percentual).toBe(100);
    expect(a.tomadas, "o número cru continua disponível para quem quiser ver").toBe(20);
  });

  it("a frase traz o denominador — percentual sem ele não é auditável", () => {
    const [de, ate] = janela(30);
    const a = calcularAdesao(tomado(45), [{ times: ["08:00", "20:00"] }], de, ate);
    expect(explicarAdesao(a)).toBe("45 de 60 doses previstas.");
  });

  it("a frase diz quando uma prescrição ficou de fora", () => {
    const [de, ate] = janela(10);
    const a = calcularAdesao(tomado(5), [{ times: ["08:00"] }, { times: [] }], de, ate);
    expect(explicarAdesao(a)).toContain("1 prescrição(ões) sem horário ficam fora da conta");
  });

  it("a frase distingue 'não há prescrição' de 'não dá para prever'", () => {
    const [de, ate] = janela(10);
    expect(explicarAdesao(calcularAdesao([], [], de, ate)))
      .toBe("Nenhuma medicação prescrita no período.");
    expect(explicarAdesao(calcularAdesao([], [{ times: [] }], de, ate)))
      .toContain("Sem dose previsível no período");
  });
});
