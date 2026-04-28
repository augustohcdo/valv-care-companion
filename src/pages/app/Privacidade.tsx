import { PrivacyPreferencesPanel } from "@/components/PrivacyPreferencesPanel";
import { SecurityCenter } from "@/components/SecurityCenter";
import { TrustBadges } from "@/components/TrustBadges";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function AppPrivacidade() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
      <header>
        <h1 className="font-serif text-2xl text-primary">Privacidade e segurança</h1>
        <p className="text-sm text-muted-foreground">
          Controle total dos seus dados, consentimentos e da sua conta — com registro de auditoria.
        </p>
        <div className="mt-4">
          <TrustBadges />
        </div>
      </header>

      <SecurityCenter />
      <PrivacyPreferencesPanel />

      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Saiba mais em{" "}
        <Link to="/seguranca" className="underline hover:text-primary">
          Segurança e LGPD
        </Link>.
      </div>
    </div>
  );
}
