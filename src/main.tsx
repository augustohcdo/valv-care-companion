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

createRoot(document.getElementById("root")!).render(<App />);
