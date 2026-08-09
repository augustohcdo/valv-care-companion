import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { reportError } from "./lib/reportError";
import { isChunkLoadError, recarregarUmaVez, liberarRecarga } from "./lib/chunkReload";
import "./index.css";

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasError: boolean };

class GlobalErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[global-error-boundary]", error, info.componentStack);
    reportError(error, { componentStack: info.componentStack ?? undefined });
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive grid place-items-center text-xl font-semibold">
            !
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-primary">Não foi possível carregar o ValvePath</h1>
            <p className="text-sm text-muted-foreground">
              Recarregue a página. Se o problema continuar, entre em contato pelo canal oficial.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Recarregar
            </button>
            <a
              href="/contato"
              className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-secondary"
            >
              Contato
            </a>
          </div>
        </section>
      </main>
    );
  }
}

// Recarga automática quando um pedaço do app não carrega — tipicamente depois de
// um deploy, na aba que ficou aberta. O reconhecimento vive em
// `lib/chunkReload.ts`, testável com as mensagens reais que os navegadores
// emitem: a lista que estava aqui não cobria a que apareceu em produção.
window.addEventListener("error", (e) => {
  const msg = e?.message || "";
  if (isChunkLoadError(msg)) {
    recarregarUmaVez(sessionStorage, () => window.location.reload());
    return;
  }
  // filename/lineno/colno vinham no evento e eram jogados fora. Num
  // "Script error." — sem stack por vir de outra origem — eles são a única
  // pista de onde o erro nasceu.
  reportError(e.error ?? msg, {
    filename: e.filename || undefined,
    lineno: e.lineno || undefined,
    colno: e.colno || undefined,
  });
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = (e?.reason && (e.reason.message || String(e.reason))) || "";
  if (isChunkLoadError(msg)) {
    recarregarUmaVez(sessionStorage, () => window.location.reload());
    return;
  }
  reportError(e.reason ?? msg);
});

// Libera a trava depois que o app subiu, para que um deploy seguinte na mesma
// aba volte a poder se curar sozinho.
setTimeout(() => liberarRecarga(sessionStorage), 10_000);

// Idle prefetch of likely-next routes based on where the user landed.
const idle: (cb: () => void) => void =
  (window as any).requestIdleCallback?.bind(window) ?? ((cb) => setTimeout(cb, 800));
idle(() => {
  import("./lib/prefetch").then(({ prefetchRoute }) => {
    const p = window.location.pathname;
    if (p.startsWith("/app/medico")) {
      ["/app/medico", "/app/medico/casos", "/app/medico/pacientes", "/app/medico/agenda"].forEach(prefetchRoute);
    } else if (p.startsWith("/app/paciente")) {
      ["/app/paciente", "/app/paciente/jornada", "/app/paciente/diario", "/app/paciente/medicacoes"].forEach(prefetchRoute);
    } else {
      ["/aprender", "/aprender/faq", "/aprender/glossario"].forEach(prefetchRoute);
    }
  });
});

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>,
);
