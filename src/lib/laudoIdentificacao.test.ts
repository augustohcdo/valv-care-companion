import { describe, it, expect } from "vitest";
import {
  normalizarSexo, idadeEm, pareceNomeDeMedico, camposDoLaudo, paraFormulario,
} from "./laudoIdentificacao";

describe("normalizarSexo", () => {
  it("aceita as formas que os laudos escrevem", () => {
    for (const t of ["F", "f", "Fem", "Feminino", "female", "mulher"]) {
      expect(normalizarSexo(t)).toBe("F");
    }
    for (const t of ["M", "Masc", "Masculino", "male", "homem"]) {
      expect(normalizarSexo(t)).toBe("M");
    }
  });

  it("devolve null em vez de chutar", () => {
    // Um campo de sexo errado no prontuário é pior que um campo vazio.
    expect(normalizarSexo("indeterminado")).toBeNull();
    expect(normalizarSexo("")).toBeNull();
    expect(normalizarSexo(null)).toBeNull();
  });
});

describe("idadeEm", () => {
  it("conta anos completos", () => {
    expect(idadeEm("1960-03-12", "2026-08-15")).toBe(66);
  });

  it("não arredonda para cima antes do aniversário", () => {
    expect(idadeEm("1960-09-12", "2026-08-15")).toBe(65);
    expect(idadeEm("1960-08-16", "2026-08-15")).toBe(65);
    expect(idadeEm("1960-08-15", "2026-08-15")).toBe(66);
  });

  it("recusa data inválida ou fora de ordem, em vez de inventar", () => {
    expect(idadeEm("12/03/1960", "2026-08-15")).toBeNull();
    expect(idadeEm("2030-01-01", "2026-08-15")).toBeNull();
    expect(idadeEm("1800-01-01", "2026-08-15")).toBeNull();
  });
});

describe("pareceNomeDeMedico", () => {
  /**
   * O erro que mais custa caro nesta leitura: o laudo imprime o nome do
   * paciente e o do solicitante a poucas linhas de distância, e trocar os dois
   * renomearia o prontuário inteiro.
   */
  it("acusa tratamento de médico", () => {
    expect(pareceNomeDeMedico("Dr. Beltrano de Souza")).toMatch(/tratamento de médico/);
    expect(pareceNomeDeMedico("Dra Ana Lima")).toMatch(/tratamento de médico/);
  });

  it("acusa CRM no meio do nome", () => {
    expect(pareceNomeDeMedico("Ana Lima CRM 12345")).toMatch(/CRM/);
  });

  it("acusa quando é o nome de quem está usando o sistema", () => {
    expect(pareceNomeDeMedico("Augusto Oliveira", "Augusto Oliveira"))
      .toMatch(/seu próprio nome/);
  });

  it("nome comum de paciente passa limpo", () => {
    expect(pareceNomeDeMedico("João S.", "Augusto Oliveira")).toBeNull();
    // "Andre" contém "dr" no meio e não pode disparar o alarme.
    expect(pareceNomeDeMedico("Andre Pereira")).toBeNull();
  });
});

describe("camposDoLaudo", () => {
  it("transcreve o que o laudo escreveu", () => {
    const c = camposDoLaudo({
      patient_name: "João S.", patient_age: 65, patient_sex: "Masculino",
    });
    expect(c.map((x) => x.key)).toEqual(["patient_name", "patient_age", "patient_sex"]);
    expect(c[1].valor).toBe("65 anos");
    expect(c[2].valor).toBe("Masculino");
  });

  it("campo ausente no laudo simplesmente não aparece", () => {
    expect(camposDoLaudo({ patient_name: "João S." }).map((x) => x.key))
      .toEqual(["patient_name"]);
    expect(camposDoLaudo({})).toEqual([]);
  });

  it("calcula a idade do nascimento e diz de onde saiu", () => {
    // Muitos laudos imprimem o nascimento e não a idade. Calcular é aritmética
    // verificável — e a tela mostra a conta, não só o resultado.
    const c = camposDoLaudo({ patient_birth_date: "1960-03-12", exam_date: "2026-08-15" });
    expect(c[0].valor).toBe("66 anos");
    expect(c[0].derivacao).toMatch(/1960-03-12/);
  });

  it("idade escrita vence a calculada, e a divergência é acusada", () => {
    const c = camposDoLaudo({
      patient_age: 70, patient_birth_date: "1960-03-12", exam_date: "2026-08-15",
    });
    expect(c[0].valor).toBe("70 anos");
    expect(c[0].suspeita).toMatch(/laudo escreve 70 anos, mas a data de nascimento dá 66/);
  });

  it("nome suspeito chega marcado", () => {
    const c = camposDoLaudo({ patient_name: "Dr. Beltrano" });
    expect(c[0].suspeita).toMatch(/tratamento de médico/);
  });

  it("sexo que o laudo escreveu de forma estranha não entra", () => {
    expect(camposDoLaudo({ patient_sex: "N/D" }).map((x) => x.key)).toEqual([]);
  });

  it("idade fora da faixa do banco não entra", () => {
    expect(camposDoLaudo({ patient_age: 150 }).map((x) => x.key)).toEqual([]);
  });
});

describe("paraFormulario", () => {
  it("converte cada campo para o que o formulário espera", () => {
    const ident = { patient_name: "João S.", patient_age: 65, patient_sex: "Masculino" };
    const [nome, idade, sexo] = camposDoLaudo(ident);
    expect(paraFormulario(nome, ident)).toBe("João S.");
    expect(paraFormulario(idade, ident)).toBe("65");
    expect(paraFormulario(sexo, ident)).toBe("M");
  });
});
