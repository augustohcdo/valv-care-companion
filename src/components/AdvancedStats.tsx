import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Percent, Stethoscope } from "lucide-react";
import { severityLabels } from "@/lib/clinicalLabels";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Sparkline } from "@/components/Sparkline";

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
        <ScrollReveal>
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Casos neste mês"
            value={totalThisMonth.toString()}
            delta={monthDelta}
            hint={`vs ${totalLastMonth} no mês anterior`}
            sparklineData={monthlyData.map((m) => m.total)}
          />
        </ScrollReveal>
        <ScrollReveal delay={0.06}>
          <MetricCard
            icon={<Percent className="h-4 w-4" />}
            label="Casos de alta gravidade"
            value={`${severityRate.pct ?? 0}%`}
            hint={`${severityRate.high} de ${severityRate.total} casos importantes/críticos`}
          />
        </ScrollReveal>
        <ScrollReveal delay={0.12}>
          <MetricCard
            icon={<Stethoscope className="h-4 w-4" />}
            label="Em ciclo de intervenção"
            value={`${interventionRate}%`}
            hint="Pré ou pós-intervenção"
          />
        </ScrollReveal>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ScrollReveal>
          <Card className="card-elevated h-full">
            <CardHeader>
              <CardTitle className="text-base">Volume mensal de casos</CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#volumeGradient)" dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <Card className="card-elevated h-full">
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
                    <Bar key={s} dataKey={s} stackId="a" fill={SEV_COLOR[s]} name={severityLabels[s]} radius={s === "critica" ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </div>
  );
}

function MetricCard({
  icon, label, value, delta, hint, sparklineData,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  sparklineData?: number[];
}) {
  return (
    <Card className="card-elevated h-full">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <div className="h-8 w-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
            {icon}
          </div>
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
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-2 -mx-1">
            <Sparkline data={sparklineData} color="hsl(var(--accent))" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
