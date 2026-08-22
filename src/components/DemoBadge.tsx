import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AVISO_DEMO, ROTULO_DEMO } from "@/lib/demo";

/** Selo compacto, para linha de lista e cabeçalho de caso. */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title={AVISO_DEMO}
      className={`text-[10px] border-accent/50 bg-accent/10 text-accent-foreground ${className}`}
    >
      <FlaskConical className="h-3 w-3 mr-1" />
      {ROTULO_DEMO}
    </Badge>
  );
}

/**
 * Faixa larga, para o topo do caso. O selo compacto some no meio dos outros
 * badges; quem abre um prontuário precisa ler isto antes de olhar os números.
 */
export function DemoBanner() {
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 flex items-start gap-2">
      <FlaskConical className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" />
      <p className="text-sm text-accent-foreground leading-relaxed">{AVISO_DEMO}</p>
    </div>
  );
}
