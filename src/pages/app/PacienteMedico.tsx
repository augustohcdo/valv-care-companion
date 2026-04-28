import { useEffect, useState } from "react";
import { Search, Stethoscope, MapPin, Building2, BadgeCheck, Link2, Unlink, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const UFs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface Doctor {
  id: string;
  user_id: string;
  crm: string;
  crm_uf: string;
  specialty: string;
  rqe: string | null;
  institution: string | null;
  city: string | null;
  bio: string | null;
  verified: boolean;
}

const PacienteMedico = () => {
  const { user } = useAuth();
  const [crm, setCrm] = useState("");
  const [uf, setUf] = useState("SP");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<(Doctor & { full_name: string })[]>([]);
  const [linking, setLinking] = useState(false);
  const [currentDoctor, setCurrentDoctor] = useState<(Doctor & { full_name: string }) | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  const loadCurrent = async () => {
    if (!user) return;
    const { data: pat } = await supabase
      .from("patients")
      .select("id, linked_doctor_id, linked_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!pat) return;
    setPatientId(pat.id);
    if (!pat.linked_doctor_id) {
      setCurrentDoctor(null);
      return;
    }
    const { data: doc } = await supabase
      .from("doctors")
      .select("*")
      .eq("id", pat.linked_doctor_id)
      .maybeSingle();
    if (!doc) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", doc.user_id)
      .maybeSingle();
    setCurrentDoctor({ ...(doc as any), full_name: prof?.full_name || "Médico(a)" });
  };

  useEffect(() => {
    loadCurrent();
  }, [user]);

  const search = async () => {
    if (!crm.trim()) {
      toast.error("Informe o CRM");
      return;
    }
    setSearching(true);
    setResults([]);
    const { data: docs } = await supabase
      .from("doctors")
      .select("*")
      .eq("crm_uf", uf)
      .ilike("crm", `%${crm.trim()}%`)
      .limit(10);

    if (!docs || docs.length === 0) {
      setSearching(false);
      toast.info("Nenhum médico encontrado com este CRM/UF");
      return;
    }

    const userIds = docs.map((d) => d.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const merged = docs.map((d) => ({
      ...(d as any),
      full_name: profs?.find((p) => p.user_id === d.user_id)?.full_name || "Médico(a)",
    }));
    setResults(merged);
    setSearching(false);
  };

  const link = async (doctor: Doctor) => {
    if (!patientId) {
      toast.error("Perfil de paciente não encontrado.");
      return;
    }
    setLinking(true);
    const { error } = await supabase
      .from("patients")
      .update({ linked_doctor_id: doctor.id, linked_at: new Date().toISOString() })
      .eq("id", patientId);
    setLinking(false);
    if (error) {
      toast.error("Não foi possível vincular", { description: error.message });
      return;
    }
    toast.success("Vínculo criado com sucesso");
    setResults([]);
    setCrm("");
    loadCurrent();
  };

  const unlink = async () => {
    if (!patientId) return;
    const { error } = await supabase
      .from("patients")
      .update({ linked_doctor_id: null, linked_at: null })
      .eq("id", patientId);
    if (error) {
      toast.error("Erro ao desvincular");
      return;
    }
    toast.success("Vínculo encerrado");
    loadCurrent();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vínculo médico"
        title="Meu médico"
        description="Vincule-se ao seu cardiologista buscando pelo CRM e UF. O vínculo permite o compartilhamento seguro de exames e o acompanhamento clínico contínuo."
      />

      {currentDoctor ? (
        <Card className="border-primary/30 shadow-sm-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-5 w-5 text-primary" /> Vínculo ativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center text-lg font-semibold shrink-0">
                {currentDoctor.full_name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground">Dr(a). {currentDoctor.full_name}</p>
                <p className="text-sm text-muted-foreground">{currentDoctor.specialty}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">CRM {currentDoctor.crm}/{currentDoctor.crm_uf}</Badge>
                  {currentDoctor.rqe && <Badge variant="outline" className="text-xs">RQE {currentDoctor.rqe}</Badge>}
                  {currentDoctor.verified && (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Verificado
                    </Badge>
                  )}
                </div>
                {currentDoctor.institution && (
                  <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {currentDoctor.institution}
                    {currentDoctor.city && <> • <MapPin className="h-3 w-3" /> {currentDoctor.city}</>}
                  </p>
                )}
                {currentDoctor.bio && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{currentDoctor.bio}</p>
                )}
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Unlink className="h-4 w-4" /> Encerrar vínculo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar vínculo médico?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você poderá criar um novo vínculo a qualquer momento. Os casos clínicos
                    já registrados pelo médico permanecerão em sua jornada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={unlink}>Encerrar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed shadow-sm-soft">
          <CardContent className="py-8 text-center">
            <Stethoscope className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Você ainda não está vinculado(a) a um cardiologista.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Buscar por CRM
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3">
            <div>
              <Label className="text-xs">Número do CRM</Label>
              <Input
                value={crm}
                onChange={(e) => setCrm(e.target.value)}
                placeholder="ex: 123456"
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UFs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:self-end">
              <Button onClick={search} disabled={searching} className="w-full">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>

          {results.length > 0 && (
            <ul className="divide-y divide-border border border-border rounded-lg">
              {results.map((d) => (
                <li key={d.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Dr(a). {d.full_name}</p>
                    <p className="text-xs text-muted-foreground">{d.specialty}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[10px]">CRM {d.crm}/{d.crm_uf}</Badge>
                      {d.institution && <Badge variant="outline" className="text-[10px]">{d.institution}</Badge>}
                      {d.verified && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          <ShieldCheck className="h-2.5 w-2.5 mr-1" /> Verificado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => link(d)}
                    disabled={linking || currentDoctor?.id === d.id}
                  >
                    {currentDoctor?.id === d.id ? (
                      <>já vinculado</>
                    ) : (
                      <><Link2 className="h-4 w-4" /> Vincular</>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="text-xs text-muted-foreground bg-secondary/40 p-3 rounded-lg border border-border">
            <strong className="text-foreground">Importante:</strong> O vínculo é uma autorização para
            que o médico acesse seus dados clínicos e documentos compartilhados nesta plataforma.
            Você pode encerrar a qualquer momento.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PacienteMedico;
