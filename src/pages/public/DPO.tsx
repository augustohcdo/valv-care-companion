import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { TrustBadges } from "@/components/TrustBadges";
import {
  ShieldCheck, Mail, Clock, FileText, ExternalLink,
  CheckCircle2, XCircle, AlertCircle, Loader2, Inbox, History,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

const DPO_EMAIL = "dpo@valvepath.com";

const RIGHTS = [
  { id: "confirmacao",     label: "Confirmação de tratamento",         desc: "Confirmar se tratamos seus dados pessoais.",                                          article: "Art. 18, I" },
  { id: "acesso",          label: "Acesso aos dados",                  desc: "Receber cópia dos dados que mantemos sobre você.",                                    article: "Art. 18, II" },
  { id: "correcao",        label: "Correção",                          desc: "Corrigir dados incompletos, inexatos ou desatualizados.",                             article: "Art. 18, III" },
  { id: "anonimizacao",    label: "Anonimização ou bloqueio",          desc: "Anonimizar, bloquear ou eliminar dados desnecessários ou em desconformidade.",         article: "Art. 18, IV" },
  { id: "portabilidade",   label: "Portabilidade",                     desc: "Receber seus dados em formato estruturado e interoperável.",                          article: "Art. 18, V" },
  { id: "eliminacao",      label: "Eliminação",                        desc: "Eliminar dados tratados com base em consentimento.",                                  article: "Art. 18, VI" },
  { id: "compartilhamento",label: "Informação sobre compartilhamento", desc: "Saber com quais entidades compartilhamos seus dados.",                                 article: "Art. 18, VII" },
  { id: "consentimento",   label: "Revogação de consentimento",        desc: "Revogar consentimento previamente concedido.",                                        article: "Art. 18, IX" },
  { id: "revisao",         label: "Revisão de decisão automatizada",   desc: "Solicitar revisão de decisões tomadas exclusivamente por algoritmo.",                  article: "Art. 20" },
] as const;

type RightId = typeof RIGHTS[number]["id"];

type DpoStatus = "recebido" | "em_verificacao" | "atendido" | "negado" | "parcialmente_atendido";

interface DpoRequest {
  id: string;
  right_type: RightId;
  status: DpoStatus;
  requester_name: string;
  details: string | null;
  response: string | null;
  legal_basis: string | null;
  due_at: string;
  responded_at: string | null;
  created_at: string;
}

const STATUS_META: Record<DpoStatus, { label: string; color: string; icon: typeof CheckCircle2; desc: string }> = {
  recebido:               { label: "Recebido",               color: "bg-blue-500/10 text-blue-600 border-blue-500/30",       icon: Inbox,        desc: "Sua solicitação foi registrada e aguarda triagem do DPO." },
  em_verificacao:         { label: "Em verificação",         color: "bg-amber-500/10 text-amber-600 border-amber-500/30",    icon: Loader2,      desc: "Confirmando sua identidade e analisando a viabilidade legal." },
  atendido:               { label: "Atendido",               color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2, desc: "Solicitação concluída integralmente." },
  parcialmente_atendido:  { label: "Parcialmente atendido",  color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: AlertCircle,  desc: "Atendido em parte; consulte a justificativa." },
  negado:                 { label: "Negado",                 color: "bg-red-500/10 text-red-600 border-red-500/30",          icon: XCircle,      desc: "Solicitação negada com base legal — veja a justificativa." },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

export default function DPO() {
  const { user } = useAuth();
  const [right, setRight] = useState<RightId>("acesso");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<DpoRequest[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const selectedRight = RIGHTS.find((r) => r.id === right)!;

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setLoadingList(true);
    const { data, error } = await supabase
      .from("dpo_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRequests(data as DpoRequest[]);
    setLoadingList(false);
  };

  useEffect(() => { loadRequests(); }, [user]);

  // Realtime updates de status
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dpo-requests-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dpo_requests", filter: `user_id=eq.${user.id}` }, () => {
        loadRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    setSubmitting(true);

    let savedId: string | null = null;
    if (user) {
      const { data, error } = await supabase
        .from("dpo_requests")
        .insert({
          user_id: user.id,
          right_type: right,
          requester_name: name,
          requester_email: email,
          requester_cpf: cpf || null,
          details: details || null,
        })
        .select("id")
        .single();
      if (error) {
        toast.error("Não conseguimos registrar: " + error.message);
        setSubmitting(false);
        return;
      }
      savedId = data?.id ?? null;
      toast.success("Solicitação registrada. Acompanhe abaixo o status.");
      await loadRequests();
    } else {
      toast.info("Você não está logado — abriremos seu e-mail para envio manual.");
    }

    const subject = `[Solicitação LGPD${savedId ? " #" + savedId.slice(0, 8) : ""}] ${selectedRight.label} — ${name}`;
    const body = [
      `Titular: ${name}`,
      `E-mail: ${email}`,
      cpf ? `CPF: ${cpf}` : "",
      ``,
      `Direito: ${selectedRight.label} (${selectedRight.article})`,
      `Descrição: ${selectedRight.desc}`,
      ``,
      `Detalhes:`,
      details || "(nenhum)",
      ``,
      savedId ? `Protocolo interno: ${savedId}` : "",
      `Enviado em ${new Date().toLocaleString("pt-BR")}`,
    ].filter(Boolean).join("\n");

    window.open(`mailto:${DPO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");

    setSubmitting(false);
    if (!user) {
      setName(""); setEmail(""); setCpf(""); setDetails("");
    } else {
      setDetails("");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Encarregado de Dados (DPO)"
        title="Exerça seus direitos como titular de dados"
        description="LGPD (Lei 13.709/2018) — Art. 18. Respondemos em até 15 dias."
      />

      <section className="container-vp py-10 max-w-5xl">
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Card className="p-5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Gratuito</h3>
              <p className="text-xs text-muted-foreground mt-1">O exercício dos seus direitos não tem custo (Art. 19, §3º).</p>
            </div>
          </Card>
          <Card className="p-5 flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Resposta em até 15 dias</h3>
              <p className="text-xs text-muted-foreground mt-1">Conforme orientação da ANPD para todos os direitos do Art. 18.</p>
            </div>
          </Card>
          <Card className="p-5 flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Identidade verificada</h3>
              <p className="text-xs text-muted-foreground mt-1">Para proteger você, podemos solicitar comprovação antes de atender.</p>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <Card className="p-6 lg:col-span-3">
            <h2 className="font-display font-semibold text-xl mb-1">Nova solicitação</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {user
                ? "Sua solicitação será registrada com protocolo e você acompanhará o status nesta página."
                : "Você está navegando como visitante. Entre na sua conta para acompanhar o status. Sem login, abriremos um e-mail para o DPO."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Direito que deseja exercer *</Label>
                <RadioGroup value={right} onValueChange={(v) => setRight(v as RightId)} className="space-y-2">
                  {RIGHTS.map((r) => (
                    <label
                      key={r.id} htmlFor={`r-${r.id}`}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        right === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                      }`}
                    >
                      <RadioGroupItem value={r.id} id={`r-${r.id}`} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">{r.label}</span>
                          <span className="text-[10px] text-muted-foreground">{r.article}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF (opcional)</Label>
                <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="details">Detalhes adicionais</Label>
                <Textarea id="details" rows={4} value={details} onChange={(e) => setDetails(e.target.value)}
                  placeholder="Descreva sua solicitação, período, dados específicos etc." />
              </div>

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                <Mail className="h-4 w-4 mr-2" />
                {submitting ? "Registrando…" : "Enviar solicitação"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Canal direto:{" "}
                <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">{DPO_EMAIL}</a>
              </p>
            </form>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" /> Encarregado (DPO)
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Canal oficial entre você, o ValvePath e a ANPD.
              </p>
              <p className="text-xs mt-3">
                <strong>E-mail:</strong>{" "}
                <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">{DPO_EMAIL}</a>
              </p>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2">Limites legais</h3>
              <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <li>• Dados clínicos retidos por <strong>20 anos</strong> (Lei 13.787/2018) mesmo após eliminação.</li>
                <li>• Logs de acesso por <strong>6 meses</strong> (Marco Civil, Art. 15).</li>
                <li>• Pedidos podem ser negados quando houver obrigação legal, exercício regular de direitos ou proteção da vida (Art. 7º e 11º).</li>
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2">Não satisfeito?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você pode peticionar diretamente à ANPD.
              </p>
              <a href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary underline inline-flex items-center gap-1 mt-2">
                Acessar canal da ANPD <ExternalLink className="h-3 w-3" />
              </a>
            </Card>

            <TrustBadges />
          </div>
        </div>

        {/* ===================== REGISTRO DE ATENDIMENTO ===================== */}
        <div className="mt-14">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-2xl flex items-center gap-2">
                <History className="h-6 w-6 text-primary" /> Registro de atendimento
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe status, prazos e justificativas das suas solicitações.
              </p>
            </div>
          </div>

          {!user ? (
            <Card className="p-8 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">Entre na sua conta para ver o histórico</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Solicitações de visitantes são enviadas apenas por e-mail e não ficam registradas no painel.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/auth/login">Entrar</Link>
              </Button>
            </Card>
          ) : loadingList ? (
            <Card className="p-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando solicitações…
            </Card>
          ) : requests.length === 0 ? (
            <Card className="p-8 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">Nenhuma solicitação registrada</h3>
              <p className="text-sm text-muted-foreground">
                Quando você enviar uma solicitação, ela aparecerá aqui com status, prazo e resposta do DPO.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const meta = STATUS_META[req.status];
                const StatusIcon = meta.icon;
                const right = RIGHTS.find((r) => r.id === req.right_type);
                const dl = daysLeft(req.due_at);
                const isClosed = req.status === "atendido" || req.status === "negado" || req.status === "parcialmente_atendido";
                return (
                  <Card key={req.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm">{right?.label ?? req.right_type}</h4>
                          <Badge variant="outline" className="text-[10px]">{right?.article}</Badge>
                          <Badge variant="outline" className="text-[10px] font-mono">#{req.id.slice(0, 8)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Aberta em {fmtDate(req.created_at)}
                          {req.responded_at && <> · Respondida em {fmtDate(req.responded_at)}</>}
                        </p>
                      </div>
                      <Badge className={`${meta.color} border gap-1.5`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${req.status === "em_verificacao" ? "animate-spin" : ""}`} />
                        {meta.label}
                      </Badge>
                    </div>

                    <p className="text-xs text-foreground/80 mb-3">{meta.desc}</p>

                    {!isClosed && (
                      <div className={`text-xs flex items-center gap-2 mb-3 ${dl <= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
                        <Clock className="h-3.5 w-3.5" />
                        Prazo legal até <strong>{fmtDate(req.due_at)}</strong>
                        {dl >= 0 ? <> · {dl} dia{dl === 1 ? "" : "s"} restante{dl === 1 ? "" : "s"}</> : <> · prazo expirado</>}
                      </div>
                    )}

                    {req.details && (
                      <div className="text-xs bg-secondary/40 rounded-md p-3 mb-3">
                        <p className="font-medium text-foreground/80 mb-1">Sua solicitação</p>
                        <p className="text-muted-foreground whitespace-pre-line">{req.details}</p>
                      </div>
                    )}

                    {req.response && (
                      <div className="text-xs bg-primary/5 border border-primary/20 rounded-md p-3 mb-2">
                        <p className="font-medium text-foreground/80 mb-1 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Resposta do DPO
                        </p>
                        <p className="text-foreground/85 whitespace-pre-line">{req.response}</p>
                      </div>
                    )}

                    {req.legal_basis && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        <strong>Base legal:</strong> {req.legal_basis}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
