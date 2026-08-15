import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, FlaskConical, Loader2, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  valveTypeLabels, valveDiseaseLabels, severityLabels, nyhaLabels,
  commonSymptoms, commonComorbidities,
} from "@/lib/clinicalLabels";
import {
  MEDIDAS, validarMedida, paraBanco, diferencas, doExameParaFormulario,
} from "@/lib/caseFields";
import { examTypeLabels } from "@/lib/clinicalLabels";
import { logAudit } from "@/lib/auditLog";
import { aplicar } from "@/lib/mutate";

/**
 * Os achados do caso, em leitura e em edição.
 *
 * Até aqui tudo o que o médico digitava no cadastro — identificação, lesão,
 * NYHA, as medidas do eco, sintomas, comorbidades e conduta — ficava congelado
 * no instante em que o caso era salvo: a tela do caso só deixava mexer em
 * `status` e `clinical_notes`. Num prontuário isso tem dois custos, e os dois
 * apareceram no uso real: o dado entra errado e não sai, e o médico acaba
 * criando um caso novo para corrigir, duplicando o paciente.
 *
 * Duas disciplinas desta base valem aqui em particular:
 *
 * 1. **A escrita passa por `aplicar()`.** Uma recusa de RLS devolve 200 com
 *    zero linhas no PostgREST; sem isso, "Achados atualizados" apareceria na
 *    tela de quem não tem permissão nenhuma sobre o caso.
 * 2. **A trilha diz o que mudou.** `case_updated` sem os campos não permite
 *    reconstruir nada depois — e num prontuário a auditoria é o registro de
 *    conformidade, não um contador de eventos.
 */

const sexLabels: Record<string, string> = {
  F: "Feminino",
  M: "Masculino",
  O: "Outro / não informado",
};

/** O que a tela edita. Tudo texto: o formulário é de texto, a conversão é na saída. */
interface Formulario {
  patient_name: string;
  patient_age: string;
  patient_sex: string;
  valve_type: string;
  valve_disease: string;
  severity: string;
  nyha: string;
  symptoms: string[];
  comorbidities: string[];
  ejection_fraction: string;
  mean_gradient: string;
  peak_gradient: string;
  valve_area: string;
  regurgitation_grade: string;
  proposed_management: string;
}

/**
 * Só os campos que esta tela lê e escreve. É um `type`, não uma `interface`,
 * porque `diferencas()` recebe `Record<string, unknown>` e interface não é
 * atribuível a assinatura de índice.
 */
export type CasoAchados = {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_sex: string | null;
  valve_type: string;
  valve_disease: string;
  severity: string;
  nyha: string | null;
  symptoms: string[] | null;
  comorbidities: string[] | null;
  ejection_fraction: number | null;
  mean_gradient: number | null;
  peak_gradient: number | null;
  valve_area: number | null;
  regurgitation_grade: string | null;
  proposed_management: string | null;
};

function doCaso(caso: CasoAchados): Formulario {
  return {
    patient_name: caso.patient_name ?? "",
    patient_age: caso.patient_age?.toString() ?? "",
    patient_sex: caso.patient_sex ?? "",
    valve_type: caso.valve_type ?? "",
    valve_disease: caso.valve_disease ?? "",
    severity: caso.severity ?? "indeterminada",
    nyha: caso.nyha ?? "",
    symptoms: caso.symptoms ?? [],
    comorbidities: caso.comorbidities ?? [],
    ejection_fraction: caso.ejection_fraction?.toString() ?? "",
    mean_gradient: caso.mean_gradient?.toString() ?? "",
    peak_gradient: caso.peak_gradient?.toString() ?? "",
    valve_area: caso.valve_area?.toString() ?? "",
    regurgitation_grade: caso.regurgitation_grade ?? "",
    proposed_management: caso.proposed_management ?? "",
  };
}

/** Texto do formulário → o que vai para o banco. Vazio vira `null`, nunca zero. */
export function paraPayload(f: Formulario): Record<string, unknown> {
  const medidas: Record<string, number | null> = {};
  for (const campo of MEDIDAS) {
    medidas[campo.key] = paraBanco(campo, f[campo.key as keyof Formulario] as string);
  }
  return {
    patient_name: f.patient_name.trim(),
    patient_sex: f.patient_sex || null,
    valve_type: f.valve_type,
    valve_disease: f.valve_disease,
    severity: f.severity || "indeterminada",
    nyha: f.nyha || null,
    // Lista vazia vira null para bater com o que o cadastro grava — senão o
    // mesmo "nenhum sintoma" ficaria representado de duas formas no banco.
    symptoms: f.symptoms.length ? f.symptoms : null,
    comorbidities: f.comorbidities.length ? f.comorbidities : null,
    regurgitation_grade: f.regurgitation_grade.trim() || null,
    proposed_management: f.proposed_management.trim() || null,
    ...medidas,
  };
}

