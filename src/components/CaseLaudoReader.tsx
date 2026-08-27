import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Loader2, ScanText } from "lucide-react";
import { traduzirFalhaIA } from "@/lib/aiErros";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compararComExame, type ComparacaoComExame } from "@/lib/caseFields";
import { logAudit } from "@/lib/auditLog";
import { aplicar } from "@/lib/mutate";
import { hasActiveConsent, AVISO_CONSENTIMENTO_IA } from "@/lib/consent";
import { LaudoIdentificacao } from "@/components/LaudoIdentificacao";
import type { IdentificacaoDoLaudo } from "@/lib/laudoIdentificacao";
import { MODO_EXTRACAO } from "@/lib/aiModes";

/**
 * O laudo já está anexado ao caso — e ninguém o lia.
 *
 * A leitura do laudo existia só no cadastro, onde o arquivo ainda está no
 * computador do médico. Num caso já criado o documento sobe para o prontuário,
 * fica listado em "Documentos anexados", e o que está impresso nele — nome,
 * data de nascimento, sexo, FE, gradientes — continuava tendo que ser
 * redigitado. Era exatamente o caso do print que originou esta frente:
 * ecocardiograma anexado, "Informações do paciente" em branco.
 *
 * Aqui o arquivo **não passa pelo navegador**: a função busca o documento no
 * bucket depois de a RLS confirmar que quem pediu enxerga aquele registro.
 * Nada é gravado sem o médico marcar o que entra — nome de paciente lido de
 * um laudo que também traz o nome de dois médicos é o campo em que errar
 * contamina o prontuário inteiro.
 */

interface Documento {
  id: string;
  file_name: string;
  mime_type?: string | null;
  document_type?: string | null;
}

/** Formatos que a leitura consegue transcrever. DICOM e Word ficam de fora. */
export const TIPOS_LEGIVEIS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function podeLerLaudo(doc: Documento): boolean {
  const tipo = (doc.mime_type ?? "").trim().toLowerCase();
  if (TIPOS_LEGIVEIS.includes(tipo)) return true;
  // `mime_type` guarda o que o navegador declarou no upload, que às vezes vem
  // vazio. A extensão do nome resolve sem chutar.
  return /\.(jpe?g|png|webp|pdf)$/i.test(doc.file_name ?? "");
}

