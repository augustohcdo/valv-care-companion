import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Copy, Loader2, Sparkles, Stethoscope, HeartHandshake, ClipboardList, Scissors, Activity, LogOut, AlertTriangle } from "lucide-react";
import { traduzirFalhaIA } from "@/lib/aiErros";
import { limparNotacaoMatematica } from "@/lib/textoDaIA";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { hasActiveConsent } from "@/lib/consent";
import { type ModoDocumento } from "@/lib/aiModes";
import { toast } from "sonner";

export const prosthesisKey = (prosthesisId?: string | null) =>
  ["prosthesis", prosthesisId] as const;

interface Props {
  caso: any;
  /**
   * O escore calculado na mesma tela.
   *
   * `value` é **pontuação de 0 a 100**, não percentual de mortalidade — e a
   * frase gerada diz isso. A versão anterior escrevia "risco {model} de
   * {value}%" no texto que vai para o prontuário, o que transformaria uma
   * estimativa educacional em um percentual de óbito. Não chegou a acontecer em
   * produção só porque `CasoDetalhe` nunca passou esta propriedade — o
   * documento sempre caía em "escore de risco pendente de registro", mesmo com
   * o escore calculado e visível logo abaixo, na mesma tela.
   */
  riskScore?: { model: string; value: number | null; categoria?: string; conclusiva?: boolean } | null;
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
  /** O modelo parou por limite de tamanho: o texto abaixo está cortado. */
  const [truncado, setTruncado] = useState(false);
  /**
   * As fontes que sustentaram a resposta, e quantas delas ainda são
   * PRELIMINARES (`review_status: "ai_generated"`).
   *
   * A `clinical-ai` devolve `sources` em todos os modos menos o de orientação
   * de alta, e esta tela as descartava. O `ClinicalAIPanel`, ao lado, marca
   * cada trecho preliminar com "· gerado por IA ·" — marcação estrutural, que
   * não depende de o modelo ter obedecido à instrução do prompt. Aqui não
   * havia marcação nenhuma: o médico gerava o documento, clicava em Copiar, e
   * colava no prontuário um texto que podia se apoiar em material que nenhum
   * médico revisou.
   */
  const [preliminares, setPreliminares] = useState<string[]>([]);
  const [kind, setKind] = useState<DocKind | null>(null);
  const [loading, setLoading] = useState(false);

  const generateEvolucao = () => {
    const risco = riskScore?.value == null
      ? `Avaliação pré-operatória em curso; escore de risco pendente de registro.`
      : riskScore.conclusiva === false
        ? `Escore de risco ${riskScore.model}: ${riskScore.value} de 100 pontos, com dados ` +
          `incompletos — a categoria ainda não é conclusiva. Estimativa educacional; não ` +
          `corresponde a percentual de mortalidade.`
        : `Escore de risco ${riskScore.model}: ${riskScore.value} de 100 pontos` +
          `${riskScore.categoria ? ` (categoria ${riskScore.categoria})` : ""}. ` +
          `Estimativa educacional; não corresponde a percentual de mortalidade.`;
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
    setTruncado(false);
    setPreliminares([]);
    try {
      const { data, error } = await supabase.functions.invoke("clinical-ai", {
        body: { mode, caseId: caso.id },
      });
      if (error) {
        // Antes desta tela só conhecer o 403, bater no limite de uso por hora
        // devolvia "não foi possível gerar o documento" — sem dizer que basta
        // esperar. `traduzirFalhaIA` é a mesma tradução das outras telas.
        const falha = traduzirFalhaIA(
          (error as any)?.context?.status,
          AI_MODES[mode].toastFail,
          (error as any)?.message,
        );
        toast.error(falha.titulo, { description: falha.descricao });
        setKind(null); return;
      }
      if (data?.error) { toast.error(data.error); setKind(null); return; }
      setText(limparNotacaoMatematica(data.content ?? ""));
      setTruncado(!!data?.truncado);
      const fontes: Array<{ organization?: string; year?: number; review_status?: string }> =
        Array.isArray(data?.sources) ? data.sources : [];
      setPreliminares(
        fontes
          .filter((f) => f.review_status === "ai_generated")
          .map((f) => `${f.organization ?? "fonte"} ${f.year ?? ""}`.trim()),
      );
      if (data?.truncado) {
        // Documento cortado tem a mesma cara de documento inteiro. Avisar duas
        // vezes — no aviso e na própria tela — porque quem assina precisa saber
        // antes de ler, e de novo enquanto revisa.
        toast.warning("O documento ficou incompleto", {
          description: "O modelo atingiu o limite de tamanho e parou no meio. Revise o final antes de usar.",
        });
      }
    } catch (e: any) {
      toast.error("Erro de comunicação", { description: e?.message });
      setKind(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * O texto que vai para a área de transferência.
   *
   * O aviso na tela **não viaja com o documento**. Quem copia e cola no
   * prontuário leva só o texto — e o prontuário é onde a afirmação passa a
   * valer. Por isso a ressalva vai junto, escrita no próprio documento, como
   * o modelo de evolução manual já fazia com o "revisar antes de arquivar".
   */
  const textoParaCopiar = () => {
    const notas: string[] = [];
    if (truncado) {
      notas.push(
        "ATENÇÃO: este rascunho ficou INCOMPLETO — o gerador atingiu o limite de " +
        "tamanho e parou no meio. Confira o final antes de arquivar.",
      );
    }
    if (preliminares.length) {
      notas.push(
        `ATENÇÃO: parte do conteúdo apoia-se em ${preliminares.length} trecho(s) de base ` +
        `PRELIMINAR, gerados por IA a partir de diretriz e ainda NÃO revisados por ` +
        `médico (${preliminares.join("; ")}). Confira na fonte primária antes de ` +
        "arquivar em prontuário ou entregar ao paciente.",
      );
    }
    if (!notas.length) return text;
    return `${text}\n\n---\n${notas.join("\n\n")}`;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textoParaCopiar());
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
            {truncado && (
              /* Fica acima do texto de propósito: quem vai assinar precisa
                 saber que o documento está cortado antes de começar a ler. */
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  <strong>Documento incompleto.</strong> O modelo atingiu o limite de tamanho e
                  parou no meio — o final está faltando. Gere de novo ou complete manualmente
                  antes de anexar ao prontuário.
                </p>
              </div>
            )}
            {preliminares.length > 0 && (
              /* Acima do texto, junto do aviso de truncamento e pelo mesmo
                 motivo: quem vai assinar precisa saber antes de começar a ler.
                 E a mesma ressalva é acrescentada ao texto copiado, porque é
                 o texto que chega ao prontuário. */
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  <strong>Apoiado em base preliminar.</strong>{" "}
                  {preliminares.length} trecho(s) usados nesta geração foram gerados por IA a
                  partir de diretriz e <strong>ainda não foram revisados por médico</strong>{" "}
                  ({preliminares.join("; ")}). Confira na fonte primária antes de arquivar.
                  A ressalva vai junto no texto copiado.
                </p>
              </div>
            )}
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
