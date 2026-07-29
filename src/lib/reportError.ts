import { supabase } from "@/integrations/supabase/client";

/** Envia um erro client-side para monitoramento (best-effort, nunca lança). */
export function reportError(error: unknown, extra?: { componentStack?: string }) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = (error instanceof Error ? error.stack : null) ?? extra?.componentStack ?? null;
    void supabase.functions.invoke("report-error", {
      body: {
        message,
        stack,
        route: window.location.pathname,
        userAgent: navigator.userAgent,
      },
    });
  } catch {
    // best-effort: nunca deixa o reporte de erro causar outro erro
  }
}
