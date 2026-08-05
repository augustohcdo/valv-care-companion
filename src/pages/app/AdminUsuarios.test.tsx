import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  contas: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (nome: string, args?: unknown) => {
      if (nome === "admin_listar_usuarios") {
        return Promise.resolve({ data: mocks.contas, error: null });
      }
      return mocks.rpc(nome, args);
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "eu" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminUsuarios from "./AdminUsuarios";
import { toast } from "sonner";

const conta = (over: Record<string, unknown> = {}) => ({
  user_id: "u1",
  email: "medico@exemplo.com",
  full_name: "Doutora Fulana",
  account_type: "medico",
  papeis: ["medico"],
  criado_em: "2026-08-01T10:00:00Z",
  ultimo_acesso: "2026-08-04T10:00:00Z",
  email_confirmado: true,
  doctor_id: "d1",
  crm: "12345",
  crm_uf: "SP",
  verificado: false,
  eh_paciente: false,
  ...over,
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

const renderTela = () => render(<AdminUsuarios />, { wrapper });

describe("AdminUsuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.contas = [conta()];
  });

  it("lista as contas com papéis e situação do CRM", async () => {
    renderTela();
    await waitFor(() => expect(screen.getByText("Doutora Fulana")).toBeInTheDocument());
    expect(screen.getByText("medico@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText(/CRM 12345\/SP — não verificado/)).toBeInTheDocument();
  });

  it("verificar CRM chama o RPC com o id do médico", async () => {
    renderTela();
    await waitFor(() => expect(screen.getByText("Doutora Fulana")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Verificar CRM/i }));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("admin_verificar_medico", {
        _doctor_id: "d1",
        _verificado: true,
      }),
    );
  });

  it("conceder administrador chama o RPC certo", async () => {
    renderTela();
    await waitFor(() => expect(screen.getByText("Doutora Fulana")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Tornar administrador/i }));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("admin_definir_papel", {
        _user_id: "u1",
        _role: "admin",
        _conceder: true,
      }),
    );
  });

  /**
   * O banco recusa de qualquer jeito — remover o próprio papel trancaria a
   * pessoa para fora, e só SQL direto desfaz. O botão desabilitado evita a
   * viagem e explica antes de o erro acontecer.
   */
  it("o próprio administrador não consegue clicar em remover o próprio papel", async () => {
    mocks.contas = [conta({ user_id: "eu", papeis: ["medico", "admin"], doctor_id: null })];
    renderTela();

    await waitFor(() => expect(screen.getByText("(você)")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Remover administrador/i })).toBeDisabled();
  });

  it("outro administrador pode ter o papel removido", async () => {
    mocks.contas = [conta({ user_id: "outro", papeis: ["admin"], doctor_id: null })];
    renderTela();

    await waitFor(() => expect(screen.getByText("Doutora Fulana")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Remover administrador/i }));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("admin_definir_papel", {
        _user_id: "outro",
        _role: "admin",
        _conceder: false,
      }),
    );
  });

  // O RPC levanta exceção e o cliente devolve `{ error }` sem lançar. Emendar
  // direto no toast de sucesso diria "papel concedido" sobre uma recusa.
  it("recusa do banco não vira sucesso na tela", async () => {
    mocks.rpc.mockResolvedValue({
      error: { message: "voce nao pode remover o proprio papel de administrador" },
    });
    renderTela();
    await waitFor(() => expect(screen.getByText("Doutora Fulana")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Tornar administrador/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("busca filtra por e-mail, nome ou CRM", async () => {
    mocks.contas = [conta(), conta({ user_id: "u2", full_name: "Outro Nome", email: "outro@x.com", crm: "999" })];
    renderTela();
    await waitFor(() => expect(screen.getByText("Doutora Fulana")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/i), { target: { value: "999" } });
    expect(screen.getByText("Outro Nome")).toBeInTheDocument();
    expect(screen.queryByText("Doutora Fulana")).not.toBeInTheDocument();
  });
});
