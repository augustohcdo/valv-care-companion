import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Beaker, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SAMPLE_OBS = (patientId: string) => JSON.stringify({
  resourceType: "Observation",
  status: "final",
  subject: { identifier: { value: patientId } },
  code: { text: "Ecocardiograma — Gradiente médio aórtico" },
  valueQuantity: { value: 42, unit: "mmHg" },
  effectiveDateTime: new Date().toISOString().slice(0, 10),
}, null, 2);

const FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export default function FhirSandbox() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [patientId, setPatientId] = useState("");
  const [body, setBody] = useState("");
  const [readTypes, setReadTypes] = useState("Condition,Observation,MedicationStatement");
  const [response, setResponse] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
    })();
  }, [user]);

  if (loading || isAdmin === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/app/medico" replace />;

  const runIngest = async () => {
    setBusy(true); setResponse("");
    try {
      const res = await fetch(`${FN_BASE}/fhir-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: body || SAMPLE_OBS(patientId),
      });
      setResponse(`HTTP ${res.status}\n` + JSON.stringify(await res.json(), null, 2));
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const runRead = async () => {
    setBusy(true); setResponse("");
    try {
      const res = await fetch(`${FN_BASE}/fhir-read?patient=${patientId}&type=${encodeURIComponent(readTypes)}`, {
        headers: { "x-api-key": apiKey },
      });
      setResponse(`HTTP ${res.status}\n` + JSON.stringify(await res.json(), null, 2));
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Beaker className="h-7 w-7 text-primary" /> Sandbox FHIR</h1>
        <p className="text-muted-foreground">Teste os endpoints com uma chave de API real e um paciente com grant ativo.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle><CardDescription>Use chave emitida em Admin → API Keys.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>X-Api-Key</Label><Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="vp_xxxxxxxx_..." /></div>
          <div><Label>Patient ID (UUID)</Label><Input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="00000000-..." /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ingest" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ingest">POST fhir-ingest</TabsTrigger>
          <TabsTrigger value="read">GET fhir-read</TabsTrigger>
        </TabsList>

        <TabsContent value="ingest">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label>Body (FHIR Resource ou Bundle JSON)</Label>
              <Textarea rows={14} className="font-mono text-xs" value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={patientId ? SAMPLE_OBS(patientId) : "Defina o Patient ID acima para gerar exemplo"} />
              <Button onClick={runIngest} disabled={busy || !apiKey || !patientId}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Enviar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="read">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label>Tipos (vírgula)</Label>
              <Input value={readTypes} onChange={e => setReadTypes(e.target.value)} />
              <Button onClick={runRead} disabled={busy || !apiKey || !patientId}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Buscar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {response && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resposta</CardTitle></CardHeader>
          <CardContent>
            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-[500px]">{response}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
