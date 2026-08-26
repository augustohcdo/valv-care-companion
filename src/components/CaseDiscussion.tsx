import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send, Loader2, Trash2, Stethoscope, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { logAudit } from "@/lib/auditLog";
import { aplicar } from "@/lib/mutate";

interface Props {
  caseId: string;
  canComment: boolean;
}

export const caseDiscussionKey = (caseId: string) => ["case-discussion", caseId] as const;

export const CaseDiscussion = ({ caseId, canComment }: Props) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [isHeartTeam, setIsHeartTeam] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Comentários e autores são buscados juntos porque os autores dependem dos
  // ids que só existem depois de carregar os comentários.
  const { data, isLoading: loading } = useQuery({
    queryKey: caseDiscussionKey(caseId),
    queryFn: async () => {
      const { data: comments, error } = await supabase
        .from("case_comments")
        .select("*")
        .eq("case_id", caseId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Os nomes vêm por RPC, e não de `profiles` direto: as policies de
      // `profiles` são `auth.uid() = user_id` e `has_role(admin)`, então a
      // consulta antiga voltava **vazia** para todo colega e a tela caía num
      // texto de reserva — toda opinião do caso aparecia assinada por
      // "Dr(a). Médico". Numa discussão clínica isso é registro que não dá
      // para auditar: não se sabe quem recomendou o quê.
      //
      // `participantes_do_caso` é `security definer` e carrega a própria cerca,
      // que espelha a policy de SELECT de `case_comments` (médico do caso).
      const { data: participantes, error: erroNomes } = await supabase
        .rpc("participantes_do_caso", { _case_id: caseId });
      if (erroNomes) throw erroNomes;

      const authors: Record<string, { full_name: string | null; crm?: string | null; crm_uf?: string | null; specialty?: string | null }> = {};
      for (const p of participantes ?? []) {
        authors[p.user_id] = {
          full_name: p.full_name,
          crm: p.crm, crm_uf: p.crm_uf, specialty: p.specialty,
        };
      }

      return { items: comments ?? [], authors };
    },
  });

  const items = data?.items ?? [];
  const authors = data?.authors ?? {};

  const load = () => queryClient.invalidateQueries({ queryKey: caseDiscussionKey(caseId) });

  useEffect(() => {
    const channel = supabase
      .channel(`discussion-${caseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_comments", filter: `case_id=eq.${caseId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Rola para a última mensagem sempre que a lista muda.
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    return () => clearTimeout(t);
  }, [items.length]);

  const send = async () => {
    if (!user || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("case_comments").insert({
      case_id: caseId,
      author_id: user.id,
      body: body.trim(),
      is_heart_team_decision: isHeartTeam,
    });
    setSending(false);
    if (error) {
      toast.error("Erro ao enviar", { description: error.message });
      return;
    }
    setBody("");
    setIsHeartTeam(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este comentário?")) return;
    const ok = await aplicar(
      supabase.from("case_comments").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"),
      { sucesso: "Comentário removido", falha: "Não foi possível remover o comentário" },
    );
    if (!ok) return;
    logAudit("comment_deleted", "case_comments", id, { case_id: caseId });
    load();
  };

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessagesSquare className="h-5 w-5 text-primary" /> Discussão clínica
          {items.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">{items.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <MessagesSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Sem discussão ainda. {canComment && "Inicie uma observação clínica abaixo."}
            </div>
          ) : (
            items.map((c) => {
              const author = authors[c.author_id];
              const isMine = c.author_id === user?.id;
              return (
                <div key={c.id} className={`p-3 rounded-lg border ${
                  c.is_heart_team_decision
                    ? "border-warning/40 bg-warning/5"
                    : isMine
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card"
                }`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Sem nome resolvido, a tela diz isso — não inventa
                            um. "Dr(a). Médico" parecia o nome de alguém. */}
                        <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1">
                          <Stethoscope className="h-3 w-3 text-primary" />
                          {author?.full_name
                            ? `Dr(a). ${author.full_name}`
                            : <span className="italic text-muted-foreground font-normal">autor não identificado</span>}
                        </p>
                        {author?.crm && (
                          <span className="text-[10px] text-muted-foreground">
                            CRM {author.crm}/{author.crm_uf}
                          </span>
                        )}
                        {c.is_heart_team_decision && (
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                            <Award className="h-2.5 w-2.5 mr-1" /> Decisão Heart Team
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap mt-1.5 leading-relaxed">{c.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {isMine && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {canComment && (
          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compartilhe sua observação ou opinião clínica..."
              rows={3}
              className="resize-none"
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="heart-team"
                  checked={isHeartTeam}
                  onCheckedChange={(v) => setIsHeartTeam(!!v)}
                />
                <Label htmlFor="heart-team" className="text-xs cursor-pointer">
                  Marcar como decisão de Heart Team
                </Label>
              </div>
              <Button onClick={send} disabled={sending || !body.trim()} size="sm">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </div>
        )}
        {!canComment && (
          <p className="text-[11px] text-muted-foreground italic text-center pt-2 border-t border-border">
            Você tem acesso somente leitura a este caso.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
