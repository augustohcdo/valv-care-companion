import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { registerConsent } from "@/lib/consent";

const STORAGE_KEY = "vp_cookie_prefs_v1";

interface Prefs {
  functional: boolean;
  analytics: boolean;
  decidedAt: string;
}

export const CookieBanner = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const persist = async (prefs: Omit<Prefs, "decidedAt">) => {
    const full: Prefs = { ...prefs, decidedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(full)); } catch {}
    setOpen(false);
    if (user) {
      try {
        await Promise.all([
          registerConsent({ type: "cookies_functional", granted: prefs.functional, source: "cookie_banner" }),
          registerConsent({ type: "cookies_analytics", granted: prefs.analytics, source: "cookie_banner" }),
        ]);
      } catch {}
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      className="fixed bottom-0 inset-x-0 sm:bottom-4 sm:left-auto sm:right-4 sm:inset-x-auto z-50 sm:max-w-md rounded-t-xl sm:rounded-xl border border-border bg-card shadow-lg p-4 animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
          <Cookie className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Sua privacidade, sua escolha</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Usamos cookies estritamente necessários e, com seu consentimento, cookies funcionais e
            analíticos para melhorar a Plataforma. Saiba mais em{" "}
            <Link to="/cookies" className="underline text-primary">Política de Cookies</Link>.
          </p>

          {showCustomize && (
            <div className="mt-3 space-y-2 text-xs">
              <label className="flex items-center justify-between gap-3 p-2 rounded-md bg-secondary/40">
                <span><strong>Necessários</strong> · sempre ativos</span>
                <input type="checkbox" checked disabled className="h-4 w-4 accent-primary" />
              </label>
              <label className="flex items-center justify-between gap-3 p-2 rounded-md bg-secondary/40 cursor-pointer">
                <span><strong>Funcionais</strong> · preferências</span>
                <input type="checkbox" checked={functional} onChange={(e) => setFunctional(e.target.checked)} className="h-4 w-4 accent-primary" />
              </label>
              <label className="flex items-center justify-between gap-3 p-2 rounded-md bg-secondary/40 cursor-pointer">
                <span><strong>Analíticos</strong> · métricas agregadas</span>
                <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="h-4 w-4 accent-primary" />
              </label>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!showCustomize ? (
              <>
                <Button size="sm" onClick={() => persist({ functional: true, analytics: true })}>
                  Aceitar todos
                </Button>
                <Button size="sm" variant="outline" onClick={() => persist({ functional: false, analytics: false })}>
                  Apenas necessários
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCustomize(true)}>
                  Personalizar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => persist({ functional, analytics })}>
                  Salvar escolhas
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCustomize(false)}>
                  Voltar
                </Button>
              </>
            )}
          </div>
        </div>
        <button
          aria-label="Fechar (apenas necessários)"
          onClick={() => persist({ functional: false, analytics: false })}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
