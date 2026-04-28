import { useEffect, useMemo, useState } from "react";
import {
  Loader2, BarChart3, Download, FileSpreadsheet, FileText, Users, Activity,
  Heart, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { exportCasesToCsv } from "@/lib/casesCsv";
import { exportCohortPDF, type CohortMetrics } from "@/lib/cohortPdf";
import {
  severityLabels, valveTypeLabels, caseStatusLabels,
} from "@/lib/clinicalLabels";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(var(--success))"];

interface Aggregates {
  totalPatients: number;
  totalCases: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byValve: Record<string, number>;
  avgEF: number | null;
  patientsCritical: number;
  avgAdherence: number | null;
}

export default function MedicoRelatorios() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [medLogs, setMedLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: doc } = await supabase
        .from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      if (!doc) { setLoading(false); return; }
      const { data: prof } = await supabase
        .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();

      const [
        { data: cs },
        { data: pts },
      ] = await Promise.all([
        supabase.from("clinical_cases").select("*").eq("doctor_id", doc.id),
        supabase.from("patients").select("id, comorbidities").eq("linked_doctor_id", doc.id),
      ]);

      setDoctorInfo(doc);
      setProfile(prof);
      setCases(cs || []);
      setPatients(pts || []);

      const patientIds = (pts || []).map((p) => p.id);
      if (patientIds.length) {
        const since = new Date(); since.setDate(since.getDate() - 30);
        const sinceISO = since.toISOString().slice(0, 10);
        const [{ data: syms }, { data: logs }] = await Promise.all([
          supabase.from("symptom_entries").select("*").in("patient_id", patientIds).gte("entry_date", sinceISO),
          supabase.from("medication_logs").select("*").in("patient_id", patientIds).gte("log_date", sinceISO),
        ]);
        setSymptoms(syms || []);
        setMedLogs(logs || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const agg: Aggregates = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byValve: Record<string, number> = {};
    const efs: number[] = [];
    cases.forEach((c) => {
      bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byValve[c.valve_type] = (byValve[c.valve_type] || 0) + 1;
      if (c.ejection_fraction != null) efs.push(Number(c.ejection_fraction));
    });
    // pacientes com sintomas críticos no período
    const critical = new Set<string>();
    symptoms.forEach((s) => {
      if ((s.dyspnea ?? 0) >= 7 || (s.chest_pain ?? 0) >= 7 || s.syncope) critical.add(s.patient_id);
    });
    const taken = medLogs.filter((l) => l.status === "tomado").length;
    const adherence = medLogs.length ? (taken / medLogs.length) * 100 : null;

    return {
      totalPatients: patients.length,
      totalCases: cases.length,
      bySeverity, byStatus, byValve,
      avgEF: efs.length ? efs.reduce((a, b) => a + b, 0) / efs.length : null,
      patientsCritical: critical.size,
      avgAdherence: adherence,
    };
  }, [cases, patients, symptoms, medLogs]);

  const severityData = useMemo(() =>
    Object.entries(agg.bySeverity).map(([k, v]) => ({ name: severityLabels[k] || k, value: v })),
    [agg]);
  const statusData = useMemo(() =>
    Object.entries(agg.byStatus).map(([k, v]) => ({ name: caseStatusLabels[k] || k, value: v })),
    [agg]);
  const valveData = useMemo(() =>
    Object.entries(agg.byValve).map(([k, v]) => ({ name: valveTypeLabels[k] || k, value: v })),
    [agg]);

  const handleExportCsv = () => {
    if (!cases.length) { toast.error("Sem casos para exportar"); return; }
    exportCasesToCsv(cases, `valvepath-casos-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success("CSV exportado");
  };

  const handleExportPdf = () => {
    if (!cases.length) { toast.error("Sem casos para exportar"); return; }
    const metrics: CohortMetrics = {
      doctor: doctorInfo && profile ? {
        full_name: profile.full_name,
        crm: doctorInfo.crm,
        crm_uf: doctorInfo.crm_uf,
        specialty: doctorInfo.specialty,
      } : null,
      totalPatients: agg.totalPatients,
      totalCases: agg.totalCases,
      casesByStatus: agg.byStatus,
      casesBySeverity: agg.bySeverity,
      casesByValve: agg.byValve,
      avgEF: agg.avgEF,
      avgAdherence: agg.avgAdherence,
      patientsWithCriticalSymptoms: agg.patientsCritical,
      recentCases: [...cases]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15)
        .map((c) => ({
          patient_name: c.patient_name, severity: c.severity,
          status: c.status, created_at: c.created_at,
        })),
    };
    exportCohortPDF(metrics);
    toast.success("Relatório PDF gerado");
  };

  if (loading) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Relatórios da coorte"
        description="Visão executiva, distribuições clínicas e exportações para auditoria e Heart Team."
        breadcrumbs={[{ label: "Início", to: "/app/medico" }, { label: "Relatórios" }]}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExportCsv}>
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </Button>
            <Button onClick={handleExportPdf}>
              <Download className="h-4 w-4" /> PDF executivo
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Pacientes" value={agg.totalPatients} />
        <Kpi icon={<FileText className="h-4 w-4" />} label="Casos" value={agg.totalCases} />
        <Kpi icon={<Heart className="h-4 w-4" />} label="FE média" value={agg.avgEF != null ? `${agg.avgEF.toFixed(1)}%` : "—"} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Aderência (30d)" value={agg.avgAdherence != null ? `${agg.avgAdherence.toFixed(0)}%` : "—"} />
      </div>

      {agg.patientsCritical > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">
                {agg.patientsCritical} paciente(s) com sintomas críticos nos últimos 30 dias
              </p>
              <p className="text-xs text-muted-foreground">
                Inclui dispneia ou dor torácica ≥ 7/10, ou síncope reportada.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribuições */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-sm-soft">
          <CardHeader><CardTitle className="text-base">Casos por severidade</CardTitle></CardHeader>
          <CardContent>
            {severityData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {severityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm-soft">
          <CardHeader><CardTitle className="text-base">Casos por status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm-soft lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Casos por valvopatia</CardTitle></CardHeader>
          <CardContent>
            {valveData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={valveData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de casos recentes */}
      <Card className="shadow-sm-soft">
        <CardHeader><CardTitle className="text-base inline-flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Casos recentes</CardTitle></CardHeader>
        <CardContent>
          {cases.length === 0 ? <Empty /> : (
            <div className="space-y-1">
              {[...cases]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 10)
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-secondary/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {valveTypeLabels[c.valve_type] || c.valve_type} • {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge variant="secondary">{severityLabels[c.severity] || c.severity}</Badge>
                      <Badge variant="outline">{caseStatusLabels[c.status] || c.status}</Badge>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Relatórios são gerados em tempo real a partir dos dados do seu painel. Apoio à prática clínica — não substitui auditoria oficial.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="shadow-sm-soft">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          {icon} {label}
        </div>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
function Empty() {
  return <p className="text-sm text-muted-foreground py-6 text-center">Sem dados suficientes ainda.</p>;
}
