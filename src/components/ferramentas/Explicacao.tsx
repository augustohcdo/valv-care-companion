import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Um bloco de justificativa que começa fechado.
 *
 * ## Por que recolher, e o que NUNCA se recolhe
 *
 * Estas telas acumularam parágrafos porque cada número precisa dizer de onde
 * vem — e essa disciplina fica. O problema é que a justificativa passou a
 * competir por atenção com o resultado: numa tela de escolha de prótese, o
 * cirurgião procura um número e uma medida, e encontra primeiro cinco linhas
 * sobre metodologia. Texto demais em volta do dado clínico não é rigor, é
 * ruído — e ruído faz pular a leitura, inclusive a parte que importa.
 *
 * Então a explicação continua inteira, a um clique, e o resumo dela fica
 * visível. Nada foi apagado.
 *
 * **O que não passa por aqui:** alerta regulatório, aviso de que a ferramenta
 * não conhece o anel do paciente, e a marca de que um valor é projeção e não
 * medida. Recolher aviso é o mesmo que escondê-lo — e a tela voltaria a
 * parecer mais segura do que é, que é exatamente o defeito que este projeto
 * inteiro persegue.
 */
export function Explicacao({
  resumo, children, className,
}: {
  /** A frase que fica visível. Deve bastar para o médico decidir se abre. */
  resumo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group rounded-lg border border-border/70 bg-secondary/20 ${className ?? ""}`}>
      <summary className="flex items-start gap-1.5 cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform group-open:rotate-90" />
        <span>{resumo}</span>
      </summary>
      <div className="px-3 pb-3 pt-0 pl-8 text-xs text-foreground/80 leading-relaxed space-y-2">
        {children}
      </div>
    </details>
  );
}
