import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Quanto esperamos o script da Cloudflare antes de dizer que ele não veio. */
const ESPERA_MAXIMA_MS = 15_000;

/**
 * Carrega o script da Cloudflare. Devolve `true` se ele ficou disponível.
 *
 * A versão anterior sondava `window.turnstile` a cada 50 ms **para sempre** e
 * não tratava `onerror`. Com o script bloqueado — bloqueador de anúncio, rede
 * corporativa, DNS filtrado —, a promessa nunca resolvia: nenhuma mensagem,
 * nenhum erro no console nosso, e o botão Entrar desabilitado sem explicação,
 * indistinguível de "ainda carregando". É a mesma falha do BOOT_ERROR que
 * fechou o login, com uma diferença que a torna pior: aqui nem a tela de erro
 * aparecia.
 */
function ensureScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve(true);

    let terminou = false;
    const terminar = (ok: boolean) => {
      if (terminou) return;
      terminou = true;
      resolve(ok);
    };

    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      // Sem isto, qualquer erro vindo do script da Cloudflare chega ao nosso
      // monitoramento como "Script error." sem stack — o navegador omite os
      // detalhes de script de outra origem que não foi buscado com CORS.
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
    // Vale tanto para a tag que acabamos de criar quanto para uma que outra
    // instância do widget já tinha posto na página e que falhou.
    s.addEventListener("error", () => terminar(false));

    const limite = Date.now() + ESPERA_MAXIMA_MS;
    const check = () => {
      if (window.turnstile) return terminar(true);
      if (Date.now() >= limite) return terminar(false);
      setTimeout(check, 50);
    };
    check();
  });
}

/**
 * Segredo não cadastrado e função caída davam a MESMA frase ao usuário. A
 * `turnstile-config` agora responde 503 com `error: "missing_site_key"` no
 * primeiro caso, e quem administra o site precisa ver essa diferença: um se
 * resolve cadastrando um segredo, o outro é incidente.
 */
async function motivoDaFalha(erro: unknown): Promise<string> {
  const generico = "Não foi possível carregar a verificação de segurança.";
  const contexto = (erro as { context?: unknown } | null)?.context;
  if (!(contexto instanceof Response)) return generico;
  try {
    const corpo = await contexto.clone().json();
    if (corpo?.error === "missing_site_key") {
      return "A verificação de segurança não está configurada neste ambiente " +
        "(falta a chave do Turnstile). Avise quem administra o site.";
    }
  } catch {
    // corpo não-JSON: fica o genérico, que já é verdade
  }
  return generico;
}

interface Props {
  onToken: (token: string | null) => void;
  action?: string;
  /**
   * Muda de valor para pedir um token novo. O token do Turnstile é de uso
   * único: depois de uma tentativa de login/cadastro — mesmo malsucedida — ele
   * já foi gasto no servidor de auth. Sem este reset o widget continuaria
   * exibindo "verificado" segurando um token morto, e a tentativa seguinte
   * falharia com uma mensagem que não explica nada.
   */
  resetSignal?: number;
}

export function TurnstileWidget({ onToken, action, resetSignal = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke("turnstile-config").then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.siteKey) {
        const msg = await motivoDaFalha(error);
        if (!cancelled) setError(msg);
        return;
      }
      setSiteKey(data.siteKey);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let mounted = true;
    ensureScript().then((carregou) => {
      if (!mounted) return;
      if (!carregou || !window.turnstile) {
        // O caso que antes ficava girando calado. Dizer o que falhou é o que
        // separa "o site está quebrado" de "algo aqui está bloqueando a
        // Cloudflare" — e só a segunda frase o usuário consegue agir sobre.
        setError(
          "A verificação de segurança da Cloudflare não carregou. " +
            "Verifique bloqueador de anúncios, extensão de privacidade ou a rede, " +
            "e recarregue a página.",
        );
        return;
      }
      if (!ref.current) return;
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action: action ?? "login",
          theme: "light",
          callback: (token: string) => onToken(token),
          "error-callback": () => onToken(null),
          "expired-callback": () => onToken(null),
          "timeout-callback": () => onToken(null),
        });
      } catch {
        setError("Falha ao renderizar verificação.");
      }
    });
    return () => {
      mounted = false;
      try {
        if (widgetId.current && window.turnstile) {
          window.turnstile.remove(widgetId.current);
        }
      } catch {
        /* ignore */
      }
    };
  }, [siteKey, action, onToken]);

  // Descarta o token gasto e pede um novo desafio.
  useEffect(() => {
    if (!resetSignal || !widgetId.current || !window.turnstile) return;
    try {
      window.turnstile.reset(widgetId.current);
      onToken(null);
    } catch {
      /* o widget pode já ter sido removido; nada a fazer */
    }
  }, [resetSignal, onToken]);

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  return <div ref={ref} className="flex justify-center" />;
}
