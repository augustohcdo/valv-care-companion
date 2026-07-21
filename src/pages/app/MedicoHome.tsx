import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  FilePlus2,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  Stethoscope,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardCharts } from "@/components/DashboardCharts";
import { AdvancedStats } from "@/components/AdvancedStats";

export default function MedicoHome() {
  const { user, profile } = useAuth();
  const [doctor, setDoctor] = useState<any>(null);
  const [patientCount, setPatientCount] = useState(0);
  const [caseCount, setCaseCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [cases, setCases] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: doc } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      setDoctor(doc);
      if (doc) {
        const [{ count: pc }, { count: cc }, { count: ac }, { data: caseRows }] = await Promise.all([
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("linked_doctor_id", doc.id),
          supabase.from("clinical_cases").select("id", { count: "exact", head: true }).eq("doctor_id", doc.id).neq("status", "draft" as any),
          supabase.from("clinical_cases").select("id", { count: "exact", head: true })
            .eq("doctor_id", doc.id).in("status", ["avaliacao_inicial", "em_seguimento", "pre_intervencao"]),
          supabase.from("clinical_cases").select("id, created_at, valve_type, severity, status, nyha").eq("doctor_id", doc.id).neq("status", "draft" as any),
        ]);
        setPatientCount(pc ?? 0);
        setCaseCount(cc ?? 0);
        setActiveCount(ac ?? 0);
        setCases(caseRows ?? []);
      }
    })();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] || "Doutor(a)";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="space-y-8 max-w-6xl animate-fade-in">
      {/* Hero de boas-vindas */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 text-primary-foreground shadow-xl ring-1 ring-primary-foreground/10"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-foreground/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            Área médica · <span className="capitalize">{today}</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl mt-2">
            {greeting}, Dr(a). {firstName}
          </h1>
          <p className="text-primary-foreground/80 mt-3 max-w-2xl text-sm sm:text-base">
            Organize casos, acompanhe pacientes e consulte conteúdo clínico baseado em
            diretrizes brasileiras e internacionais.
          </p>

          {/* KPIs translúcidos sobre o hero */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <HeroStat icon={Users} label="Pacientes" value={patientCount} />
            <HeroStat icon={FilePlus2} label="Casos ativos" value={activeCount} />
            <HeroStat icon={TrendingUp} label="Total de casos" value={caseCount} />
            <HeroStat
              icon={ShieldCheck}
              label="CRM"
              value={doctor?.verified ? "Verificado" : "Pendente"}
              tone={doctor?.verified ? "success" : "warning"}
            />
          </div>
        </div>
      </div>

      {doctor && !doctor.verified && (
        <div className="flex gap-3 items-start rounded-2xl border border-warning/30 bg-warning/5 p-4">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Verificação de CRM em análise</p>
            <p className="text-muted-foreground">
              Seu CRM {doctor.crm}/{doctor.crm_uf} está em verificação manual. Algumas
              funções avançadas serão liberadas após a confirmação.
            </p>
          </div>
        </div>
      )}

      {/* Estatísticas avançadas */}
      <div>
        <h2 className="font-serif text-xl text-primary mb-3">Estatísticas avançadas</h2>
        <AdvancedStats cases={cases} />
      </div>

      {/* Dashboards visuais */}
      <div>
        <h2 className="font-serif text-xl text-primary mb-3">Visão clínica geral</h2>
        <DashboardCharts cases={cases} />
      </div>

      {/* Ações rápidas */}
      <div className="grid lg:grid-cols-3 gap-4">
        <ActionCard
          to="/app/medico/casos/novo"
          icon={FilePlus2}
          title="Novo caso clínico"
          description="Registre um novo caso de valvopatia em até 3 minutos."
          cta="Iniciar wizard"
        />
        <ActionCard
          to="/app/medico/pacientes"
          icon={Users}
          title="Meus pacientes"
          description="Pacientes vinculados ao seu CRM e seus registros."
          cta="Ver pacientes"
        />
        <ActionCard
          to="/app/medico/biblioteca"
          icon={BookOpen}
          title="Biblioteca clínica"
          description="Resumos de diretrizes e fluxogramas por valvopatia."
          cta="Acessar"
        />
      </div>

      {/* Perfil profissional */}
      {doctor && (
        <Card className="shadow-sm-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Stethoscope className="h-5 w-5 text-primary" /> Perfil profissional
                </CardTitle>
                <CardDescription>Dados visíveis para vínculo de pacientes</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/medico/perfil">Editar</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Info label="Nome" value={profile?.full_name} />
            <Info label="CRM" value={`${doctor.crm}/${doctor.crm_uf}`} />
            <Info label="Especialidade" value={doctor.specialty} />
            <Info label="Instituição" value={doctor.institution || "—"} />
            <div className="sm:col-span-2 flex items-center gap-2 pt-2 border-t border-border">
              <Badge variant={doctor.verified ? "default" : "secondary"}>
                {doctor.verified ? "CRM verificado" : "Verificação pendente"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Para verificação acelerada, escreva para valvepath@gmail.com
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning";
}) {
  const dot =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : "bg-accent";
  return (
    <div className="group/stat relative overflow-hidden rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 backdrop-blur-sm p-4 transition-all duration-300 hover:bg-primary-foreground/20 hover:border-primary-foreground/30 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary-foreground/40 to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity" />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-primary-foreground/80 text-xs uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      </div>
      <p className="font-serif text-2xl sm:text-3xl text-primary-foreground tabular-nums">{value}</p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary";
  return (
    <Card className="shadow-sm-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <Icon className={`h-4 w-4 ${toneCls}`} />
        </div>
        <p className={`font-serif text-3xl ${toneCls}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  description,
  cta,
}: {
  to: string;
  icon: any;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Card className="rounded-2xl border-border/40 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 group relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-6">
        <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-serif text-lg text-primary mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button asChild variant="outline" size="sm" className="group-hover:border-primary group-hover:text-primary transition-colors">
          <Link to={to}>
            {cta}
            <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
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
