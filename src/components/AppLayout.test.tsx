import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const estado = vi.hoisted(() => ({
  isAdmin: false,
  medico: null as { id: string } | null,
  paciente: null as { id: string } | null,
  accountType: "medico" as string,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    profile: { full_name: "Fulano de Tal", account_type: estado.accountType },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdmin: estado.isAdmin, carregando: false }),
}));

vi.mock("@/hooks/useDoctor", () => ({
  useDoctor: () => ({ data: estado.medico, isLoading: false }),
}));

vi.mock("@/hooks/usePatient", () => ({
  usePatient: () => ({ data: estado.paciente, isLoading: false }),
}));

// Filhos pesados do layout que não interessam a este teste.
vi.mock("@/components/NotificationsBell", () => ({ NotificationsBell: () => null }));
vi.mock("@/components/CommandPalette", () => ({
  CommandPalette: () => null,
  CommandPaletteTrigger: () => null,
}));
vi.mock("@/components/MobileBottomNav", () => ({ MobileBottomNav: () => null }));
vi.mock("@/components/ExportQueueDock", () => ({ ExportQueueDock: () => null }));

import { AppLayout } from "./AppLayout";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter initialEntries={["/app/admin"]}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const renderLayout = () => render(<AppLayout />, { wrapper });

describe("AppLayout — menu", () => {
  beforeEach(() => {
    estado.isAdmin = false;
    estado.medico = null;
    estado.paciente = null;
    estado.accountType = "medico";
  });

  /**
   * O defeito que o usuário encontrou ao entrar como administrador pela
   * primeira vez.
   *
   * A conta de admin é obrigada a declarar `account_type = 'medico'` — o CHECK
   * do banco só aceita `medico` e `paciente` —, então recebia o menu clínico
   * inteiro sem ter registro em `doctors`. Quem clicasse em "Pacientes" ou
   * "Casos clínicos" só encontrava pedidos para completar um cadastro que
   * aquela conta nunca teria.
   */
  it("admin sem registro de médico não recebe o menu clínico", async () => {
    estado.isAdmin = true;
    renderLayout();

    await waitFor(() => expect(screen.getAllByText("Administração").length).toBeGreaterThan(0));
    expect(screen.queryByText("Casos clínicos")).not.toBeInTheDocument();
    expect(screen.queryByText("Novo caso")).not.toBeInTheDocument();
    expect(screen.queryByText("Agenda")).not.toBeInTheDocument();
  });

  // Quem realmente atende continua com tudo: o menu de administração é somado
  // ao clínico, não trocado por ele.
  it("admin que também é médico de verdade mantém os dois menus", async () => {
    estado.isAdmin = true;
    estado.medico = { id: "d1" };
    renderLayout();

    await waitFor(() => expect(screen.getAllByText("Casos clínicos").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Administração").length).toBeGreaterThan(0);
  });

  /**
   * A supressão não pode pegar quem não devia: um médico recém-cadastrado
   * ainda não tem linha em `doctors` e precisa da área clínica justamente para
   * criá-la. Por isso ela só vale para quem é administrador.
   */
  it("médico sem registro ainda, e sem papel de admin, mantém o menu clínico", async () => {
    renderLayout();
    await waitFor(() => expect(screen.getAllByText("Casos clínicos").length).toBeGreaterThan(0));
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
  });

  it("paciente comum vê o menu do paciente e nada de administração", async () => {
    estado.accountType = "paciente";
    estado.paciente = { id: "p1" };
    renderLayout();

    await waitFor(() => expect(screen.getAllByText("Minha jornada").length).toBeGreaterThan(0));
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
    expect(screen.queryByText("Casos clínicos")).not.toBeInTheDocument();
  });
});