export function CaseLaudoReader({
  caseId,
  caso,
  documento,
  nomeDoMedico,
  onAplicado,
}: {
  caseId: string;
  caso: Record<string, unknown>;
  documento: Documento;
  nomeDoMedico?: string | null;
  onAplicado?: () => void;
}) {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState<"lacunas" | "divergencias" | null>(null);
  const [identificacao, setIdentificacao] = useState<IdentificacaoDoLaudo | null>(null);
  const [comparacao, setComparacao] = useState<ComparacaoComExame | null>(null);
  const [alternados, setAlternados] = useState<Set<string>>(new Set());
  const [semLaudo, setSemLaudo] = useState(false);

  const ler = async () => {
    // O documento inteiro vai ao provedor de IA — com o que estiver impresso
    // nele. O servidor recusa sem consentimento; esta checagem existe para a
    // recusa chegar como explicação, e não como erro cru.
    if (!(await hasActiveConsent("ai_processing"))) {
      toast.error(AVISO_CONSENTIMENTO_IA.titulo, { description: AVISO_CONSENTIMENTO_IA.descricao });
      return;
    }
    setAberto(true);
    setLendo(true);
    setSemLaudo(false);
    setIdentificacao(null);
    setComparacao(null);
    setAlternados(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("clinical-ai", {
        body: { mode: MODO_EXTRACAO, documentId: documento.id },
      });
      if (error) {
        // Mesma tradução das outras telas: aqui também o limite de uso por hora
        // aparecia como "falha na leitura do laudo", sem dizer que é passageiro.
        const falha = traduzirFalhaIA(
          (error as { context?: { status?: number } })?.context?.status,
          "Falha na leitura do laudo",
          (error as Error)?.message,
        );
        toast.error(falha.titulo, { description: falha.descricao });
        setAberto(false);
        return;
      }
      if (data?.error) { toast.error(data.error); setAberto(false); return; }
      if (data?.is_laudo === false) { setSemLaudo(true); return; }

      setIdentificacao({
        patient_name: typeof data.patient_name === "string" ? data.patient_name : null,
        patient_age: typeof data.patient_age === "number" ? data.patient_age : null,
        patient_sex: typeof data.patient_sex === "string" ? data.patient_sex : null,
        patient_birth_date: typeof data.patient_birth_date === "string" ? data.patient_birth_date : null,
        exam_date: typeof data.exam_date === "string" ? data.exam_date : null,
      });
      // O laudo vira "exame" só para reaproveitar a comparação que já existe —
      // mesmas faixas do `CHECK`, mesmas regras de plausibilidade, mesma
      // separação entre lacuna e divergência. Duas comparações diferentes para
      // a mesma pergunta divergiriam com o tempo.
      setComparacao(compararComExame(caso, {
        ejection_fraction: typeof data.lvef === "number" ? data.lvef : null,
        mean_gradient: typeof data.mean_gradient === "number" ? data.mean_gradient : null,
        valve_area: typeof data.aortic_valve_area === "number" ? data.aortic_valve_area : null,
      }));
    } catch (e) {
      toast.error("Erro de comunicação", { description: (e as Error)?.message });
      setAberto(false);
    } finally {
      setLendo(false);
    }
  };

  const ligadoPorPadrao = (suspeita: string | null) => !suspeita;
  const ativo = (key: string, suspeita: string | null) =>
    alternados.has(key) ? !ligadoPorPadrao(suspeita) : ligadoPorPadrao(suspeita);
  const alternar = (key: string) =>
    setAlternados((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(key)) proximo.delete(key); else proximo.add(key);
      return proximo;
    });

  const lacunas = comparacao?.lacunas ?? [];
  const divergencias = comparacao?.divergencias ?? [];
  const recusados = comparacao?.recusados ?? [];
  const selecionadas = lacunas.filter((l) => ativo(l.key, l.suspeita));

  const gravar = async (
    campos: Record<string, unknown>,
    qual: "lacunas" | "divergencias",
    acao: string,
    metadata: Record<string, unknown>,
    sucesso: string,
  ) => {
    setSalvando(qual);
    const ok = await aplicar(
      supabase.from("clinical_cases").update(campos as never).eq("id", caseId).select("id"),
      { sucesso, falha: "Não foi possível gravar os dados do laudo" },
    );
    setSalvando(null);
    if (!ok) return;
    logAudit(acao, "clinical_cases", caseId, {
      campos, origem: "laudo", documento_id: documento.id, arquivo: documento.file_name, ...metadata,
    });
    queryClient.invalidateQueries({ queryKey: ["case-detail"] });
    onAplicado?.();
  };

  return (
    <>
      <Button
        variant="ghost" size="icon" onClick={ler} disabled={lendo}
        title="Ler o laudo e preencher o caso"
      >
        {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ler laudo anexado</DialogTitle>
            <DialogDescription className="truncate">{documento.file_name}</DialogDescription>
          </DialogHeader>

          {lendo && (
            <p className="text-sm text-muted-foreground flex items-center gap-2 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcrevendo o que está escrito no documento...
            </p>
          )}

          {!lendo && semLaudo && (
            <div className="text-sm text-muted-foreground space-y-2 py-2">
              <p className="flex items-start gap-2 text-warning">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Este arquivo não tem laudo escrito para transcrever.
              </p>
              <p className="text-[12px] leading-relaxed">
                A leitura transcreve o texto do laudo — ela não mede nem interpreta a imagem do
                ultrassom. Um número estimado de um traçado seria invenção com cara de medida.
              </p>
            </div>
          )}

          {!lendo && !semLaudo && (
            <div className="space-y-4">
              {identificacao && (
                <LaudoIdentificacao
                  identificacao={identificacao}
                  nomeDoMedico={nomeDoMedico}
                  atual={{
                    patient_name: String(caso["patient_name"] ?? ""),
                    patient_age: caso["patient_age"] == null ? "" : String(caso["patient_age"]),
                    patient_sex: String(caso["patient_sex"] ?? ""),
                  }}
                  onAplicar={(valores) => {
                    const campos: Record<string, unknown> = { ...valores };
                    // A idade vai como número: a coluna é inteira, e o
                    // formulário do cadastro trabalha com texto.
                    if (typeof campos["patient_age"] === "string") {
                      campos["patient_age"] = Number(campos["patient_age"]);
                    }
                    void gravar(
                      campos, "lacunas", "case_identity_filled_from_laudo", {},
                      "Identificação do paciente gravada a partir do laudo",
                    ).then(() => setIdentificacao(null));
                  }}
                  onDispensar={() => setIdentificacao(null)}
                />
              )}

              {lacunas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">
                    {lacunas.length} medida(s) do laudo que os achados não têm
                  </p>
                  <ul className="space-y-1.5">
                    {lacunas.map((l) => (
                      <li key={l.key} className="flex items-start gap-2 text-xs">
                        <Checkbox
                          id={`laudo-${l.key}`}
                          checked={ativo(l.key, l.suspeita)}
                          onCheckedChange={() => alternar(l.key)}
                          className="mt-0.5"
                        />
                        <label htmlFor={`laudo-${l.key}`} className="cursor-pointer min-w-0">
                          <span className="text-muted-foreground">{l.label}</span>{" "}
                          <ArrowRight className="h-3 w-3 inline text-muted-foreground" />{" "}
                          <span className="font-medium">{l.valor}{l.unidade && ` ${l.unidade}`}</span>
                          {l.suspeita && (
                            <span className="block text-warning mt-0.5">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              valor suspeito — {l.suspeita}
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm" disabled={!selecionadas.length || salvando !== null}
                    onClick={() => void gravar(
                      Object.fromEntries(selecionadas.map((l) => [l.key, l.valor])),
                      "lacunas", "case_findings_filled_from_laudo", {},
                      `${selecionadas.length} medida(s) preenchidas a partir do laudo`,
                    )}
                  >
                    {salvando === "lacunas" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Preencher {selecionadas.length} medida(s)
                  </Button>
                </div>
              )}

              {divergencias.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    {divergencias.length} medida(s) diferem do laudo
                  </p>
                  <ul className="space-y-1 text-xs">
                    {divergencias.map((d) => (
                      <li key={d.key}>
                        <span className="text-muted-foreground">{d.label}:</span>{" "}
                        achados <span className="font-medium">{d.noCaso}{d.unidade && ` ${d.unidade}`}</span>{" "}
                        · laudo <span className="font-medium text-warning">{d.noExame}{d.unidade && ` ${d.unidade}`}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    O valor dos achados pode ter sido posto de propósito, então nada é trocado sozinho.
                  </p>
                  <Button
                    size="sm" variant="outline" disabled={salvando !== null}
                    onClick={() => void gravar(
                      Object.fromEntries(divergencias.map((d) => [d.key, d.noExame])),
                      "divergencias", "case_findings_updated",
                      { anteriores: Object.fromEntries(divergencias.map((d) => [d.key, d.noCaso])) },
                      "Achados atualizados com o laudo",
                    )}
                  >
                    {salvando === "divergencias" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Atualizar com o valor do laudo
                  </Button>
                </div>
              )}

              {recusados.length > 0 && (
                <div className="border-t border-border pt-3 text-xs text-destructive space-y-1">
                  <p className="font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {recusados.length} medida(s) fora da faixa aceita — não oferecidas
                  </p>
                  {recusados.map((r) => (
                    <p key={r.label} className="text-muted-foreground">
                      {r.label}: {r.valor} — {r.motivo}
                    </p>
                  ))}
                </div>
              )}

              {!identificacao && !lacunas.length && !divergencias.length && !recusados.length && (
                <p className="text-sm text-muted-foreground py-2">
                  O laudo não trouxe nada que os achados já não tenham.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
