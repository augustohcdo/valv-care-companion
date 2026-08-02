import { supabase } from "@/integrations/supabase/client";

/** Origem do erro no código, quando o navegador informa. */
export type ErrorOrigin = {
  filename?: string;
  lineno?: number;
  colno?: number;
  componentStack?: string;
};

/**
 * Um erro em laço dispara o mesmo reporte dezenas de vezes por segundo. As 20
 * primeiras linhas que `client_errors` recebeu vieram de um aparelho só, em 6,6
 * segundos. O servidor agrupa repetições, mas cortar aqui evita as chamadas de
 * rede antes de existirem.
 */
const enviados = new Map<string, number>();
const JANELA_MS = 60_000;
const TETO_POR_CARGA = 10;
let total = 0;

function jaEnviadoAgora(assinatura: string): boolean {
  const agora = Date.now();
  const anterior = enviados.get(assinatura);
  if (anterior !== undefined && agora - anterior < JANELA_MS) return true;
  enviados.set(assinatura, agora);
  return false;
}

/** Envia um erro client-side para monitoramento (best-effort, nunca lança). */
export function reportError(error: unknown, extra?: ErrorOrigin) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack =
      (error instanceof Error ? error.stack : null) ?? extra?.componentStack ?? null;

    const assinatura = `${message}|${extra?.filename ?? ""}|${extra?.lineno ?? ""}`;
    if (jaEnviadoAgora(assinatura)) return;
    if (total >= TETO_POR_CARGA) return;
    total += 1;

    void supabase.functions.invoke("report-error", {
      body: {
        message,
        stack,
        route: window.location.pathname,
        userAgent: navigator.userAgent,
        // Sem stack, isto é o que sobra para localizar o erro.
        filename: extra?.filename,
        lineno: extra?.lineno,
        colno: extra?.colno,
      },
    });
  } catch {
    // best-effort: nunca deixa o reporte de erro causar outro erro
  }
}

/** Só para os testes: zera o estado de deduplicação entre casos. */
export function __resetReportErrorState() {
  enviados.clear();
  total = 0;
}
