import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Globe, Loader2, Plus, Pencil, Power, PowerOff, AlertTriangle, Search,
} from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { aplicar } from "@/lib/mutate";

/**
 * Onde a IA pode pesquisar — e, em cada fonte, o que ela pode embasar.
 *
 * A tela existe porque a lista só entrava por SQL. E ela mostra uma distinção
 * que a lista precisou ganhar antes de virar tela: das fontes cadastradas, só
 * as marcadas como **consulta automática** são de fato buscadas. As demais são
 * fontes que a IA aceita e cita, e que o produto declara como sua base — mas
 * que não são varridas sozinhas. Uma tela chamada "onde a IA pesquisa" listando
 * catorze lugares que ela não pesquisa seria a promessa vazia de sempre.
 */

export type Fonte = {
  id: string;
  domain: string;
  name: string;
  category: "sociedade_medica" | "orgao_publico" | "literatura" | "fabricante";
  citable_for: string;
  never_for: string | null;
  consulta: "automatica" | "referencia";
  enabled: boolean;
  notes: string | null;
};

export const adminFontesKey = () => ["admin-fontes"] as const;

const CATEGORIA_ROTULO: Record<Fonte["category"], string> = {
  sociedade_medica: "Sociedade médica",
  orgao_publico: "Órgão público",
  literatura: "Base de literatura",
  fabricante: "Fabricante",
};

const CATEGORIA_COR: Record<Fonte["category"], string> = {
  sociedade_medica: "bg-primary/10 text-primary border-primary/30",
  orgao_publico: "bg-accent/10 text-accent-foreground border-accent/30",
  literatura: "bg-success/10 text-success border-success/30",
  fabricante: "bg-warning/10 text-warning border-warning/30",
};

/**
 * O admin cola a URL inteira; o banco guarda o host.
 *
 * Guardar "https://www.escardio.org/" onde a cerca compara "www.escardio.org"
 * faria a fonte nunca casar — e a falha seria silenciosa, do jeito mais chato:
 * a fonte apareceria cadastrada e nunca seria reconhecida.
 */
export function normalizarDominio(entrada: string): string | null {
  const t = entrada.trim().toLowerCase();
  if (!t) return null;
  try {
    return new URL(t.includes("://") ? t : `https://${t}`).hostname;
  } catch {
    return null;
  }
}

export interface FormularioFonte {
  domain: string;
  name: string;
  category: Fonte["category"];
  citable_for: string;
  never_for: string;
  consulta: Fonte["consulta"];
  notes: string;
}

/**
 * A primeira recusa, ou `null` quando está tudo bom.
 *
 * Fica fora do componente para poder ser testada como regra, não como
 * coreografia de formulário — a validação que importa aqui é clínica, não de
 * interface.
 */
export function validarFonte(f: FormularioFonte): { erro: string; detalhe?: string } | null {
  if (!normalizarDominio(f.domain)) {
    return { erro: "Domínio inválido", detalhe: "Cole o endereço do site, ex.: www.escardio.org" };
  }
  if (!f.name.trim()) return { erro: "Informe o nome da fonte" };
  if (!f.citable_for.trim()) {
    return {
      erro: "Diga o que esta fonte pode embasar",
      detalhe: "Sem isso, 'fonte confiável' vira carimbo que atravessa qualquer pergunta.",
    };
  }
  // Fabricante é a categoria com conflito de interesse por definição: ele vende
  // a prótese sobre a qual informa. Sem o limite escrito, a página dele
  // embasaria indicação.
  if (f.category === "fabricante" && !f.never_for.trim()) {
    return {
      erro: "Fabricante precisa do limite escrito",
      detalhe: "Diga o que a fonte NÃO pode embasar — indicação e comparação entre marcas, no mínimo.",
    };
  }
  return null;
}

const VAZIO = {
  domain: "", name: "", category: "sociedade_medica" as Fonte["category"],
  citable_for: "", never_for: "", consulta: "referencia" as Fonte["consulta"],
  notes: "",
};

