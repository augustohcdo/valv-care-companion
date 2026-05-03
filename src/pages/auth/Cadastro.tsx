import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Stethoscope, HeartPulse, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  doctorSignupSchema,
  patientSignupSchema,
  DoctorSignupInput,
  PatientSignupInput,
  UF_LIST,
} from "@/lib/validators";
import { registerConsent, ConsentType } from "@/lib/consent";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";

type Step = "choose" | "medico" | "paciente";

/** Scroll to first validation error field and focus it */
function useScrollToError(errors: Record<string, any>, fieldOrder: string[]) {
  useEffect(() => {
    const firstKey = fieldOrder.find((k) => errors[k]);
    if (!firstKey) return;
    // Find the wrapper that contains the errored field
    const el =
      document.querySelector(`[data-field="${firstKey}"]`) ??
      document.querySelector(`[name="${firstKey}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Try to focus the first focusable child (input or button/trigger)
    const focusable = el instanceof HTMLInputElement || el instanceof HTMLSelectElement
      ? el
      : (el.querySelector("input, button, [tabindex]") as HTMLElement | null);
    focusable?.focus({ preventScroll: true });
  }, [errors, fieldOrder]);
}

async function recordSignupConsents(audience: "medico" | "paciente") {
  const baseTypes: ConsentType[] = [
    "terms_of_use",
    "privacy_policy",
    "medical_disclaimer",
  ];
  // O paciente também já consente, no cadastro, com compartilhamento com o médico vinculado
  if (audience === "paciente") baseTypes.push("data_sharing_doctor");
  for (const t of baseTypes) {
    try {
      await registerConsent({ type: t, granted: true, source: "signup" });
    } catch (e) {
      console.error("consent register failed", t, e);
    }
  }
}

export default function Cadastro() {
  const [step, setStep] = useState<Step>("choose");

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

        {step === "choose" && <ChooseAccount onPick={(t) => setStep(t)} />}
        {step === "medico" && <DoctorForm onBack={() => setStep("choose")} />}
        {step === "paciente" && <PatientForm onBack={() => setStep("choose")} />}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{" "}
          <Link to="/auth/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

function ChooseAccount({ onPick }: { onPick: (t: "medico" | "paciente") => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <button
        onClick={() => onPick("medico")}
        className="text-left rounded-xl border border-border/70 bg-card p-6 hover:border-primary hover:shadow-md-soft transition-all group"
      >
        <div className="h-11 w-11 rounded-lg bg-primary/10 grid place-items-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Stethoscope className="h-5 w-5" />
        </div>
        <h3 className="font-serif text-xl text-primary mb-1">Sou médico</h3>
        <p className="text-sm text-muted-foreground">
          Cadastro com CRM, casos clínicos, biblioteca e dashboards.
        </p>
      </button>

      <button
        onClick={() => onPick("paciente")}
        className="text-left rounded-xl border border-border/70 bg-card p-6 hover:border-accent hover:shadow-md-soft transition-all group"
      >
        <div className="h-11 w-11 rounded-lg bg-accent/10 grid place-items-center text-accent mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
          <HeartPulse className="h-5 w-5" />
        </div>
        <h3 className="font-serif text-xl text-primary mb-1">Sou paciente</h3>
        <p className="text-sm text-muted-foreground">
          Aprenda sobre sua condição. Vincule-se ao seu médico pelo CRM (opcional).
        </p>
      </button>

      <div className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 rounded-lg p-3">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        Seus dados são criptografados e tratados conforme a LGPD. O ValvePath é um apoio
        educativo e organizacional; nenhum diagnóstico é gerado automaticamente.
      </div>
    </div>
  );
}

function DoctorForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const ufTriggerRef = useRef<HTMLButtonElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DoctorSignupInput>({
    resolver: zodResolver(doctorSignupSchema),
    defaultValues: { account_type: "medico", terms: false as never, lgpd: false as never },
  });

  const doctorFieldOrder = ["full_name", "email", "phone", "crm", "crm_uf", "specialty", "institution", "password", "terms", "lgpd"];
  useScrollToError(errors, doctorFieldOrder);

  const onSubmit = async (values: DoctorSignupInput) => {
    setSubmitting(true);

    // 1) Verifica CRM duplicado antes do signup
    const { data: existing } = await supabase
      .from("doctors")
      .select("id")
      .eq("crm", values.crm)
      .eq("crm_uf", values.crm_uf)
      .maybeSingle();
    if (existing) {
      setSubmitting(false);
      toast.error("CRM já cadastrado", {
        description: "Esse CRM/UF já possui uma conta. Faça login ou recupere a senha.",
      });
      return;
    }

    // 2) Signup — pass all data via metadata so the DB trigger creates profile + role + doctor
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app/medico`,
        data: {
          full_name: values.full_name,
          account_type: "medico",
          crm: values.crm,
          crm_uf: values.crm_uf,
          specialty: values.specialty,
          institution: values.institution || null,
        },
      },
    });
    if (signupError || !signupData.user) {
      setSubmitting(false);
      toast.error("Não foi possível criar a conta", { description: signupError?.message });
      return;
    }

    // 3) Atualiza phone no profile (trigger já criou o profile)
    if (values.phone && signupData.session) {
      await supabase.from("profiles").update({ phone: values.phone }).eq("user_id", signupData.user.id);
    }

    // 4) Registra consentimentos granulares
    if (signupData.session) {
      await recordSignupConsents("medico");
    }

    setSubmitting(false);
    toast.success("Conta criada com sucesso");
    navigate("/app/medico", { replace: true });
  };

  const crmUf = watch("crm_uf");

  return (
    <Card className="shadow-md-soft border-border/70">
      <CardHeader>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mudar tipo de conta
        </button>
        <CardTitle className="text-xl flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" /> Cadastro médico
        </CardTitle>
        <CardDescription>
          O CRM informado será exibido em seu perfil profissional. A verificação manual
          pode levar até 48h após a criação da conta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nome completo" error={errors.full_name?.message}>
            <Input {...register("full_name")} autoComplete="name" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="E-mail profissional" error={errors.email?.message}>
              <Input type="email" {...register("email")} autoComplete="email" />
            </Field>
            <Field label="Telefone (opcional)" error={errors.phone?.message}>
              <Input {...register("phone")} autoComplete="tel" placeholder="(11) 99999-9999" />
            </Field>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Field label="CRM" error={errors.crm?.message}>
                <Input {...register("crm")} placeholder="000000" />
              </Field>
            </div>
            <Field label="UF" error={errors.crm_uf?.message} dataField="crm_uf">
              <Select value={crmUf} onValueChange={(v) => setValue("crm_uf", v as DoctorSignupInput["crm_uf"], { shouldValidate: true })}>
                <SelectTrigger ref={ufTriggerRef}><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Especialidade" error={errors.specialty?.message}>
            <Input {...register("specialty")} placeholder="Cardiologia, Cirurgia Cardiovascular..." />
          </Field>

          <Field label="Instituição (opcional)" error={errors.institution?.message}>
            <Input {...register("institution")} placeholder="Hospital, clínica ou instituto" />
          </Field>

          <Field label="Senha" error={errors.password?.message} hint="Mínimo 8 caracteres, com maiúscula, minúscula e número.">
            <Input type="password" {...register("password")} autoComplete="new-password" />
          </Field>

          <ConsentBlock register={register} errors={errors} />

          <Button type="submit" variant="hero" className="w-full h-11" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar conta médica
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PatientForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientSignupInput>({
    resolver: zodResolver(patientSignupSchema),
    defaultValues: { account_type: "paciente", terms: false as never, lgpd: false as never },
  });

  const docCrmUf = watch("doctor_crm_uf");

  const onSubmit = async (values: PatientSignupInput) => {
    setSubmitting(true);

    // Signup — pass all data via metadata so the DB trigger creates profile + role + patient
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app/paciente`,
        data: {
          full_name: values.full_name,
          account_type: "paciente",
          doctor_crm: values.doctor_crm || null,
          doctor_crm_uf: values.doctor_crm_uf || null,
        },
      },
    });
    if (signupError || !signupData.user) {
      setSubmitting(false);
      toast.error("Não foi possível criar a conta", { description: signupError?.message });
      return;
    }

    if (values.phone && signupData.session) {
      await supabase.from("profiles").update({ phone: values.phone }).eq("user_id", signupData.user.id);
    }

    if (signupData.session) {
      await recordSignupConsents("paciente");
    }

    setSubmitting(false);
    const linkedDoctor = values.doctor_crm && values.doctor_crm_uf;
    toast.success("Bem-vindo ao ValvePath", {
      description: linkedDoctor ? "Vínculo com seu médico estabelecido." : undefined,
    });
    navigate("/app/paciente", { replace: true });
  };

  return (
    <Card className="shadow-md-soft border-border/70">
      <CardHeader>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mudar tipo de conta
        </button>
        <CardTitle className="text-xl flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-accent" /> Cadastro de paciente
        </CardTitle>
        <CardDescription>
          O vínculo com seu médico é opcional. Se informado, ele poderá ver seus
          registros para acompanhamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              <Field label="UF" error={errors.doctor_crm_uf?.message as string | undefined}>
                <Select value={docCrmUf || ""} onValueChange={(v) => setValue("doctor_crm_uf", v as PatientSignupInput["doctor_crm_uf"], { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <ConsentBlock register={register} errors={errors} />

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
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ConsentBlock({ register, errors }: { register: any; errors: any }) {
  return (
    <div className="space-y-3 pt-2 border-t border-border/60">
      <label className="flex gap-3 items-start cursor-pointer">
        <input type="checkbox" {...register("terms")} className="mt-1 h-4 w-4 accent-primary" />
        <span className="text-xs text-muted-foreground leading-relaxed">
          Li e aceito os{" "}
          <Link to="/termos" target="_blank" className="text-primary underline">Termos de Uso</Link>{" "}
          e o{" "}
          <Link to="/aviso-medico" target="_blank" className="text-primary underline">Aviso Médico</Link>.
        </span>
      </label>
      {errors.terms && <p className="text-xs text-destructive">{errors.terms.message as string}</p>}

      <label className="flex gap-3 items-start cursor-pointer">
        <input type="checkbox" {...register("lgpd")} className="mt-1 h-4 w-4 accent-primary" />
        <span className="text-xs text-muted-foreground leading-relaxed">
          Concordo com a{" "}
          <Link to="/privacidade" target="_blank" className="text-primary underline">Política de Privacidade</Link>{" "}
          e o tratamento dos meus dados conforme a LGPD.
        </span>
      </label>
      {errors.lgpd && <p className="text-xs text-destructive">{errors.lgpd.message as string}</p>}
    </div>
  );
}
