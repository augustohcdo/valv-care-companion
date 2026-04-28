import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  case_id: string;
  sender_id: string;
  sender_role: "medico" | "paciente";
  body: string;
  read_at: string | null;
  created_at: string;
}

interface Props {
  caseId: string;
  /** Papel de quem está visualizando (medico ou paciente) */
  viewerRole: "medico" | "paciente";
}

function formatStamp(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Ontem ${format(d, "HH:mm")}`;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

export function CaseChat({ caseId, viewerRole }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carrega mensagens iniciais
  useEffect(() => {
    if (!caseId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("case_messages")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (!error) setMessages((data as Message[]) ?? []);
      setLoading(false);
    })();
  }, [caseId]);

  // Realtime
  useEffect(() => {
    if (!caseId) return;
    const ch = supabase
      .channel(`case-chat-${caseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_messages", filter: `case_id=eq.${caseId}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((p) => p.id === m.id)) return prev;
            return [...prev, m];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "case_messages", filter: `case_id=eq.${caseId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((p) => (p.id === m.id ? m : p)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [caseId]);

  // Auto-scroll para o final
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Marca como lidas as mensagens recebidas
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const unreadIds = messages
      .filter((m) => m.sender_id !== user.id && !m.read_at)
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from("case_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => undefined);
  }, [messages, user]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("case_messages").insert({
      case_id: caseId,
      sender_id: user.id,
      sender_role: viewerRole,
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar a mensagem");
      return;
    }
    setText("");
  };

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Mensagens do caso
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          ref={scrollRef}
          className="h-72 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-3 space-y-2"
        >
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Nenhuma mensagem ainda. Envie a primeira para iniciar a conversa.
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm-soft",
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-foreground border border-border rounded-bl-sm",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={cn(
                        "text-[10px] mt-1 text-right",
                        mine ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {formatStamp(m.created_at)}
                      {mine && m.read_at && " · lida"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
            rows={2}
            className="resize-none"
            maxLength={4000}
          />
          <Button onClick={send} disabled={!text.trim() || sending} size="icon" className="h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Não use o chat para emergências. Em situações urgentes, procure atendimento médico imediato.
        </p>
      </CardContent>
    </Card>
  );
}
