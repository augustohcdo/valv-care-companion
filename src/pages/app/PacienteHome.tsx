import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HeartPulse,
  Stethoscope,
  FileText,
  BookOpen,
  ShieldCheck,
  Link2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PacienteHome() {
  const { user, profile } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [linkedDoctor, setLinkedDoctor] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pat } = await supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      setPatient(pat);
      if (pat?.linked_doctor_id) {
        const { data: doc } = await supabase
          .from("doctors")
          .select("id, crm, crm_uf, specialty, institution, user_id")
          .eq("id", pat.linked_doctor_id)
          .maybeSingle();
        if (doc) {
          const { data: docProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", doc.user_id)
            .maybeSingle();
          setLinkedDoctor({ ...doc, full_name: docProfile?.full_name });
        }
      }
    })();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] || "Paciente";

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero de boas-vindas */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-10 text-primary-foreground shadow-lg"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/70">Área do paciente</p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl mt-2">
            Olá, {firstName}
          </h1>
          <p className="text-primary-foreground/85 mt-3 max-w-2xl text-sm sm:text-base">
            O ValvePath organiza informações, dúvidas e documentos sobre sua condição valvar —
            com linguagem clara e respaldo científico. Seu médico continua no centro do cuidado.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-sm px-3 py-1.5 text-xs">
            {linkedDoctor ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Vinculado ao Dr(a). {linkedDoctor.full_name}
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                Nenhum médico vinculado
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 items-start rounded-xl border border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Conteúdo educativo, não diagnóstico</p>
          <p className="text-muted-foreground">
            Em qualquer dúvida ou sintoma novo, contate seu médico ou serviço de emergência.
            Em situações de risco, ligue 192 (SAMU).
          </p>
        </div>
      </div>

      {/* Status médico */}
      {linkedDoctor ? (
        <Card className="shadow-sm-soft border-accent/30">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Stethoscope className="h-5 w-5 text-accent" /> Seu médico
                </CardTitle>
                <CardDescription>
                  Vinculado em {patient?.linked_at ? new Date(patient.linked_at).toLocaleDateString("pt-BR") : "—"}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <Link2 className="h-3 w-3" /> Vinculado
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Info label="Médico" value={linkedDoctor.full_name} />
            <Info label="CRM" value={`${linkedDoctor.crm}/${linkedDoctor.crm_uf}`} />
            <Info label="Especialidade" value={linkedDoctor.specialty} />
            <Info label="Instituição" value={linkedDoctor.institution || "—"} />
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm-soft border-dashed">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center shrink-0">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">Você ainda não vinculou um médico</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Adicione o CRM do seu médico para que ele possa acompanhar seu caso por aqui.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/paciente/medico">Vincular médico</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <ActionCard
          to="/app/paciente/jornada"
          icon={HeartPulse}
          title="Minha jornada"
          description="Acompanhe etapas da sua avaliação cardíaca."
        />
        <ActionCard
          to="/app/paciente/documentos"
          icon={FileText}
          title="Meus documentos"
          description="Organize exames, laudos e relatórios em um só lugar."
        />
        <ActionCard
          to="/aprender"
          icon={BookOpen}
          title="Aprender sobre valvopatias"
          description="Conteúdo educativo sobre cada doença valvar."
        />
      </div>
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm transition-all duration-200 hover:border-accent/60 hover:shadow-md hover:-translate-y-1 group"
    >
      <div className="h-10 w-10 rounded-lg bg-accent/10 grid place-items-center text-accent mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-serif text-lg text-primary mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium">{value || "—"}</p>
    </div>
  );
}
