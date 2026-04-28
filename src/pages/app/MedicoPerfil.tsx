import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Stethoscope, ShieldCheck, Loader2 } from "lucide-react";

const UFs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function MedicoPerfil() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doctor, setDoctor] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [crm, setCrm] = useState("");
  const [crmUf, setCrmUf] = useState("SP");
  const [specialty, setSpecialty] = useState("");
  const [rqe, setRqe] = useState("");
  const [institution, setInstitution] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setDoctor(data);
        setCrm(data.crm || "");
        setCrmUf(data.crm_uf || "SP");
        setSpecialty(data.specialty || "");
        setRqe(data.rqe || "");
        setInstitution(data.institution || "");
        setCity(data.city || "");
        setBio(data.bio || "");
      }
      setFullName(profile?.full_name || "");
      setPhone(profile?.phone || "");
      setLoading(false);
    })();
  }, [user, profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      const { error: dErr } = await supabase
        .from("doctors")
        .update({ crm, crm_uf: crmUf, specialty, rqe, institution, city, bio })
        .eq("user_id", user.id);
      if (dErr) throw dErr;

      await refreshProfile();
      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Configurações</p>
        <h1 className="font-serif text-3xl lg:text-4xl text-primary mt-1 flex items-center gap-3">
          <Stethoscope className="h-7 w-7" /> Perfil profissional
        </h1>
        <p className="text-muted-foreground mt-1">
          Dados profissionais visíveis para pacientes que se vinculam ao seu CRM.
        </p>
      </div>

      {doctor && (
        <div className="flex items-center gap-2">
          <Badge variant={doctor.verified ? "default" : "secondary"} className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {doctor.verified ? "CRM verificado" : "Verificação pendente"}
          </Badge>
          {!doctor.verified && (
            <span className="text-xs text-muted-foreground">
              Para acelerar, escreva para valvepath@gmail.com
            </span>
          )}
        </div>
      )}

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-lg">Dados pessoais</CardTitle>
          <CardDescription>Como você aparece no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Telefone (opcional)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-lg">Registro profissional</CardTitle>
          <CardDescription>CRM, especialidade e atuação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="crm">CRM</Label>
              <Input id="crm" value={crm} onChange={(e) => setCrm(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <Label htmlFor="uf">UF</Label>
              <select
                id="uf"
                value={crmUf}
                onChange={(e) => setCrmUf(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {UFs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="specialty">Especialidade</Label>
            <Input id="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex.: Cardiologia" />
          </div>
          <div>
            <Label htmlFor="rqe">RQE (opcional)</Label>
            <Input id="rqe" value={rqe} onChange={(e) => setRqe(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-lg">Atuação</CardTitle>
          <CardDescription>Local de prática e biografia profissional</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="institution">Instituição</Label>
            <Input id="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Hospital, clínica…" />
          </div>
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bio">Biografia profissional</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Formação, áreas de interesse, atuação clínica…"
            />
            <p className="text-xs text-muted-foreground mt-1">Visível para pacientes vinculados ao seu CRM.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
