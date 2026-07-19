import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Cloud, CloudOff, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  valveTypeLabels,
  valveDiseaseLabels,
  severityLabels,
  nyhaLabels,
  commonSymptoms,
  commonComorbidities,
} from "@/lib/clinicalLabels";

const steps = [
  { n: 1, label: "Identificação" },
  { n: 2, label: "Achados clínicos" },
  { n: 3, label: "Conduta" },
];

type FormState = {
  patient_name: string;
  patient_age: string;
  patient_sex: string;
  valve_type: string;
  valve_disease: string;
  severity: string;
  nyha: string;
  symptoms: string[];
  comorbidities: string[];
  ejection_fraction: string;
  mean_gradient: string;
  peak_gradient: string;
  valve_area: string;
  regurgitation_grade: string;
  proposed_management: string;
  clinical_notes: string;
};

const emptyForm: FormState = {
  patient_name: "",
  patient_age: "",
  patient_sex: "",
  valve_type: "",
  valve_disease: "",
  severity: "indeterminada",
  nyha: "",
  symptoms: [],
  comorbidities: [],
  ejection_fraction: "",
  mean_gradient: "",
  peak_gradient: "",
  valve_area: "",
  regurgitation_grade: "",
  proposed_management: "",
  clinical_notes: "",
};

function buildPayload(form: FormState) {
  return {
    patient_name: form.patient_name.trim() || "Rascunho sem nome",
    patient_age: form.patient_age ? parseInt(form.patient_age) : null,
    patient_sex: form.patient_sex || null,
    valve_type: form.valve_type as any,
    valve_disease: form.valve_disease as any,
    severity: (form.severity || "indeterminada") as any,
    nyha: (form.nyha || null) as any,
    symptoms: form.symptoms.length ? form.symptoms : null,
    comorbidities: form.comorbidities.length ? form.comorbidities : null,
    ejection_fraction: form.ejection_fraction ? parseFloat(form.ejection_fraction) : null,
    mean_gradient: form.mean_gradient ? parseFloat(form.mean_gradient) : null,
    peak_gradient: form.peak_gradient ? parseFloat(form.peak_gradient) : null,
    valve_area: form.valve_area ? parseFloat(form.valve_area) : null,
    regurgitation_grade: form.regurgitation_grade || null,
    proposed_management: form.proposed_management || null,
    clinical_notes: form.clinical_notes || null,
  };
}

