import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);
