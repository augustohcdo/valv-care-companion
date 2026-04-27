import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MedicalDisclaimerProps {
  variant?: "default" | "compact" | "inline";
  className?: string;
}

export const MedicalDisclaimer = ({ variant = "default", className }: MedicalDisclaimerProps) => {
  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground italic", className)}>
        Esta informação é educacional e não substitui avaliação médica individualizada.
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-foreground", className)}>
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <span>
          <strong className="font-semibold">Apoio clínico, não substitui o médico.</strong> Decisões devem ser tomadas pelo profissional habilitado e Heart Team.
        </span>
      </div>
    );
  }

  return (
    <aside className={cn("rounded-xl border border-warning/30 bg-warning/5 p-4 sm:p-5", className)}>
      <div className="flex gap-3">
        <div className="shrink-0">
          <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h4 className="font-display font-semibold text-sm text-foreground">
            Aviso de responsabilidade médica
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ValvePath é uma ferramenta de <strong className="text-foreground">apoio educacional e organizacional</strong>. Não substitui avaliação médica, julgamento clínico, diagnóstico, prescrição, laudo ou decisão do Heart Team. Em sinais de alerta, procure atendimento médico imediato.
          </p>
        </div>
      </div>
    </aside>
  );
};
