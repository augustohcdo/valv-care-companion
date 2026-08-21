import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { examTypeLabels } from "@/lib/clinicalLabels";
import { compararComExame } from "@/lib/caseFields";
import type { ComparacaoComExame } from "@/lib/caseFields";
import { logAudit } from "@/lib/auditLog";
import { aplicar } from "@/lib/mutate";

/**
 * O exame tem os números; os achados do caso estão em branco.
 *
 * A propagação que existia disparava **só no instante em que um exame era
 * salvo**. Todo exame que já existia nunca ofereceu nada, e um aviso dispensado
 * sumia para sempre — não havia detecção no caminho de leitura. Foi assim que o
 * caso do print ficou com FE, gradientes, área valvar e regurgitação em `—`
 * tendo um ecocardiograma completo logo abaixo.
 *
 * Este cartão fecha isso: a cada abertura do caso, compara os achados com o
 * exame mais recente e mostra, campo a campo, o que entraria e de onde vem.
 * Nada é gravado sem o clique — o pedido foi "garantir que não vá dado errado",
 * e a garantia é o médico ver antes.
 */

export const lacunaDoExameKey = (caseId: string) => ["case-exam-gap", caseId] as const;

interface Props {
  caseId: string;
  caso: Record<string, unknown>;
  readOnly?: boolean;
  onAplicado?: () => void;
}

export const CaseExamGap = ({ caseId, caso, readOnly = false, onAplicado }: Props) => {
  const queryClient = useQueryClient();
  const [alternados, setAlternados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState<"lacunas" | "divergencias" | null>(null);

  const { data: exame } = useQuery({
    queryKey: lacunaDoExameKey(caseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_exams")
        .select("id, exam_type, exam_date, ejection_fraction, mean_gradient, peak_gradient, valve_area, regurgitation_grade")
        .eq("case_id", caseId)
        .is("deleted_at", null)
        .order("exam_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !readOnly,
  });

  if (!exame) return null;

  const comparacao: ComparacaoComExame = compararComExame(caso, exame);
  const { lacunas, divergencias, recusados } = comparacao;
  if (!lacunas.length && !divergencias.length && !recusados.length) return null;

  const origem =
    `${examTypeLabels[exame.exam_type] ?? "Exame"} de ` +
    new Date(exame.exam_date + "T00:00:00").toLocaleDateString("pt-BR");

  /**
   * Item suspeito nasce **desmarcado**: passa no `CHECK` do banco e quase
   * certamente é erro de digitação, então não pode entrar junto com o resto por
   * inércia. O estado guarda só quem o médico inverteu, e não uma cópia da
   * lista — assim um exame recarregado não ressuscita a escolha anterior.
   */
  const ligadoPorPadrao = (suspeita: string | null) => !suspeita;
  const ativo = (key: string, suspeita: string | null) =>
    alternados.has(key) ? !ligadoPorPadrao(suspeita) : ligadoPorPadrao(suspeita);

  const selecionados = lacunas.filter((l) => ativo(l.key, l.suspeita));

  const alternar = (key: string) =>
    setAlternados((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(key)) proximo.delete(key);
      else proximo.add(key);
      return proximo;
    });

  const gravar = async (
    campos: Record<string, number | string>,
    qual: "lacunas" | "divergencias",
    acao: string,
    metadata: Record<string, unknown>,
  ) => {
    setSalvando(qual);
    const ok = await aplicar(
      supabase.from("clinical_cases").update(campos as never).eq("id", caseId).select("id"),
      {
        sucesso: qual === "lacunas"
          ? `${Object.keys(campos).length} medida(s) preenchidas a partir do exame`
          : "Achados atualizados com o exame mais recente",
        falha: "Não foi possível gravar os achados",
      },
    );
    setSalvando(null);
    if (!ok) return;
    logAudit(acao, "clinical_cases", caseId, {
      campos, origem: "exame", exame_id: exame.id, ...metadata,
    });
    queryClient.invalidateQueries({ queryKey: ["case-detail"] });
    onAplicado?.();
  };

  const preencherLacunas = () =>
    gravar(
      Object.fromEntries(selecionados.map((l) => [l.key, l.valor])),
      "lacunas",
      "case_findings_filled_from_exam",
      {},
    );

  const atualizarDivergencias = () =>
    gravar(
      Object.fromEntries(divergencias.map((d) => [d.key, d.noExame])),
      "divergencias",
      "case_findings_updated",
      { anteriores: Object.fromEntries(divergencias.map((d) => [d.key, d.noCaso])) },
    );

  return (
    <Card className="border-primary/40 bg-primary/5 shadow-sm-soft">
      <CardContent className="p-4 space-y-4">
        {lacunas.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <FlaskConical className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {lacunas.length} medida(s) do exame não estão nos achados do caso
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Origem: {origem}. Confira o que entra antes de gravar no prontuário.
                </p>
              </div>
            </div>

            <ul className="space-y-1.5">
              {lacunas.map((l) => {
                return (
                  <li key={l.key} className="flex items-start gap-2 text-xs">
                    <Checkbox
                      id={`lacuna-${l.key}`}
                      checked={ativo(l.key, l.suspeita)}
                      onCheckedChange={() => alternar(l.key)}
                      className="mt-0.5"
                    />
                    <label htmlFor={`lacuna-${l.key}`} className="cursor-pointer min-w-0">
                      <span className="text-muted-foreground">{l.label}</span>{" "}
                      <ArrowRight className="h-3 w-3 inline text-muted-foreground" />{" "}
                      <span className="font-medium text-foreground">
                        {l.valor}{l.unidade && ` ${l.unidade}`}
                      </span>
                      {l.suspeita && (
                        <span className="block text-warning mt-0.5">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          valor suspeito — {l.suspeita}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>

            <Button
              size="sm"
              disabled={!selecionados.length || salvando !== null}
              onClick={preencherLacunas}
            >
              {salvando === "lacunas" && <Loader2 className="h-4 w-4 animate-spin" />}
              Preencher {selecionados.length} campo(s)
            </Button>
          </div>
        )}

        {divergencias.length > 0 && (
          <div className="space-y-2 border-t border-primary/20 pt-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {divergencias.length} medida(s) diferem do exame mais recente
            </p>
            <ul className="space-y-1 text-xs">
              {divergencias.map((d) => (
                <li key={d.key}>
                  <span className="text-muted-foreground">{d.label}:</span>{" "}
                  achados <span className="font-medium">{d.noCaso}{d.unidade && ` ${d.unidade}`}</span>{" "}
                  · {origem.toLowerCase()}{" "}
                  <span className="font-medium text-warning">{d.noExame}{d.unidade && ` ${d.unidade}`}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              O valor dos achados pode ter sido posto de propósito, então nada é trocado sozinho.
            </p>
            <Button
              size="sm" variant="outline"
              disabled={salvando !== null}
              onClick={atualizarDivergencias}
            >
              {salvando === "divergencias" && <Loader2 className="h-4 w-4 animate-spin" />}
              Atualizar com o valor do exame
            </Button>
          </div>
        )}

        {recusados.length > 0 && (
          <div className="border-t border-primary/20 pt-3 text-xs text-destructive space-y-1">
            <p className="font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {recusados.length} medida(s) do exame fora da faixa aceita — não oferecidas
            </p>
            {recusados.map((r) => (
              <p key={r.label} className="text-muted-foreground">
                {r.label}: {r.valor} — {r.motivo}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
