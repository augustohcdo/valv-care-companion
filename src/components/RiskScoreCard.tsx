import { useMemo } from "react";
import { Activity, AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateRisk, TOTAL_ENTRADAS } from "@/lib/riskScore";

interface Props {
  caso: any;
}

export const RiskScoreCard = ({ caso }: Props) => {
  const result = useMemo(
    () =>
      calculateRisk({
        age: caso.patient_age,
        sex: caso.patient_sex,
        nyha: caso.nyha,
        ejection_fraction: caso.ejection_fraction,
        severity: caso.severity,
        comorbidities: caso.comorbidities,
      }),
    [caso]
  );

  // Anel neutro quando a categoria não é conclusiva.
  //
  // O verde era a parte mais alta da afirmação: um caso só com "lesão
  // importante" preenchida somava 14 pontos, caía na faixa "Baixo" e aparecia
  // com anel verde e "Perfil clínico favorável". Pintar de verde o resultado de
  // um cálculo feito sobre quase nada é afirmar com a cor exatamente o que o
  // texto passou a se recusar a afirmar.
  const ringColor = !result.categoriaDeterminada
    ? "stroke-muted-foreground"
    : result.category === "Baixo"
    ? "stroke-success"
    : result.category === "Intermediário"
    ? "stroke-accent-foreground"
    : result.category === "Alto"
    ? "stroke-warning"
    : "stroke-destructive";

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (result.score / 100) * circumference;

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" /> Estimativa de risco clínico
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Donut */}
          <div className="relative shrink-0 mx-auto sm:mx-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r="36" strokeWidth="10" className="stroke-muted" fill="none" />
              <circle
                cx="48" cy="48" r="36" strokeWidth="10" fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={ringColor}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground leading-none">{result.score}</p>
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">/ 100</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <Badge
              variant="outline"
              className={
                result.categoriaDeterminada
                  ? `${result.color} border-current`
                  : "text-muted-foreground border-current"
              }
            >
              {result.categoriaDeterminada
                ? `Risco ${result.category}`
                : `Risco ${result.category} — não conclusivo`}
            </Badge>
            <p className="text-sm text-foreground mt-2 leading-relaxed">{result.description}</p>
            {result.faltando.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {TOTAL_ENTRADAS - result.faltando.length} de {TOTAL_ENTRADAS} dados considerados.
                Não informado: {result.faltando.join(", ")}.
              </p>
            )}
          </div>
        </div>

        {result.breakdown.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Composição do score
            </p>
            <ul className="space-y-1.5">
              {result.breakdown.map((b, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground font-medium">{b.label}</span>
                    {b.detail && <span className="text-muted-foreground"> — {b.detail}</span>}
                  </div>
                  <span className="text-muted-foreground tabular-nums shrink-0">+{b.points}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              Estimativa <strong>educacional</strong>, baseada em variáveis clínicas comuns. Não
              substitui calculadoras validadas (STS, EuroSCORE II) nem julgamento do Heart Team.
            </p>
            <a
              href="https://www.mdcalc.com/calc/10179/european-system-cardiac-operative-risk-evaluation-euroscore-ii"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              Abrir calculadora EuroSCORE II (MDCalc) <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
