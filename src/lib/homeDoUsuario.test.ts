import { describe, it, expect } from "vitest";
import { homeDoUsuario, HOME_ADMIN, HOME_MEDICO, HOME_PACIENTE } from "./homeDoUsuario";

describe("homeDoUsuario", () => {
  // O caso que motivou o helper: a conta de administrador é obrigada a declarar
  // `account_type = 'medico'` (o CHECK do banco só aceita medico/paciente), e
  // por isso caía num painel de médico vazio pedindo cadastro clínico.
  it("admin sem registro clínico vai para o painel de administração", () => {
    expect(
      homeDoUsuario({ accountType: "medico", ehAdmin: true, temRegistroClinico: false }),
    ).toBe(HOME_ADMIN);
  });

  // Quem realmente atende continua caindo na área clínica: o menu de
  // administração é somado ao dela, não trocado por ele.
  it("admin que também tem registro de médico vai para a área clínica", () => {
    expect(
      homeDoUsuario({ accountType: "medico", ehAdmin: true, temRegistroClinico: true }),
    ).toBe(HOME_MEDICO);
  });

  // A distinção que impede o desvio de pegar quem não devia: um médico
  // recém-cadastrado ainda não tem linha em `doctors` e precisa da área clínica
  // justamente para criá-la.
  it("médico recém-cadastrado, sem registro ainda, vai para a área clínica", () => {
    expect(
      homeDoUsuario({ accountType: "medico", ehAdmin: false, temRegistroClinico: false }),
    ).toBe(HOME_MEDICO);
  });

  it("paciente vai para a área do paciente", () => {
    expect(
      homeDoUsuario({ accountType: "paciente", ehAdmin: false, temRegistroClinico: true }),
    ).toBe(HOME_PACIENTE);
  });

  it("sem perfil conhecido, cai na área do paciente (o menos privilegiado)", () => {
    expect(homeDoUsuario({ accountType: null, ehAdmin: false, temRegistroClinico: false })).toBe(
      HOME_PACIENTE,
    );
  });

  it("admin paciente sem registro também vai para o painel", () => {
    expect(
      homeDoUsuario({ accountType: "paciente", ehAdmin: true, temRegistroClinico: false }),
    ).toBe(HOME_ADMIN);
  });
});