export default function AdminFontes() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Fonte | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const { data: fontes = [], isLoading } = useQuery({
    queryKey: adminFontesKey(),
    queryFn: async (): Promise<Fonte[]> => {
      const { data, error } = await supabase
        .from("trusted_sources")
        .select("id, domain, name, category, citable_for, never_for, consulta, enabled, notes")
        .order("category")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Fonte[];
    },
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: adminFontesKey() });

  const automaticasAtivas = fontes.filter((f) => f.enabled && f.consulta === "automatica");

  const abrirNova = () => { setEditando(null); setForm(VAZIO); setAberto(true); };

  const abrirEdicao = (f: Fonte) => {
    setEditando(f);
    setForm({
      domain: f.domain, name: f.name, category: f.category,
      citable_for: f.citable_for, never_for: f.never_for ?? "",
      consulta: f.consulta, notes: f.notes ?? "",
    });
    setAberto(true);
  };

  const salvar = async () => {
    const recusa = validarFonte(form);
    if (recusa) {
      toast.error(recusa.erro, recusa.detalhe ? { description: recusa.detalhe } : undefined);
      return;
    }
    const domain = normalizarDominio(form.domain)!;

    const payload = {
      domain, name: form.name.trim(), category: form.category,
      citable_for: form.citable_for.trim(),
      never_for: form.never_for.trim() || null,
      consulta: form.consulta,
      notes: form.notes.trim() || null,
    };

    setSalvando(true);
    const ok = editando
      ? await aplicar(
          supabase.from("trusted_sources").update(payload).eq("id", editando.id).select("id"),
          { sucesso: "Fonte atualizada", falha: "Não foi possível atualizar a fonte" },
        )
      : await aplicar(
          supabase.from("trusted_sources").insert(payload).select("id"),
          { sucesso: "Fonte cadastrada", falha: "Não foi possível cadastrar a fonte" },
        );
    setSalvando(false);
    if (!ok) return;

    logAudit(
      editando ? "trusted_source_updated" : "trusted_source_created",
      "trusted_sources", editando?.id ?? domain, { domain, consulta: form.consulta },
    );
    setAberto(false);
    recarregar();
  };

  const alternar = async (f: Fonte) => {
    // Desligar a última fonte automática desliga a busca de literatura inteira.
    // O aviso vem antes: depois, o sintoma seria "não encontrei artigo", que é
    // indistinguível de uma busca sem resultado.
    if (f.enabled && f.consulta === "automatica" && automaticasAtivas.length === 1) {
      const confirmar = window.confirm(
        `"${f.name}" é a única fonte de busca automática ativa.\n\n` +
        "Desligá-la desativa a consulta à literatura para todos os médicos: o painel " +
        "passará a avisar que a busca está desligada.\n\nDesligar mesmo assim?",
      );
      if (!confirmar) return;
    }
    const ok = await aplicar(
      supabase.from("trusted_sources").update({ enabled: !f.enabled }).eq("id", f.id).select("id"),
      {
        sucesso: f.enabled ? "Fonte desativada" : "Fonte reativada",
        falha: "Não foi possível alterar a fonte",
      },
    );
    if (!ok) return;
    logAudit("trusted_source_toggled", "trusted_sources", f.id, {
      domain: f.domain, enabled: !f.enabled,
    });
    recarregar();
  };

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? fontes.filter((f) => [f.domain, f.name, f.citable_for].some((v) => v?.toLowerCase().includes(termo)))
    : fontes;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe className="h-7 w-7 text-primary" /> Fontes da IA
        </h1>
        <p className="text-muted-foreground">
          A pesquisa da IA só alcança o que está nesta lista. Cada fonte declara o que pode e o
          que não pode embasar.
        </p>
      </header>

      {automaticasAtivas.length === 0 && !isLoading && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            <strong>Nenhuma fonte de busca automática está ativa.</strong> A consulta à literatura
            está desligada para todos os médicos.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="Buscar por domínio, nome ou escopo"
            value={busca} onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button onClick={abrirNova}><Plus className="h-4 w-4" /> Nova fonte</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar fonte" : "Nova fonte confiável"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Endereço do site</Label>
                <Input
                  value={form.domain}
                  onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                  placeholder="www.escardio.org"
                  className="mt-1.5"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Pode colar a URL inteira — guardamos só o domínio, que é o que a cerca compara.
                </p>
              </div>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="European Society of Cardiology"
                  className="mt-1.5"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v as Fonte["category"] }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIA_ROTULO).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Como é consultada</Label>
                  <Select
                    value={form.consulta}
                    onValueChange={(v) => setForm((f) => ({ ...f, consulta: v as Fonte["consulta"] }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="referencia">Aceita como referência</SelectItem>
                      <SelectItem value="automatica">Busca automática</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    "Busca automática" só funciona para fontes com caminho de busca implementado —
                    hoje, apenas o PubMed.
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs">O que esta fonte PODE embasar</Label>
                <Textarea
                  value={form.citable_for}
                  onChange={(e) => setForm((f) => ({ ...f, citable_for: e.target.value }))}
                  className="mt-1.5 min-h-[70px]"
                  placeholder="Ex.: diretriz de doença valvar e documentos de consenso da sociedade."
                />
              </div>
              <div>
                <Label className="text-xs">
                  O que ela NÃO pode embasar
                  {form.category === "fabricante" && <span className="text-destructive"> *</span>}
                </Label>
                <Textarea
                  value={form.never_for}
                  onChange={(e) => setForm((f) => ({ ...f, never_for: e.target.value }))}
                  className="mt-1.5 min-h-[70px]"
                  placeholder="Ex.: nunca para indicação, comparação entre marcas ou desfecho clínico."
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Confiável não é propriedade do site, é do par (site, pergunta). O fabricante é a
                  melhor fonte para o tamanho do próprio anel e a pior para decidir a conduta.
                </p>
              </div>
              <div>
                <Label className="text-xs">Observações (opcional)</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma fonte encontrada.</p>
      ) : (
        <ul className="space-y-3">
          {filtradas.map((f) => (
            <li key={f.id}>
              <Card className={f.enabled ? "" : "opacity-60"}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.domain}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={CATEGORIA_COR[f.category]}>
                        {CATEGORIA_ROTULO[f.category]}
                      </Badge>
                      {f.consulta === "automatica" ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          busca automática
                        </Badge>
                      ) : (
                        <Badge variant="outline">aceita como referência</Badge>
                      )}
                      {!f.enabled && <Badge variant="outline">desativada</Badge>}
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    <p><span className="text-muted-foreground">Pode embasar:</span> {f.citable_for}</p>
                    {f.never_for && (
                      <p className="text-warning">
                        <span className="text-muted-foreground">Não pode:</span> {f.never_for}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => abrirEdicao(f)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => alternar(f)}>
                      {f.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      {f.enabled ? "Desativar" : "Reativar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        A pesquisa da IA nunca alcança domínio fora desta lista — a cerca é a origem da busca, não
        um filtro aplicado depois. Alterações ficam registradas na trilha de auditoria.
      </p>
    </div>
  );
}
