import { useState, useEffect, useRef, useId, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Stethoscope, HeartPulse, ShieldCheck, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  patientSignupSchema,
  PatientSignupInput,
  UF_LIST,
} from "@/lib/validators";
import { ConsentType, CONSENT_VERSION } from "@/lib/consent";
import { bloquearSeSenhaVazada } from "@/lib/hibp";
import { TurnstileWidget } from "@/components/TurnstileWidget";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";

type Step = "choose" | "paciente" | "confirmar";

/** Scroll to first validation error field, focus it, and announce via live region.
 *  `submitCount` ensures the effect re-fires even when the same errors persist.
 *  The announce uses a two-frame clear→set cycle so identical messages are still
 *  picked up by screen readers, and a debounce prevents overlapping announcements
 *  during rapid repeated submits. */
function useScrollToError(errors: Record<string, any>, fieldOrder: string[], submitCount: number) {
  const errorKeys = fieldOrder.filter((k) => errors[k]).join(",");
  const liveRef = useRef<HTMLDivElement | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout>>();
  const prevSubmit = useRef(0);

  // Persistent assertive live region (visually hidden, no role="alert" to avoid
  // double-announcement — aria-live="assertive" is sufficient)
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("aria-live", "assertive");
    el.setAttribute("aria-atomic", "true");
    Object.assign(el.style, {
      position: "absolute", width: "1px", height: "1px",
      overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
    });
    document.body.appendChild(el);
    liveRef.current = el;
    return () => { el.remove(); liveRef.current = null; };
  }, []);

  useEffect(() => {
    if (!errorKeys || submitCount === 0 || submitCount === prevSubmit.current) return;
    prevSubmit.current = submitCount;

    const firstKey = errorKeys.split(",")[0];
    const firstMsg = errors[firstKey]?.message ?? errors[firstKey];

    // Debounce: cancel any pending announcement from a previous rapid tap
    clearTimeout(announceTimer.current);

    // Announce only the first error — keep it short for SR users
    if (liveRef.current && typeof firstMsg === "string") {
      // 1) Clear so the SR registers a content change even if the text is identical
      liveRef.current.textContent = "";
      // 2) Set on next frame after the clear has been observed by the accessibility tree
      announceTimer.current = setTimeout(() => {
        if (liveRef.current) liveRef.current.textContent = firstMsg;
      }, 80);
    }

    requestAnimationFrame(() => {
      const el =
        document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`) ??
        document.querySelector<HTMLElement>(`[name="${firstKey}"]`);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const scrollTarget = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;

      try {
        window.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      } catch {
        window.scrollTo(0, Math.max(0, scrollTarget));
      }

      setTimeout(() => {
        const focusable =
          el instanceof HTMLInputElement || el instanceof HTMLSelectElement
            ? el
            : (el.querySelector<HTMLElement>("input, button, [tabindex]"));
        if (focusable) {
          try { focusable.focus({ preventScroll: true }); } catch { focusable.focus(); }
        }
      }, 350);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorKeys, submitCount]);
}

/**
 * Consentimentos aceitos no formulário, enviados nos metadados do cadastro.
 *
 * Eles NÃO são gravados daqui. A confirmação de e-mail é obrigatória, então o
 * `signUp` devolve `session: null` — e a RLS de `user_consents` exige sessão.
 * Gravar pelo navegador era impossível: a chamada ficava dentro de um
 * `if (session)` e nunca era sequer tentada. Quem grava é o gatilho
 * `handle_new_user`, no mesmo instante da criação da conta.
 */
function consentimentosDoCadastro(audience: "paciente"): ConsentType[] {
  const tipos: ConsentType[] = ["terms_of_use", "privacy_policy", "medical_disclaimer"];
  // O paciente também já consente, no cadastro, com compartilhamento com o médico vinculado
  if (audience === "paciente") tipos.push("data_sharing_doctor");
  return tipos;
}

/**
 * O cadastro não termina no formulário: a conta só passa a existir de verdade
 * quando o e-mail é confirmado. Antes desta tela o usuário era mandado direto
 * para a área logada, sem sessão, e voltava expulso para o login sem entender
 * o motivo.
 */
function ConfirmeSeuEmail({ email }: { email: string }) {
  return (
    <Card className="shadow-md-soft border-border/70">
      <CardContent className="p-8 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-accent/10 text-accent grid place-items-center mx-auto">
          <Mail className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="font-serif text-2xl text-primary">Confirme seu e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>.
            Abra o e-mail e clique no link para ativar sua conta.
          </p>
        </div>
        <div className="rounded-lg bg-secondary/50 p-4 text-left text-sm space-y-1.5">
          <p className="font-medium text-primary">Por que este passo existe</p>
          <p className="text-muted-foreground">
            Confirmar o e-mail garante que só você tenha acesso à sua conta e que
            possamos falar com você sobre dados de saúde com segurança.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Não recebeu? Verifique a caixa de spam. O link vale por 1 hora.
        </p>
        <Button asChild variant="outline" className="w-full h-11">
          <Link to="/auth/login">Já confirmei — ir para o login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Cadastro() {
  const [step, setStep] = useState<Step>("choose");
  const [emailPendente, setEmailPendente] = useState("");

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10 bg-gradient-to-b from-background to-secondary/40">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo />
          <h1 className="font-serif text-3xl text-primary">Criar conta no ValvePath</h1>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Plataforma de orientação em doenças valvares cardíacas. Conteúdo educativo;
            não substitui consulta médica.
          </p>
        </div>

        {step === "choose" && <ChooseAccount onPick={() => setStep("paciente")} />}
        {step === "paciente" && (
          <PatientForm
            onBack={() => setStep("choose")}
            onAguardandoConfirmacao={(e) => { setEmailPendente(e); setStep("confirmar"); }}
          />
        )}
        {step === "confirmar" && <ConfirmeSeuEmail email={emailPendente} />}

        {step !== "confirmar" && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem conta?{" "}
            <Link to="/auth/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function ChooseAccount({ onPick }: { onPick: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-center text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">
        Etapa 1 de 2 · Escolha seu perfil
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Button
          asChild
          variant="ghost"
          className="h-auto w-full items-stretch justify-start text-left rounded-2xl border border-border/70 bg-card p-6 font-normal hover:bg-card hover:border-primary hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
        >
          <Link to="/acesso-profissional">
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-primary/[0.03] transition-all duration-500"
          />
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105 transition-all duration-300">
              <Stethoscope className="h-7 w-7" />
            </div>
            <h3 className="font-serif text-2xl text-primary mb-1.5">Sou médico</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Organize casos, ganhe tempo e decida com uma fonte confiável.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Acesso por solicitação · O responsável confere seu CRM e libera
            </p>
          </div>
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => onPick()}
          className="h-auto w-full items-stretch justify-start text-left rounded-2xl border border-border/70 bg-card p-6 font-normal hover:bg-card hover:border-accent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-accent/0 via-accent/0 to-accent/0 group-hover:from-accent/10 group-hover:to-accent/[0.03] transition-all duration-500"
          />
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-accent/10 grid place-items-center text-accent mb-4 group-hover:bg-accent group-hover:text-accent-foreground group-hover:scale-105 transition-all duration-300">
              <HeartPulse className="h-7 w-7" />
            </div>
            <h3 className="font-serif text-2xl text-primary mb-1.5">Sou paciente</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Acompanhe seu caso e fale direto com seu médico.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Jornada guiada · Diário de sintomas · Conteúdo em linguagem clara
            </p>
          </div>
        </Button>
      </div>

      <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-success/15 grid place-items-center text-success shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="text-sm">
          <p className="font-medium text-foreground">Seus dados protegidos pela LGPD</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            Criptografia em trânsito e em repouso, trilha de auditoria e controle
            granular de consentimento. O ValvePath é apoio educativo e organizacional —
            nenhum diagnóstico é gerado automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Barra fina de progresso — indica que o usuário está na etapa final. */
function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-4" aria-hidden={false}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-1.5">
        <span>Etapa {current} de {total}</span>
        <span>{label}</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-secondary overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso do cadastro: etapa ${current} de ${total}`}
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// O formulário de cadastro de médico foi removido daqui.
//
// Médico e clínica não criam conta: solicitam acesso em `/acesso-profissional`,
// e a conta é criada pela edge function `access-decide` quando o responsável
// aprova — depois de conferir o CRM. Antes, qualquer pessoa criava conta de
// médico e digitava um CRM que ninguém olhava, num sistema que organiza
// prontuário e sugere conduta.

function PatientForm({ onBack, onAguardandoConfirmacao }: { onBack: () => void; onAguardandoConfirmacao: (email: string) => void }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const ufTriggerRef = useRef<HTMLButtonElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, submitCount },
  } = useForm<PatientSignupInput>({
    resolver: zodResolver(patientSignupSchema),
    defaultValues: { account_type: "paciente", terms: false as never, lgpd: false as never },
  });

  const patientFieldOrder = ["full_name", "email", "phone", "password", "doctor_crm", "doctor_crm_uf", "terms", "lgpd"];
  useScrollToError(errors, patientFieldOrder, submitCount);

  const docCrmUf = watch("doctor_crm_uf");

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const handleCaptcha = useCallback((t: string | null) => setCaptchaToken(t), []);
  /** O servidor de auth consome o token mesmo quando o cadastro é recusado. */
  const renewCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaReset((n) => n + 1);
  };

  const onSubmit = async (values: PatientSignupInput) => {
    if (!captchaToken) {
      toast.error("Verificação de segurança", {
        description: "Complete a verificação anti-robô antes de continuar.",
      });
      return;
    }
    setSubmitting(true);

    // Senha vazada é recusada antes de criar a conta. A verificação é por
    // k-anonimato: só os 5 primeiros caracteres do hash saem do navegador.
    // Se a base pública estiver fora do ar, o cadastro segue — ver o comentário
    // em `bloquearSeSenhaVazada`.
    if (await bloquearSeSenhaVazada(values.password)) {
      setSubmitting(false);
      return;
    }

    // O token não é validado aqui: ele é de uso único e quem precisa da prova é
    // o servidor de auth. Ver o comentário em TurnstileWidget.
    // Signup — pass all data via metadata so the DB trigger creates profile + role + patient
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        captchaToken,
        emailRedirectTo: `${window.location.origin}/app/paciente`,
        data: {
          full_name: values.full_name,
          account_type: "paciente",
          doctor_crm: values.doctor_crm || null,
          doctor_crm_uf: values.doctor_crm_uf || null,
          phone: values.phone || null,
          consents: consentimentosDoCadastro("paciente"),
          consent_version: CONSENT_VERSION,
        },
      },
    });
    if (signupError || !signupData.user) {
      setSubmitting(false);
      renewCaptcha();
      toast.error("Não foi possível criar a conta", { description: signupError?.message });
      return;
    }

    setSubmitting(false);

    if (!signupData.session) {
      onAguardandoConfirmacao(values.email);
      return;
    }

    const linkedDoctor = values.doctor_crm && values.doctor_crm_uf;
    toast.success("Bem-vindo ao ValvePath", {
      description: linkedDoctor ? "Vínculo com seu médico estabelecido." : undefined,
    });
    navigate("/app/paciente", { replace: true });
  };

  return (
    <Card className="shadow-md-soft border-border/70">
      <CardHeader>
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={submitting}
          className="h-auto w-fit p-0 gap-1 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-primary mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mudar tipo de conta
        </Button>
        <CardTitle className="text-xl flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-accent" /> Cadastro de paciente
        </CardTitle>
        <CardDescription>
          O vínculo com seu médico é opcional. Se informado, ele poderá ver seus
          registros para acompanhamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StepProgress current={2} total={2} label="Seus dados" />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nome completo" error={errors.full_name?.message}>
            <Input {...register("full_name")} autoComplete="name" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="E-mail" error={errors.email?.message}>
              <Input type="email" {...register("email")} autoComplete="email" />
            </Field>
            <Field label="Telefone (opcional)" error={errors.phone?.message}>
              <Input {...register("phone")} autoComplete="tel" placeholder="(11) 99999-9999" />
            </Field>
          </div>

          <Field label="Senha" error={errors.password?.message} hint="Mínimo 8 caracteres, com maiúscula, minúscula e número.">
            <Input type="password" {...register("password")} autoComplete="new-password" />
          </Field>

          <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Vincular ao seu médico (opcional)</p>
              <p className="text-xs text-muted-foreground">
                Informe o CRM do seu médico para que ele acompanhe seu caso pelo ValvePath.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Field label="CRM do médico" error={errors.doctor_crm?.message}>
                  <Input {...register("doctor_crm")} placeholder="000000" />
                </Field>
              </div>
              <Field label="UF" error={errors.doctor_crm_uf?.message as string | undefined} dataField="doctor_crm_uf">
                <Select value={docCrmUf || ""} onValueChange={(v) => setValue("doctor_crm_uf", v as PatientSignupInput["doctor_crm_uf"], { shouldValidate: true })}>
                  <SelectTrigger ref={ufTriggerRef}><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <ConsentBlock register={register} errors={errors} />

          <TurnstileWidget onToken={handleCaptcha} action="signup" resetSignal={captchaReset} />

          <Button type="submit" variant="hero" className="w-full h-11" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar minha conta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  hint,
  dataField,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  dataField?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-err`;
  const hintId = `${id}-hint`;
  const hasError = !!error;

  return (
    <div className="space-y-1.5" data-field={dataField} role="group" aria-labelledby={`${id}-label`}>
      <Label id={`${id}-label`} className="text-sm">{label}</Label>
      {children}
      {hint && !hasError && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {hasError && (
        <p id={errorId} aria-live="off" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

function ConsentBlock({ register, errors }: { register: any; errors: any }) {
  /** Stop link tap from toggling the parent <label>'s checkbox */
  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="space-y-3 pt-2 border-t border-border/60">
      <label className="flex gap-3 items-start cursor-pointer">
        <input type="checkbox" {...register("terms")} className="mt-1 h-4 w-4 accent-primary" />
        <span className="text-xs text-muted-foreground leading-relaxed">
          Li e aceito os{" "}
          <Link to="/termos" target="_blank" onClick={stopProp} className="text-primary underline">Termos de Uso</Link>{" "}
          e o{" "}
          <Link to="/aviso-medico" target="_blank" onClick={stopProp} className="text-primary underline">Aviso Médico</Link>.
        </span>
      </label>
      {errors.terms && <p className="text-xs text-destructive">{errors.terms.message as string}</p>}

      <label className="flex gap-3 items-start cursor-pointer">
        <input type="checkbox" {...register("lgpd")} className="mt-1 h-4 w-4 accent-primary" />
        <span className="text-xs text-muted-foreground leading-relaxed">
          Concordo com a{" "}
          <Link to="/privacidade" target="_blank" onClick={stopProp} className="text-primary underline">Política de Privacidade</Link>{" "}
          e o tratamento dos meus dados conforme a LGPD.
        </span>
      </label>
      {errors.lgpd && <p className="text-xs text-destructive">{errors.lgpd.message as string}</p>}
    </div>
  );
}
