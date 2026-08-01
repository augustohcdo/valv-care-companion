import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { TurnstileWidget } from "./TurnstileWidget";

// O widget busca a site key por esta função ao montar.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { siteKey: "0xTESTE" }, error: null }),
    },
  },
}));

const render_ = vi.fn((_el: HTMLElement, _opts: Record<string, unknown>) => "widget-1");
const reset = vi.fn();
const remove = vi.fn();

beforeEach(() => {
  render_.mockClear();
  reset.mockClear();
  remove.mockClear();
  // O script real vem da Cloudflare; aqui basta a interface que usamos.
  (window as any).turnstile = { render: render_, reset, remove };
});

afterEach(() => {
  delete (window as any).turnstile;
});

describe("TurnstileWidget", () => {
  it("renderiza o desafio com a site key que o servidor informou", async () => {
    render(<TurnstileWidget onToken={vi.fn()} action="login" />);
    await waitFor(() => expect(render_).toHaveBeenCalled());
    expect(render_.mock.calls[0][1]).toMatchObject({ sitekey: "0xTESTE", action: "login" });
  });

  // O token do Turnstile é de uso único: depois de uma tentativa de login, mesmo
  // malsucedida, ele já foi gasto no servidor de auth. Sem este reset o widget
  // seguiria mostrando "verificado" com um token morto na mão, e a tentativa
  // seguinte falharia com uma mensagem que não explica nada.
  it("pede um desafio novo e descarta o token quando o sinal de reset muda", async () => {
    const onToken = vi.fn();
    const { rerender } = render(
      <TurnstileWidget onToken={onToken} action="login" resetSignal={0} />,
    );
    await waitFor(() => expect(render_).toHaveBeenCalled());
    expect(reset).not.toHaveBeenCalled();

    rerender(<TurnstileWidget onToken={onToken} action="login" resetSignal={1} />);

    await waitFor(() => expect(reset).toHaveBeenCalledWith("widget-1"));
    expect(onToken).toHaveBeenCalledWith(null);
  });

  it("não reseta enquanto o sinal não muda", async () => {
    const onToken = vi.fn();
    const { rerender } = render(
      <TurnstileWidget onToken={onToken} action="login" resetSignal={2} />,
    );
    await waitFor(() => expect(render_).toHaveBeenCalled());
    reset.mockClear();

    rerender(<TurnstileWidget onToken={onToken} action="login" resetSignal={2} />);
    expect(reset).not.toHaveBeenCalled();
  });
});
