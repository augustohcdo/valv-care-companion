import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2, FileText, Stethoscope, TrendingUp, Send, AlertTriangle, BookOpen, ExternalLink, ShieldAlert, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { type ModoPainel } from "@/lib/aiModes";
import { hasActiveConsent, registerConsent, AVISO_CONSENTIMENTO_IA } from "@/lib/consent";
import { toast } from "sonner";

type Source = { title: string; organization: string; year: number; scope: "br" | "international"; url: string | null; similarity: number; review_status: string };
/** Vem de `src/lib/aiModes.ts`, que é conferido contra a edge function. */
type Mode = ModoPainel;
/** Camada externa: artigo indexado, com o desenho do estudo à vista. */
type Artigo = { pmid: string; titulo: string; revista: string; ano: string; tipos: string[]; url: string };
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
  const [artigosByMode, setArtigosByMode] = useState<Record<string, Artigo[]>>({});
  const [chatArtigos, setChatArtigos] = useState<Artigo[]>([]);
  // Desligado por padrão: a busca externa é mais lenta e o médico deve pedi-la.
  const [pesquisar, setPesquisar] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatSources, setChatSources] = useState<Source[]>([]);
  const [chatRagHit, setChatRagHit] = useState<boolean | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [aiConsent, setAiConsent] = useState<boolean | null>(null);
  const [grantingConsent, setGrantingConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasActiveConsent("ai_processing").then((ok) => {
      if (!cancelled) setAiConsent(ok);
    });
    return () => { cancelled = true; };
  }, []);

  const grantAiConsent = async () => {
    setGrantingConsent(true);
    try {
      await registerConsent({ type: "ai_processing", granted: true, source: "clinical_ai_panel" });
      setAiConsent(true);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível registrar o consentimento");
    } finally {
      setGrantingConsent(false);
    }
  };

  async function callAI(targetMode: Mode, question?: string, history?: ChatMsg[]) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clinical-ai", {
        body: { mode: targetMode, caseId, question, history, pesquisar },
      });
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 429) toast.error("Limite de uso da IA atingido. Aguarde um instante.");
        else if (status === 402) toast.error("Créditos de IA esgotados.");
        else if (status === 403) {
          // O servidor passou a exigir o consentimento, e ele pode ter sido
          // revogado noutra aba desde que esta tela carregou. Trazer a parede
          // de volta é mais útil que um erro genérico.
          setAiConsent(false);
          toast.error(AVISO_CONSENTIMENTO_IA.titulo, { description: AVISO_CONSENTIMENTO_IA.descricao });
        }
        else toast.error("Erro ao consultar IA clínica");
        return null;
      }
      if (data?.error) {
        toast.error(data.error);
        return null;
      }
      return data as {
        content: string; sources?: Source[]; rag_hit?: boolean;
        external_sources?: Artigo[];
      };
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
      setArtigosByMode((prev) => ({ ...prev, [m]: res.external_sources ?? [] }));
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
      setChatArtigos(res.external_sources ?? []);
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
        {aiConsent === null ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : aiConsent === false ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-sm">
            <p className="text-foreground">
              Para usar a IA clínica, seus dados de caso (idade, sexo, sintomas, comorbidades, achados de exames e anotações — sem o seu nome) precisam ser enviados ao Google (API Gemini) para processamento. Isso exige seu consentimento específico.
            </p>
            <Button size="sm" onClick={grantAiConsent} disabled={grantingConsent}>
              {grantingConsent && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Ativar processamento por IA
            </Button>
          </div>
        ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="summary"><FileText className="h-3.5 w-3.5 mr-1" />Resumo</TabsTrigger>
            <TabsTrigger value="suggest"><Stethoscope className="h-3.5 w-3.5 mr-1" />Conduta</TabsTrigger>
            <TabsTrigger value="trends"><TrendingUp className="h-3.5 w-3.5 mr-1" />Tendências</TabsTrigger>
            <TabsTrigger value="chat"><Send className="h-3.5 w-3.5 mr-1" />Chat</TabsTrigger>
          </TabsList>

          {/* A cerca, dita em uma linha: o médico precisa saber que "pesquisar"
              aqui não é pesquisar na internet. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
            <div className="flex items-center gap-2">
              <Switch id="pesquisa-externa" checked={pesquisar} onCheckedChange={setPesquisar} />
              <Label htmlFor="pesquisa-externa" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                <Globe className="h-3.5 w-3.5 text-primary" /> Consultar a literatura
              </Label>
            </div>
            <p className="text-[11px] text-muted-foreground min-w-0 flex-1">
              Busca artigos indexados no PubMed (periódico, ano e desenho do estudo à vista) além da
              base ValvePath. A consulta só alcança as fontes cadastradas — não é busca na internet
              aberta.
            </p>
          </div>

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
                  <ArtigosList artigos={artigosByMode[m] ?? []} pediu={pesquisar} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Clique em Gerar para obter {m === "summary" ? "um resumo clínico estruturado" : m === "suggest" ? "sugestões de conduta ancoradas em SBC 2024, ACC/AHA 2020 e ESC 2021" : "análise de tendências dos exames seriados e sintomas"}.
                </p>
              )}
            </TabsContent>
          ))}

          <TabsContent value="chat" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button" variant="outline" size="sm" className="h-7 text-xs"
                disabled={loading}
                onClick={() => { setChatInput("Avaliar risco de mismatch prótese-paciente (PPM) para este caso: calcule EOAi esperado com base na área de superfície corporal estimada e na EOA da prótese planejada, aponte cutoffs (moderado <0,85; severo <0,65 cm²/m²) e sugira alternativas se houver risco de PPM severo."); }}
              >Avaliar risco de Mismatch (PPM)</Button>
              <Button
                type="button" variant="outline" size="sm" className="h-7 text-xs"
                disabled={loading}
                onClick={() => { setChatInput("Estratégia para Valve-in-Valve (ViV) futuro: qual o impacto do tamanho/tipo da prótese planejada agora na viabilidade de um ViV transcateter no futuro? Considere diâmetro interno mínimo para reintervenção e risco de obstrução coronária."); }}
              >Estratégia para Valve-in-Valve futuro</Button>
            </div>

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
                <ArtigosList artigos={chatArtigos} pediu={pesquisar} />
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
        )}

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
                <span className="ml-1.5 text-[9px] uppercase font-semibold text-destructive">· gerado por IA · base em diretriz</span>
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

/**
 * A camada externa, em lista própria.
 *
 * Separada das fontes da base de propósito: as duas não têm o mesmo peso, e
 * juntá-las faria um resumo de série de casos parecer recomendação de
 * diretriz. O desenho do estudo aparece porque é ele que deixa o médico pesar
 * o achado sozinho.
 */
function ArtigosList({ artigos, pediu }: { artigos: Artigo[]; pediu: boolean }) {
  if (!pediu) return null;
  if (!artigos.length) {
    return (
      <p className="text-[11px] text-muted-foreground border border-dashed border-border rounded-lg p-2.5">
        A consulta à literatura não encontrou artigo indexado para esta pergunta. A resposta acima
        não foi reforçada por ela.
      </p>
    );
  }
  return (
    <div className="border border-border rounded-lg p-3 bg-background">
      <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-2">
        <Globe className="h-3 w-3 text-primary" />
        Literatura consultada ({artigos.length}) — camada externa, distinta da base ValvePath
      </p>
      <ul className="space-y-1.5">
        {artigos.map((a) => (
          <li key={a.pmid} className="text-[11px] flex items-start gap-2">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold shrink-0 bg-primary/15 text-primary">
              PubMed
            </span>
            <span className="flex-1">
              <span className="font-medium text-foreground">{a.titulo}</span>
              <span className="text-muted-foreground"> · {a.revista}, {a.ano}</span>
              {a.tipos.length > 0 && (
                <span className="ml-1.5 text-[9px] uppercase font-semibold text-muted-foreground">
                  · {a.tipos.join(" · ")}
                </span>
              )}
              <a href={a.url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-0.5 ml-1.5 text-primary hover:underline">
                PMID {a.pmid} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
