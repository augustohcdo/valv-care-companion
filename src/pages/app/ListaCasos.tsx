import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, SlidersHorizontal, X, Download, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/DemoBadge";
import { ehDemo } from "@/lib/demo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  valveTypeLabels,
  valveDiseaseLabels,
  severityLabels,
  severityColors,
  caseStatusLabels,
  nyhaLabels,
} from "@/lib/clinicalLabels";
import { queueCsvExport } from "@/lib/exporters";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

const ALL = "__all__";

export default function ListaCasos() {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  /**
   * `null` = ninguém conseguiu ler quais casos têm ação pendente.
   *
   * O terceiro estado de sempre: `new Set()` diz "conferi e não há nenhum", e
   * as duas coisas apareciam iguais na tela — o botão "Pendentes" simplesmente
   * não era desenhado. Alerta que some em silêncio é pior que alerta errado.
   */
  const [pendingIds, setPendingIds] = useState<Set<string> | null>(new Set());
  const [erroCasos, setErroCasos] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [valve, setValve] = useState<string>(ALL);
  const [severity, setSeverity] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [nyha, setNyha] = useState<string>(ALL);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("recent");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data, error: erroLista }, { data: pend, error: erroPendencias }] = await Promise.all([
        supabase.from("clinical_cases").select("*").is("deleted_at", null).neq("status", "draft" as any).order("created_at", { ascending: false }),
        supabase.rpc("cases_pending_action", { _doctor_user_id: user.id }),
      ]);
      // As duas falhas são independentes e têm consequências diferentes: sem a
      // lista, a tela dizia "Nenhum caso registrado" a um médico com casos;
      // sem as pendências, a faixa de ação pendente sumia sem uma palavra.
      setErroCasos(erroLista ? (erroLista.message ?? "falha ao ler os casos") : null);
      setCases(erroLista ? [] : data || []);
      setPendingIds(erroPendencias ? null : new Set(((pend as any[]) || []).map((p) => p.case_id)));
      setLoading(false);
    })();
  }, [user]);

  const activeFilters =
    (valve !== ALL ? 1 : 0) +
    (severity !== ALL ? 1 : 0) +
    (status !== ALL ? 1 : 0) +
    (nyha !== ALL ? 1 : 0);

  const clearFilters = () => {
    setValve(ALL);
    setSeverity(ALL);
    setStatus(ALL);
    setNyha(ALL);
  };

  const filtered = useMemo(() => {
    const list = cases.filter((c) => {
      if (q.trim() && !c.patient_name?.toLowerCase().includes(q.toLowerCase())) return false;
      if (valve !== ALL && c.valve_type !== valve) return false;
      if (severity !== ALL && c.severity !== severity) return false;
      if (status !== ALL && c.status !== status) return false;
      if (nyha !== ALL && c.nyha !== nyha) return false;
      if (pendingOnly && !pendingIds?.has(c.id)) return false;
      return true;
    });

    const severityOrder: Record<string, number> = {
      critica: 0, importante: 1, moderada: 2, leve: 3, indeterminada: 4,
    };

    if (sortBy === "recent") {
      list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else if (sortBy === "name") {
      list.sort((a, b) => a.patient_name.localeCompare(b.patient_name));
    } else if (sortBy === "severity") {
      list.sort(
        (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
      );
    }

    return list;
  }, [cases, q, valve, severity, status, nyha, pendingOnly, pendingIds, sortBy]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Casos clínicos"
        title="Meus casos"
        description="Avaliações valvares registradas. Use filtros para localizar pacientes específicos rapidamente."
        breadcrumbs={[{ label: "Início", to: "/app/medico" }, { label: "Casos" }]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (filtered.length === 0) {
                  toast.info("Nenhum caso para exportar");
                  return;
                }
                const stamp = new Date().toISOString().slice(0, 10);
                queueCsvExport({
                  label: `CSV — ${filtered.length} caso(s)`,
                  filename: `casos-clinicos-${stamp}.csv`,
                  cases: filtered as any,
                });
                toast.message("CSV enfileirado", { description: "Acompanhe na barra de exportações." });
              }}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button asChild>
              <Link to="/app/medico/casos/novo"><Plus className="h-4 w-4" /> Novo caso</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-3 mb-5">
        {/* Quick status chips */}
        {cases.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatus(ALL)}
              className={`h-auto gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${status === ALL ? "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90" : "bg-card hover:bg-muted border-border text-muted-foreground hover:text-foreground"}`}
            >
              Todos <span className="tabular-nums opacity-70">({cases.length})</span>
            </Button>
            {(["avaliacao_inicial", "em_seguimento", "pre_intervencao", "pos_intervencao"] as const).map((s) => {
              const count = cases.filter((c) => c.status === s).length;
              if (count === 0) return null;
              const active = status === s;
              return (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  onClick={() => setStatus(active ? ALL : s)}
                  className={`h-auto gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${active ? "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90" : "bg-card hover:bg-muted border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {caseStatusLabels[s]} <span className="tabular-nums opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do paciente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters || activeFilters > 0 ? "default" : "outline"}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {activeFilters > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                {activeFilters}
              </Badge>
            )}
          </Button>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="name">Nome (A–Z)</SelectItem>
              <SelectItem value="severity">Severidade ↓</SelectItem>
            </SelectContent>
          </Select>
          {pendingIds === null && (
            <span className="inline-flex items-center gap-1.5 text-xs text-warning px-3 py-1.5 rounded-md border border-warning/40 bg-warning/5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Não foi possível checar quais casos têm ação pendente
            </span>
          )}
          {pendingIds !== null && pendingIds.size > 0 && (
            <Button
              variant={pendingOnly ? "default" : "outline"}
              onClick={() => setPendingOnly((v) => !v)}
              className="gap-1.5"
            >
              <AlertTriangle className="h-4 w-4" /> Pendentes
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                {pendingIds.size}
              </Badge>
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="shadow-sm-soft">
            <CardContent className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valva</label>
                <Select value={valve} onValueChange={setValve}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {Object.entries(valveTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Severidade</label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {Object.entries(severityLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {Object.entries(caseStatusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Classe NYHA</label>
                <Select value={nyha} onValueChange={setNyha}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {Object.entries(nyhaLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeFilters > 0 && (
                <div className="lg:col-span-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4" /> Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {cases.length} {cases.length === 1 ? "caso" : "casos"}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando casos...</p>
      ) : erroCasos ? (
        /* Sem isto, a falha de leitura caía no `cases.length === 0` abaixo e a
           tela afirmava "Nenhum caso registrado" — e ainda convidava a criar o
           primeiro — a um médico que tem casos e não conseguiu vê-los. */
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <h3 className="font-serif text-lg text-foreground mb-2">
              Não foi possível carregar seus casos
            </h3>
            <p className="text-sm text-foreground/85 max-w-md mx-auto leading-relaxed">
              Isto é uma falha de leitura, não a ausência de casos. Nada foi
              apagado. Recarregue a página; se continuar, avise o suporte.
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-3">{erroCasos}</p>
          </CardContent>
        </Card>
      ) : cases.length === 0 ? (
        <Card className="shadow-sm-soft">
          <CardContent className="p-10 text-center">
            <div className="h-14 w-14 rounded-xl bg-secondary mx-auto mb-4 grid place-items-center">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-xl text-primary mb-2">Nenhum caso registrado</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Comece registrando seu primeiro caso clínico em 3 passos rápidos.
            </p>
            <Button asChild>
              <Link to="/app/medico/casos/novo"><Plus className="h-4 w-4" /> Criar primeiro caso</Link>
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum caso encontrado"
          description="Nenhum caso corresponde aos filtros aplicados."
          action={{ label: "Limpar filtros", onClick: clearFilters }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((c, idx) => (
            <Link
              key={c.id}
              to={`/app/medico/casos/${c.id}`}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms`, animationFillMode: "backwards" }}
            >
              <Card className="relative overflow-hidden shadow-sm-soft hover:shadow-md-soft transition-all duration-300 hover:-translate-y-0.5 group border-border/50 hover:border-primary/40">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${pendingIds?.has(c.id) ? "bg-amber-400" : "bg-transparent group-hover:bg-primary"} transition-colors`} />
                <CardContent className="p-5 pl-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif text-lg text-primary truncate group-hover:underline underline-offset-4">{c.patient_name}</h3>
                      {c.patient_age && <span className="text-xs text-muted-foreground">{c.patient_age} anos</span>}
                      {ehDemo(c) && <DemoBadge />}
                      {pendingIds?.has(c.id) && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Ação pendente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {valveTypeLabels[c.valve_type]} — {valveDiseaseLabels[c.valve_disease]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Registrado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 items-center">
                    <Badge className={severityColors[c.severity]} variant="outline">
                      {severityLabels[c.severity]}
                    </Badge>
                    <Badge variant="secondary">{caseStatusLabels[c.status]}</Badge>
                    {c.nyha && <Badge variant="outline">NYHA {c.nyha}</Badge>}
                    <span className="hidden sm:inline text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1">→</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
