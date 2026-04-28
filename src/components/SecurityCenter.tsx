import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, KeyRound, Mail, LogOut, Clock, Smartphone, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function SecurityCenter() {
  const { user, signOut } = useAuth();
  const [sendingReset, setSendingReset] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const provider = user?.app_metadata?.provider ?? "email";
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const emailConfirmed = !!user?.email_confirmed_at;

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/redefinir`,
      });
      if (error) throw error;
      toast.success("Enviamos um link para redefinir sua senha.");
    } catch (e: any) {
      toast.error("Não foi possível enviar", { description: e.message });
    } finally {
      setSendingReset(false);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOutAll(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      toast.success("Você saiu de todos os dispositivos.");
    } catch (e: any) {
      toast.error("Erro ao encerrar sessões", { description: e.message });
    } finally {
      setSigningOutAll(false);
    }
  };

  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Centro de segurança</CardTitle>
            <CardDescription>
              Status da sua conta, sessões ativas e ações rápidas para proteger seus dados.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Mail className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">E-mail</span>
              {emailConfirmed ? (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Não confirmado
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground break-all">{user?.email}</p>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <KeyRound className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Método de acesso</span>
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {provider === "google" ? "Google" : "E-mail e senha"}
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Último acesso</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {lastSignIn
                ? format(lastSignIn, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : "Sem registro"}
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Smartphone className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Conta criada em</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {createdAt ? format(createdAt, "dd/MM/yyyy", { locale: ptBR }) : "—"}
            </p>
          </div>
        </div>

        {/* Garantias */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900 space-y-1.5">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" /> Sua conta está protegida por:
          </p>
          <ul className="pl-5 list-disc space-y-0.5">
            <li>Verificação contra senhas vazadas (HIBP)</li>
            <li>Criptografia em trânsito (TLS) e em repouso</li>
            <li>Row-Level Security em todas as tabelas clínicas</li>
            <li>Trilha de auditoria de consentimentos</li>
          </ul>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          {provider === "email" && (
            <Button
              variant="outline"
              size="sm"
              onClick={sendPasswordReset}
              disabled={sendingReset}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {sendingReset ? "Enviando…" : "Trocar minha senha"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={signOutEverywhere}
            disabled={signingOutAll}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {signingOutAll ? "Encerrando…" : "Sair de todos os dispositivos"}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sair apenas deste dispositivo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
