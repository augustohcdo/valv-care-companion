import { useEffect, useState, useMemo } from "react";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  HeartPulse, Plus, Loader2, Save, Edit2, Trash2, AlertTriangle, TrendingDown, Activity,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const intensityFields = [
  { key: "dyspnea", label: "Falta de ar (dispneia)", color: "hsl(var(--primary))" },
  { key: "fatigue", label: "Cansaço (fadiga)", color: "hsl(var(--accent))" },
  { key: "chest_pain", label: "Dor no peito", color: "hsl(var(--destructive))" },
  { key: "palpitations", label: "Palpitações", color: "hsl(var(--warning))" },
];

const boolFields = [
  { key: "edema", label: "Inchaço nas pernas" },
  { key: "syncope", label: "Desmaio" },
  { key: "orthopnea", label: "Falta de ar deitado" },
];

const emptyForm = {
  entry_date: format(new Date(), "yyyy-MM-dd"),
  dyspnea: 0,
  fatigue: 0,
  chest_pain: 0,
  palpitations: 0,
  edema: false,
  syncope: false,
  orthopnea: false,
  weight_kg: "",
  bp_systolic: "",
  bp_diastolic: "",
  notes: "",
};

export default function PacienteDiario() {
  const { user } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    if (!user) return;
    const { data: pat } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
    if (!pat) { setLoading(false); return; }
    setPatient(pat);
    const { data } = await supabase
      .from("symptom_entries")
      .select("*")
      .eq("patient_id", pat.id)
      .order("entry_date", { ascending: false })
      .limit(60);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const startEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      entry_date: e.entry_date,
      dyspnea: e.dyspnea ?? 0,
      fatigue: e.fatigue ?? 0,
      chest_pain: e.chest_pain ?? 0,
      palpitations: e.palpitations ?? 0,
      edema: e.edema, syncope: e.syncope, orthopnea: e.orthopnea,
      weight_kg: e.weight_kg?.toString() || "",
      bp_systolic: e.bp_systolic?.toString() || "",
      bp_diastolic: e.bp_diastolic?.toString() || "",
      notes: e.notes || "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!patient) return;
    setSaving(true);
    const num = (v: string) => (v.trim?.() === "" ? null : Number(v.toString().replace(",", ".")));
    const payload: any = {
      patient_id: patient.id,
      entry_date: form.entry_date,
      dyspnea: form.dyspnea,
      fatigue: form.fatigue,
      chest_pain: form.chest_pain,
      palpitations: form.palpitations,
      edema: form.edema,
      syncope: form.syncope,
      orthopnea: form.orthopnea,
      weight_kg: num(form.weight_kg),
      bp_systolic: num(form.bp_systolic),
      bp_diastolic: num(form.bp_diastolic),
      notes: form.notes.trim() || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("symptom_entries").update(payload).eq("id", editingId));
    } else {
      // upsert por dia
      ({ error } = await supabase.from("symptom_entries").upsert(payload, { onConflict: "patient_id,entry_date" }));
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Registro salvo");
    reset();
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este registro?")) return;
    await supabase.from("symptom_entries").delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  // Dados últimos 30 dias para o gráfico
  const chartData = useMemo(() => {
    const days: any[] = [];
    const today = startOfDay(new Date());
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const iso = format(d, "yyyy-MM-dd");
      const found = items.find((e) => e.entry_date === iso);
      days.push({
        date: format(d, "dd/MM"),
        dyspnea: found?.dyspnea ?? null,
        fatigue: found?.fatigue ?? null,
        chest_pain: found?.chest_pain ?? null,
        palpitations: found?.palpitations ?? null,
      });
    }
    return days;
  }, [items]);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayEntry = items.find((i) => i.entry_date === today);
  const last7 = items.slice(0, 7);
  const avgDyspnea7 = last7.length
    ? (last7.reduce((s, e) => s + (e.dyspnea || 0), 0) / last7.length).toFixed(1)
    : "—";

  if (loading) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Meu acompanhamento"
        title="Diário de sintomas"
        description="Registre como você está se sentindo. Seu médico acompanha a evolução."
        breadcrumbs={[{ label: "Início", to: "/app/paciente" }, { label: "Diário" }]}
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> {todayEntry ? "Atualizar hoje" : "Registrar hoje"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar registro" : "Como você está hoje?"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} max={today} />
                </div>

                {intensityFields.map((f) => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm">{f.label}</Label>
                      <Badge variant="outline" className="text-sm">{form[f.key]}/10</Badge>
                    </div>
                    <Slider
                      min={0} max={10} step={1}
                      value={[form[f.key]]}
                      onValueChange={(v) => setForm({ ...form, [f.key]: v[0] })}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>Nada</span><span>Moderado</span><span>Intenso</span>
                    </div>
                  </div>
                ))}

                <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-border">
                  {boolFields.map((f) => (
                    <div key={f.key} className="flex items-center justify-between p-2 rounded-lg border border-border bg-secondary/30">
                      <Label className="text-sm cursor-pointer">{f.label}</Label>
                      <Switch checked={form[f.key]} onCheckedChange={(v) => setForm({ ...form, [f.key]: v })} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div>
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">PA sistólica</Label>
                    <Input type="number" value={form.bp_systolic} onChange={(e) => setForm({ ...form, bp_systolic: e.target.value })} placeholder="120" />
                  </div>
                  <div>
                    <Label className="text-xs">PA diastólica</Label>
                    <Input type="number" value={form.bp_diastolic} onChange={(e) => setForm({ ...form, bp_diastolic: e.target.value })} placeholder="80" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {!patient ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Complete seu perfil para começar a registrar sintomas.
        </CardContent></Card>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="shadow-sm-soft"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-2xl font-serif text-primary">{todayEntry ? "✓ Registrado" : "Pendente"}</p>
              {!todayEntry && <p className="text-xs text-muted-foreground mt-1">Toque em "Registrar hoje"</p>}
            </CardContent></Card>
            <Card className="shadow-sm-soft"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Registros (60 dias)</p>
              <p className="text-2xl font-serif text-primary">{items.length}</p>
            </CardContent></Card>
            <Card className="shadow-sm-soft"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Média de dispneia (7d)</p>
              <p className="text-2xl font-serif text-primary">{avgDyspnea7} <span className="text-sm text-muted-foreground">/10</span></p>
            </CardContent></Card>
          </div>

          <Tabs defaultValue="evolucao">
            <TabsList>
              <TabsTrigger value="evolucao">Evolução</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="evolucao" className="mt-4">
              <Card className="shadow-sm-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-primary" /> Sintomas — últimos 30 dias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      Comece a registrar para visualizar sua evolução.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {intensityFields.map((f) => (
                          <Line
                            key={f.key}
                            type="monotone"
                            dataKey={f.key}
                            stroke={f.color}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                            name={f.label}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historico" className="mt-4 space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Sem registros ainda.</p>
              ) : (
                items.map((e) => <EntryRow key={e.id} entry={e} onEdit={() => startEdit(e)} onDelete={() => remove(e.id)} />)
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete }: { entry: any; onEdit: () => void; onDelete: () => void }) {
  const flags = [
    entry.edema && "Edema",
    entry.syncope && "Síncope",
    entry.orthopnea && "Ortopneia",
  ].filter(Boolean);
  const severe = entry.dyspnea >= 7 || entry.chest_pain >= 7 || entry.syncope;
  return (
    <div className={`p-3 rounded-lg border ${severe ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-start gap-3">
        <div className="text-center shrink-0 w-12">
          <p className="text-[10px] uppercase text-muted-foreground">
            {format(parseISO(entry.entry_date), "MMM", { locale: ptBR }).replace(".", "")}
          </p>
          <p className="text-xl font-bold text-foreground leading-tight">{format(parseISO(entry.entry_date), "dd")}</p>
        </div>
        <div className="flex-1 min-w-0">
          {severe && (
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 mb-1">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Sintomas relevantes
            </Badge>
          )}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {intensityFields.map((f) => (
              <span key={f.key} className="bg-secondary/60 px-2 py-0.5 rounded">
                {f.label.split(" ")[0]}: <strong>{entry[f.key]}/10</strong>
              </span>
            ))}
          </div>
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {flags.map((f: any) => <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>)}
            </div>
          )}
          {(entry.weight_kg || entry.bp_systolic) && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {entry.weight_kg && `${entry.weight_kg} kg`}
              {entry.weight_kg && entry.bp_systolic && " • "}
              {entry.bp_systolic && `PA ${entry.bp_systolic}/${entry.bp_diastolic}`}
            </p>
          )}
          {entry.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{entry.notes}"</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}
