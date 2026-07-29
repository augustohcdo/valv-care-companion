import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { valveTypeLabels, severityLabels, caseStatusLabels, nyhaLabels } from "@/lib/clinicalLabels";
import { TrendingUp, HeartPulse, AlertTriangle, ClipboardList, Gauge } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--success))",
  "hsl(var(--muted-foreground))",
];

interface Props {
  cases: Array<{
    valve_type: string;
    severity: string;
    status: string;
    nyha: string | null;
  }>;
}

function countBy<T extends string>(items: { [k: string]: any }[], key: string, labels: Record<string, string>) {
  const acc: Record<string, number> = {};
  items.forEach((it) => {
    const v = it[key];
    if (!v) return;
    acc[v] = (acc[v] || 0) + 1;
  });
  return Object.entries(acc).map(([k, v]) => ({ name: labels[k] || k, value: v }));
}

export function DashboardCharts({ cases }: Props) {
  if (cases.length === 0) {
    return (
      <Card className="shadow-sm-soft">
        <CardContent className="py-12 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Os dashboards aparecerão aqui quando você tiver casos clínicos cadastrados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const byValve = countBy(cases, "valve_type", valveTypeLabels);
  const bySeverity = countBy(cases, "severity", severityLabels);
  const byStatus = countBy(cases, "status", caseStatusLabels);
  const byNyha = countBy(cases.filter(c => c.nyha), "nyha", nyhaLabels);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <ScrollReveal>
        <Card className="card-elevated h-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                <HeartPulse className="h-4 w-4" />
              </span>
              Distribuição por valvopatia
            </CardTitle>
            <CardDescription>Casos por valva afetada</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byValve} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={80} paddingAngle={2} label={(e) => e.value}>
                  {byValve.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal delay={0.06}>
        <Card className="card-elevated h-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </span>
              Severidade
            </CardTitle>
            <CardDescription>Gravidade das lesões valvares</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bySeverity} margin={{ left: -10 }}>
                <defs>
                  <linearGradient id="severityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="url(#severityGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal>
        <Card className="card-elevated h-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                <ClipboardList className="h-4 w-4" />
              </span>
              Status dos casos
            </CardTitle>
            <CardDescription>Em que etapa do cuidado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byStatus} layout="vertical" margin={{ left: 80 }}>
                <defs>
                  <linearGradient id="statusGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="url(#statusGradient)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal delay={0.06}>
        <Card className="card-elevated h-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg bg-success/15 text-success flex items-center justify-center">
                <Gauge className="h-4 w-4" />
              </span>
              Classe funcional NYHA
            </CardTitle>
            <CardDescription>Distribuição entre os casos</CardDescription>
          </CardHeader>
          <CardContent>
            {byNyha.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byNyha} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} label={(e) => e.value}>
                    {byNyha.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados de NYHA registrados.</p>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>
    </div>
  );
}
