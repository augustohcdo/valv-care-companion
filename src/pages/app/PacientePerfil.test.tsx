import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * A irmã do `MedicoPerfil`, com o mesmo defeito e o mesmo conserto.
 *
 * `handleSave` gravava em `profiles` e em `patients` conferindo só o `error`, e
 * confirmava com `toast({ title: "Perfil atualizado", description: "Seus dados
 * foram salvos." })`. A RLS recusando um UPDATE responde **200 com
 * `error: null` e zero linhas** — o `if (pErr)` não dispara e a confirmação sai
 * sobre nada escrito.
 *
 * ## Sem ramo de INSERT aqui, e o motivo está no código
 *
 * A leitura usa `.is("deleted_at", null)`, então `pat === null` significa
 * "nunca houve linha" OU "linha encerrada pelo `encerrar_conta`". Inserir sobre
 * a segunda bate no `UNIQUE (user_id)` de `patients` e devolve um conflito cujo
 * texto não nomeia a causa. Relatar a falha é o conserto; criar a linha é uma
 * decisão que exige saber qual dos dois é — e a tela não sabe.
 *
 * ## Por que dois testes e não quatro
 *
 * O que esta tela acrescenta ao que o `MedicoPerfil.test.tsx` já prova é
 * exclusivamente a FIAÇÃO: que estas duas escritas também passam pela
 * conferência. A guarda estática garante o `.select(...)`; que alguém leia a
 * resposta é isto aqui.
 */

const PROFILE = { user_id: "u1", full_name: "João", phone: "11988887777", birth_date: "1970-04-02" };
const PATIENT = { id: "p1", user_id: "u1", sex: "masculino", city: "Santos", uf: "SP", comorbidities: ["Hipertensão"] };

const linhasAfetadas: Record<string, number> = { profiles: 1, patients: 1 };
const updateSpy = vi.fn();

/** Escrita nas duas formas do cliente real: sem `.select(...)` não vem `data`. */
function escrita(resultado: { error: { message: string } | null }, afetadas = 1) {
  const p: any = Promise.resolve(resultado);
  p.select = () =>
    Promise.resolve({
      data: resultado.error ? [] : Array.from({ length: afetadas }, () => ({ id: "r" })),
      error: resultado.error,
    });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          maybeSingle: () =>
            Promise.resolve({ data: table === "profiles" ? PROFILE : PATIENT, error: null }),
        };
        return chain;
      },
      update: (values: any) => ({
        eq: () => {
          updateSpy(table, values);
          return escrita({ error: null }, linhasAfetadas[table] ?? 1);
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, refreshProfile: vi.fn().mockResolvedValue(undefined) }),
}));

const toastDaTela = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({ toast: (...a: any[]) => toastDaTela(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PacientePerfil from "./PacientePerfil";
import { toast as sonner } from "sonner";

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

const confirmou = () =>
  toastDaTela.mock.calls.some(([arg]) => arg?.title === "Perfil atualizado");

describe("PacientePerfil — salvar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linhasAfetadas.profiles = 1;
    linhasAfetadas.patients = 1;
  });

  it("as duas escritas acontecem e só então a tela confirma", async () => {
    render(<PacientePerfil />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Nome completo")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações|Salvar/i }));

    await waitFor(() => expect(confirmou()).toBe(true));
    const tabelas = updateSpy.mock.calls.map(([t]) => t);
    expect(tabelas).toContain("profiles");
    expect(tabelas).toContain("patients");

    // As quatro colunas que o grant de `patients` libera ao paciente —
    // `linked_doctor_id` fica fora, porque o vínculo não se edita por aqui.
    const [, valores] = updateSpy.mock.calls.find(([t]) => t === "patients")!;
    expect(Object.keys(valores).sort()).toEqual(["city", "comorbidities", "sex", "uf"]);
  });

  it("zero linhas em `patients`: NÃO diz que salvou", async () => {
    // A inversão do defeito. Com `error: null` e zero linhas — a forma exata
    // como a RLS recusa — a confirmação não pode sair.
    linhasAfetadas.patients = 0;
    render(<PacientePerfil />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Nome completo")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações|Salvar/i }));

    await waitFor(() => expect(sonner.error).toHaveBeenCalled());
    expect(
      confirmou(),
      'disse "Perfil atualizado" sobre zero linhas em `patients`',
    ).toBe(false);
    expect(sonner.error).toHaveBeenCalledWith(
      "Não foi possível salvar os dados clínicos",
      { description: expect.stringContaining("permissão") },
    );
  });
});
