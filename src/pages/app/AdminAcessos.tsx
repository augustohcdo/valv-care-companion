import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck, ExternalLink, Loader2, Mail, ShieldQuestion, Check, X, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { aplicar } from "@/lib/mutate";
import { logAudit } from "@/lib/auditLog";

/**
 * A fila de quem pediu acesso profissional.
 *
 * Aprovar aqui não muda um status: cria a conta, o registro de médico e o
 * papel, e manda ao profissional o link para ele definir a própria senha. Por
 * isso a decisão passa pela edge function `access-decide` e não por um
 * `update` na tela — um "aprovado" que não criou conta seria sucesso relatado
 * sem trabalho feito.
 *
 * A conferência do CRM é registrada **por quem conferiu e quando**, e é ela
 * que decide se o médico nasce com `verified`. O selo de verificado é o que dá
 * autoridade a uma revisão de conteúdo clínico; ligá-lo por aprovação
 * administrativa esvaziaria o significado dele.
 */

export const adminAcessosKey = () => ["admin-acessos"] as const;

type Pedido = {
  id: string; tipo: string; nome: string; email: string; telefone: string | null;
  crm: string | null; crm_uf: string | null; especialidade: string | null; rqe: string | null;
  instituicao: string | null; cidade: string | null; uf: string | null; mensagem: string | null;
  consent_diretorio: boolean; status: string; motivo_recusa: string | null;
  crm_conferido_em: string | null; created_at: string; decidido_em: string | null;
};

const STATUS_META: Record<string, { rotulo: string; classe: string }> = {
  recebido: { rotulo: "Aguardando análise", classe: "bg-warning/10 text-warning border-warning/30" },
  em_analise: { rotulo: "Em análise", classe: "bg-primary/10 text-primary border-primary/30" },
  aprovado: { rotulo: "Aprovado", classe: "bg-success/10 text-success border-success/30" },
  recusado: { rotulo: "Recusado", classe: "bg-destructive/10 text-destructive border-destructive/30" },
};

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/** O portal do CFM não tem API — o link abre a busca para conferência humana. */
const PORTAL_CFM = "https://portal.cfm.org.br/busca-medicos";

export default function AdminAcessos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: adminAcessosKey(),
    queryFn: async (): Promise<Pedido[]> => {
      const { data, error } = await supabase
        .from("access_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Pedido[]) ?? [];
    },
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: adminAcessosKey() });

  const marcarConferido = async (p: Pedido, conferido: boolean) => {
    const ok = await aplicar(
      supabase.from("access_requests").update({
        crm_conferido_em: conferido ? new Date().toISOString() : null,
        crm_conferido_por: conferido ? user?.id ?? null : null,
        updated_at: new Date().toISOString(),
      }).eq("id", p.id).select("id"),
      {
        sucesso: conferido ? "CRM marcado como conferido" : "Conferência desfeita",
        falha: "Não foi possível registrar a conferência",
      },
    );
    if (!ok) return;
    logAudit("access_request_crm_checked", "access_requests", p.id, { conferido, crm: p.crm, crm_uf: p.crm_uf });
    recarregar();
  };

  const decidir = async (p: Pedido, aprovar: boolean) => {
    const motivo = (motivos[p.id] ?? "").trim();
    if (!aprovar && !motivo) {
      toast.error("Escreva o motivo da recusa", {
        description: "Ele vai no e-mail que o profissional recebe.",
      });
      return;
    }
    if (aprovar && !p.crm_conferido_em && p.tipo === "medico") {
      // Não bloqueia: às vezes a conferência vem depois. Mas quem aprovar sem
      // conferir precisa saber que a conta nasce sem o selo de verificado.
      if (!confirm(
        "O CRM ainda não foi conferido.\n\n" +
        "A conta será criada, mas sem o selo de verificado — e sem ele o médico " +
        "não pode aprovar conteúdo clínico.\n\nAprovar mesmo assim?",
      )) return;
    }

    setEmAcao(p.id);
    const { data, error } = await supabase.functions.invoke("access-decide", {
      body: { id: p.id, aprovar, motivo: motivo || null },
    });
    setEmAcao(null);

    if (error || data?.error) {
      toast.error(aprovar ? "Não foi possível aprovar" : "Não foi possível recusar", {
        description: data?.error ?? (error as Error)?.message,
      });
      return;
    }
    toast.success(aprovar ? "Acesso liberado" : "Solicitação recusada", {
      description: data?.email_enviado
        ? "O profissional foi avisado por e-mail."
        : `O e-mail não saiu (${data?.email_motivo ?? "motivo desconhecido"}). Avise por outro canal.`,
    });
    recarregar();
  };

  const pendentes = pedidos.filter((p) => p.status === "recebido" || p.status === "em_analise");
  const decididos = pedidos.filter((p) => p.status === "aprovado" || p.status === "recusado");

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Administração"
        title="Solicitações de acesso"
        description="Médicos e clínicas que pediram acesso. A conta só existe depois da aprovação."
        breadcrumbs={[{ label: "Administração", to: "/app/admin" }, { label: "Acessos" }]}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </p>
      ) : pedidos.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          <ShieldQuestion className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhuma solicitação até agora.
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          <Secao titulo={`Aguardando decisão (${pendentes.length})`} vazio="Nada na fila.">
            {pendentes.map((p) => (
              <PedidoCard
                key={p.id} pedido={p} emAcao={emAcao === p.id}
                motivo={motivos[p.id] ?? ""}
                onMotivo={(v) => setMotivos((m) => ({ ...m, [p.id]: v }))}
                onConferir={(v) => marcarConferido(p, v)}
                onDecidir={(a) => decidir(p, a)}
              />
            ))}
          </Secao>

          {decididos.length > 0 && (
            <Secao titulo={`Já decididas (${decididos.length})`} vazio="">
              {decididos.map((p) => (
                <PedidoCard key={p.id} pedido={p} emAcao={false} somenteLeitura
                  motivo="" onMotivo={() => {}} onConferir={() => {}} onDecidir={() => {}} />
              ))}
            </Secao>
          )}
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode }) {
  const vazia = Array.isArray(children) && children.length === 0;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
      {vazia && vazio
        ? <p className="text-sm text-muted-foreground">{vazio}</p>
        : children}
    </div>
  );
}

