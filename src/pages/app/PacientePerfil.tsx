import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { User, Loader2 } from "lucide-react";
import { commonComorbidities } from "@/lib/clinicalLabels";

const UFs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function PacientePerfil() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<string>("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("SP");
  const [comorbidities, setComorbidities] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: pat }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("patients").select("*").is("deleted_at", null).eq("user_id", user.id).maybeSingle(),
      ]);
      if (prof) {
        setFullName(prof.full_name || "");
        setPhone(prof.phone || "");
        setBirthDate(prof.birth_date || "");
      }
      if (pat) {
        setSex(pat.sex || "");
        setCity(pat.city || "");
        setUf(pat.uf || "SP");
        setComorbidities(pat.comorbidities || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const toggleComorbidity = (c: string) => {
    setComorbidities((prev) => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, birth_date: birthDate || null })
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      const { error: patErr } = await supabase
        .from("patients")
        .update({ sex: sex || null, city, uf, comorbidities })
        .eq("user_id", user.id);
      if (patErr) throw patErr;

      await refreshProfile();
      toast({ title: "Perfil atualizado", description: "Seus dados foram salvos." });
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
          <User className="h-7 w-7" /> Meu perfil
        </h1>
        <p className="text-muted-foreground mt-1">
          Mantenha seus dados atualizados para o melhor acompanhamento.
        </p>
      </div>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-lg">Dados pessoais</CardTitle>
          <CardDescription>Suas informações básicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label htmlFor="birthDate">Data de nascimento</Label>
              <Input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sex">Sexo</Label>
              <select
                id="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="sm:col-span-2 grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="uf">UF</Label>
                <select
                  id="uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {UFs.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-lg">Histórico de saúde</CardTitle>
          <CardDescription>
            Comorbidades — informação visível ao seu médico vinculado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {commonComorbidities.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 px-2 py-1.5 rounded-md">
                <Checkbox checked={comorbidities.includes(c)} onCheckedChange={() => toggleComorbidity(c)} />
                {c}
              </label>
            ))}
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
