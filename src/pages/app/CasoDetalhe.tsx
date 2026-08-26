import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, Save, Download } from "lucide-react";
import { useDoctor } from "@/hooks/useDoctor";
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
  caseStatusLabels,
} from "@/lib/clinicalLabels";
import { DemoBanner } from "@/components/DemoBadge";
import { ehDemo } from "@/lib/demo";
import { CaseFindingsEditor } from "@/components/CaseFindingsEditor";
import { CaseExamGap } from "@/components/CaseExamGap";
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
import { DocumentGenerator } from "@/components/DocumentGenerator";
import { logAudit } from "@/lib/auditLog";

export const caseDetailKey = (caseId?: string, doctorId?: string) =>
  ["case-detail", caseId, doctorId] as const;

export default function CasoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const auditedRef = useRef<string | null>(null);

  const { data: doctor, isLoading: loadingDoctor } = useDoctor();
  // Só para a leitura do laudo reconhecer o próprio nome do médico onde ele
  // aparecer impresso — laudo emitido por quem está usando o sistema é comum,
  // e é aí que a troca com o nome do paciente passa despercebida.
  const { profile } = useAuth();

  // O papel do usuário entra na mesma query porque depende do caso e do
  // médico ao mesmo tempo — e porque o id do médico já faz parte da chave,
  // de modo que trocar de conta no mesmo navegador não reaproveita permissão.
  const { data, isLoading: loadingCase, error } = useQuery({
    queryKey: caseDetailKey(id, doctor?.id),
    queryFn: async () => {
      const { data: caso, error } = await supabase
        .from("clinical_cases").select("*").is("deleted_at", null).eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!caso) return null;

      const isOwner = !!doctor && doctor.id === caso.doctor_id;
      let canComment = isOwner;
      if (!isOwner && doctor) {
        const { data: collab } = await supabase
          .from("case_collaborators")
          .select("access_level, status")
          .eq("case_id", id!)
          .eq("doctor_id", doctor.id)
          .is("deleted_at", null)
          .maybeSingle();
        canComment = collab?.status === "aceito" && collab?.access_level === "comentar";
      }

      let patientUserId: string | null = null;
      if (caso.patient_id) {
        const { data: pat } = await supabase
          .from("patients").select("user_id").is("deleted_at", null).eq("id", caso.patient_id).maybeSingle();
        patientUserId = pat?.user_id ?? null;
      }

      return { caso, isOwner, canComment, patientUserId };
    },
    enabled: !!id && !loadingDoctor,
  });

  const caso = data?.caso ?? null;
  const isOwner = data?.isOwner ?? false;
  const canComment = data?.canComment ?? false;
  const patientUserId = data?.patientUserId ?? null;
  const loading = loadingDoctor || loadingCase;

  // Preenche o formulário quando o caso chega. Sincronização de formulário
  // com dado assíncrono é justamente o caso em que este efeito é correto.
  /* eslint-disable react-hooks/set-state-in-effect -- sincronização de formulário com dado assíncrono: é o caso legítimo desta regra */
  useEffect(() => {
    if (!caso) return;
    setStatus(caso.status);
    setNotes(caso.clinical_notes || "");
  }, [caso]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // A auditoria de "prontuário aberto" fica fora da query de propósito: o
  // react-query refaz a busca ao voltar o foco da janela, e isso encheria a
  // trilha de auditoria de aberturas que nunca aconteceram. O ref garante uma
  // entrada por caso aberto.
  useEffect(() => {
    if (!caso || auditedRef.current === caso.id) return;
    auditedRef.current = caso.id;
    logAudit("case_viewed", "clinical_cases", caso.id);
  }, [caso]);

  useEffect(() => {
    if (error) toast.error("Erro ao carregar caso", { description: (error as Error).message });
    else if (!loading && data === null) {
      toast.error("Caso não encontrado");
      navigate("/app/medico/casos");
    }
  }, [error, loading, data, navigate]);

  const saveChanges = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clinical_cases")
      .update({ status: status as any, clinical_notes: notes })
      .eq("id", id!);
    setSaving(false);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else {
      toast.success("Caso atualizado");
      logAudit("case_updated", "clinical_cases", id!, { status });
      // sem isto o cabeçalho continuaria mostrando o status anterior
      queryClient.invalidateQueries({ queryKey: caseDetailKey(id, doctor?.id) });
    }
  };

  const deleteCase = async () => {
    const { error } = await supabase
      .from("clinical_cases")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id!);
    if (error) toast.error("Erro", { description: error.message });
    else {
      toast.success("Caso removido");
      logAudit("case_deleted", "clinical_cases", id!);
      navigate("/app/medico/casos");
    }
  };

  const handleExport = async () => {
    if (!caso) return;
    toast.info("Gerando PDF...");
    // Buscar dados relacionados
    const [{ data: events }, { data: appts }, { data: docs }, { data: doctor }] = await Promise.all([
      supabase.from("case_events").select("*").eq("case_id", caso.id).is("deleted_at", null).order("event_date", { ascending: false }),
      supabase.from("appointments").select("*").eq("case_id", caso.id).is("deleted_at", null).order("scheduled_at"),
      supabase.from("case_documents").select("*").eq("case_id", caso.id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("doctors").select("*").eq("id", caso.doctor_id).maybeSingle(),
    ]);

    let doctorInfo: any = undefined;
    if (doctor) {
      // Pelo RPC: ler `profiles` de outro médico volta vazio pela policy, e o
      // PDF de um caso exportado por um colaborador saía com "Dr(a). —" no
      // lugar do autor. Documento clínico sem autor identificado.
      const { data: participantes } = await supabase
        .rpc("participantes_do_caso", { _case_id: caso.id });
      const dono = (participantes ?? []).find((x) => x.user_id === doctor.user_id);
      doctorInfo = {
        full_name: dono?.full_name ?? null,
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
    logAudit("document_exported", "clinical_cases", caso.id, { format: "pdf", type: "case_report" });
  };

  if (loading || !caso) {
    return <div className="grid place-items-center min-h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* A válvula de segurança clínica da pseudonimização.
          Quando o titular pede eliminação, o nome sai do prontuário — mas o
          médico precisa saber que aquele caso tem dono identificável, e por
          onde recuperar a identidade se o atendimento exigir. Sem este aviso,
          o código pareceria erro de cadastro. */}
      {caso.patient_name?.startsWith("Titular removido") && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px] leading-relaxed">
          <strong>Titular solicitou eliminação dos dados (LGPD, Art. 18, VI).</strong> O registro
          clínico é preservado por 20 anos, como manda a Lei 13.787/2018, mas o nome foi
          substituído por um código. A identificação continua guardada em base restrita: peça ao
          encarregado de dados (DPO) se o atendimento exigir.
        </div>
      )}
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

      {/* Antes de qualquer número: quem abre um prontuário precisa saber, já
          na primeira linha, que este paciente não existe. */}
      {ehDemo(caso) && <div className="mb-6"><DemoBanner /></div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* O exame tem número que os achados não têm — detectado ao abrir,
              não só no instante em que o exame é salvo. */}
          <CaseExamGap
            caseId={caso.id}
            caso={caso}
            readOnly={!isOwner}
            onAplicado={() => queryClient.invalidateQueries({ queryKey: caseDetailKey(id, doctor?.id) })}
          />

          {/* Achados — leitura e edição no mesmo lugar */}
          <CaseFindingsEditor
            caso={caso}
            readOnly={!isOwner}
            onSaved={() => queryClient.invalidateQueries({ queryKey: caseDetailKey(id, doctor?.id) })}
          />

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
          <CaseDocuments
            caseId={caso.id}
            caso={caso}
            nomeDoMedico={profile?.full_name}
            onAplicado={() => queryClient.invalidateQueries({ queryKey: caseDetailKey(id, doctor?.id) })}
          />

          {/* Gerador de documentos (evolução + orientação de alta) */}
          {isOwner && <DocumentGenerator caso={caso} />}

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