function PedidoCard({
  pedido: p, emAcao, motivo, somenteLeitura = false, onMotivo, onConferir, onDecidir,
}: {
  pedido: Pedido; emAcao: boolean; motivo: string; somenteLeitura?: boolean;
  onMotivo: (v: string) => void; onConferir: (v: boolean) => void; onDecidir: (aprovar: boolean) => void;
}) {
  const meta = STATUS_META[p.status] ?? STATUS_META["recebido"];
  const buscaCfm = p.crm
    ? `${PORTAL_CFM}?crm=${encodeURIComponent(p.crm)}&uf=${encodeURIComponent(p.crm_uf ?? "")}`
    : PORTAL_CFM;

  return (
    <Card className="shadow-sm-soft">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-lg text-primary">{p.nome}</h3>
              <Badge variant="outline" className={meta.classe}>{meta.rotulo}</Badge>
              <Badge variant="secondary" className="text-[10px]">
                {p.tipo === "clinica" ? "Clínica/hospital" : "Médico(a)"}
              </Badge>
              {p.crm_conferido_em && (
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                  <BadgeCheck className="h-3 w-3 mr-1" /> CRM conferido
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <Mail className="h-3 w-3" />
              <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>
              {p.telefone && <span>· {p.telefone}</span>}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {data(p.created_at)}
              </span>
            </p>
          </div>
        </div>

        <dl className="grid sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
          <Campo rotulo="CRM">{p.crm ? `${p.crm}/${p.crm_uf ?? "—"}` : "—"}</Campo>
          <Campo rotulo="RQE">{p.rqe ?? "—"}</Campo>
          <Campo rotulo="Especialidade">{p.especialidade ?? "—"}</Campo>
          <Campo rotulo="Instituição">{p.instituicao ?? "—"}</Campo>
          <Campo rotulo="Cidade/UF">{[p.cidade, p.uf].filter(Boolean).join("/") || "—"}</Campo>
          <Campo rotulo="Aceitou o diretório">{p.consent_diretorio ? "Sim" : "Não"}</Campo>
        </dl>

        {p.mensagem && (
          <p className="text-sm text-foreground/80 bg-secondary/40 rounded-lg p-3 leading-relaxed">
            {p.mensagem}
          </p>
        )}

        {somenteLeitura ? (
          <p className="text-xs text-muted-foreground">
            Decidido em {data(p.decidido_em)}
            {p.motivo_recusa && <> · Motivo: {p.motivo_recusa}</>}
          </p>
        ) : (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-start gap-2">
              <Checkbox id={`crm-${p.id}`} checked={!!p.crm_conferido_em}
                onCheckedChange={(v) => onConferir(v === true)} className="mt-0.5" />
              <label htmlFor={`crm-${p.id}`} className="text-xs leading-relaxed cursor-pointer">
                <span className="font-medium text-foreground">
                  Conferi este CRM no portal do CFM
                </span>
                <span className="block text-muted-foreground">
                  Sem isto a conta é criada sem o selo de verificado.{" "}
                  <a href={buscaCfm} target="_blank" rel="noreferrer"
                    className="text-primary underline inline-flex items-center gap-1">
                    abrir o portal <ExternalLink className="h-3 w-3" />
                  </a>
                </span>
              </label>
            </div>

            <Textarea value={motivo} onChange={(e) => onMotivo(e.target.value)}
              placeholder="Motivo da recusa (obrigatório para recusar — vai no e-mail ao profissional)"
              className="min-h-[70px] text-xs" />

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" disabled={emAcao} onClick={() => onDecidir(true)}>
                {emAcao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Aprovar e criar conta
              </Button>
              <Button size="sm" variant="outline" className="text-destructive"
                disabled={emAcao} onClick={() => onDecidir(false)}>
                <X className="h-4 w-4" /> Recusar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-foreground font-medium">{children}</dd>
    </div>
  );
}
