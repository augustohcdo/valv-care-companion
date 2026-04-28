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

export default function MedicoHome() {
  const { user, profile } = useAuth();
  const [doctor, setDoctor] = useState<any>(null);
  const [patientCount, setPatientCount] = useState(0);
  const [caseCount, setCaseCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: doc } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      setDoctor(doc);
      if (doc) {
        const [{ count: pc }, { count: cc }, { count: ac }] = await Promise.all([
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("linked_doctor_id", doc.id),
          supabase.from("clinical_cases").select("id", { count: "exact", head: true }).eq("doctor_id", doc.id),
          supabase.from("clinical_cases").select("id", { count: "exact", head: true })
            .eq("doctor_id", doc.id).in("status", ["avaliacao_inicial", "em_seguimento", "pre_intervencao"]),
        ]);
        setPatientCount(pc ?? 0);
        setCaseCount(cc ?? 0);
        setActiveCount(ac ?? 0);
      }
    })();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] || "Doutor(a)";

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <p className="text-sm text-muted-foreground">Área médica</p>
        <h1 className="font-serif text-3xl lg:text-4xl text-primary mt-1">
          Olá, Dr(a). {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo à plataforma ValvePath. Aqui você organiza casos, acompanha pacientes
          e acessa conteúdo clínico baseado em diretrizes.
        </p>
      </div>

      {doctor && !doctor.verified && (
        <div className="flex gap-3 items-start rounded-xl border border-warning/30 bg-warning/5 p-4">
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

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Pacientes vinculados" value={patientCount.toString()} />
        <KpiCard icon={FilePlus2} label="Casos ativos" value={activeCount.toString()} />
        <KpiCard icon={TrendingUp} label="Total de casos" value={caseCount.toString()} />
        <KpiCard
          icon={ShieldCheck}
          label="Verificação"
          value={doctor?.verified ? "Verificado" : "Pendente"}
          tone={doctor?.verified ? "success" : "warning"}
        />
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
                Para verificação acelerada, escreva para verificacao@valvepath.com
              </span>
            </div>
          </CardContent>
        </Card>
      )}
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
    <Card className="shadow-sm-soft hover:shadow-md-soft transition-shadow group">
      <CardContent className="p-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-serif text-lg text-primary mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button asChild variant="outline" size="sm"><Link to={to}>{cta}</Link></Button>
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
