import { useMemo } from "react";
import { ExternalLink, Archive } from "lucide-react";
import { Explicacao } from "./Explicacao";
import { useReferenciaHistorica, type ProteseForaDeLinha } from "@/hooks/useReferenciaHistorica";

/**
 * As próteses fora de linha — e por que elas NÃO são um cartão de catálogo.
 *
 * Tudo aqui é deliberadamente diferente do catálogo: sem foto, sem faixa de
 * anel, sem "a partir de X mm", sem entrar em contagem nenhuma. É uma tabela de
 * consulta, e a diferença visual é o que impede que alguém a leia como oferta.
 *
 * O que ela responde é uma pergunta que o catálogo não responde: *este paciente
 * tem uma prótese implantada que não se vende mais — qual era a EOA de
 * referência dela?* Sem isso, o cirurgião que lê um eco de seguimento não
 * consegue separar mismatch prótese-paciente de obstrução, e o planejamento de
 * valve-in-valve fica sem número.
 */

const duas = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const umA = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

interface Grupo {
  chave: string;
  fabricante: string;
  modelo: string;
  posicao: string;
  saiuEm: string;
  nota: string | null;
  fonte: string | null;
  linhas: ProteseForaDeLinha[];
}

function agrupar(linhas: ProteseForaDeLinha[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const l of linhas) {
    const chave = `${l.manufacturer}|${l.model_name}|${l.valve_position}`;
    let g = mapa.get(chave);
    if (!g) {
      g = {
        chave, fabricante: l.manufacturer, modelo: l.model_name, posicao: l.valve_position,
        saiuEm: l.discontinued_at, nota: l.discontinued_note, fonte: l.discontinued_source_url,
        linhas: [],
      };
      mapa.set(chave, g);
    }
    g.linhas.push(l);
  }
  for (const g of mapa.values()) g.linhas.sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
  return [...mapa.values()].sort(
    (a, b) => a.fabricante.localeCompare(b.fabricante, "pt-BR") ||
              a.modelo.localeCompare(b.modelo, "pt-BR") ||
              a.posicao.localeCompare(b.posicao, "pt-BR"),
  );
}

const POSICAO: Record<string, string> = { aortica: "aórtica", mitral: "mitral", tricuspide: "tricúspide" };

export function ReferenciaHistorica() {
  const { data = [], isLoading, error } = useReferenciaHistorica();
  const grupos = useMemo(() => agrupar(data), [data]);

  // Nem "carregando" nem "falhou" podem virar silêncio: silêncio aqui seria lido
  // como "não há prótese fora de linha registrada", que é conclusão, não estado.
  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando a referência histórica…</p>;
  }
  if (error) {
    return (
      <p className="text-xs text-muted-foreground">
        Não foi possível carregar a referência histórica. Isto não quer dizer que não haja
        prótese fora de linha registrada — quer dizer que a lista não chegou.
      </p>
    );
  }
  if (grupos.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex items-start gap-3">
        <span className="h-8 w-8 rounded-lg bg-muted grid place-items-center shrink-0 text-muted-foreground">
          <Archive className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-sm text-foreground">
            Referência histórica — fora de linha
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            <strong className="text-foreground">Não estão à venda e não são oferecidas por esta
            ferramenta.</strong>{" "}
            Os valores ficam porque continuam necessários em duas situações cirúrgicas: para ler o
            ecocardiograma de seguimento de quem já tem uma implantada — separando mismatch de
            obstrução — e para planejar valve-in-valve. É também contra elas que as próteses atuais
            são comparadas nos estudos.
          </p>

          <div className="mt-3 space-y-3">
            {grupos.map((g) => (
              <div key={g.chave} className="rounded-lg border border-border/70 bg-card p-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {g.fabricante} {g.modelo}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {POSICAO[g.posicao] ?? g.posicao} · fora de linha desde {g.saiuEm}
                  </span>
                </div>

                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="text-muted-foreground text-left">
                        <th className="font-medium pr-4 pb-1">Tamanho</th>
                        <th className="font-medium pr-4 pb-1">EOA de referência</th>
                        <th className="font-medium pb-1">Gradiente médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.linhas.map((l) => (
                        <tr key={`${l.size}`} className="border-t border-border/50">
                          <td className="pr-4 py-1 text-foreground">{umA(l.size ?? 0)} mm</td>
                          <td className="pr-4 py-1 text-foreground">
                            {l.effective_orifice_area != null
                              ? `${duas(l.effective_orifice_area)}${l.eoa_reference_sd ? ` ± ${duas(l.eoa_reference_sd)}` : ""} cm²`
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-1 text-foreground">
                            {l.mean_gradient_ref != null
                              ? `${duas(l.mean_gradient_ref)}${l.mean_gradient_ref_sd ? ` ± ${duas(l.mean_gradient_ref_sd)}` : ""} mmHg`
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {g.nota && (
                  <Explicacao resumo="Por que saiu de linha, e com que fonte" className="mt-2">
                    <p>{g.nota}</p>
                    {g.fonte && (
                      <a href={g.fonte} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-primary hover:underline">
                        página do fabricante <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </Explicacao>
                )}

                {g.linhas[0]?.eoa_source_url && (
                  <a href={g.linhas[0].eoa_source_url} target="_blank" rel="noopener noreferrer"
                     className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                    {g.linhas[0].eoa_source_label ?? "fonte"} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