/** Primeira recusa, ou `null` quando está tudo bom. */
export function validar(f: Formulario): string | null {
  if (!f.patient_name.trim()) return "A identificação do paciente não pode ficar vazia";
  if (!f.valve_type) return "Informe a valva acometida";
  if (!f.valve_disease) return "Informe o tipo de lesão";
  for (const campo of MEDIDAS) {
    const erro = validarMedida(campo, f[campo.key as keyof Formulario] as string);
    if (erro) return erro;
  }
  return null;
}

export const ultimoExameKey = (caseId: string) => ["case-latest-exam", caseId] as const;

interface Props {
  caso: CasoAchados;
  readOnly?: boolean;
  onSaved?: () => void;
}

export const CaseFindingsEditor = ({ caso, readOnly = false, onSaved }: Props) => {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Formulario>(() => doCaso(caso));

  /**
   * O exame mais recente do caso, para o botão de preencher.
   *
   * Só é buscado em modo de edição: quem está lendo o caso não precisa da
   * consulta, e ela não tem por que pesar em toda abertura de prontuário.
   */
  const { data: exame } = useQuery({
    queryKey: ultimoExameKey(caso.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_exams")
        .select("id, exam_type, exam_date, ejection_fraction, mean_gradient, peak_gradient, valve_area, regurgitation_grade")
        .eq("case_id", caso.id)
        .is("deleted_at", null)
        .order("exam_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: editando && !readOnly,
  });

  const dataDoExame = exame
    ? `${examTypeLabels[exame.exam_type] ?? "Exame"} de ${new Date(exame.exam_date + "T00:00:00").toLocaleDateString("pt-BR")}`
    : null;

  /**
   * Traz as medidas do exame para o formulário — e para no formulário.
   *
   * Nunca automático e nunca silencioso: o médico vê os valores nos campos,
   * sabe de qual exame vieram, e decide antes de salvar. É o mesmo princípio
   * das sugestões de anel, que a IA devolve marcadas como revisão obrigatória.
   */
  const preencherComExame = () => {
    if (!exame) return;
    const vindos = doExameParaFormulario(exame);
    const n = Object.keys(vindos).length;
    if (n === 0) {
      toast.info("Esse exame não tem nenhuma das medidas do caso", {
        description: `${dataDoExame} foi registrado sem FE, gradientes, área valvar ou regurgitação.`,
      });
      return;
    }
    setForm((f) => ({ ...f, ...vindos }));
    toast.success(`${n} medida(s) trazidas do exame`, {
      description: `Origem: ${dataDoExame}. Revise antes de salvar.`,
    });
  };

  // O nome pseudonimizado não volta a ser editável: o titular pediu eliminação,
  // e um campo de texto aberto desfaria a pseudonimização com uma digitação.
  const pseudonimizado = !!caso.patient_name?.startsWith("Titular removido");

  const abrir = () => {
    setForm(doCaso(caso));
    setEditando(true);
  };

  const set = (k: keyof Formulario, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const alternar = (k: "symptoms" | "comorbidities", valor: string) =>
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(valor) ? f[k].filter((x) => x !== valor) : [...f[k], valor],
    }));

  const salvar = async () => {
    const erro = validar(form);
    if (erro) {
      toast.error("Revise antes de salvar", { description: erro });
      return;
    }

    // O nome pseudonimizado é reenviado como está — nunca o que veio da tela.
    const payload = {
      ...paraPayload(form),
      ...(pseudonimizado ? { patient_name: caso.patient_name } : {}),
    };

    const mudou = diferencas(caso, payload);
    if (Object.keys(mudou).length === 0) {
      toast.info("Nada mudou");
      setEditando(false);
      return;
    }

    setSalvando(true);
    const ok = await aplicar(
      supabase.from("clinical_cases").update(payload as never).eq("id", caso.id).select("id"),
      { sucesso: "Achados atualizados", falha: "Não foi possível salvar os achados" },
    );
    setSalvando(false);
    if (!ok) return;

    // Campo, valor antigo e valor novo: sem isso, quem ler a trilha depois não
    // consegue reconstruir o que o prontuário dizia antes da correção.
    logAudit("case_findings_updated", "clinical_cases", caso.id, { campos: mudou });
    setEditando(false);
    onSaved?.();
  };

  return (
    <Card className="shadow-sm-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" /> Achados clínicos e ecocardiográficos
        </CardTitle>
        {!readOnly && !editando && (
          <Button variant="outline" size="sm" onClick={abrir}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        )}
      </CardHeader>

      {editando ? (
        <CardContent className="space-y-6">
          <Secao titulo="Identificação">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome / identificação do paciente</Label>
              <Input
                value={form.patient_name}
                disabled={pseudonimizado}
                onChange={(e) => set("patient_name", e.target.value)}
                className="mt-1.5"
              />
              {pseudonimizado && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  O titular pediu eliminação dos dados: o nome é um código e não pode ser reescrito
                  aqui. A identificação continua guardada em base restrita, com o encarregado (DPO).
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Idade (anos)</Label>
              <Input
                type="number" min="0" max="120" inputMode="numeric"
                value={form.patient_age}
                onChange={(e) => set("patient_age", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Sexo</Label>
              <Select value={form.patient_sex} onValueChange={(v) => set("patient_sex", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(sexLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Secao>

          <Secao titulo="Lesão valvar">
            <div>
              <Label className="text-xs">Valva acometida</Label>
              <Select value={form.valve_type} onValueChange={(v) => set("valve_type", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(valveTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de lesão</Label>
              <Select value={form.valve_disease} onValueChange={(v) => set("valve_disease", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(valveDiseaseLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gravidade</Label>
              <Select value={form.severity} onValueChange={(v) => set("severity", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(severityLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Classe funcional NYHA</Label>
              <Select value={form.nyha} onValueChange={(v) => set("nyha", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Não informada" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(nyhaLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Secao>

          <Secao titulo="Medidas do ecocardiograma">
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <Button
                type="button" variant="secondary" size="sm"
                disabled={!exame}
                onClick={preencherComExame}
              >
                <FlaskConical className="h-3.5 w-3.5" /> Preencher com o exame mais recente
              </Button>
              <p className="text-[11px] text-muted-foreground min-w-0">
                {dataDoExame
                  ? `${dataDoExame} — os valores entram no formulário para você revisar; nada é salvo antes de você confirmar.`
                  : "Nenhum exame registrado neste caso ainda."}
              </p>
            </div>
            <div>
              <Label className="text-xs">FE (%)</Label>
              <Input
                type="number" step="1" min="0" max="100" inputMode="decimal"
                value={form.ejection_fraction}
                onChange={(e) => set("ejection_fraction", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Gradiente médio (mmHg)</Label>
              <Input
                type="number" step="0.1" min="0" max="200" inputMode="decimal"
                value={form.mean_gradient}
                onChange={(e) => set("mean_gradient", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Gradiente máximo (mmHg)</Label>
              <Input
                type="number" step="0.1" min="0" max="250" inputMode="decimal"
                value={form.peak_gradient}
                onChange={(e) => set("peak_gradient", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Área valvar (cm²)</Label>
              <Input
                type="number" step="0.01" min="0" max="10" inputMode="decimal"
                value={form.valve_area}
                onChange={(e) => set("valve_area", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Grau de regurgitação / observação</Label>
              <Input
                value={form.regurgitation_grade}
                onChange={(e) => set("regurgitation_grade", e.target.value)}
                placeholder="Ex.: regurgitação mitral moderada (2+/4+)"
                className="mt-1.5"
              />
            </div>
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              Campo em branco fica <strong>sem medida</strong>, não zero — ausência de dado é
              informação legítima e entra assim na estimativa de risco e na sugestão de conduta.
            </p>
          </Secao>

          <div>
            <Label className="text-xs mb-2 block">Sintomas relatados</Label>
            <div className="flex flex-wrap gap-2">
              {commonSymptoms.map((s) => (
                <Chip key={s} ativo={form.symptoms.includes(s)} onClick={() => alternar("symptoms", s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Comorbidades</Label>
            <div className="flex flex-wrap gap-2">
              {commonComorbidities.map((s) => (
                <Chip key={s} ativo={form.comorbidities.includes(s)} onClick={() => alternar("comorbidities", s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Conduta proposta</Label>
            <Textarea
              value={form.proposed_management}
              onChange={(e) => set("proposed_management", e.target.value)}
              className="mt-1.5 min-h-[100px]"
              placeholder="Ex.: seguimento clínico em 6 meses com novo eco; encaminhar para Heart Team."
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setEditando(false)} disabled={salvando}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar achados
            </Button>
          </div>
        </CardContent>
      ) : (
        <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Info label="Classe NYHA" value={caso.nyha ? nyhaLabels[caso.nyha] : "—"} />
          <Info label="FE" value={caso.ejection_fraction != null ? `${caso.ejection_fraction}%` : "—"} />
          <Info label="Gradiente médio" value={caso.mean_gradient != null ? `${caso.mean_gradient} mmHg` : "—"} />
          <Info label="Gradiente máximo" value={caso.peak_gradient != null ? `${caso.peak_gradient} mmHg` : "—"} />
          <Info label="Área valvar" value={caso.valve_area != null ? `${caso.valve_area} cm²` : "—"} />
          <Info label="Regurgitação" value={caso.regurgitation_grade || "—"} />

          {!!caso.symptoms?.length && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Sintomas</p>
              <div className="flex flex-wrap gap-1.5">
                {caso.symptoms.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            </div>
          )}
          {!!caso.comorbidities?.length && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Comorbidades</p>
              <div className="flex flex-wrap gap-1.5">
                {caso.comorbidities.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
              </div>
            </div>
          )}
          {caso.proposed_management && (
            <div className="sm:col-span-2 pt-2 border-t border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Conduta proposta</p>
              <p className="text-foreground whitespace-pre-wrap">{caso.proposed_management}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">{titulo}</p>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Chip({
  ativo, onClick, children,
}: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button" variant="outline" onClick={onClick}
      aria-pressed={ativo}
      className={`h-auto rounded-full px-3 py-1.5 text-xs font-normal ${
        ativo
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          : "bg-background border-border hover:border-primary/50"
      }`}
    >
      {children}
    </Button>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium">{value || "—"}</p>
    </div>
  );
}
