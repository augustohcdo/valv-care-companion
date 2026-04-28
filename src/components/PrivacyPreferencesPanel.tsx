import { useEffect, useState } from "react";
import { ShieldCheck, History, Loader2, AlertTriangle, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CONSENT_CATALOG,
  ConsentType,
  registerConsent,
} from "@/lib/consent";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConsentRow {
  consent_type: ConsentType;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  document_version: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  consent_type: ConsentType;
  action: "granted" | "revoked";
  document_version: string;
  source: string | null;
  created_at: string;
}

export function PrivacyPreferencesPanel() {
  const { user, profile } = useAuth();
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ConsentType | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ConsentType | null>(null);

  const audience = profile?.account_type ?? "all";
  const items = CONSENT_CATALOG.filter(
    (c) => c.audience === "all" || c.audience === audience
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase
        .from("user_consents")
        .select("consent_type, granted, granted_at, revoked_at, document_version, updated_at")
        .eq("user_id", user.id),
      supabase
        .from("consent_audit_log")
        .select("id, consent_type, action, document_version, source, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setConsents((c ?? []) as ConsentRow[]);
    setAudit((a ?? []) as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const stateOf = (type: ConsentType) =>
    consents.find((c) => c.consent_type === type);

  const update = async (type: ConsentType, granted: boolean) => {
    setSaving(type);
    try {
      await registerConsent({ type, granted, source: "preferences" });
      toast.success(granted ? "Consentimento registrado" : "Consentimento revogado");
      await load();
    } catch (e: any) {
      toast.error("Não foi possível atualizar", { description: e.message });
    } finally {
      setSaving(null);
      setPendingRevoke(null);
    }
  };

  const handleToggle = (type: ConsentType, next: boolean, required: boolean) => {
    if (!next && required) {
      toast.warning("Consentimento obrigatório", {
        description:
          "Esse consentimento é necessário para usar a plataforma. Para revogá-lo, exclua sua conta entrando em contato com o suporte.",
      });
      return;
    }
    if (!next) {
      setPendingRevoke(type);
      return;
    }
    update(type, true);
  };

  const labelFor = (t: ConsentType) =>
    CONSENT_CATALOG.find((c) => c.type === t)?.title ?? t;

  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Privacidade e consentimentos (LGPD)</CardTitle>
              <CardDescription>
                Gerencie quais tratamentos de dados você autoriza. Você pode revogar
                consentimentos opcionais a qualquer momento. Tudo é registrado para auditoria.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((def) => {
                const state = stateOf(def.type);
                const granted = state?.granted ?? false;
                return (
                  <div
                    key={def.type}
                    className="rounded-lg border border-border/70 bg-card p-4 flex items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground">{def.title}</p>
                        {def.required && (
                          <Badge variant="secondary" className="text-[10px]">
                            Obrigatório
                          </Badge>
                        )}
                        {granted ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                            <Check className="h-3 w-3 mr-1" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            <X className="h-3 w-3 mr-1" /> Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {def.description}
                      </p>
                      {state && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {granted && state.granted_at
                            ? `Aceito em ${format(new Date(state.granted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                            : state.revoked_at
                            ? `Revogado em ${format(new Date(state.revoked_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                            : null}
                          {" · "}versão {state.document_version}
                        </p>
                      )}
                    </div>
                    <div className="pt-1">
                      <Switch
                        checked={granted}
                        disabled={saving === def.type}
                        onCheckedChange={(v) => handleToggle(def.type, v, def.required)}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Para exclusão definitiva da conta e portabilidade dos seus dados,
                  contate o encarregado de dados (DPO) pelo e-mail{" "}
                  <a href="mailto:valvepath@gmail.com" className="underline">
                    valvepath@gmail.com
                  </a>
                  .
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico de auditoria
          </CardTitle>
          <CardDescription>
            Últimas {audit.length} ações registradas em sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <ul className="space-y-2">
              {audit.map((a, i) => (
                <li key={a.id}>
                  <div className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{labelFor(a.consent_type)}</span>{" "}
                        <span
                          className={
                            a.action === "granted"
                              ? "text-emerald-700"
                              : "text-destructive"
                          }
                        >
                          {a.action === "granted" ? "aceito" : "revogado"}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                          locale: ptBR,
                        })}
                        {a.source ? ` · origem: ${a.source}` : ""} · versão {a.document_version}
                      </p>
                    </div>
                  </div>
                  {i < audit.length - 1 && <Separator />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingRevoke} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar consentimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a revogar:{" "}
              <strong>{pendingRevoke ? labelFor(pendingRevoke) : ""}</strong>. A ação será
              registrada no log de auditoria. Algumas funcionalidades poderão deixar de
              funcionar até que o consentimento seja restabelecido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRevoke && update(pendingRevoke, false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar revogação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
