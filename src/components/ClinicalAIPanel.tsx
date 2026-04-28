import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, FileText, Stethoscope, TrendingUp, Send, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "summary" | "suggest" | "trends" | "chat";
type ChatMsg = { role: "user" | "assistant"; content: string };

interface Props {
  caseId: string;
}

export function ClinicalAIPanel({ caseId }: Props) {
  const [mode, setMode] = useState<Mode>("summary");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");

  async function callAI(targetMode: Mode, question?: string, history?: ChatMsg[]) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clinical-ai", {
        body: { mode: targetMode, caseId, question, history },
      });
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 429) toast.error("Limite de uso da IA atingido. Aguarde um instante.");
        else if (status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error("Erro ao consultar IA clínica");
        return null;
      }
      if (data?.error) {
        toast.error(data.error);
        return null;
      }
      return data?.content as string;
    } catch (e) {
      console.error(e);
      toast.error("Falha de comunicação com a IA");
      return null;
    } finally {
      setLoading(false);
    }
  }

  const runSimpleMode = async (m: Mode) => {
    const content = await callAI(m);
    if (content) setResults((prev) => ({ ...prev, [m]: content }));
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q) return;
    const newHistory: ChatMsg[] = [...chatHistory, { role: "user", content: q }];
    setChatHistory(newHistory);
    setChatInput("");
    const content = await callAI("chat", q, chatHistory);
    if (content) {
      setChatHistory([...newHistory, { role: "assistant", content }]);
    }
  };

  return (
    <Card className="shadow-sm-soft border-primary/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          IA Clínica (apoio à decisão)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="summary"><FileText className="h-3.5 w-3.5 mr-1" />Resumo</TabsTrigger>
            <TabsTrigger value="suggest"><Stethoscope className="h-3.5 w-3.5 mr-1" />Conduta</TabsTrigger>
            <TabsTrigger value="trends"><TrendingUp className="h-3.5 w-3.5 mr-1" />Tendências</TabsTrigger>
            <TabsTrigger value="chat"><Send className="h-3.5 w-3.5 mr-1" />Chat</TabsTrigger>
          </TabsList>

          {(["summary", "suggest", "trends"] as const).map((m) => (
            <TabsContent key={m} value={m} className="mt-4 space-y-3">
              <Button onClick={() => runSimpleMode(m)} disabled={loading} size="sm">
                {loading && mode === m ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {results[m] ? "Gerar novamente" : "Gerar"}
              </Button>
              {results[m] ? (
                <div className="prose prose-sm max-w-none dark:prose-invert bg-secondary/30 border border-border rounded-lg p-4">
                  <ReactMarkdown>{results[m]}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Clique em Gerar para obter {m === "summary" ? "um resumo clínico estruturado" : m === "suggest" ? "sugestões de conduta baseadas em ESC 2021 / AHA-ACC 2020" : "análise de tendências dos exames seriados e sintomas"}.
                </p>
              )}
            </TabsContent>
          ))}

          <TabsContent value="chat" className="mt-4 space-y-3">
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Faça uma pergunta clínica sobre este caso. Ex: "Quais critérios de encaminhamento para TAVI?", "Como interpretar o gradiente atual?".
                </p>
              ) : chatHistory.map((m, i) => (
                <div key={i} className={`text-sm rounded-lg p-3 ${m.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-secondary/40 border border-border"}`}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {m.role === "user" ? "Você" : "IA"}
                  </p>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && mode === "chat" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> A IA está pensando...
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Pergunte sobre este caso..."
                className="min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendChat();
                }}
              />
              <Button onClick={sendChat} disabled={loading || !chatInput.trim()} size="icon">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Ctrl/⌘ + Enter para enviar</p>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground bg-amber-500/5 border border-amber-500/30 rounded-lg p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
          <p>Apoio à decisão baseado em diretrizes. Não substitui julgamento clínico nem realiza diagnóstico.</p>
        </div>
      </CardContent>
    </Card>
  );
}