function hydrateForm(row: any): FormState {
  return {
    patient_name: row.patient_name === "Rascunho sem nome" ? "" : (row.patient_name ?? ""),
    patient_age: row.patient_age?.toString() ?? "",
    patient_sex: row.patient_sex ?? "",
    valve_type: row.valve_type ?? "",
    valve_disease: row.valve_disease ?? "",
    severity: row.severity ?? "indeterminada",
    nyha: row.nyha ?? "",
    symptoms: row.symptoms ?? [],
    comorbidities: row.comorbidities ?? [],
    ejection_fraction: row.ejection_fraction?.toString() ?? "",
    mean_gradient: row.mean_gradient?.toString() ?? "",
    peak_gradient: row.peak_gradient?.toString() ?? "",
    valve_area: row.valve_area?.toString() ?? "",
    regurgitation_grade: row.regurgitation_grade ?? "",
    proposed_management: row.proposed_management ?? "",
    clinical_notes: row.clinical_notes ?? "",
  };
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function NovoCaso() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Autosave state
  const draftIdRef = useRef<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const savingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load doctor + recover latest draft (if any)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: doc } = await supabase
        .from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc?.id) { setDraftLoaded(true); return; }
      setDoctorId(doc.id);

      const { data: draft } = await supabase
        .from("clinical_cases")
        .select("*")
        .eq("doctor_id", doc.id)
        .eq("status", "draft" as any)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (draft) {
        draftIdRef.current = draft.id;
        setForm(hydrateForm(draft));
        setLastSavedAt(new Date(draft.updated_at));
        toast.info("Rascunho recuperado", {
          description: "Continuamos de onde você parou.",
        });
      }
      setDraftLoaded(true);
    })();
  }, [user]);

  // Autosave (debounced) — only after minimum required fields are set
  const canAutosave =
    !!doctorId &&
    draftLoaded &&
    !!form.patient_name.trim() &&
    !!form.valve_type &&
    !!form.valve_disease;

  const persistDraft = useCallback(async () => {
    if (!doctorId || savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");
    const payload = { ...buildPayload(form), status: "draft" as any };
    try {
      if (draftIdRef.current) {
        const { error } = await supabase
          .from("clinical_cases")
          .update(payload)
          .eq("id", draftIdRef.current)
          .eq("status", "draft" as any); // never overwrite a promoted case
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("clinical_cases")
          .insert({ ...payload, doctor_id: doctorId })
          .select("id")
          .single();
        if (error) throw error;
        draftIdRef.current = data!.id;
      }
      setSaveStatus("saved");
      setLastSavedAt(new Date());
    } catch (e: any) {
      console.error("[autosave] falhou", e);
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, [doctorId, form]);

  useEffect(() => {
    if (!canAutosave) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void persistDraft(); }, 1200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form, canAutosave, persistDraft]);

  // Save immediately on tab close / route away
  useEffect(() => {
    const handler = () => {
      if (canAutosave && !savingRef.current) void persistDraft();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [canAutosave, persistDraft]);

  const update = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleArr = (key: "symptoms" | "comorbidities", val: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));
  };

  const canNext = () => {
    if (step === 1) return form.patient_name.trim() && form.valve_type && form.valve_disease;
    return true;
  };

  const discardDraft = async () => {
    if (!draftIdRef.current) {
      setForm(emptyForm);
      return;
    }
    if (!confirm("Descartar este rascunho? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase
      .from("clinical_cases")
      .delete()
      .eq("id", draftIdRef.current)
      .eq("status", "draft" as any);
    if (error) {
      toast.error("Não foi possível descartar", { description: error.message });
      return;
    }
    draftIdRef.current = null;
    setForm(emptyForm);
    setStep(1);
    setSaveStatus("idle");
    setLastSavedAt(null);
    toast.success("Rascunho descartado");
  };

  const submit = async () => {
    if (!doctorId) {
      toast.error("Perfil de médico não encontrado.");
      return;
    }
    setSaving(true);
    // Flush any pending autosave
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }

    const payload = { ...buildPayload(form), status: "avaliacao_inicial" as any };
    let caseId = draftIdRef.current;
    let error: any = null;

    if (caseId) {
      const res = await supabase.from("clinical_cases").update(payload).eq("id", caseId);
      error = res.error;
    } else {
      const res = await supabase
        .from("clinical_cases")
        .insert({ ...payload, doctor_id: doctorId })
        .select("id")
        .single();
      error = res.error;
      caseId = res.data?.id ?? null;
    }
    setSaving(false);
    if (error || !caseId) {
      toast.error("Erro ao salvar caso", { description: error?.message });
      return;
    }
    draftIdRef.current = null; // promoted, no longer a draft
    toast.success("Caso clínico criado");
    navigate(`/app/medico/casos/${caseId}`);
  };

  const saveIndicator = (() => {
    if (!canAutosave) {
      return { icon: <CloudOff className="h-3.5 w-3.5" />, text: "Autosave inicia após identificar paciente e valva" };
    }
    if (saveStatus === "saving") return { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: "Salvando rascunho..." };
    if (saveStatus === "error") return { icon: <CloudOff className="h-3.5 w-3.5 text-destructive" />, text: "Falha ao salvar — tentaremos novamente" };
    if (lastSavedAt) return {
      icon: <Cloud className="h-3.5 w-3.5 text-primary" />,
      text: `Rascunho salvo às ${lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    };
    return { icon: <Cloud className="h-3.5 w-3.5" />, text: "Pronto para salvar" };
  })();

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Novo registro"
        title="Novo caso clínico"
        description="Registre uma avaliação valvar em 3 passos. Rascunhos são salvos automaticamente no servidor (criptografados em trânsito e em repouso) e visíveis apenas para você."
        breadcrumbs={[{ label: "Início", to: "/app/medico" }, { label: "Novo caso" }]}
      />

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-4">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-3 flex-1">
            <div
              className={`h-9 w-9 rounded-full grid place-items-center text-sm font-semibold shrink-0 ${
                step >= s.n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {step > s.n ? <Check className="h-4 w-4" /> : s.n}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Passo {s.n}</p>
              <p className="text-sm font-medium">{s.label}</p>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${step > s.n ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Autosave indicator */}
      <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5" aria-live="polite">
          {saveIndicator.icon}
          <span>{saveIndicator.text}</span>
        </div>
        {draftIdRef.current && (
          <Button variant="ghost" size="sm" onClick={discardDraft} className="h-7 text-xs text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Descartar rascunho
          </Button>
        )}
      </div>

      <Card className="shadow-sm-soft">
        <CardContent className="p-6 lg:p-8 space-y-6">
          {step === 1 && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Nome / identificação do paciente *</Label>
                  <Input
                    value={form.patient_name}
                    onChange={(e) => update("patient_name", e.target.value)}
                    placeholder="Ex.: João S. ou iniciais"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use iniciais ou identificador interno se preferir não armazenar nome completo.
                  </p>
                </div>
                <div>
                  <Label>Idade</Label>
                  <Input
                    type="number" min="0" max="120"
                    value={form.patient_age}
                    onChange={(e) => update("patient_age", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Sexo</Label>
                  <Select value={form.patient_sex} onValueChange={(v) => update("patient_sex", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="O">Outro / não informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valva acometida *</Label>
                  <Select value={form.valve_type} onValueChange={(v) => update("valve_type", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(valveTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de lesão *</Label>
                  <Select value={form.valve_disease} onValueChange={(v) => update("valve_disease", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(valveDiseaseLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Gravidade</Label>
                  <Select value={form.severity} onValueChange={(v) => update("severity", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(severityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Classe funcional NYHA</Label>
                  <Select value={form.nyha} onValueChange={(v) => update("nyha", v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(nyhaLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Sintomas relatados</Label>
                <div className="flex flex-wrap gap-2">
                  {commonSymptoms.map((s) => {
                    const active = form.symptoms.includes(s);
                    return (
                      <button
                        key={s} type="button"
                        onClick={() => toggleArr("symptoms", s)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary/50"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Comorbidades</Label>
                <div className="flex flex-wrap gap-2">
                  {commonComorbidities.map((s) => {
                    const active = form.comorbidities.includes(s);
                    return (
                      <button
                        key={s} type="button"
                        onClick={() => toggleArr("comorbidities", s)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary/50"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Achados ecocardiográficos (opcional)</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">FE (%)</Label>
                    <Input type="number" step="0.1" value={form.ejection_fraction}
                      onChange={(e) => update("ejection_fraction", e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs">Grad. médio (mmHg)</Label>
                    <Input type="number" step="0.1" value={form.mean_gradient}
                      onChange={(e) => update("mean_gradient", e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs">Grad. máximo (mmHg)</Label>
                    <Input type="number" step="0.1" value={form.peak_gradient}
                      onChange={(e) => update("peak_gradient", e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-xs">Área valvar (cm²)</Label>
                    <Input type="number" step="0.01" value={form.valve_area}
                      onChange={(e) => update("valve_area", e.target.value)} className="mt-1.5" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Label className="text-xs">Grau de regurgitação / observação</Label>
                    <Input value={form.regurgitation_grade}
                      onChange={(e) => update("regurgitation_grade", e.target.value)}
                      placeholder="Ex.: regurgitação mitral moderada (2+/4+)" className="mt-1.5" />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>Conduta proposta</Label>
                <Textarea
                  value={form.proposed_management}
                  onChange={(e) => update("proposed_management", e.target.value)}
                  placeholder="Ex.: seguimento clínico em 6 meses com novo eco; otimização de IECA/BB; encaminhar para Heart Team."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
              <div>
                <Label>Notas clínicas adicionais</Label>
                <Textarea
                  value={form.clinical_notes}
                  onChange={(e) => update("clinical_notes", e.target.value)}
                  placeholder="Histórico, contexto, decisões compartilhadas com o paciente..."
                  className="mt-1.5 min-h-[120px]"
                />
              </div>

              <div className="rounded-lg bg-secondary/50 border border-border p-4 flex gap-3 items-start">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Pronto para registrar</p>
                  <p className="text-muted-foreground">
                    Após salvar, você poderá anexar exames (ecocardiograma, laudos, imagens) ao caso.
                    O ValvePath nunca interpreta imagens automaticamente — anexos servem como organização.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{valveTypeLabels[form.valve_type] || "—"}</Badge>
                <Badge variant="outline">{valveDiseaseLabels[form.valve_disease] || "—"}</Badge>
                <Badge variant="outline">{severityLabels[form.severity]}</Badge>
                {form.nyha && <Badge variant="outline">{`NYHA ${form.nyha}`}</Badge>}
              </div>
            </>
          )}

          {/* Navegação */}
          <div className="flex items-center justify-between border-t border-border pt-5">
            <Button
              variant="ghost"
              onClick={() => (step === 1 ? navigate("/app/medico") : setStep(step - 1))}
            >
              <ArrowLeft className="h-4 w-4" /> {step === 1 ? "Sair (rascunho salvo)" : "Voltar"}
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Registrar caso
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
