import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Stethoscope, HeartPulse, FolderOpen, Eye,
  ShieldAlert, ScrollText, Plug, Users, BookOpen,
  BookOpenCheck, ChevronRight, Loader2, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

/** Mesmo formato do RPC `admin_site_metrics`, já usado em `AdminErrors`. */
type SiteMetrics = {
  medicos: number; medicos_30d: number;
  pacientes: number; pacientes_30d: number;
  casos: number; casos_30d: number;
  contas_confirmadas: number; contas_pendentes: number;
  views_30d: number; visitas_30d: number;
  top_paths: { path: string; views: number }[];
};

export const adminHomeMetricsKey = () => ["site-metrics"] as const;

const ATALHOS = [
  {
    to: "/app/admin/usuarios",
    label: "Usuários e papéis",
    descricao: "Contas, permissão de administrador e verificação de CRM.",
    icon: Users,
  },
  {
    to: "/app/admin/conteudo",
    label: "Revisão de conteúdo",
    descricao: "Trechos que alimentam a IA clínica, e quem os revisou.",
    icon: BookOpenCheck,
  },
  {
    to: "/app/admin/fontes",
    label: "Fontes da IA",
    descricao: "Onde a IA pode pesquisar, e o que cada fonte pode embasar.",
    icon: Globe,
  },
  {
    to: "/app/admin/biblioteca",
    label: "Biblioteca de referência",
    descricao: "As obras que originam a base clínica, para conferir na fonte.",
    icon: BookOpen,
  },
  {
    to: "/app/admin/erros",
    label: "Erros e tarefas",
    descricao: "Falhas capturadas em produção e saúde das tarefas agendadas.",
    icon: ShieldAlert,
  },
  {
    to: "/app/admin/dpo",
    label: "Pedidos LGPD",
    descricao: "Fila de acesso, portabilidade e eliminação, com prazo.",
    icon: ScrollText,
  },
  {
    to: "/app/admin/integracoes",
    label: "Integrações",
    descricao: "Hospitais, chaves de API e trilha das trocas FHIR.",
    icon: Plug,
  },
];

function Numero({
  icon, label, value, hint,
}: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * A casa do administrador.
 *
 * Antes não havia nenhuma: a conta administrativa aterrissava em `/app/medico`,
 * um painel clínico vazio pedindo para completar um cadastro de médico que ela
 * nunca teria — porque o `profiles_account_type_check` só aceita `medico` e
 * `paciente`, e a condição de administrador vive só em `user_roles`.
 */
export default function AdminHome() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: adminHomeMetricsKey(),
    queryFn: async (): Promise<SiteMetrics> => {
      const { data, error } = await supabase.rpc("admin_site_metrics");
      if (error) throw error;
      return data as unknown as SiteMetrics;
    },
  });

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" /> Administração
        </h1>
        <p className="text-muted-foreground">
          Visão da plataforma e as ações reservadas a quem administra.
        </p>
      </header>

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : metrics ? (
        <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Numero
            icon={<Stethoscope className="h-5 w-5 text-primary" />}
            label="Médicos"
            value={metrics.medicos}
            hint={`+${metrics.medicos_30d} em 30 dias`}
          />
          <Numero
            icon={<HeartPulse className="h-5 w-5 text-primary" />}
            label="Pacientes"
            value={metrics.pacientes}
            hint={`+${metrics.pacientes_30d} em 30 dias`}
          />
          <Numero
            icon={<FolderOpen className="h-5 w-5 text-primary" />}
            label="Casos clínicos"
            value={metrics.casos}
            hint={`+${metrics.casos_30d} em 30 dias`}
          />
          {/* "Telas abertas" e "sessões", nunca "visitantes": o contador não
              guarda cookie, IP nem identificador, então não sabe quem é quem. */}
          <Numero
            icon={<Eye className="h-5 w-5 text-primary" />}
            label="Telas abertas"
            value={metrics.views_30d}
            hint={`${metrics.visitas_30d.toLocaleString("pt-BR")} sessões em 30 dias`}
          />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-muted-foreground">Ações</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ATALHOS.map((a) => {
            const Icone = a.icon;
            return (
              <Link key={a.to} to={a.to} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Icone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{a.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
