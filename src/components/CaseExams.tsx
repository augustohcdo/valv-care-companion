import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical, Plus, Loader2, Trash2, Edit2, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { examTypeLabels, examTypeColors } from "@/lib/clinicalLabels";
import { logAudit } from "@/lib/auditLog";
import { aplicar } from "@/lib/mutate";
import { medidasFaltantesNoCaso, type ExameMedidas } from "@/lib/caseFields";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  caseId: string;
  readOnly?: boolean;
}

// `higherIsBetter` define o sentido clínico de cada parâmetro, usado só para
// colorir o comparativo. Sem isso, um gradiente médio subindo (progressão de
// estenose) apareceria em verde ao lado de uma FE em queda em amarelo — o
// inverso da leitura clínica nos dois casos.
const numericFields: { key: string; label: string; unit: string; higherIsBetter: boolean }[] = [
  { key: "ejection_fraction", label: "FE", unit: "%", higherIsBetter: true },
  { key: "mean_gradient", label: "Grad. médio", unit: "mmHg", higherIsBetter: false },
  { key: "peak_gradient", label: "Grad. máx", unit: "mmHg", higherIsBetter: false },
  { key: "valve_area", label: "Área valvar", unit: "cm²", higherIsBetter: true },
  { key: "psap", label: "PSAP", unit: "mmHg", higherIsBetter: false },
  { key: "lv_diameter", label: "Diâm. VE", unit: "mm", higherIsBetter: false },
  { key: "septal_thickness", label: "Septo", unit: "mm", higherIsBetter: false },
  { key: "bnp", label: "BNP", unit: "pg/mL", higherIsBetter: false },
  { key: "nt_probnp", label: "NT-proBNP", unit: "pg/mL", higherIsBetter: false },
  { key: "six_min_walk", label: "TC6min", unit: "m", higherIsBetter: true },
];

const emptyForm = {
  exam_type: "eco",
  exam_date: new Date().toISOString().slice(0, 10),
  title: "",
  notes: "",
  ejection_fraction: "",
  mean_gradient: "",
  peak_gradient: "",
  valve_area: "",
  regurgitation_grade: "",
  psap: "",
  lv_diameter: "",
  septal_thickness: "",
  bnp: "",
  nt_probnp: "",
  six_min_walk: "",
};

export const caseExamsKey = (caseId: string) => ["case-exams", caseId] as const;

