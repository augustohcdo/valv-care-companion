import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useDoctor, doctorKey } from "@/hooks/useDoctor";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Stethoscope, ShieldCheck, Loader2 } from "lucide-react";

const UFs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function MedicoPerfil() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data: doctor, isLoading: loading } = useDoctor();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [crm, setCrm] = useState("");
  const [crmUf, setCrmUf] = useState("SP");
  const [specialty, setSpecialty] = useState("");
  const [rqe, setRqe] = useState("");
  const [institution, setInstitution] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [noDiretorio, setNoDiretorio] = useState(true);
  const [aceitaNovos, setAceitaNovos] = useState(true);

  // Preenche o formulário quando os dados chegam. Isto é sincronização de
  // formulário, não busca de dados — continua num efeito de propósito.
  /* eslint-disable react-hooks/set-state-in-effect -- sincronização de formulário com dado assíncrono: é o caso legítimo desta regra */
  useEffect(() => {
    if (doctor) {
      setCrm(doctor.crm || "");
      setCrmUf(doctor.crm_uf || "SP");
      setSpecialty(doctor.specialty || "");
      setRqe(doctor.rqe || "");
      setInstitution(doctor.institution || "");
      setCity(doctor.city || "");
      setBio(doctor.bio || "");
      setNoDiretorio(doctor.no_diretorio !== false);
      setAceitaNovos(doctor.aceita_novos_pacientes !== false);
    }
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
  }, [doctor, profile]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        .update({
          crm, crm_uf: crmUf, specialty, rqe, institution, city, bio,
          no_diretorio: noDiretorio, aceita_novos_pacientes: aceitaNovos,
        })
        .eq("user_id", user.id);
      if (dErr) throw dErr;

      await refreshProfile();
      // sem isto o selo de verificação e o CRM continuariam vindo do cache
      queryClient.invalidateQueries({ queryKey: doctorKey(user.id) });
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
            <p className="text-xs text-muted-foreground mt-1">
              Visível no diretório de profissionais e para pacientes vinculados a você.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-lg">Diretório de profissionais</CardTitle>
          <CardDescription>Como você aparece para os pacientes do ValvePath</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* A anuência foi dada na solicitação de acesso — e é revogável.
              Consentimento que não pode ser retirado não é consentimento
              (LGPD art. 8º §5º), e a anuência de publicidade médica da
              Resolução CFM nº 2.336/2023 também se retira. */}
          <div className="flex items-start gap-3">
            <Checkbox id="no_diretorio" checked={noDiretorio} className="mt-0.5"
              onCheckedChange={(v) => setNoDiretorio(v === true)} />
            <label htmlFor="no_diretorio" className="text-sm leading-relaxed cursor-pointer">
              <span className="font-medium text-foreground">Aparecer no diretório</span>
              <span className="block text-muted-foreground">
                Pacientes com conta veem seu nome, CRM/UF, RQE, especialidade, cidade,
                instituição e sua biografia, e podem enviar pedido de vínculo. Não há
                nota, estrela nem classificação entre profissionais. Desmarcar tira você
                da lista; os vínculos que já existem continuam.
              </span>
            </label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="aceita_novos" checked={aceitaNovos} className="mt-0.5"
              onCheckedChange={(v) => setAceitaNovos(v === true)} />
            <label htmlFor="aceita_novos" className="text-sm leading-relaxed cursor-pointer">
              <span className="font-medium text-foreground">Aceitando novos pacientes</span>
              <span className="block text-muted-foreground">
                Desmarcado, você continua no diretório mas a tela avisa que não está
                recebendo pedidos no momento.
              </span>
            </label>
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
