import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasError: boolean };

class GlobalErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[global-error-boundary]", error, info.componentStack);
  }

  render() {
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

// Auto-reload once when a lazy-loaded chunk fails to load (typically after a
// redeploy invalidates the hashed filenames the current tab still references).
const RELOAD_KEY = "vp:chunk-reloaded";
const isChunkLoadError = (msg: string) =>
  /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i.test(
    msg,
  );

window.addEventListener("error", (e) => {
  const msg = e?.message || "";
  if (isChunkLoadError(msg) && !sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
  }
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = (e?.reason && (e.reason.message || String(e.reason))) || "";
  if (isChunkLoadError(msg) && !sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
  }
});

// Clear the guard once the app boots successfully so future deploys can recover again.
setTimeout(() => sessionStorage.removeItem(RELOAD_KEY), 10_000);

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
