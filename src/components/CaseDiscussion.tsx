import { useEffect, useState, useRef } from "react";
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

interface Props {
  caseId: string;
  canComment: boolean;
}

export const CaseDiscussion = ({ caseId, canComment }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [authors, setAuthors] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [isHeartTeam, setIsHeartTeam] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("case_comments")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });

    const userIds = [...new Set((data || []).map((c) => c.author_id))];
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as any[] };
    const { data: docs } = userIds.length
      ? await supabase.from("doctors").select("user_id, crm, crm_uf, specialty").in("user_id", userIds)
      : { data: [] as any[] };
    const map: Record<string, any> = {};
    userIds.forEach((uid) => {
      const p = profs?.find((x: any) => x.user_id === uid);
      const d = docs?.find((x: any) => x.user_id === uid);
      map[uid] = { full_name: p?.full_name || "Médico", ...d };
    });

    setAuthors(map);
    setItems(data || []);
    setLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`discussion-${caseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_comments", filter: `case_id=eq.${caseId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [caseId]);

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
    await supabase.from("case_comments").delete().eq("id", id);
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
                        <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1">
                          <Stethoscope className="h-3 w-3 text-primary" />
                          Dr(a). {author?.full_name}
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
