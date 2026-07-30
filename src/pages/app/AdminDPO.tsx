import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, Loader2, Inbox, Clock, Download, FileDown,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

const RIGHT_LABELS: Record<string, string> = {
  confirmacao: "Confirmação de tratamento",
  acesso: "Acesso aos dados",
  correcao: "Correção",
  anonimizacao: "Anonimização ou bloqueio",
  portabilidade: "Portabilidade",
  eliminacao: "Eliminação",
  compartilhamento: "Informação sobre compartilhamento",
  consentimento: "Revogação de consentimento",
  revisao: "Revisão de decisão automatizada",
};

type DpoStatus = "recebido" | "em_verificacao" | "atendido" | "negado" | "parcialmente_atendido";

const STATUS_OPTIONS: { value: DpoStatus; label: string }[] = [
  { value: "recebido", label: "Recebido" },
  { value: "em_verificacao", label: "Em verificação" },
  { value: "atendido", label: "Atendido" },
  { value: "parcialmente_atendido", label: "Parcialmente atendido" },
  { value: "negado", label: "Negado" },
];

const STATUS_META: Record<DpoStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  recebido: { label: "Recebido", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Inbox },
  em_verificacao: { label: "Em verificação", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Loader2 },
  atendido: { label: "Atendido", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  parcialmente_atendido: { label: "Parcialmente atendido", color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: AlertCircle },
  negado: { label: "Negado", color: "bg-red-500/10 text-red-600 border-red-500/30", icon: XCircle },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

interface DpoRequest {
  id: string;
  right_type: string;
  status: DpoStatus;
  requester_name: string;
  requester_email: string;
  requester_cpf: string | null;
  details: string | null;
  response: string | null;
  due_at: string;
  responded_at: string | null;
  created_at: string;
}

export default function AdminDPO() {
  const [requests, setRequests] = useState<DpoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { status: DpoStatus; response: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportUrls, setExportUrls] = useState<Record<string, string>>({});

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dpo_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data as DpoRequest[]) ?? [];
    setRequests(rows);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!next[r.id]) next[r.id] = { status: r.status, response: r.response ?? "" };
      }
      return next;
    });
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const saveResponse = async (req: DpoRequest) => {
    const draft = drafts[req.id];
    if (!draft) return;
    setSaving(req.id);
    const { error } = await supabase
      .from("dpo_requests")
      .update({
        status: draft.status,
        response: draft.response || null,
        responded_at: draft.status !== "recebido" ? new Date().toISOString() : null,
      })
      .eq("id", req.id);
    setSaving(null);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Solicitação atualizada");
    logAudit("dpo_status_updated", "dpo_requests", req.id, { status: draft.status });
    reload();
  };

  const generateExport = async (req: DpoRequest) => {
    setExporting(req.id);
    const { data, error } = await supabase.functions.invoke("dpo-export", {
      body: { dpo_request_id: req.id },
    });
    setExporting(null);
    if (error || data?.error) {
      toast.error("Erro ao gerar export", { description: data?.error ?? error?.message });
      return;
    }
    setExportUrls((prev) => ({ ...prev, [req.id]: data.url }));
    toast.success("Export gerado");
    logAudit("dpo_export_generated", "dpo_requests", req.id, { right_type: req.right_type });
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" /> Admin — Solicitações LGPD
        </h1>
        <p className="text-muted-foreground">
          Fila de solicitações de direitos do titular (Art. 18, LGPD). Pedidos de eliminação são sempre
          tratados manualmente — nenhuma exclusão é executada automaticamente por esta tela.
        </p>
      </header>

      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="p-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando solicitações…
          </CardContent></Card>
        ) : requests.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma solicitação registrada.
          </CardContent></Card>
        ) : (
          requests.map((req) => {
            const meta = STATUS_META[req.status];
            const StatusIcon = meta.icon;
            const draft = drafts[req.id] ?? { status: req.status, response: req.response ?? "" };
            const canExport = req.right_type === "acesso" || req.right_type === "portabilidade";
            return (
              <Card key={req.id}>
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{RIGHT_LABELS[req.right_type] ?? req.right_type}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">#{req.id.slice(0, 8)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.requester_name} · {req.requester_email}
                        {req.requester_cpf && <> · CPF {req.requester_cpf}</>}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> Aberta em {fmtDate(req.created_at)} · Prazo {fmtDate(req.due_at)}
                      </p>
                    </div>
                    <Badge className={`${meta.color} border gap-1.5 shrink-0`}>
                      <StatusIcon className="h-3.5 w-3.5" /> {meta.label}
                    </Badge>
                  </div>

                  {req.details && (
                    <div className="text-xs bg-secondary/40 rounded-md p-3">
                      <p className="font-medium text-foreground/80 mb-1">Detalhes do solicitante</p>
                      <p className="text-muted-foreground whitespace-pre-line">{req.details}</p>
                    </div>
                  )}

                  {canExport && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => generateExport(req)}
                        disabled={exporting === req.id}
                      >
                        {exporting === req.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <FileDown className="h-4 w-4" />}
                        Gerar export de dados
                      </Button>
                      {exportUrls[req.id] && (
                        <a
                          href={exportUrls[req.id]} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary underline inline-flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> Baixar export (válido por 30 min)
                        </a>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-[160px_1fr] gap-3 items-start pt-2 border-t border-border">
                    <Select
                      value={draft.status}
                      onValueChange={(v) => setDrafts((prev) => ({ ...prev, [req.id]: { ...draft, status: v as DpoStatus } }))}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={draft.response}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [req.id]: { ...draft, response: e.target.value } }))}
                      placeholder="Resposta ao titular (visível para ele no painel de status)"
                      className="min-h-[70px] text-xs"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => saveResponse(req)} disabled={saving === req.id}>
                      {saving === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
