import { useState } from "react";
import { FileText, Copy, Loader2, Sparkles, Stethoscope, HeartHandshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  caso: any;
  prosthesis?: { manufacturer: string; model_name: string; size: number | null } | null;
  riskScore?: { model: string; value: number | null } | null;
}

export function DocumentGenerator({ caso, prosthesis, riskScore }: Props) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"evolucao" | "alta" | null>(null);
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

  const generateAlta = async () => {
    setLoading(true);
    setKind("alta");
    try {
      const { data, error } = await supabase.functions.invoke("clinical-ai", {
        body: { mode: "patient_discharge", caseId: caso.id },
      });
      if (error) {
        toast.error("Falha ao gerar orientação", { description: (error as any)?.message });
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
          <Button variant="outline" onClick={generateAlta} disabled={loading} className="justify-start">
            {loading && kind === "alta" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
            Gerar Orientação de Alta (Paciente)
          </Button>
        </div>

        {kind && (
          <div className="space-y-2">
            <Textarea
              value={text}
              readOnly
              className="min-h-[200px] text-sm font-mono"
              placeholder={loading ? "Gerando..." : ""}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Revise antes de anexar ao prontuário ou entregar ao paciente.
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
