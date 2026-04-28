import { PrivacyPreferencesPanel } from "@/components/PrivacyPreferencesPanel";

export default function AppPrivacidade() {
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="font-serif text-2xl text-primary">Privacidade e LGPD</h1>
        <p className="text-sm text-muted-foreground">
          Controle total dos consentimentos da sua conta com registro de auditoria.
        </p>
      </header>
      <PrivacyPreferencesPanel />
    </div>
  );
}
