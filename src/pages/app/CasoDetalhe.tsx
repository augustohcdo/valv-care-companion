import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, Save, Activity, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, severityColors,
  caseStatusLabels, nyhaLabels,
} from "@/lib/clinicalLabels";
import { CaseDocuments } from "@/components/CaseDocuments";
import { CaseTimeline } from "@/components/CaseTimeline";
import { CaseAppointments } from "@/components/CaseAppointments";
import { RiskScoreCard } from "@/components/RiskScoreCard";
import { exportCasePDF } from "@/lib/casePdf";
import { CaseChat } from "@/components/CaseChat";
import { CaseExams } from "@/components/CaseExams";
import { GuidelineRecommendations } from "@/components/GuidelineRecommendations";
import { CaseCollaborators } from "@/components/CaseCollaborators";
import { CaseDiscussion } from "@/components/CaseDiscussion";
import { ClinicalAIPanel } from "@/components/ClinicalAIPanel";
import { CaseExternalData } from "@/components/CaseExternalData";

export default function CasoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [canComment, setCanComment] = useState(false);
  const [patientUserId, setPatientUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("clinical_cases").select("*").is("deleted_at", null).eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error("Caso não encontrado");
        navigate("/app/medico/casos");
        return;
      }
      setCaso(data);
      setStatus(data.status);
      setNotes(data.clinical_notes || "");

      // Determinar papel: owner ou colaborador
      const { data: doc } = await supabase
        .from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      const owner = !!doc && doc.id === data.doctor_id;
      setIsOwner(owner);

      if (owner) {
        setCanComment(true);
      } else if (doc) {
        const { data: collab } = await supabase
          .from("case_collaborators")
          .select("access_level, status")
          .eq("case_id", id)
          .eq("doctor_id", doc.id)
          .maybeSingle();
        setCanComment(collab?.status === "aceito" && collab?.access_level === "comentar");
      }

      if (data.patient_id) {
        const { data: pat } = await supabase.from("patients").select("user_id").is("deleted_at", null).eq("id", data.patient_id).maybeSingle();
        setPatientUserId(pat?.user_id ?? null);
      }
      setLoading(false);
    })();
  }, [id, user, navigate]);

  const saveChanges = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clinical_cases")
      .update({ status: status as any, clinical_notes: notes })
      .eq("id", id!);
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else toast.success("Caso atualizado");
  };

  const deleteCase = async () => {
    const { error } = await supabase.from("clinical_cases").delete().eq("id", id!);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Caso removido");
      navigate("/app/medico/casos");
    }
  };

  const handleExport = async () => {
    if (!caso) return;
    toast.info("Gerando PDF...");
    // Buscar dados relacionados
    const [{ data: events }, { data: appts }, { data: docs }, { data: doctor }] = await Promise.all([
      supabase.from("case_events").select("*").eq("case_id", caso.id).order("event_date", { ascending: false }),
      supabase.from("appointments").select("*").eq("case_id", caso.id).order("scheduled_at"),
      supabase.from("case_documents").select("*").eq("case_id", caso.id).order("created_at", { ascending: false }),
      supabase.from("doctors").select("*").eq("id", caso.doctor_id).maybeSingle(),
    ]);

    let doctorInfo: any = undefined;
    if (doctor) {
      const { data: prof } = await supabase
        .from("profiles").select("full_name").eq("user_id", doctor.user_id).maybeSingle();
      doctorInfo = {
        full_name: prof?.full_name || "—",
        crm: doctor.crm,
        crm_uf: doctor.crm_uf,
        specialty: doctor.specialty,
      };
    }

    exportCasePDF({
      caso,
      doctor: doctorInfo,
      events: events || [],
      appointments: appts || [],
      documents: docs || [],
    });
    toast.success("PDF gerado");
  };

  if (loading || !caso) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Caso clínico"
        title={caso.patient_name}
        description={`${valveTypeLabels[caso.valve_type]} — ${valveDiseaseLabels[caso.valve_disease]}`}
        breadcrumbs={[
          { label: "Início", to: "/app/medico" },
          { label: "Casos", to: "/app/medico/casos" },
          { label: caso.patient_name },
        ]}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/app/medico/casos"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover caso?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O caso e todos os documentos anexados serão excluídos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteCase} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className={severityColors[caso.severity]}>{severityLabels[caso.severity]}</Badge>
          <Badge variant="secondary">{caseStatusLabels[caso.status]}</Badge>
          {caso.nyha && <Badge variant="outline">NYHA {caso.nyha}</Badge>}
          {caso.patient_age && <Badge variant="outline">{caso.patient_age} anos</Badge>}
        </div>
      </PageHeader>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Achados */}
          <Card className="shadow-sm-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" /> Achados clínicos e ecocardiográficos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Info label="Classe NYHA" value={caso.nyha ? nyhaLabels[caso.nyha] : "—"} />
              <Info label="FE" value={caso.ejection_fraction ? `${caso.ejection_fraction}%` : "—"} />
              <Info label="Gradiente médio" value={caso.mean_gradient ? `${caso.mean_gradient} mmHg` : "—"} />
              <Info label="Gradiente máximo" value={caso.peak_gradient ? `${caso.peak_gradient} mmHg` : "—"} />
              <Info label="Área valvar" value={caso.valve_area ? `${caso.valve_area} cm²` : "—"} />
              <Info label="Regurgitação" value={caso.regurgitation_grade || "—"} />

              {caso.symptoms?.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Sintomas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {caso.symptoms.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                </div>
              )}
              {caso.comorbidities?.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Comorbidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {caso.comorbidities.map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}
                  </div>
                </div>
              )}
              {caso.proposed_management && (
                <div className="sm:col-span-2 pt-2 border-t border-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Conduta proposta</p>
                  <p className="text-foreground whitespace-pre-wrap">{caso.proposed_management}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exames seriados com gráficos */}
          <CaseExams caseId={caso.id} readOnly={!isOwner} />

          {/* Sugestão de conduta baseada em diretrizes */}
          <GuidelineRecommendations caso={caso} />

          {/* IA Clínica (resumo, conduta, tendências, chat) */}
          <ClinicalAIPanel caseId={caso.id} />

          {/* Discussão clínica entre médicos */}
          <CaseDiscussion caseId={caso.id} canComment={canComment} />

          {/* Timeline evolutiva */}
          <CaseTimeline caseId={caso.id} readOnly={!isOwner} />

          {/* Agenda */}
          <CaseAppointments caseId={caso.id} readOnly={!isOwner} />

          {/* Documentos */}
          <CaseDocuments caseId={caso.id} />

          {/* Dados externos (FHIR de hospitais parceiros) */}
          <CaseExternalData caseId={caso.id} patientUserId={patientUserId} />

          {/* Chat com o paciente (somente médico responsável) */}
          {isOwner && caso.patient_id && <CaseChat caseId={caso.id} viewerRole="medico" />}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <RiskScoreCard caso={caso} />

          {/* Colaboradores (segunda opinião) */}
          <CaseCollaborators caseId={caso.id} isOwner={isOwner} />

          {isOwner && (
            <Card className="shadow-sm-soft">
              <CardHeader><CardTitle className="text-base">Status & evolução</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Status do caso</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(caseStatusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notas clínicas</Label>
                  <Textarea
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 min-h-[140px]"
                    placeholder="Adicione evolução, decisões compartilhadas..."
                  />
                </div>
                <Button onClick={saveChanges} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar alterações
                </Button>
              </CardContent>
            </Card>
          )}

          {!isOwner && (
            <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/30 rounded-lg p-3">
              <p className="font-medium text-foreground mb-0.5">Modo colaborador</p>
              Você está visualizando este caso como {canComment ? "comentarista" : "leitor"}. Edições são reservadas ao médico responsável.
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3">
            ValvePath é apoio à decisão. Não substitui julgamento clínico nem realiza diagnóstico automático.
          </div>
        </div>
      </div>
    </div>
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