export const CaseExams = ({ caseId, readOnly = false }: Props) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: caseExamsKey(caseId),
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
      .from("case_exams")
      .select("*")
      .eq("case_id", caseId)
      .is("deleted_at", null)
      .order("exam_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const load = () => queryClient.invalidateQueries({ queryKey: caseExamsKey(caseId) });

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const startEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      exam_type: e.exam_type,
      exam_date: e.exam_date,
      title: e.title || "",
      notes: e.notes || "",
      ejection_fraction: e.ejection_fraction?.toString() || "",
      mean_gradient: e.mean_gradient?.toString() || "",
      peak_gradient: e.peak_gradient?.toString() || "",
      valve_area: e.valve_area?.toString() || "",
      regurgitation_grade: e.regurgitation_grade || "",
      psap: e.psap?.toString() || "",
      lv_diameter: e.lv_diameter?.toString() || "",
      septal_thickness: e.septal_thickness?.toString() || "",
      bnp: e.bnp?.toString() || "",
      nt_probnp: e.nt_probnp?.toString() || "",
      six_min_walk: e.six_min_walk?.toString() || "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    const payload: any = {
      case_id: caseId,
      created_by: user.id,
      exam_type: form.exam_type as any,
      exam_date: form.exam_date,
      title: form.title.trim() || null,
      notes: form.notes.trim() || null,
      regurgitation_grade: form.regurgitation_grade.trim() || null,
      ejection_fraction: num(form.ejection_fraction),
      mean_gradient: num(form.mean_gradient),
      peak_gradient: num(form.peak_gradient),
      valve_area: num(form.valve_area),
      psap: num(form.psap),
      lv_diameter: num(form.lv_diameter),
      septal_thickness: num(form.septal_thickness),
      bnp: num(form.bnp),
      nt_probnp: num(form.nt_probnp),
      six_min_walk: num(form.six_min_walk),
    };
    const { error } = editingId
      ? await supabase.from("case_exams").update(payload).eq("id", editingId)
      : await supabase.from("case_exams").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success(editingId ? "Exame atualizado" : "Exame registrado");
    reset();
    setOpen(false);
    load();
    void oferecerLevarAoCaso(payload);
  };

  /**
   * O exame acabou de trazer uma medida que os achados do caso não têm.
   *
   * `case_exams` guarda exatamente os mesmos parâmetros que o caso exibe, e as
   * duas telas conviviam sem se falarem — o médico digitava o número duas
   * vezes, ou o caso ficava com o campo vazio para sempre. A oferta é uma
   * linha, sem diálogo, e **só** para campo que o caso não tem: sobrescrever
   * em silêncio o que ele digitou seria o oposto do que se quer aqui.
   */
  const oferecerLevarAoCaso = async (medidas: ExameMedidas) => {
    const { data: caso } = await supabase
      .from("clinical_cases")
      .select("ejection_fraction, mean_gradient, peak_gradient, valve_area, regurgitation_grade")
      .eq("id", caseId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!caso) return;

    const faltantes = medidasFaltantesNoCaso(caso, medidas);
    const quantas = Object.keys(faltantes).length;
    if (quantas === 0) return;

    toast.success(`Os achados do caso estão sem ${quantas} dessas medidas`, {
      description: "Quer levar os valores deste exame para os achados?",
      duration: 12000,
      action: {
        label: "Levar ao caso",
        onClick: () => { void levarAoCaso(faltantes); },
      },
    });
  };

  const levarAoCaso = async (campos: Record<string, number | string>) => {
    const ok = await aplicar(
      supabase.from("clinical_cases").update(campos as never).eq("id", caseId).select("id"),
      { sucesso: "Achados do caso atualizados", falha: "Não foi possível levar os valores ao caso" },
    );
    if (!ok) return;
    logAudit("case_findings_updated", "clinical_cases", caseId, { campos, origem: "exame" });
    // Prefixo: a chave completa do caso inclui o id do médico, que não vive
    // aqui — e invalidar pelo prefixo alcança a mesma entrada.
    queryClient.invalidateQueries({ queryKey: ["case-detail"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este exame?")) return;
    const ok = await aplicar(
      supabase.from("case_exams").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"),
      { sucesso: "Exame removido", falha: "Não foi possível remover o exame" },
    );
    if (!ok) return;
    logAudit("exam_deleted", "case_exams", id, { case_id: caseId });
    load();
  };

  // Comparativo: último vs anterior
  const comparison = useMemo(() => {
    if (items.length < 2) return null;
    const [latest, previous] = items;
    const diffs = numericFields
      .map((f) => {
        const a = latest[f.key];
        const b = previous[f.key];
        if (a == null || b == null) return null;
        const delta = Number(a) - Number(b);
        return { ...f, latest: a, previous: b, delta };
      })
      .filter(Boolean) as any[];
    return { latest, previous, diffs };
  }, [items]);

  // Dados para gráficos (ordem cronológica asc)
  const chartData = useMemo(() => {
    return [...items].reverse().map((e) => {
      const point: any = { date: new Date(e.exam_date).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) };
      numericFields.forEach((f) => {
        if (e[f.key] != null) point[f.key] = Number(e[f.key]);
      });
      return point;
    });
  }, [items]);

  const fieldsWithData = numericFields.filter((f) => chartData.some((p) => p[f.key] != null));

  return (
    <Card className="shadow-sm-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FlaskConical className="h-5 w-5 text-primary" /> Exames seriados
          {items.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {items.length}
            </Badge>
          )}
        </CardTitle>
        {!readOnly && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Novo exame</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar exame" : "Registrar novo exame"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={form.exam_type} onValueChange={(v) => setForm({ ...form, exam_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(examTypeLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Título / resumo</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex: ECO controle 6 meses" />
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Parâmetros (preencha o que se aplica)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {numericFields.map((f) => (
                      <div key={f.key}>
                        <Label className="text-[11px]">{f.label} ({f.unit})</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={(form as any)[f.key]}
                          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        />
                      </div>
                    ))}
                    <div>
                      <Label className="text-[11px]">Regurgitação</Label>
                      <Input
                        value={form.regurgitation_grade}
                        onChange={(e) => setForm({ ...form, regurgitation_grade: e.target.value })}
                        placeholder="leve / moderada / grave"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Observações / laudo</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum exame registrado. Adicione exames para visualizar a evolução.
          </div>
        ) : (
          <Tabs defaultValue="lista">
            <TabsList>
              <TabsTrigger value="lista">Lista</TabsTrigger>
              <TabsTrigger value="evolucao" disabled={fieldsWithData.length === 0}>Evolução</TabsTrigger>
              <TabsTrigger value="comparativo" disabled={!comparison}>Comparativo</TabsTrigger>
            </TabsList>

            <TabsContent value="lista" className="space-y-2 mt-4">
              {items.map((e) => (
                <ExamItem key={e.id} exam={e} readOnly={readOnly} onEdit={() => startEdit(e)} onDelete={() => remove(e.id)} />
              ))}
            </TabsContent>

            <TabsContent value="evolucao" className="mt-4 space-y-6">
              {fieldsWithData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados numéricos suficientes.</p>
              ) : (
                fieldsWithData.map((f) => (
                  <div key={f.key}>
                    <p className="text-sm font-semibold text-foreground mb-1">{f.label} <span className="text-xs text-muted-foreground font-normal">({f.unit})</span></p>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey={f.key}
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 4, fill: "hsl(var(--primary))" }}
                          name={f.label}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="comparativo" className="mt-4">
              {comparison && (
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 px-1">
                    <span>Anterior: <strong className="text-foreground">{new Date(comparison.previous.exam_date).toLocaleDateString("pt-BR")}</strong></span>
                    <span>→</span>
                    <span>Atual: <strong className="text-foreground">{new Date(comparison.latest.exam_date).toLocaleDateString("pt-BR")}</strong></span>
                  </div>
                  {comparison.diffs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem parâmetros comparáveis entre os dois exames.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {comparison.diffs.map((d) => {
                        const rose = d.delta > 0;
                        const stable = d.delta === 0;
                        // A seta segue o número; a cor segue o sentido clínico.
                        const Icon = stable ? Minus : rose ? TrendingUp : TrendingDown;
                        const improved = rose === d.higherIsBetter;
                        const color = stable ? "text-muted-foreground" : improved ? "text-success" : "text-warning";
                        return (
                          <div key={d.key} className="p-3 rounded-lg border border-border bg-secondary/20 flex items-center gap-3">
                            <Icon className={`h-5 w-5 ${color}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">{d.label}</p>
                              <p className="text-sm font-semibold text-foreground">
                                {d.previous} → {d.latest} <span className="text-xs text-muted-foreground">{d.unit}</span>
                              </p>
                            </div>
                            <Badge variant="outline" className={`text-xs ${color}`}>
                              {d.delta > 0 ? "+" : ""}{d.delta.toFixed(1)}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

function ExamItem({ exam, readOnly, onEdit, onDelete }: { exam: any; readOnly: boolean; onEdit: () => void; onDelete: () => void }) {
  const params = numericFields.filter((f) => exam[f.key] != null);
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${examTypeColors[exam.exam_type]}`}>
              {examTypeLabels[exam.exam_type]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(exam.exam_date).toLocaleDateString("pt-BR")}
            </span>
          </div>
          {exam.title && <p className="text-sm font-medium text-foreground mt-1">{exam.title}</p>}
          {params.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {params.map((f) => (
                <span key={f.key} className="text-[11px] bg-secondary/60 px-2 py-0.5 rounded">
                  <span className="text-muted-foreground">{f.label}:</span>{" "}
                  <strong className="text-foreground">{exam[f.key]} {f.unit}</strong>
                </span>
              ))}
              {exam.regurgitation_grade && (
                <span className="text-[11px] bg-secondary/60 px-2 py-0.5 rounded">
                  <span className="text-muted-foreground">Regurg:</span>{" "}
                  <strong className="text-foreground">{exam.regurgitation_grade}</strong>
                </span>
              )}
            </div>
          )}
          {exam.notes && <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{exam.notes}</p>}
        </div>
        {!readOnly && (
          <div className="flex flex-col gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
