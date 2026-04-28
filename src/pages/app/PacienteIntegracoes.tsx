import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Hospital, Check, X, Copy, ShieldOff, Loader2, FileText } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function PacienteIntegracoes() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [inbound, setInbound] = useState<any[]>([]);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: r }, { data: g }, { data: i }] = await Promise.all([
      supabase.from("data_access_requests").select("*, hospitals(trade_name, legal_name)").eq("patient_id", user.id).order("created_at", { ascending: false }),
      supabase.from("data_access_grants").select("*, hospitals(trade_name, legal_name)").eq("patient_id", user.id).order("granted_at", { ascending: false }),
      supabase.from("fhir_resources_inbound").select("*, hospitals(trade_name, legal_name)").eq("patient_id", user.id).order("received_at", { ascending: false }).limit(50),
    ]);
    setRequests(r ?? []); setGrants(g ?? []); setInbound(i ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user]);

  const decide = async (id: string, status: "aprovado" | "recusado", note?: string) => {
    const { error } = await supabase.from("data_access_requests").update({ status, decision_note: note ?? null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "aprovado" ? "Pedido aprovado." : "Pedido recusado.");
    reload();
  };

  const revoke = async (grantId: string) => {
    if (!confirm("Tem certeza? O hospital perderá acesso imediatamente.")) return;
    const { error } = await supabase.from("data_access_grants").update({
      revoked_at: new Date().toISOString(), revoked_by: user?.id, revoke_reason: "Revogado pelo paciente",
    }).eq("id", grantId);
    if (error) return toast.error(error.message);
    toast.success("Acesso revogado."); reload();
  };

  const pending = requests.filter(r => r.status === "pendente");

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <Helmet><title>Integrações Hospitalares — ValvePath</title></Helmet>

      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Hospital className="h-7 w-7 text-primary" /> Integrações Hospitalares</h1>
        <p className="text-muted-foreground">Você decide quais hospitais podem acessar seus dados e por quanto tempo.</p>
      </header>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium">Seu ID ValvePath (forneça ao hospital)</p>
            <p className="font-mono text-xs text-muted-foreground break-all">{user?.id}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(user?.id ?? ""); toast.success("Copiado!"); }}>
            <Copy className="h-4 w-4 mr-2" /> Copiar
          </Button>
        </CardContent>
      </Card>

      {loading && <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />}

      <Tabs defaultValue={pending.length ? "pendentes" : "ativos"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes">Pedidos pendentes {pending.length > 0 && <Badge className="ml-2" variant="destructive">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="ativos">Acessos ativos ({grants.filter(g => !g.revoked_at).length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="recebidos"><FileText className="h-4 w-4 mr-2" />Dados recebidos ({inbound.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-3">
          {pending.length === 0 && <p className="text-muted-foreground text-sm">Nenhum pedido aguardando.</p>}
          {pending.map(r => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-lg">{r.hospitals?.trade_name ?? r.hospitals?.legal_name}</CardTitle>
                <CardDescription>{r.requesting_doctor_name} {r.requesting_doctor_crm && `· CRM ${r.requesting_doctor_crm}`}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><span className="text-muted-foreground">Finalidade:</span> <strong>{r.purpose}</strong></div>
                {r.purpose_details && <p className="text-muted-foreground">{r.purpose_details}</p>}
                <div><span className="text-muted-foreground">Recursos solicitados:</span> {r.resource_scopes.join(", ")}</div>
                <div><span className="text-muted-foreground">Validade:</span> {r.validity_days} dias · <span className="text-muted-foreground">direção:</span> {r.direction}</div>
                {r.patient_message && (
                  <div className="bg-muted p-3 rounded text-sm italic">"{r.patient_message}"</div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => decide(r.id, "aprovado")}><Check className="h-4 w-4 mr-2" /> Aprovar</Button>
                  <Button variant="outline" onClick={() => decide(r.id, "recusado")}><X className="h-4 w-4 mr-2" /> Recusar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="ativos" className="space-y-3">
          {grants.filter(g => !g.revoked_at).length === 0 && <p className="text-muted-foreground text-sm">Nenhum acesso ativo.</p>}
          {grants.filter(g => !g.revoked_at).map(g => (
            <Card key={g.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="text-sm space-y-1">
                  <div className="font-semibold">{g.hospitals?.trade_name ?? g.hospitals?.legal_name}</div>
                  <div className="text-muted-foreground">{g.resource_scopes.join(", ")} · {g.direction}</div>
                  <div className="text-xs text-muted-foreground">Expira: {new Date(g.expires_at).toLocaleString("pt-BR")}</div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => revoke(g.id)}><ShieldOff className="h-4 w-4 mr-2" /> Revogar</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="historico" className="space-y-2">
          {requests.filter(r => r.status !== "pendente").map(r => (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-center justify-between text-sm gap-3">
                <div>
                  <div className="font-medium">{r.hospitals?.trade_name ?? r.hospitals?.legal_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")} · {r.purpose}</div>
                </div>
                <Badge variant={r.status === "aprovado" ? "default" : "destructive"}>{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="recebidos" className="space-y-2">
          {inbound.length === 0 && <p className="text-muted-foreground text-sm">Nenhum dado recebido ainda.</p>}
          {inbound.map(i => (
            <Card key={i.id}>
              <CardContent className="p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{i.summary || i.resource_type}</div>
                    <div className="text-xs text-muted-foreground">{i.hospitals?.trade_name ?? i.hospitals?.legal_name} · {new Date(i.received_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <Badge variant="outline">{i.resource_type}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
