import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";
import { TurnstileWidget } from "./TurnstileWidget";
import { supabase } from "@/integrations/supabase/client";

// O widget busca a site key por esta função ao montar.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const invoke = vi.mocked(supabase.functions.invoke);

const render_ = vi.fn((_el: HTMLElement, _opts: Record<string, unknown>) => "widget-1");
const reset = vi.fn();
const remove = vi.fn();

beforeEach(() => {
  render_.mockClear();
  reset.mockClear();
  remove.mockClear();
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { siteKey: "0xTESTE" }, error: null } as never);
  // O script real vem da Cloudflare; aqui basta a interface que usamos.
  (window as any).turnstile = { render: render_, reset, remove };
  document.getElementById("cf-turnstile-script")?.remove();
});

afterEach(() => {
  delete (window as any).turnstile;
  vi.useRealTimers();
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

  /**
   * Os dois silêncios desta tela.
   *
   * O primeiro custou o login inteiro: a `turnstile-config` respondia
   * BOOT_ERROR/503, o widget escrevia uma frase só, e ninguém sabia se faltava
   * um segredo ou se a função tinha caído. O segundo ainda não tinha aparecido
   * e é pior: com o script da Cloudflare bloqueado, o widget sondava
   * `window.turnstile` a cada 50 ms **para sempre**, sem mensagem nenhuma. O
   * botão Entrar ficava desabilitado, idêntico a "ainda carregando".
   */
  describe("quando a verificação não carrega", () => {
    it("diz que falta a chave quando o servidor responde missing_site_key", async () => {
      // O `invoke` devolve o erro com a Response em `context` — é de lá que sai
      // a diferença entre segredo não cadastrado e função caída.
      invoke.mockResolvedValue({
        data: null,
        error: Object.assign(new Error("503"), {
          context: new Response(JSON.stringify({ error: "missing_site_key" }), { status: 503 }),
        }),
      } as never);

      render(<TurnstileWidget onToken={vi.fn()} action="login" />);

      await waitFor(() =>
        expect(screen.getByText(/não está configurada neste ambiente/i)).toBeTruthy(),
      );
      expect(render_).not.toHaveBeenCalled();
    });

    it("mantém a frase genérica quando a função caiu, sem inventar causa", async () => {
      // Falso diagnóstico é pior que diagnóstico nenhum: mandar o usuário
      // desligar o bloqueador quando o problema é nosso faz ele perder tempo e
      // confiar menos na próxima mensagem.
      invoke.mockResolvedValue({
        data: null,
        error: Object.assign(new Error("boot"), {
          context: new Response("Function failed to start", { status: 503 }),
        }),
      } as never);

      render(<TurnstileWidget onToken={vi.fn()} action="login" />);

      await waitFor(() =>
        expect(screen.getByText(/Não foi possível carregar a verificação/i)).toBeTruthy(),
      );
      expect(screen.queryByText(/não está configurada neste ambiente/i)).toBeNull();
    });

    it("desiste do script da Cloudflare e DIZ, em vez de girar calado", async () => {
      // Sem `window.turnstile` e com a tag falhando: antes, silêncio eterno.
      delete (window as any).turnstile;

      render(<TurnstileWidget onToken={vi.fn()} action="login" />);

      const tag = await waitFor(() => {
        const el = document.getElementById("cf-turnstile-script");
        expect(el).toBeTruthy();
        return el!;
      });
      tag.dispatchEvent(new Event("error"));

      await waitFor(() =>
        expect(screen.getByText(/não carregou/i)).toBeTruthy(),
      );
    });

    it("desiste também quando o script nunca responde — nem erro, nem carga", async () => {
      // O caso real do bloqueador que engole a requisição: nenhum `error`
      // dispara, e a sondagem seguia para sempre. Agora há prazo.
      delete (window as any).turnstile;
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<TurnstileWidget onToken={vi.fn()} action="login" />);
      await waitFor(() => expect(document.getElementById("cf-turnstile-script")).toBeTruthy());

      await vi.advanceTimersByTimeAsync(16_000);

      await waitFor(() => expect(screen.getByText(/não carregou/i)).toBeTruthy());
    });
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
