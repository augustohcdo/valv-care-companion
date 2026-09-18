import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * A tela dos arquivos de trabalho, renderizada de verdade.
 *
 * Existe porque o navegador deste ambiente não alcança a internet, então a
 * tela autenticada não pode ser conferida por screenshot daqui — e "compila"
 * não é o mesmo que "aparece". O que importa provar é o que a pessoa vê: a
 * lista com a origem certa, o teto escrito, e a recusa antes do envio.
 */

const mocks = vi.hoisted(() => ({
  arquivos: [] as unknown[],
  upload: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: mocks.arquivos, error: null }) }),
      // `.select(...)` depois do insert porque é assim que o cliente real
      // encadeia — e porque `aplicar()` PRECISA das linhas afetadas para
      // enxergar a recusa de RLS, que chega como 200 com zero linhas. O mock
      // devolvia a promessa direto, uma forma que o cliente não tem, e por isso
      // este teste passou a reprovar quando o código foi corrigido.
      insert: (v: unknown) => {
        const resultado = mocks.insert(v) as { error: unknown; data?: unknown };
        // O detalhe que faz este mock valer: SEM `.select(...)` o cliente real
        // não devolve `data`. Modelando os dois iguais, o `aplicar()` enxergaria
        // a lista vazia mesmo sem ninguém ter pedido as linhas — e a inversão
        // desta guarda passava, provando o contrário do que eu queria.
        return Object.assign(Promise.resolve({ error: resultado.error }), {
          select: () => Promise.resolve(resultado),
        });
      },
    }),
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => mocks.upload(...a),
        remove: (...a: unknown[]) => mocks.remove(...a),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://x/y" }, error: null }),
      }),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminArquivos from "./AdminArquivos";
import { toast } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const arquivo = (nome: string, tipo: string, bytes: number) =>
  new File([new Uint8Array(bytes)], nome, { type: tipo });

const enviar = (f: File) => {
  const input = document.getElementById("arquivo") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [f], configurable: true });
  fireEvent.change(input);
};

describe("AdminArquivos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.arquivos = [];
    mocks.upload.mockResolvedValue({ error: null });
    mocks.insert.mockReturnValue({ error: null, data: [{ id: "f1" }] });
    mocks.remove.mockResolvedValue({ error: null });
  });

  it("diz o teto por arquivo onde a pessoa escolhe o arquivo", async () => {
    render(<AdminArquivos />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Arquivo")).toBeInTheDocument());
    expect(screen.getByText(/Até 50 MB por arquivo/)).toBeInTheDocument();
  });

  it("mostra o que o assistente gravou como tal", async () => {
    mocks.arquivos = [{
      id: "a1", storage_path: "2026-08-25/ab-notas.md", titulo: "Notas da rodada",
      descricao: "o que foi decidido", mime_type: "text/markdown", file_bytes: 4096,
      origem: "assistente", created_at: "2026-08-25T12:00:00Z",
    }];
    render(<AdminArquivos />, { wrapper });
    await waitFor(() => expect(screen.getByText("Notas da rodada")).toBeInTheDocument());
    expect(screen.getByText("assistente")).toBeInTheDocument();
    expect(screen.getByText("4 kB")).toBeInTheDocument();
  });

  it("recusa extensão fora da allowlist sem chamar o storage", async () => {
    render(<AdminArquivos />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Arquivo")).toBeInTheDocument());
    enviar(arquivo("script.sh", "text/x-sh", 10));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mocks.upload, "subiu um tipo que o bucket recusaria").not.toHaveBeenCalled();
  });

  it("recusa acima de 50 MB sem chamar o storage", async () => {
    render(<AdminArquivos />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Arquivo")).toBeInTheDocument());
    enviar(arquivo("grande.zip", "application/zip", 55 * 1024 * 1024));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mocks.upload, "tentou subir acima do teto da plataforma").not.toHaveBeenCalled();
  });

  it("recusa de RLS — 200 com zero linhas — também apaga o arquivo subido", async () => {
    /**
     * A forma de falha que ninguém espera, e a razão de `aplicar()` existir.
     *
     * Quando a RLS recusa, o PostgREST não devolve erro: devolve **200 com
     * `error: null` e zero linhas**. Para ele, gravar nada é sucesso.
     *
     * Esta tela chamava `aplicar()` SEM encadear `.select(...)`, e sem as linhas
     * afetadas o helper não tem como ver o zero — o comentário dele diz que
     * nesse caso "segue como sucesso". Quer dizer: o administrador lia "Arquivo
     * guardado", o objeto ficava órfão no bucket, e a lista não o mostrava.
     *
     * Conferido nos dois sentidos: tirando o `.select("id")` do código, este
     * teste reprova.
     */
    mocks.insert.mockReturnValue({ error: null, data: [] });
    render(<AdminArquivos />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Arquivo")).toBeInTheDocument());
    enviar(arquivo("notas.md", "text/markdown", 100));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalled());
    expect(toast.error, "a recusa de RLS precisa chegar ao usuário").toHaveBeenCalled();
    expect(toast.success, "anunciou sucesso sobre escrita que não aconteceu").not.toHaveBeenCalled();
  });

  it("se o registro falhar, apaga o arquivo que já tinha subido", async () => {
    // Sem isto o bucket acumularia objetos que a lista não mostra — e a tela
    // estaria mentindo sobre o que existe lá dentro.
    mocks.insert.mockReturnValue({ error: { message: "recusado" }, data: null });
    render(<AdminArquivos />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Arquivo")).toBeInTheDocument());
    enviar(arquivo("notas.md", "text/markdown", 100));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalled());
  });
});
