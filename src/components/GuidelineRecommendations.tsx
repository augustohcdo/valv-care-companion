import { Link } from "react-router-dom";
import { Sparkles, AlertTriangle, Eye, ArrowRight, Info as InfoIcon, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRecommendations } from "@/lib/guidelines";
import { FONTE_2025 } from "@/data/diretriz2025";
import { MMCTS, tutoriaisDaConduta } from "@/data/mmcts";
import { ListaDeTutoriais } from "@/components/mmcts/ListaDeTutoriais";

interface Props {
  caso: any;
}

const levelConfig: Record<string, { color: string; icon: any; label: string }> = {
  urgent: { color: "border-destructive/40 bg-destructive/5", icon: AlertTriangle, label: "Indicação clara" },
  consider: { color: "border-warning/40 bg-warning/5", icon: Sparkles, label: "Considerar" },
  watch: { color: "border-primary/30 bg-primary/5", icon: Eye, label: "Vigilância" },
  info: { color: "border-border bg-secondary/30", icon: InfoIcon, label: "Informativo" },
};

export const GuidelineRecommendations = ({ caso }: Props) => {
  const recs = getRecommendations({
    valve_type: caso.valve_type,
    valve_disease: caso.valve_disease,
    severity: caso.severity,
    nyha: caso.nyha,
    ejection_fraction: caso.ejection_fraction,
    mean_gradient: caso.mean_gradient,
    peak_gradient: caso.peak_gradient,
    valve_area: caso.valve_area,
    symptoms: caso.symptoms,
    patient_age: caso.patient_age,
    // As medidas da diretriz de 2025. Sem repassá-las aqui, o motor as trata
    // como não informadas e a atualização inteira vira fachada: o código sabe
    // ler Vmax e DSVE, e a tela nunca os entrega.
    vmax_m_s: caso.vmax_m_s,
    svi_ml_m2: caso.svi_ml_m2,
    lvesd_mm: caso.lvesd_mm,
    altura_cm: caso.altura_cm,
    peso_kg: caso.peso_kg,
    teste_esforco: caso.teste_esforco,
    risco_cirurgico: caso.risco_cirurgico,
    fibrilacao_atrial: caso.fibrilacao_atrial,
    em_etiologia: caso.em_etiologia,
  });

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" /> Sugestão de conduta
          <Badge variant="outline" className="text-[10px] ml-1">Apoio à decisão</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recs.map((r, i) => {
          const cfg = levelConfig[r.level];
          const Icon = cfg.icon;
          return (
            <div key={i} className={`p-3 rounded-lg border ${cfg.color}`}>
              <div className="flex items-start gap-2.5">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    {r.classRec && (
                      <Badge variant="secondary" className="text-[10px]">
                        Classe {r.classRec}{r.evidence ? ` • ${r.evidence}` : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.detail}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1.5 inline-flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> {r.source}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <TecnicaDaConduta recs={recs} />

        {/* Esta linha dizia "ESC 2021 e AHA-ACC 2020" depois que o motor já
            tinha sido reescrito para a ESC/EACTS 2025 — a tela nomeando uma
            fonte que o código não usava mais. O DOI vem do arquivo de citações,
            então a frase não pode voltar a divergir sozinha. */}
        <p className="text-[11px] text-muted-foreground italic pt-1">
          Recomendações automáticas segundo a ESC/EACTS 2025 (DOI {FONTE_2025.doi}). Não
          substituem julgamento clínico nem decisão do Heart Team.
        </p>
      </CardContent>
    </Card>
  );
};

/**
 * O tutorial de técnica, quando a conduta sugerida é uma operação.
 *
 * Discreto de propósito: some por inteiro no paciente em vigilância, e nunca
 * aparece como bloco no meio das recomendações. A pergunta "como se faz" só
 * existe depois que a pergunta "faz?" foi respondida.
 *
 * A ligação é pela chave da recomendação, não por palavra no título — ver
 * `GESTO_DA_RECOMENDACAO` em `src/data/mmcts.ts`.
 */
const TecnicaDaConduta = ({ recs }: { recs: ReturnType<typeof getRecommendations> }) => {
  const tutoriais = tutoriaisDaConduta(recs.map((r) => r.chave));
  if (tutoriais.length === 0) return null;

  return (
    <details className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <summary className="text-xs font-medium text-foreground cursor-pointer inline-flex items-center gap-1.5">
        <PlayCircle className="h-3.5 w-3.5 text-primary" />
        Técnica operatória em vídeo ({tutoriais.length})
      </summary>
      <div className="pt-2.5 space-y-2">
        <ListaDeTutoriais tutoriais={tutoriais} compacta />
        <p className="text-[10px] text-muted-foreground">
          {MMCTS.fonte}, acesso aberto — abre no site da EACTS.{" "}
          <Link to="/app/medico/tecnica" className="text-primary hover:underline">
            Ver todas por operação
          </Link>
        </p>
      </div>
    </details>
  );
};
