import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * O que estes testes protegem é o pedido literal: "garantir que realmente está
 * preenchendo o que é mesmo, para que não vá nenhum dado errado".
 *
 * O erro caro aqui tem nome e endereço — o laudo imprime o nome do paciente e o
 * do médico solicitante a duas linhas de distância. Então o teste central não é
 * "o nome aparece": é que o nome que parece de médico **não entra sozinho**.
 */

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { LaudoIdentificacao } from "./LaudoIdentificacao";

const aplicar = vi.fn();
const dispensar = vi.fn();

beforeEach(() => {
  aplicar.mockClear();
  dispensar.mockClear();
});

function montar(
  ident: Record<string, unknown>,
  extra: { atual?: Record<string, string>; nomeDoMedico?: string } = {},
) {
  return render(
    <LaudoIdentificacao
      identificacao={ident}
      nomeDoMedico={extra.nomeDoMedico}
      atual={extra.atual ?? {}}
      onAplicar={aplicar}
      onDispensar={dispensar}
    />,
  );
}

const caixas = () => screen.getAllByRole("checkbox");
const preencher = () => screen.getByRole("button", { name: /Preencher/i });

describe("identificação lida do laudo", () => {
  it("mostra os campos transcritos e preenche com um clique", () => {
    montar({ patient_name: "Maria Souza", patient_age: 68, patient_sex: "Feminino" });

    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("68 anos")).toBeInTheDocument();
    expect(screen.getByText("Feminino")).toBeInTheDocument();

    fireEvent.click(preencher());
    // Já no formato do formulário: sexo vira o código do banco, idade vira só o
    // número. Mandar "Feminino" para uma coluna que aceita "F" seria recusa do
    // banco depois de a tela dizer que preencheu.
    expect(aplicar).toHaveBeenCalledWith({
      patient_name: "Maria Souza", patient_age: "68", patient_sex: "F",
    });
  });

  it("nome com cara de médico vem desmarcado, com o motivo à vista", () => {
    montar({ patient_name: "Dr. Carlos Lima", patient_age: 70 });

    expect(screen.getByText(/tratamento de médico/i)).toBeInTheDocument();
    // Duas caixas, uma marcada (idade) e uma não (nome).
    expect(caixas().filter((c) => c.getAttribute("aria-checked") === "true")).toHaveLength(1);

    fireEvent.click(preencher());
    expect(aplicar).toHaveBeenCalledWith({ patient_age: "70" });
  });

  it("o próprio nome do médico logado também é marcado como suspeito", () => {
    montar({ patient_name: "Augusto Oliveira" }, { nomeDoMedico: "Augusto Oliveira" });

    expect(screen.getByText(/seu próprio nome/i)).toBeInTheDocument();
    expect(preencher()).toBeDisabled();
  });

  it("o médico pode marcar o suspeito — o aviso não impede, só tira do padrão", () => {
    montar({ patient_name: "Dr. Carlos Lima" });

    expect(preencher()).toBeDisabled();
    fireEvent.click(caixas()[0]);
    fireEvent.click(preencher());
    expect(aplicar).toHaveBeenCalledWith({ patient_name: "Dr. Carlos Lima" });
  });

  it("idade calculada do nascimento diz de onde saiu", () => {
    montar({ patient_birth_date: "1958-03-10", exam_date: "2026-08-15" });

    expect(screen.getByText("68 anos")).toBeInTheDocument();
    expect(screen.getByText(/calculada a partir do nascimento em 1958-03-10/)).toBeInTheDocument();
  });

  it("idade escrita que não bate com o nascimento vira suspeita", () => {
    montar({ patient_age: 60, patient_birth_date: "1958-03-10", exam_date: "2026-08-15" });

    expect(screen.getByText(/o laudo escreve 60 anos, mas a data de nascimento dá 68/))
      .toBeInTheDocument();
    expect(preencher()).toBeDisabled();
  });

  it("valor que o médico já digitou não é substituído por inércia", () => {
    montar(
      { patient_name: "Maria Souza", patient_age: 68 },
      { atual: { patient_name: "Maria S. Souza" } },
    );

    expect(screen.getByText(/o formulário já tem Maria S. Souza/)).toBeInTheDocument();
    fireEvent.click(preencher());
    expect(aplicar).toHaveBeenCalledWith({ patient_age: "68" });
  });

  it("valor idêntico ao que já está no formulário não é conflito", () => {
    montar(
      { patient_sex: "F" },
      { atual: { patient_sex: "F" } },
    );

    expect(screen.queryByText(/o formulário já tem/)).not.toBeInTheDocument();
    expect(preencher()).not.toBeDisabled();
  });

  it("sexo que o laudo não escreveu não vira palpite", () => {
    montar({ patient_name: "Maria Souza", patient_sex: "não informado" });

    expect(screen.queryByText("Feminino")).not.toBeInTheDocument();
    fireEvent.click(preencher());
    expect(aplicar).toHaveBeenCalledWith({ patient_name: "Maria Souza" });
  });

  it("sem nada lido, o bloco não aparece — nem como cartão vazio", () => {
    const { container } = montar({ patient_name: null, patient_age: null, patient_sex: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("dispensar não preenche nada", () => {
    montar({ patient_name: "Maria Souza" });
    fireEvent.click(screen.getByRole("button", { name: /Dispensar/i }));
    expect(dispensar).toHaveBeenCalled();
    expect(aplicar).not.toHaveBeenCalled();
  });
});
