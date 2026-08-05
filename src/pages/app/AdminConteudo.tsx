import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ContentReviewBadge } from "@/components/ContentReviewBadge";
import { BookOpenCheck, Loader2, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

type Trecho = {
  id: string;
  topic: string;
  section: string | null;
  content: string;
  review_status: string;
  knowledge_sources: {
    title: string;
    organization: string;
    year: number;
    url: string | null;
  } | null;
};

type Selo = {
  content_key: string;
  reviewer_name: string | null;
  reviewer_crm: string | null;
  reviewer_crm_uf: string | null;
  reviewed_at: string | null;
  notes: string | null;
};

type Permissao = { pode: boolean; motivo: string | null; revisor: string | null; crm: string | null };

export const trechosKey = () => ["admin-trechos"] as const;
export const permissaoRevisaoKey = () => ["posso-revisar"] as const;

export default function AdminConteudo() {
  const queryClient = useQueryClient();
  const [confirmado, setConfirmado] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [emAcao, setEmAcao] = useState<string | null>(null);

  const { data: permissao } = useQuery({
    queryKey: permissaoRevisaoKey(),
    queryFn: async (): Promise<Permissao | null> => {
      const { data, error } = await supabase.rpc("posso_revisar_conteudo");
      if (error) throw error;
      return ((data as Permissao[]) ?? [])[0] ?? null;
    },
  });

  const { data: trechos = [], isLoading } = useQuery({
    queryKey: trechosKey(),
    queryFn: async (): Promise<Trecho[]> => {
      // A coluna `embedding` fica de fora de propósito: é um vetor grande e
      // completamente inútil nesta tela.
      const { data, error } = await supabase
        .from("knowledge_chunks")
        .select("id, topic, section, content, review_status, knowledge_sources(title, organization, year, url)")
        .order("topic");
      if (error) throw error;
      return (data as unknown as Trecho[]) ?? [];
    },
  });

  const { data: selos = [] } = useQuery({
    queryKey: ["selos-revisao"],
    queryFn: async (): Promise<Selo[]> => {
      const { data, error } = await supabase
        .from("content_review_status")
        .select("content_key, reviewer_name, reviewer_crm, reviewer_crm_uf, reviewed_at, notes")
        .eq("content_type", "clinical_guideline");
      if (error) throw error;
      return (data as Selo[]) ?? [];
    },
  });

  const seloDe = (id: string) => selos.find((s) => s.content_key === id);

  const revisar = async (trecho: Trecho, aprovar: boolean) => {
    setEmAcao(trecho.id);
    const { error } = await supabase.rpc("revisar_trecho", {
      _chunk_id: trecho.id,
      _aprovar: aprovar,
      _notas: notas[trecho.id] ?? null,
    });
    setEmAcao(null);
    if (error) {
      toast.error(aprovar ? "Não foi possível aprovar" : "Não foi possível revogar", {
        description: error.message,
      });
      return;
    }
    toast.success(aprovar ? "Trecho marcado como revisado" : "Revisão revogada");
    setConfirmado((c) => ({ ...c, [trecho.id]: false }));
    queryClient.invalidateQueries({ queryKey: trechosKey() });
    queryClient.invalidateQueries({ queryKey: ["selos-revisao"] });
  };

  const pendentes = trechos.filter((t) => t.review_status !== "reviewed").length;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpenCheck className="h-7 w-7 text-primary" /> Revisão do conteúdo clínico
        </h1>
        <p className="text-muted-foreground">
          Os trechos que alimentam as respostas da IA clínica. {pendentes} de {trechos.length}{" "}
          aguardam revisão médica.
        </p>
      </header>

      {/* Quem pode aprovar, e por que — antes de qualquer botão. */}
      {permissao && !permissao.pode ? (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-foreground">Você pode ler, mas não aprovar.</p>
            <p className="text-muted-foreground">
              {permissao.motivo ??
                "Aprovar conteúdo clínico exige registro de médico com CRM verificado."}
            </p>
            <p className="text-muted-foreground">
              Marcar um texto como revisado por médico anexa um nome e um CRM reais à
              afirmação. O nome nunca é digitado aqui: ele vem do cadastro de quem aprova.
            </p>
          </div>
        </div>
      ) : permissao?.pode ? (
        <div className="p-4 rounded-lg bg-secondary/60 border border-border text-sm">
          Aprovando como <strong>{permissao.revisor}</strong> — CRM {permissao.crm}. Seu nome e
          CRM ficam registrados em cada trecho que você aprovar.
        </div>
      ) : null}

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <ul className="space-y-4">
          {trechos.map((t) => {
            const revisado = t.review_status === "reviewed";
            const selo = seloDe(t.id);
            const fonte = t.knowledge_sources;
            return (
              <li key={t.id}>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{t.topic}</p>
                        {t.section && (
                          <p className="text-xs text-muted-foreground">{t.section}</p>
                        )}
                      </div>
                      {fonte && (
                        <Badge variant="outline" className="text-[10px]">
                          {fonte.organization} {fonte.year}
                        </Badge>
                      )}
                    </div>

                    {/* Sem `compact`: é o modo compacto que esconde o detalhe,
                        e o detalhe — quem revisou e quando — é justamente o que
                        esta tela existe para tornar visível. */}
                    <ContentReviewBadge
                      status={revisado ? "reviewed" : "ai_generated"}
                      reviewer={
                        selo?.reviewer_name
                          ? `${selo.reviewer_name} — CRM ${selo.reviewer_crm}/${selo.reviewer_crm_uf}`
                          : null
                      }
                      reviewedAt={selo?.reviewed_at}
                    />

                    {/* O texto inteiro, sempre. Revisar sem ler o texto seria o
                        mesmo defeito que esta tela existe para corrigir. */}
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed border-l-2 border-border pl-3">
                      {t.content}
                    </p>

                    {selo?.notes && (
                      <p className="text-xs text-muted-foreground italic">Nota: {selo.notes}</p>
                    )}

                    {permissao?.pode && (
                      <div className="space-y-2 pt-1">
                        {revisado ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={emAcao === t.id}
                            onClick={() => revisar(t, false)}
                          >
                            {emAcao === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            ) : (
                              <Undo2 className="h-4 w-4 mr-1.5" />
                            )}
                            Revogar revisão
                          </Button>
                        ) : (
                          <>
                            <Textarea
                              placeholder="Notas da revisão (opcional)"
                              rows={2}
                              value={notas[t.id] ?? ""}
                              onChange={(e) =>
                                setNotas((n) => ({ ...n, [t.id]: e.target.value }))
                              }
                            />
                            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={!!confirmado[t.id]}
                                onCheckedChange={(v) =>
                                  setConfirmado((c) => ({ ...c, [t.id]: v === true }))
                                }
                              />
                              <span>
                                Li o texto acima e confirmo que confere com a diretriz citada.
                              </span>
                            </label>
                            <Button
                              size="sm"
                              disabled={!confirmado[t.id] || emAcao === t.id}
                              onClick={() => revisar(t, true)}
                            >
                              {emAcao === t.id && (
                                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                              )}
                              Marcar como revisado
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
