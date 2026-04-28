import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Plus, Loader2, Copy } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";

export default function AdminIntegracoes() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add member
  const [memberHospital, setMemberHospital] = useState("");
  const [memberUserId, setMemberUserId] = useState("");

  // New key dialog
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyHospital, setKeyHospital] = useState("");
  const [keyName, setKeyName] = useState("");
  const [keyDays, setKeyDays] = useState(180);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
    })();
  }, [user]);

  const reload = async () => {
    setLoading(true);
    const [{ data: h }, { data: k }, { data: m }] = await Promise.all([
      supabase.from("hospitals").select("*").order("created_at", { ascending: false }),
      supabase.from("hospital_api_keys").select("*").order("created_at", { ascending: false }),
      supabase.from("hospital_members").select("*, hospitals(legal_name, trade_name)").order("created_at", { ascending: false }),
    ]);
    setHospitals(h ?? []); setKeys(k ?? []); setMembers(m ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  if (authLoading || isAdmin === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/app/medico" replace />;

  const approveHospital = async (id: string, status: "ativo" | "rejeitado") => {
    const { error } = await supabase.from("hospitals").update({
      status, approved_at: status === "ativo" ? new Date().toISOString() : null, approved_by: user?.id,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Hospital ${status === "ativo" ? "aprovado" : "rejeitado"}.`);
    reload();
  };

  const addMember = async () => {
    if (!memberHospital || !memberUserId) return toast.error("Preencha hospital e user_id.");
    const { error } = await supabase.from("hospital_members").insert({
      hospital_id: memberHospital, user_id: memberUserId, role: "operador" as any,
    });
    if (error) return toast.error(error.message);
    toast.success("Membro adicionado."); setMemberUserId(""); reload();
  };

  const createKey = async () => {
    if (!keyHospital || !keyName) return toast.error("Preencha hospital e nome.");
    setCreatingKey(true);
    const { data, error } = await supabase.functions.invoke("hospital-api-key-create", {
      body: { hospital_id: keyHospital, name: keyName, expires_in_days: keyDays },
    });
    setCreatingKey(false);
    if (error || data?.error) return toast.error(data?.error ?? error?.message ?? "Erro");
    setGeneratedKey(data.api_key);
    reload();
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <Helmet><title>Admin — Integrações | ValvePath</title></Helmet>
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-primary" /> Admin — Integrações Hospitalares</h1>
        <p className="text-muted-foreground">Aprove hospitais, gerencie membros e emita chaves de API.</p>
      </header>

      <Tabs defaultValue="hospitals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hospitals">Hospitais ({hospitals.length})</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="keys"><KeyRound className="h-4 w-4 mr-2" />API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="hospitals" className="space-y-3">
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {hospitals.map(h => (
            <Card key={h.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="text-sm space-y-1">
                  <div className="font-semibold">{h.trade_name ?? h.legal_name}</div>
                  <div className="text-muted-foreground">CNPJ {h.cnpj}{h.cnes && ` · CNES ${h.cnes}`}</div>
                  <div className="text-muted-foreground">RT: {h.technical_responsible_name} · CRM {h.technical_responsible_crm}/{h.technical_responsible_uf}</div>
                  <div className="text-xs text-muted-foreground">{h.contact_email}</div>
                  <div className="text-xs font-mono text-muted-foreground">{h.id}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={h.status === "ativo" ? "default" : h.status === "rejeitado" ? "destructive" : "secondary"}>{h.status}</Badge>
                  {h.status === "pendente" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveHospital(h.id, "ativo")}>Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => approveHospital(h.id, "rejeitado")}>Rejeitar</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {!hospitals.length && !loading && <p className="text-muted-foreground text-sm">Nenhum hospital cadastrado.</p>}
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Adicionar membro</CardTitle><CardDescription>Vincula um usuário existente a um hospital.</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <div>
                <Label>Hospital</Label>
                <select className="w-full border rounded h-10 px-2 bg-background" value={memberHospital} onChange={e => setMemberHospital(e.target.value)}>
                  <option value="">Selecione</option>
                  {hospitals.filter(h => h.status === "ativo").map(h => <option key={h.id} value={h.id}>{h.trade_name ?? h.legal_name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>User ID (UUID auth)</Label>
                <div className="flex gap-2">
                  <Input value={memberUserId} onChange={e => setMemberUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
                  <Button onClick={addMember}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {members.map(m => (
              <Card key={m.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{m.hospitals?.trade_name ?? m.hospitals?.legal_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{m.user_id}</div>
                  </div>
                  <Badge>{m.role}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="keys" className="space-y-3">
          <Dialog open={keyDialogOpen} onOpenChange={(o) => { setKeyDialogOpen(o); if (!o) { setGeneratedKey(null); setKeyName(""); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova API key</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Emitir API key</DialogTitle><DialogDescription>A chave será exibida apenas uma vez.</DialogDescription></DialogHeader>
              {!generatedKey ? (
                <div className="space-y-3">
                  <div>
                    <Label>Hospital</Label>
                    <select className="w-full border rounded h-10 px-2 bg-background" value={keyHospital} onChange={e => setKeyHospital(e.target.value)}>
                      <option value="">Selecione</option>
                      {hospitals.filter(h => h.status === "ativo").map(h => <option key={h.id} value={h.id}>{h.trade_name ?? h.legal_name}</option>)}
                    </select>
                  </div>
                  <div><Label>Nome (descrição)</Label><Input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Produção · Sistema HIS" /></div>
                  <div><Label>Validade (dias)</Label><Input type="number" value={keyDays} onChange={e => setKeyDays(Number(e.target.value) || 180)} /></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Salve esta chave agora — não será exibida novamente.</p>
                  <div className="bg-muted p-3 rounded font-mono text-xs break-all">{generatedKey}</div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success("Copiada!"); }}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar
                  </Button>
                </div>
              )}
              <DialogFooter>
                {!generatedKey
                  ? <Button onClick={createKey} disabled={creatingKey}>{creatingKey && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Gerar</Button>
                  : <Button onClick={() => setKeyDialogOpen(false)}>Fechar</Button>}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {keys.map(k => (
            <Card key={k.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap text-sm">
                <div className="space-y-1">
                  <div className="font-medium">{k.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">vp_{k.key_prefix}_••••••••</div>
                  <div className="text-xs text-muted-foreground">Hospital: {hospitals.find(h => h.id === k.hospital_id)?.trade_name ?? k.hospital_id}</div>
                  <div className="text-xs text-muted-foreground">Escopos: {k.scopes.join(", ")}</div>
                  <div className="text-xs text-muted-foreground">Expira: {new Date(k.expires_at).toLocaleString("pt-BR")}</div>
                </div>
                <Badge variant={k.revoked_at ? "destructive" : new Date(k.expires_at) < new Date() ? "secondary" : "default"}>
                  {k.revoked_at ? "revogada" : new Date(k.expires_at) < new Date() ? "expirada" : "ativa"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
