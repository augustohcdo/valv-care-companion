import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Copy, Loader2, Sparkles, Stethoscope, HeartHandshake, ClipboardList, Scissors, Activity, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { hasActiveConsent, AVISO_CONSENTIMENTO_IA } from "@/lib/consent";
import { type ModoDocumento } from "@/lib/aiModes";
import { toast } from "sonner";

export const prosthesisKey = (prosthesisId?: string | null) =>
  ["prosthesis", prosthesisId] as const;

interface Props {
  caso: any;
  riskScore?: { model: string; value: number | null } | null;
}

/** "evolucao" é montada aqui mesmo, sem IA; o resto vai para a edge function. */
type DocKind = "evolucao" | ModoDocumento;

const AI_MODES: Record<ModoDocumento, { label: string; toastFail: string }> = {
  patient_discharge: { label: "Orientação de Alta (Paciente)", toastFail: "Falha ao gerar orientação" },
  note_consultation: { label: "Nota de Consulta", toastFail: "Falha ao gerar nota" },
  preop_summary: { label: "Resumo Pré-Operatório", toastFail: "Falha ao gerar resumo" },
  postop_note: { label: "Nota Pós-Operatória", toastFail: "Falha ao gerar nota" },
  discharge_summary: { label: "Sumário de Alta", toastFail: "Falha ao gerar sumário" },
};

export function DocumentGenerator({ caso, riskScore }: Props) {
  const { data: prosthesis = null } = useQuery({
    queryKey: prosthesisKey(caso?.prosthesis_id),
    queryFn: async () => {
      const { data, error } = await supabase.from("prosthesis_catalog")
        .select("manufacturer, model_name, size")
        .eq("id", caso!.prosthesis_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!caso?.prosthesis_id,
  });
  const [text, setText] = useState("");
  const [kind, setKind] = useState<DocKind | null>(null);
  const [loading, setLoading] = useState(false);

  const generateEvolucao = () => {
    const risco = riskScore?.value != null
      ? `Avaliação pré-operatória revelou risco ${riskScore.model} de ${riskScore.value}%.`
      : `Avaliação pré-operatória em curso; escore de risco pendente de registro.`;
    const prot = prosthesis
      ? `Implantada prótese ${prosthesis.model_name}${prosthesis.size ? ` tamanho ${prosthesis.size}mm` : ""} (${prosthesis.manufacturer}).`
      : `Prótese planejada ainda não registrada no catálogo do caso.`;
    const eco = `Ecocardiograma basal: FE ${caso.ejection_fraction ?? "—"}%, Gradiente Médio ${caso.mean_gradient ?? "—"} mmHg${caso.valve_area ? `, Área valvar ${caso.valve_area} cm²` : ""}.`;
    const out = `Paciente ${caso.patient_name}${caso.patient_age ? `, ${caso.patient_age} anos` : ""}${caso.patient_sex ? `, sexo ${caso.patient_sex}` : ""}, portador(a) de ${caso.valve_disease} de valva ${caso.valve_type}, submetido(a) a procedimento estrutural valvar. ${risco} ${prot} ${eco}${caso.proposed_management ? `\n\nConduta atual: ${caso.proposed_management}` : ""}\n\n— Registro gerado via ValvePath (apoio à decisão, revisar antes de arquivar em prontuário).`;
    setText(out);
    setKind("evolucao");
  };

  const generateAi = async (mode: ModoDocumento) => {
    const consented = await hasActiveConsent("ai_processing");
    if (!consented) {
      toast.error("Consentimento necessário", {
        description: "Ative \"Processamento por IA clínica\" em Privacidade e segurança para gerar documentos com IA.",
      });
      return;
    }
    setLoading(true);
    setKind(mode);
    setText("");
    try {
      const { data, error } = await supabase.functions.invoke("clinical-ai", {
        body: { mode, caseId: caso.id },
      });
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 403) toast.error(AVISO_CONSENTIMENTO_IA.titulo, { description: AVISO_CONSENTIMENTO_IA.descricao });
        else toast.error(AI_MODES[mode].toastFail, { description: (error as any)?.message });
        setKind(null); return;
      }
      if (data?.error) { toast.error(data.error); setKind(null); return; }
      setText(data.content ?? "");
    } catch (e: any) {
      toast.error("Erro de comunicação", { description: e?.message });
      setKind(null);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar automaticamente");
    }
  };

  const label = kind ? (kind === "evolucao" ? "Evolução Médica" : AI_MODES[kind].label) : "";

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" /> Documentos e pareceres
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-2">
          <Button variant="outline" onClick={generateEvolucao} className="justify-start">
            <Stethoscope className="h-4 w-4" /> Gerar Evolução Médica (Prontuário)
          </Button>
          <Button variant="outline" onClick={() => generateAi("patient_discharge")} disabled={loading} className="justify-start">
            {loading && kind === "patient_discharge" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
            Gerar Orientação de Alta (Paciente)
          </Button>
          <Button variant="outline" onClick={() => generateAi("note_consultation")} disabled={loading} className="justify-start">
            {loading && kind === "note_consultation" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Nota de Consulta
          </Button>
          <Button variant="outline" onClick={() => generateAi("preop_summary")} disabled={loading} className="justify-start">
            {loading && kind === "preop_summary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            Resumo Pré-Operatório
          </Button>
          <Button variant="outline" onClick={() => generateAi("postop_note")} disabled={loading} className="justify-start">
            {loading && kind === "postop_note" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Nota Pós-Operatória
          </Button>
          <Button variant="outline" onClick={() => generateAi("discharge_summary")} disabled={loading} className="justify-start">
            {loading && kind === "discharge_summary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sumário de Alta (Prontuário)
          </Button>
        </div>

        {kind && (
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[240px] text-sm font-mono"
              placeholder={loading ? "Gerando a partir dos dados registrados no caso..." : ""}
              aria-label={`${label} (editável)`}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Rascunho baseado apenas em registros do caso. Revise antes de anexar ao prontuário ou entregar ao paciente.
              </p>
              <Button size="sm" onClick={copy} disabled={!text}>
                <Copy className="h-3.5 w-3.5" /> Copiar Texto
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
