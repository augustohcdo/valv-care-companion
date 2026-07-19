import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, FileText, Stethoscope, TrendingUp, Send, AlertTriangle, BookOpen, ExternalLink, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Source = { title: string; organization: string; year: number; scope: "br" | "international"; url: string | null; similarity: number; review_status: string };
type Mode = "summary" | "suggest" | "trends" | "chat";
type ChatMsg = { role: "user" | "assistant"; content: string };

interface Props {
  caseId: string;
}

export function ClinicalAIPanel({ caseId }: Props) {
  const [mode, setMode] = useState<Mode>("summary");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [sourcesByMode, setSourcesByMode] = useState<Record<string, Source[]>>({});
  const [ragHitByMode, setRagHitByMode] = useState<Record<string, boolean>>({});
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatSources, setChatSources] = useState<Source[]>([]);
  const [chatRagHit, setChatRagHit] = useState<boolean | null>(null);
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
      return data as { content: string; sources?: Source[]; rag_hit?: boolean };
    } catch (e) {
      console.error(e);
      toast.error("Falha de comunicação com a IA");
      return null;
    } finally {
      setLoading(false);
    }
  }

  const runSimpleMode = async (m: Mode) => {
    const res = await callAI(m);
    if (res?.content) {
      setResults((prev) => ({ ...prev, [m]: res.content }));
      setSourcesByMode((prev) => ({ ...prev, [m]: res.sources ?? [] }));
      setRagHitByMode((prev) => ({ ...prev, [m]: !!res.rag_hit }));
    }
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q) return;
    const newHistory: ChatMsg[] = [...chatHistory, { role: "user", content: q }];
    setChatHistory(newHistory);
    setChatInput("");
    const res = await callAI("chat", q, chatHistory);
    if (res?.content) {
      setChatHistory([...newHistory, { role: "assistant", content: res.content }]);
      setChatSources(res.sources ?? []);
      setChatRagHit(!!res.rag_hit);
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
                <>
                  {ragHitByMode[m] === false && (
                    <div className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/40 rounded-lg p-2.5 text-destructive">
                      <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <p><strong>Sem trecho ancorado.</strong> A base ValvePath não retornou referência para este tópico. A resposta abaixo é conhecimento geral do modelo — verifique em fonte primária antes de qualquer decisão.</p>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert bg-secondary/30 border border-border rounded-lg p-4">
                    <ReactMarkdown>{results[m]}</ReactMarkdown>
                  </div>
                  <SourcesList sources={sourcesByMode[m] ?? []} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Clique em Gerar para obter {m === "summary" ? "um resumo clínico estruturado" : m === "suggest" ? "sugestões de conduta ancoradas em SBC 2024, ACC/AHA 2020 e ESC 2021" : "análise de tendências dos exames seriados e sintomas"}.
                </p>
              )}
            </TabsContent>
          ))}

          <TabsContent value="chat" className="mt-4 space-y-3">
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Faça uma pergunta clínica sobre este caso. Ex: "Quais critérios de encaminhamento para TAVI segundo a SBC 2024?", "Como interpretar o gradiente atual?".
                </p>
              ) : chatHistory.map((m, i) => (
                <div key={i} className={`text-sm rounded-lg p-3 ${m.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-secondary/40 border border-border"}`}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {m.role === "user" ? "Você" : "IA ValvePath"}
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
            {chatHistory.length > 0 && (
              <>
                {chatRagHit === false && (
                  <div className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/40 rounded-lg p-2.5 text-destructive">
                    <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p><strong>Última resposta sem trecho ancorado</strong> — verifique em fonte primária.</p>
                  </div>
                )}
                <SourcesList sources={chatSources} />
              </>
            )}
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

        <div className="mt-4 flex items-start gap-2 text-[11px] bg-amber-500/10 border-2 border-amber-500/50 rounded-lg p-3 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <p>
            <strong>Apoio à decisão, nunca substitui julgamento clínico.</strong> A IA busca trechos ancorados nas diretrizes catalogadas (SBC 2024, ACC/AHA 2020, ESC 2021) e mostra a fonte de cada resposta. Verifique sempre na diretriz original antes de decisão terapêutica. Conteúdo preliminar (selo vermelho) requer revisão médica humana.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SourcesList({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <p className="text-xs font-semibold flex items-center gap-1.5 mb-2 text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        Fontes usadas nesta resposta ({sources.length})
      </p>
      <ul className="space-y-1.5">
        {sources.map((s, i) => (
          <li key={i} className="text-[11px] flex items-start gap-2">
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold shrink-0 ${s.scope === "br" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"}`}>
              {s.scope === "br" ? "BR" : "INT"}
            </span>
            <span className="flex-1">
              <span className="font-medium text-foreground">{s.organization} {s.year}</span>
              <span className="text-muted-foreground"> · {s.title}</span>
              {s.review_status === "ai_generated" && (
                <span className="ml-1.5 text-[9px] uppercase font-semibold text-destructive">· preliminar</span>
              )}
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 ml-1.5 text-primary hover:underline">
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
