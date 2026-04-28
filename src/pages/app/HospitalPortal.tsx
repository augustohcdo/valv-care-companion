import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, KeyRound, Send, ShieldCheck, Activity, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

const RESOURCE_TYPES = ["Condition", "Observation", "MedicationStatement", "DiagnosticReport", "Procedure", "Encounter"];

export default function HospitalPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  // Form: novo pedido
  const [patientId, setPatientId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorCrm, setDoctorCrm] = useState("");
  const [purpose, setPurpose] = useState("assistencia_direta");
  const [details, setDetails] = useState("");
  const [scopes, setScopes] = useState<string[]>(["Condition", "Observation", "MedicationStatement"]);
  const [validity, setValidity] = useState(90);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: members } = await supabase
        .from("hospital_members")
        .select("hospital_id, role, hospitals(id, legal_name, trade_name, status)")
        .eq("user_id", user.id)
        .eq("active", true);
      const list = (members ?? []).map((m: any) => ({ ...m.hospitals, role: m.role }));
      setHospitals(list);
      if (list.length) setSelected(list[0].id);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const [{ data: r }, { data: g }, { data: a }] = await Promise.all([
        supabase.from("data_access_requests").select("*").eq("hospital_id", selected).order("created_at", { ascending: false }).limit(50),
        supabase.from("data_access_grants").select("*").eq("hospital_id", selected).order("granted_at", { ascending: false }).limit(50),
        supabase.from("integration_audit_log").select("*").eq("hospital_id", selected).order("created_at", { ascending: false }).limit(50),
      ]);
      setRequests(r ?? []); setGrants(g ?? []); setAudit(a ?? []);
    })();
  }, [selected]);

  const submitRequest = async () => {
    if (!selected || !user) return;
    if (!patientId.trim()) return toast.error("Informe o ID do paciente.");
    setSubmitting(true);
    const { error } = await supabase.from("data_access_requests").insert({
      hospital_id: selected,
      patient_id: patientId.trim(),
      requested_by: user.id,
      requesting_doctor_name: doctorName || null,
      requesting_doctor_crm: doctorCrm || null,
      purpose: purpose as any,
      purpose_details: details || null,
      resource_scopes: scopes as any,
      direction: "bidirectional",
      validity_days: validity,
      patient_message: message || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado. O paciente foi notificado.");
    setPatientId(""); setDoctorName(""); setDoctorCrm(""); setDetails(""); setMessage("");
    const { data: r } = await supabase.from("data_access_requests").select("*").eq("hospital_id", selected).order("created_at", { ascending: false }).limit(50);
    setRequests(r ?? []);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!hospitals.length) {
    return (
      <div className="container max-w-3xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Sem vínculo hospitalar</CardTitle>
            <CardDescription>Sua conta não está vinculada a nenhum hospital parceiro.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Para integrar seu hospital à ValvePath, acesse a página{" "}
              <a href="/parceiros" className="text-primary underline">Para Hospitais</a> ou
              entre em contato com nosso DPO em <a className="text-primary underline" href="mailto:valvepath@gmail.com">valvepath@gmail.com</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <Helmet><title>Portal do Hospital — ValvePath</title></Helmet>

      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> Portal do Hospital</h1>
          <p className="text-muted-foreground">Solicite acesso aos dados do paciente, acompanhe consentimentos e auditoria.</p>
        </div>
        {hospitals.length > 1 && (
          <Select value={selected ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {hospitals.map(h => <SelectItem key={h.id} value={h.id}>{h.trade_name ?? h.legal_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </header>

      <Tabs defaultValue="novo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="novo"><Send className="h-4 w-4 mr-2" />Novo pedido</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos ({requests.length})</TabsTrigger>
          <TabsTrigger value="grants"><ShieldCheck className="h-4 w-4 mr-2" />Acessos ativos</TabsTrigger>
          <TabsTrigger value="audit"><Activity className="h-4 w-4 mr-2" />Auditoria</TabsTrigger>
          <TabsTrigger value="api"><KeyRound className="h-4 w-4 mr-2" />API/FHIR</TabsTrigger>
        </TabsList>

        <TabsContent value="novo">
          <Card>
            <CardHeader>
              <CardTitle>Solicitar acesso aos dados de um paciente</CardTitle>
              <CardDescription>O paciente recebe a notificação e decide aprovar ou recusar (modelo open health).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>ID do paciente (UUID na ValvePath)</Label>
                  <Input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
                  <p className="text-xs text-muted-foreground mt-1">O paciente fornece este ID em Perfil → Integrações.</p>
                </div>
                <div>
                  <Label>Validade (dias)</Label>
                  <Input type="number" value={validity} onChange={e => setValidity(Number(e.target.value) || 90)} />
                </div>
                <div>
                  <Label>Médico solicitante</Label>
                  <Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr(a). Nome completo" />
                </div>
                <div>
                  <Label>CRM</Label>
                  <Input value={doctorCrm} onChange={e => setDoctorCrm(e.target.value)} placeholder="123456/SP" />
                </div>
                <div>
                  <Label>Finalidade (LGPD art. 11)</Label>
                  <Select value={purpose} onValueChange={setPurpose}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assistencia_direta">Assistência direta à saúde</SelectItem>
                      <SelectItem value="segunda_opiniao">Segunda opinião</SelectItem>
                      <SelectItem value="emergencia">Emergência</SelectItem>
                      <SelectItem value="continuidade_cuidado">Continuidade do cuidado</SelectItem>
                      <SelectItem value="auditoria">Auditoria clínica</SelectItem>
                      <SelectItem value="pesquisa">Pesquisa (com CEP/CONEP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Detalhes da finalidade</Label>
                <Textarea value={details} onChange={e => setDetails(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Recursos FHIR solicitados</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {RESOURCE_TYPES.map(rt => (
                    <Badge key={rt} variant={scopes.includes(rt) ? "default" : "outline"} className="cursor-pointer"
                      onClick={() => setScopes(s => s.includes(rt) ? s.filter(x => x !== rt) : [...s, rt])}>
                      {rt}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Mensagem ao paciente</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="Olá, somos do Hospital X e precisamos do seu histórico para a consulta de cardiologia em [data]." />
              </div>
              <Button onClick={submitRequest} disabled={submitting} className="w-full md:w-auto">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar pedido
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos" className="space-y-3">
          {requests.length === 0 && <p className="text-muted-foreground text-sm">Nenhum pedido ainda.</p>}
          {requests.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">Paciente: <span className="font-mono text-xs">{r.patient_id}</span></div>
                  <div className="text-muted-foreground">{r.purpose} · {r.resource_scopes.join(", ")} · validade {r.validity_days}d</div>
                  <div className="text-xs text-muted-foreground">Criado em {new Date(r.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <Badge variant={r.status === "aprovado" ? "default" : r.status === "recusado" ? "destructive" : "secondary"}>{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="grants" className="space-y-3">
          {grants.length === 0 && <p className="text-muted-foreground text-sm">Nenhum acesso ativo.</p>}
          {grants.map(g => (
            <Card key={g.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="text-sm space-y-1">
                  <div className="font-mono text-xs">{g.patient_id}</div>
                  <div className="text-muted-foreground">{g.resource_scopes.join(", ")} · {g.direction}</div>
                  <div className="text-xs text-muted-foreground">Expira em {new Date(g.expires_at).toLocaleString("pt-BR")}</div>
                </div>
                <Badge variant={g.revoked_at ? "destructive" : "default"}>{g.revoked_at ? "revogado" : "ativo"}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2">
          {audit.length === 0 && <p className="text-muted-foreground text-sm">Sem registros.</p>}
          {audit.map(a => (
            <div key={a.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
              <span className="font-mono text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
              {" — "}<span className="font-medium">{a.action}</span>
              {a.resource_type && <> · {a.resource_type}</>}
              {!a.success && <span className="text-destructive"> · {a.error_message}</span>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>Endpoints FHIR R4</CardTitle>
              <CardDescription>Use a chave de API fornecida no header <code>X-Api-Key</code>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong>POST</strong> <code className="bg-muted px-2 py-0.5 rounded">/functions/v1/fhir-ingest</code>
                <p className="text-muted-foreground">Envia Resource ou Bundle FHIR R4. <code>subject.identifier.value</code> = ID do paciente ValvePath.</p>
              </div>
              <div>
                <strong>GET</strong> <code className="bg-muted px-2 py-0.5 rounded">/functions/v1/fhir-read?patient=&lt;uuid&gt;&amp;type=Condition,Observation</code>
                <p className="text-muted-foreground">Retorna Bundle searchset com resumo do paciente.</p>
              </div>
              <p className="text-xs text-muted-foreground pt-2">As chaves são gerenciadas pelo time ValvePath. Solicite em <a href="mailto:valvepath@gmail.com" className="text-primary underline">valvepath@gmail.com</a>.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
