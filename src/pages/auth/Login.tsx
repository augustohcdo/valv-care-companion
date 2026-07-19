import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { loginSchema, LoginInput } from "@/lib/validators";
import {
  getLockRemaining,
  registerFail,
  clearFails,
  formatRemaining,
} from "@/lib/loginLockout";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/Logo";
import { TurnstileWidget, verifyTurnstile } from "@/components/TurnstileWidget";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const params = new URLSearchParams(location.search);
  const accountHint = params.get("type"); // medico | paciente | null
  const fromPath = (location.state as { from?: string })?.from;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const emailValue = watch("email") ?? "";
  const [lockMs, setLockMs] = useState(0);

  // Poll the lockout timer while it's active.
  useEffect(() => {
    const tick = () => setLockMs(getLockRemaining(emailValue));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [emailValue]);

  const redirectAfterLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .maybeSingle();
    const dest = fromPath ?? (profile?.account_type === "medico" ? "/app/medico" : "/app/paciente");
    navigate(dest, { replace: true });
  };

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const handleCaptcha = useCallback((t: string | null) => setCaptchaToken(t), []);

  const onSubmit = async (values: LoginInput) => {
    const remaining = getLockRemaining(values.email);
    if (remaining > 0) {
      toast.error("Muitas tentativas", {
        description: `Aguarde ${formatRemaining(remaining)} antes de tentar novamente.`,
      });
      return;
    }
    if (!captchaToken) {
      toast.error("Verificação de segurança", {
        description: "Complete a verificação anti-robô antes de entrar.",
      });
      return;
    }
    setSubmitting(true);
    const captchaOk = await verifyTurnstile(captchaToken, "login");
    if (!captchaOk) {
      setSubmitting(false);
      setCaptchaToken(null);
      toast.error("Verificação de segurança falhou", {
        description: "Tente novamente.",
      });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      const applied = registerFail(values.email);
      setLockMs(getLockRemaining(values.email));
      setCaptchaToken(null);
      toast.error("Não foi possível entrar", {
        description:
          applied > 0
            ? `Conta temporariamente bloqueada por ${formatRemaining(applied)} por segurança.`
            : error.message,
      });
      return;
    }
    clearFails(values.email);
    toast.success("Bem-vindo de volta");
    await redirectAfterLogin();
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth/callback",
    });
    if (result.error) toast.error("Falha no login com Google");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10 bg-gradient-to-b from-background to-secondary/40">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo />
          <h1 className="font-serif text-3xl text-primary">Entrar</h1>
          <p className="text-sm text-muted-foreground text-center">
            {accountHint === "medico"
              ? "Acesso da área médica"
              : accountHint === "paciente"
              ? "Acesso do paciente"
              : "Acesse sua conta ValvePath"}
          </p>
        </div>

        <Card className="shadow-md-soft border-border/70">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Acessar plataforma</CardTitle>
            <CardDescription>
              Conexão criptografada. Seus dados estão protegidos pela LGPD.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              onClick={handleGoogle}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1A6.61 6.61 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continuar com Google
            </Button>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-3 text-xs text-muted-foreground">
                ou com e-mail
              </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" autoComplete="email" className="pl-9" {...register("email")} />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link to="/auth/recuperar" className="text-xs text-primary hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" autoComplete="current-password" className="pl-9" {...register("password")} />
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>

              {lockMs > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Muitas tentativas de login. Tente novamente em <strong>{formatRemaining(lockMs)}</strong>.
                    Se não foi você, altere sua senha assim que possível.
                  </span>
                </div>
              )}

              <Button type="submit" variant="hero" className="w-full h-11" disabled={submitting || lockMs > 0}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Ainda não tem conta?{" "}
          <Link to="/auth/cadastro" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
