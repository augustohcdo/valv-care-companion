import { Sparkles, AlertTriangle, Eye, ArrowRight, Info as InfoIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRecommendations } from "@/lib/guidelines";

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
        <p className="text-[11px] text-muted-foreground italic pt-1">
          Recomendações automáticas baseadas em diretrizes ESC 2021 e AHA-ACC 2020. Não substituem julgamento clínico nem decisão do Heart Team.
        </p>
      </CardContent>
    </Card>
  );
};
