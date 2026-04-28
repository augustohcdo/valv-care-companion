import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { severityLabels } from "@/lib/clinicalLabels";

interface CaseRow {
  id: string;
  created_at: string;
  severity: string;
  status: string;
  valve_type: string;
}

const SEVERITY_ORDER = ["leve", "moderada", "importante", "critica"];
const SEV_COLOR: Record<string, string> = {
  leve: "hsl(var(--success))",
  moderada: "hsl(var(--accent))",
  importante: "hsl(var(--warning))",
  critica: "hsl(var(--destructive))",
};

export function AdvancedStats({ cases }: { cases: CaseRow[] }) {
  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; date: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      months.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM/yy", { locale: ptBR }),
        date: d,
      });
    }
    return months.map((m) => {
      const monthCases = cases.filter((c) => format(new Date(c.created_at), "yyyy-MM") === m.key);
      return {
        name: m.label,
        total: monthCases.length,
        leve: monthCases.filter((c) => c.severity === "leve").length,
        moderada: monthCases.filter((c) => c.severity === "moderada").length,
        importante: monthCases.filter((c) => c.severity === "importante").length,
        critica: monthCases.filter((c) => c.severity === "critica").length,
      };
    });
  }, [cases]);

  const totalThisMonth = monthlyData[monthlyData.length - 1]?.total ?? 0;
  const totalLastMonth = monthlyData[monthlyData.length - 2]?.total ?? 0;
  const monthDelta = totalThisMonth - totalLastMonth;

  // Taxa de progressão por severidade — % de casos importantes/críticos
  const severityRate = useMemo(() => {
    if (cases.length === 0) return { high: 0, total: 0 };
    const high = cases.filter((c) => c.severity === "importante" || c.severity === "critica").length;
    return { high, total: cases.length, pct: Math.round((high / cases.length) * 100) };
  }, [cases]);

  const interventionRate = useMemo(() => {
    if (cases.length === 0) return 0;
    const interv = cases.filter((c) => c.status === "pre_intervencao" || c.status === "pos_intervencao").length;
    return Math.round((interv / cases.length) * 100);
  }, [cases]);

  if (cases.length === 0) {
    return (
      <Card className="shadow-sm-soft">
        <CardContent className="py-12 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            As estatísticas avançadas aparecerão quando houver casos registrados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <MetricCard
          label="Casos neste mês"
          value={totalThisMonth.toString()}
          delta={monthDelta}
          hint={`vs ${totalLastMonth} no mês anterior`}
        />
        <MetricCard
          label="Casos de alta gravidade"
          value={`${severityRate.pct ?? 0}%`}
          hint={`${severityRate.high} de ${severityRate.total} casos importantes/críticos`}
        />
        <MetricCard
          label="Em ciclo de intervenção"
          value={`${interventionRate}%`}
          hint="Pré ou pós-intervenção"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-sm-soft">
          <CardHeader>
            <CardTitle className="text-base">Volume mensal de casos</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm-soft">
          <CardHeader>
            <CardTitle className="text-base">Progressão por severidade</CardTitle>
            <CardDescription>Distribuição mensal por gravidade</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {SEVERITY_ORDER.map((s) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={SEV_COLOR[s]} name={severityLabels[s]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, delta, hint }: { label: string; value: string; delta?: number; hint?: string }) {
  return (
    <Card className="shadow-sm-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-baseline gap-2">
          <p className="font-serif text-3xl text-primary">{value}</p>
          {delta !== undefined && delta !== 0 && (
            <span className={`text-xs font-medium flex items-center gap-0.5 ${delta > 0 ? "text-success" : "text-destructive"}`}>
              {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
