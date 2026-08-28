import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, Ruler } from "lucide-react";
import { EsquemaProtese } from "./EsquemaProtese";
import {
  recomendarProteses, menoresPorModelo,
  type OpcaoProtese, type RecomendacaoDoFabricante,
} from "@/lib/recomendacaoProtese";
import type { PosicaoValvar } from "@/lib/mismatch";
import type { ProteseDoCatalogo } from "@/hooks/useCatalogoProteses";
import { buscaDaFamilia, BUSCA_FEITA_EM } from "@/data/buscaDeFontes";

/**
 * "Qual prótese serve neste paciente, em cada fabricante."
 *
 * Agrupa por fabricante porque é assim que a decisão acontece na sala: o
 * serviço tem contrato ou consignação de uma ou duas marcas. Uma lista única
 * ordenada por EOA seria ranking entre fabricantes — e ainda inútil para quem
 * só tem duas na prateleira.
 *
 * O aviso do anel fica **acima** da lista, não no rodapé: quem decide o que
 * cabe é a medida do anel do paciente, que esta ferramenta não conhece.
 */

const duas = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tam = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

interface Props {
  catalogo: ProteseDoCatalogo[];
  bsa: number | null;
  imc: number | null;
  posicao: PosicaoValvar;
}

export function RecomendadorProtese({ catalogo, bsa, imc, posicao }: Props) {
  const r = useMemo(
    () => (bsa ? recomendarProteses(catalogo, bsa, posicao, imc) : null),
    [catalogo, bsa, posicao, imc],
  );

  if (!bsa) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Informe <strong>altura e peso</strong> para ver quais próteses evitam mismatch neste paciente.
        </p>
      </div>
    );
  }
  if (!r) return null;

  const comOpcao = r.fabricantes.filter((f) => f.adequadas.length > 0);
  const semOpcao = r.fabricantes.filter((f) => f.adequadas.length === 0 && f.insuficientes.length > 0);
  const semDado = r.fabricantes
    .filter((f) => f.semEoaPublicada > 0)
    .map((f) => ({
      ...f,
      familiasPesquisadas: [
        ...new Map(
          catalogo
            .filter((p) => p.manufacturer === f.fabricante && p.effective_orifice_area == null)
            .map((p) => buscaDaFamilia(p.manufacturer, p.model_name))
            .filter((b): b is NonNullable<typeof b> => !!b)
            .map((b) => [b.familia, b]),
        ).values(),
      ],
    }))
    .filter((f) => f.familiasPesquisadas.length > 0);

  return (
    <div className="space-y-5">
      {/* O limite da ferramenta, antes do resultado e não depois dele. */}
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
        <Ruler className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/85 leading-relaxed space-y-1">
          <p>
            <strong>Quem decide o que cabe é o anel do paciente</strong>, e esta lista não o conhece.
            Ela responde outra pergunta: <em>a partir de que tamanho cada modelo deixa de produzir
            mismatch nesta superfície corporal</em>. A faixa de anel de cada opção está ao lado —
            confronte com a medida do anel antes de escolher.
          </p>
          <p className="text-muted-foreground">
            A projeção por tabela de referência superestima o mismatch em relação à EOA medida no
            ecocardiograma. Serve para escolher prótese, não para carimbar diagnóstico.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Limiar aplicado: EOA indexada acima de{" "}
          <strong className="text-foreground tabular-nums">{duas(r.limiares.moderado)} cm²/m²</strong>
          {r.faixaDeObesidade && " (faixa de IMC ≥ 30)"}
        </span>
        <span>·</span>
        <span><strong className="text-foreground tabular-nums">{r.avaliadas}</strong> tamanhos avaliados</span>
        {r.semEoaPublicada > 0 && (
          <>
            <span>·</span>
            <span>
              <strong className="text-foreground tabular-nums">{r.semEoaPublicada}</strong> ficaram de
              fora por não terem EOA de referência publicada
            </span>
          </>
        )}
      </div>

      {comOpcao.length === 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/85 leading-relaxed">
            <strong>Nenhum tamanho com EOA publicada evita mismatch nesta superfície corporal.</strong>{" "}
            Em superfícies grandes isso é esperado e é achado clínico, não falha da ferramenta:
            considere ampliação da raiz, prótese sem stent ou transcateter, e discuta no Heart Team.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {comOpcao.map((f) => <CartaoFabricante key={f.fabricante} f={f} />)}
      </div>

      {semOpcao.length > 0 && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-xs font-medium text-foreground mb-2">
            Sem opção adequada neste paciente
          </p>
          <ul className="space-y-1.5">
            {semOpcao.map((f) => {
              const melhor = f.insuficientes[0];
              return (
                <li key={f.fabricante} className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{f.fabricante}</strong>
                  {melhor && (
                    <> — o mais próximo é {melhor.modelo} {tam(melhor.tamanho)} mm, com EOA indexada{" "}
                    <span className="tabular-nums">{duas(melhor.ieoa)}</span> cm²/m²
                    ({melhor.grau === "grave" ? "mismatch grave" : "mismatch moderado"})</>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* O fabricante que não entrou na conta por falta de dado NÃO é o
          fabricante cujo produto não serve. Somem os dois numa lista só e o
          médico conclui que a marca é ruim quando o que falta é publicação. */}
      {semDado.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-foreground mb-2">
            Fora da conta por falta de EOA publicada
          </p>
          <ul className="space-y-2">
            {semDado.map((f) => (
              <li key={f.fabricante} className="text-xs text-muted-foreground">
                <strong className="text-foreground">{f.fabricante}</strong> —{" "}
                {f.semEoaPublicada} tamanho(s) sem EOA de referência.{" "}
                {f.familiasPesquisadas.map((b, i) => (
                  <span key={b.familia}>
                    {i > 0 && " "}
                    <span className="text-foreground">{b.familia.split("|")[1]}</span>: {b.nota}
                    {b.referencia && (
                      <>
                        {" "}
                        <a href={b.referencia.url} target="_blank" rel="noopener noreferrer"
                           className="text-primary hover:underline">estudo</a>
                      </>
                    )}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">
            Busca de {BUSCA_FEITA_EM}. Ausência de EOA publicada não diz nada sobre a prótese —
            diz que não há medida por tamanho para projetar mismatch.
          </p>
        </div>
      )}
    </div>
  );
}

function CartaoFabricante({ f }: { f: RecomendacaoDoFabricante }) {
  const pisos = menoresPorModelo(f.adequadas);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-secondary/40 flex items-baseline justify-between gap-2">
        <h4 className="font-display font-semibold text-sm text-foreground">{f.fabricante}</h4>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {pisos.length} modelo{pisos.length > 1 ? "s" : ""}
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {pisos.map((o) => <LinhaOpcao key={o.id} o={o} />)}
      </ul>
      {f.semEoaPublicada > 0 && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/60">
          {f.semEoaPublicada} tamanho(s) deste fabricante sem EOA de referência publicada — não
          entraram na conta.
        </p>
      )}
    </div>
  );
}

function LinhaOpcao({ o }: { o: OpcaoProtese }) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div className="w-11 h-11 shrink-0 rounded-lg bg-secondary/50 overflow-hidden grid place-items-center text-primary">
        {o.imagem ? (
          <img src={o.imagem} alt={`${o.fabricante} ${o.modelo}`} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <EsquemaProtese tipo={o.tipo} fabricante={o.fabricante} modelo={o.modelo} className="w-8 h-8" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-sm text-foreground">{o.modelo}</span>
          <Badge variant="outline" className="text-[11px] tabular-nums border-success/40 bg-success/10 text-success">
            a partir de {tam(o.tamanho)} mm
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
          EOA de referência {duas(o.eoa)}{o.eoaDesvio ? ` ± ${duas(o.eoaDesvio)}` : ""} cm²
          {" · "}indexada <strong className="text-foreground">{duas(o.ieoa)}</strong> cm²/m²
          {o.gradiente != null && (
            <> · gradiente esperado {duas(o.gradiente)}
              {o.gradienteDesvio != null ? ` ± ${duas(o.gradienteDesvio)}` : ""} mmHg</>
          )}
          {o.anelMin != null && o.anelMax != null && (
            <> · anel {tam(o.anelMin)}–{tam(o.anelMax)} mm</>
          )}
        </p>
        {o.fonteUrl && (
          <a
            href={o.fonteUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            {o.fonteRotulo ?? "fonte"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </li>
  );
}
