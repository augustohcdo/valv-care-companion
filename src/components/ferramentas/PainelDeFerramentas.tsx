import { useNavigate, useLocation } from "react-router-dom";
import { Activity, GitCompareArrows, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CalculadoraEuroscore, type PreenchimentoInicial } from "./CalculadoraEuroscore";
import { CalculadoraMismatch, type PreenchimentoMismatch } from "./CalculadoraMismatch";
import { CatalogoProteses } from "./CatalogoProteses";

/**
 * As três ferramentas, montadas do mesmo jeito na página pública e dentro da
 * conta. `base` é a única diferença entre os dois lugares.
 *
 * O seletor não é uma barra de abas com rótulo curto: cada ferramenta anuncia
 * **a pergunta que responde**. Quem chega aqui pela primeira vez não sabe o que
 * é "mismatch" nem por que haveria um catálogo — e um rótulo de duas palavras
 * não conta isso. A aba fica no caminho, e não só no estado do componente, para
 * o médico poder mandar `/ferramentas/mismatch` para um colega.
 */

export const ABAS: { chave: string; rotulo: string; pergunta: string; icone: LucideIcon }[] = [
  {
    chave: "euroscore-ii",
    rotulo: "EuroSCORE II",
    pergunta: "Qual a mortalidade operatória prevista deste paciente?",
    icone: Activity,
  },
  {
    chave: "mismatch",
    rotulo: "Gradiente e mismatch",
    pergunta: "Que prótese cabe sem sobrar gradiente — e este gradiente alto é mismatch ou obstrução?",
    icone: GitCompareArrows,
  },
  {
    chave: "proteses",
    rotulo: "Catálogo de próteses",
    pergunta: "Que tamanhos, áreas e faixas de anel existem, e de onde vem cada número?",
    icone: Layers,
  },
];

export type AbaDeFerramenta = (typeof ABAS)[number]["chave"];

export const PADRAO: AbaDeFerramenta = "euroscore-ii";

export function abaDoCaminho(pathname: string, base: string): AbaDeFerramenta {
  const resto = pathname.slice(base.length).replace(/^\//, "");
  return ABAS.some((a) => a.chave === resto) ? resto : PADRAO;
}

interface Props {
  base: string;
  euroscore?: PreenchimentoInicial;
  mismatch?: PreenchimentoMismatch;
}

export function PainelDeFerramentas({ base, euroscore, mismatch }: Props) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const aba = abaDoCaminho(pathname, base);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Ferramentas clínicas"
        className="grid gap-3 sm:grid-cols-3 mb-8"
      >
        {ABAS.map((a) => {
          const ativa = a.chave === aba;
          return (
            <button
              key={a.chave}
              role="tab"
              aria-selected={ativa}
              onClick={() => navigate(`${base}/${a.chave}${search}`, { replace: true })}
              className={`group text-left rounded-xl border p-4 transition-colors min-h-[44px] ${
                ativa
                  ? "border-primary bg-primary/5 shadow-sm-soft"
                  : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${
                    ativa ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                  }`}
                >
                  <a.icone className="h-4 w-4" />
                </span>
                <span className={`font-display font-semibold text-sm ${ativa ? "text-primary" : "text-foreground"}`}>
                  {a.rotulo}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug mt-2">{a.pergunta}</p>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {aba === "euroscore-ii" && <CalculadoraEuroscore inicial={euroscore} />}
        {aba === "mismatch" && <CalculadoraMismatch inicial={mismatch} />}
        {aba === "proteses" && <CatalogoProteses />}
      </div>
    </div>
  );
}
