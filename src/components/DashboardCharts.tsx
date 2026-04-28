import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { valveTypeLabels, severityLabels, caseStatusLabels, nyhaLabels } from "@/lib/clinicalLabels";
import { TrendingUp } from "lucide-react";

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
      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-base">Distribuição por valvopatia</CardTitle>
          <CardDescription>Casos por valva afetada</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byValve} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.value}>
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

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-base">Severidade</CardTitle>
          <CardDescription>Gravidade das lesões valvares</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bySeverity} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-base">Status dos casos</CardTitle>
          <CardDescription>Em que etapa do cuidado</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byStatus} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-base">Classe funcional NYHA</CardTitle>
          <CardDescription>Distribuição entre os casos</CardDescription>
        </CardHeader>
        <CardContent>
          {byNyha.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byNyha} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={(e) => e.value}>
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
    </div>
  );
}
