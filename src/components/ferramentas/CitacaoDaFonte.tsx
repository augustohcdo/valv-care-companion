import { ExternalLink } from "lucide-react";
import type { Fonte } from "@/lib/fontes";

/**
 * A citação da fonte, junto do cálculo.
 *
 * Fica na tela e não no rodapé de propósito: quem discorda do número precisa
 * poder ir conferir de onde ele saiu, sem procurar. É o que separa apoio à
 * decisão de "número que apareceu".
 */
export function CitacaoDaFonte({ fonte }: { fonte: Fonte }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <p className="text-xs text-foreground/80 leading-relaxed">{fonte.citacao}</p>
      <p className="text-[11px] text-muted-foreground mt-1">Daqui saiu: {fonte.usadoPara}.</p>
      <a
        href={fonte.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        Abrir a publicação <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
