import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin, Building2, BadgeCheck, Send, ChevronRight, ChevronLeft,
  Loader2, SearchX, Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePatient } from "@/hooks/usePatient";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UF_LIST } from "@/lib/validators";
import { logAudit } from "@/lib/auditLog";

/**
 * O paciente encontra o profissional — um de cada vez, sem classificação.
 *
 * É um **diretório com filtros**, não um ranking, e a diferença não é de
 * estilo: a Resolução CFM nº 2.336/2023 veda "melhor médico", "destaque da
 * especialidade" e títulos com foco promocional. Por isso não há nota,
 * estrela, ordenação por mérito nem contagem de pacientes.
 *
 * A ordem vem do servidor (pelo id, que não diz nada sobre o profissional) e é
 * embaralhada por uma semente estável do paciente: assim dois pacientes não
 * veem sempre a mesma pessoa primeiro, e o mesmo paciente não vê a lista
 * saltando a cada recarga.
 */

export const diretorioKey = (esp: string, uf: string, busca: string) =>
  ["diretorio-medicos", esp, uf, busca] as const;
export const meusPedidosKey = (patientId?: string) => ["meus-pedidos-vinculo", patientId] as const;

const ESPECIALIDADES = [
  "Cardiologia clínica",
  "Cirurgia cardiovascular",
  "Hemodinâmica e cardiologia intervencionista",
  "Ecocardiografia",
  "Cardiologia pediátrica",
  "Clínica médica",
];

const TODAS = "__todas__";

/** Semente estável a partir do id do paciente — não é aleatório a cada render. */
function embaralharEstavel<T extends { doctor_id: string }>(lista: T[], semente: string): T[] {
  const chave = (id: string) => {
    let h = 0;
    for (const c of semente + id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
  };
  return [...lista].sort((a, b) => chave(a.doctor_id) - chave(b.doctor_id));
}

export default function PacienteEncontrar() {
  const queryClient = useQueryClient();
  const { data: patient } = usePatient();
  const patientId = (patient?.id as string | undefined) ?? undefined;

  const [especialidade, setEspecialidade] = useState(TODAS);
  const [uf, setUf] = useState(TODAS);
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { data: medicos = [], isLoading } = useQuery({
    queryKey: diretorioKey(especialidade, uf, busca),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("diretorio_medicos", {
        _especialidade: especialidade === TODAS ? undefined : especialidade,
        _uf: uf === TODAS ? undefined : uf,
        _busca: busca.trim() || undefined,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: meusPedidosKey(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_link_requests")
        .select("doctor_id, status")
        .eq("patient_id", patientId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const ordenados = useMemo(
    () => embaralharEstavel(medicos, patientId ?? "sem-paciente"),
    [medicos, patientId],
  );
  const atual = ordenados[indice];
  const jaPedido = pedidos.find((p) => p.doctor_id === atual?.doctor_id);

  const avancar = (passo: number) => {
    setIndice((i) => Math.min(Math.max(i + passo, 0), Math.max(ordenados.length - 1, 0)));
    setMensagem("");
  };

  const pedir = async () => {
    if (!patientId || !atual) return;
    setEnviando(true);
    const { error } = await supabase.from("patient_link_requests").insert({
      patient_id: patientId, doctor_id: atual.doctor_id, mensagem: mensagem.trim() || null,
    });
    setEnviando(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "Você já tem um pedido pendente com este profissional"
                               : "Não foi possível enviar o pedido",
        { description: error.code === "23505" ? undefined : error.message },
      );
      return;
    }
    toast.success("Pedido enviado", {
      description: "O profissional precisa aceitar para o vínculo começar.",
    });
    logAudit("patient_link_requested", "patient_link_requests", patientId, { doctor_id: atual.doctor_id });
    queryClient.invalidateQueries({ queryKey: meusPedidosKey(patientId) });
    avancar(1);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Encontrar profissional"
        title="Profissionais no ValvePath"
        description="Quem já atende você, ou quem você ainda vai conhecer. O vínculo só começa quando o profissional aceita."
      />

      <Card className="shadow-sm-soft">
        <CardContent className="p-4 grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Especialidade</Label>
            <Select value={especialidade} onValueChange={(v) => { setEspecialidade(v); setIndice(0); }}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas</SelectItem>
                {ESPECIALIDADES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">UF do CRM</Label>
            <Select value={uf} onValueChange={(v) => { setUf(v); setIndice(0); }}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas</SelectItem>
                {UF_LIST.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nome, cidade ou instituição</Label>
            <Input value={busca} onChange={(e) => { setBusca(e.target.value); setIndice(0); }}
              className="mt-1.5" placeholder="Se já conhece, busque pelo nome" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </p>
      ) : ordenados.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          <SearchX className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum profissional com esses filtros.
        </CardContent></Card>
      ) : atual ? (
        <>
          <Card className="shadow-md-soft border-primary/25">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center text-xl font-semibold shrink-0">
                  {atual.nome.split(" ").slice(0, 2).map((p: string) => p[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl text-primary">Dr(a). {atual.nome}</h2>
                  <p className="text-sm text-muted-foreground">{atual.especialidade ?? "Médico(a)"}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      CRM {atual.crm}/{atual.crm_uf}
                    </Badge>
                    {atual.rqe && <Badge variant="outline" className="text-xs">RQE {atual.rqe}</Badge>}
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      <BadgeCheck className="h-3 w-3 mr-1" /> CRM conferido
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {atual.cidade && (
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{atual.cidade}</span>
                )}
                {atual.instituicao && (
                  <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{atual.instituicao}</span>
                )}
              </div>

              {atual.bio && (
                <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/40 rounded-lg p-3">
                  {atual.bio}
                </p>
              )}

              {jaPedido ? (
                <p className="text-sm text-muted-foreground">
                  {jaPedido.status === "pendente" && "Pedido enviado — aguardando a resposta do profissional."}
                  {jaPedido.status === "aceito" && "Vínculo ativo com este profissional."}
                  {jaPedido.status === "recusado" && "Este profissional não aceitou o pedido."}
                  {jaPedido.status === "cancelado" && "Vínculo anterior encerrado."}
                </p>
              ) : atual.aceita_novos_pacientes === false ? (
                <p className="text-sm text-muted-foreground">
                  Este profissional não está aceitando novos pacientes no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)}
                    className="min-h-[70px] text-sm"
                    placeholder="Escreva uma mensagem (opcional): desde quando é seu médico, o que está buscando..." />
                  <Button onClick={pedir} disabled={enviando || !patientId} className="w-full">
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar pedido de vínculo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={indice === 0} onClick={() => avancar(-1)}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {indice + 1} de {ordenados.length}
            </span>
            <Button variant="outline" size="sm"
              disabled={indice >= ordenados.length - 1} onClick={() => avancar(1)}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : null}

      <Card className="border-border/60 bg-secondary/30">
        <CardContent className="p-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Todos os profissionais aqui tiveram o CRM conferido pela equipe do ValvePath e
            escolheram aparecer nesta lista. Não há classificação, nota ou ordem de
            preferência entre eles — a ordem é neutra e a escolha é sua.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
