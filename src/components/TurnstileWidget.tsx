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

function ensureScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve();
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    const check = () => (window.turnstile ? resolve() : setTimeout(check, 50));
    check();
  });
}

interface Props {
  onToken: (token: string | null) => void;
  action?: string;
}

export function TurnstileWidget({ onToken, action }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke("turnstile-config").then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.siteKey) {
        setError("Não foi possível carregar a verificação de segurança.");
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
    ensureScript().then(() => {
      if (!mounted || !ref.current || !window.turnstile) return;
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

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  return <div ref={ref} className="flex justify-center" />;
}

export async function verifyTurnstile(token: string, action?: string) {
  const { data, error } = await supabase.functions.invoke("turnstile-verify", {
    body: { token, action },
  });
  if (error) return false;
  return !!data?.success;
}
