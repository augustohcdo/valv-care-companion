import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";
import { CampoOpcoes, CampoSimNao } from "./CamposClinicos";
import { CitacaoDaFonte } from "./CitacaoDaFonte";
import { FONTE_EUROSCORE2 } from "@/lib/fontes";
import {
  calcularEuroscore2, clearanceCockcroftGault, faixaRenalPorClearance,
  TOTAL_VARIAVEIS,
  type EntradaEuroscore, type FaixaRenal, type FuncaoVE, type ClasseNyha,
  type PressaoPulmonar, type Urgencia, type PesoIntervencao, type Sexo,
} from "@/lib/euroscore2";

/**
 * A calculadora do EuroSCORE II.
 *
 * Existe porque, até esta rodada, o `RiskScoreCard` do caso clínico mandava o
 * médico para fora do produto — link direto para o MDCalc — exatamente no
 * momento em que ele mais precisava dele. O modelo é ciência publicada
 * (Nashef 2012) e está implementado em `src/lib/euroscore2.ts`; o que **não**
 * foi copiado é a redação, a diagramação e a ordem de perguntas do MDCalc, que
 * são produto deles.
 */

const numero = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

const umaCasa = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export interface PreenchimentoInicial extends Partial<EntradaEuroscore> {
  pesoKg?: number | null;
}

export function CalculadoraEuroscore({ inicial }: { inicial?: PreenchimentoInicial }) {
  const [e, setE] = useState<EntradaEuroscore>(() => ({ ...inicial }));
  const [pesoKg, setPesoKg] = useState(inicial?.pesoKg != null ? String(inicial.pesoKg) : "");
  const [creatinina, setCreatinina] = useState("");

  const set = <K extends keyof EntradaEuroscore>(k: K, v: EntradaEuroscore[K]) =>
    setE((atual) => ({ ...atual, [k]: v }));

  const resultado = useMemo(() => calcularEuroscore2(e), [e]);

  const clearance = useMemo(() => {
    if (e.idade == null || !e.sexo) return null;
    return clearanceCockcroftGault(e.idade, numero(pesoKg) ?? 0, numero(creatinina) ?? 0, e.sexo);
  }, [e.idade, e.sexo, pesoKg, creatinina]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Paciente</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="es-idade" className="text-sm font-medium">Idade (anos) *</Label>
              <Input
                id="es-idade" inputMode="numeric" className="h-10"
                value={e.idade ?? ""}
                onChange={(ev) => set("idade", numero(ev.target.value))}
              />
            </div>
            <CampoOpcoes<Sexo>
              id="es-sexo" rotulo="Sexo *" valor={e.sexo}
              opcoes={[{ valor: "M", rotulo: "Masculino" }, { valor: "F", rotulo: "Feminino" }]}
              aoMudar={(v) => set("sexo", v)}
            />
            <CampoSimNao
              id="es-diabetes" rotulo="Diabetes em uso de insulina" valor={e.diabetesInsulina}
              ajuda="Só insulinodependente entra no modelo; dieta e via oral não somam."
              aoMudar={(v) => set("diabetesInsulina", v)}
            />
            <CampoSimNao
              id="es-pneumo" rotulo="Doença pulmonar crônica" valor={e.pneumopatia}
              ajuda="Uso prolongado de broncodilatador ou corticoide por doença pulmonar."
              aoMudar={(v) => set("pneumopatia", v)}
            />
            <CampoSimNao
              id="es-arteriopatia" rotulo="Arteriopatia extracardíaca" valor={e.arteriopatia}
              ajuda="Claudicação; oclusão ou estenose > 50% de carótida; amputação por doença arterial; intervenção prévia ou planejada em aorta abdominal, carótidas ou artérias dos membros."
              aoMudar={(v) => set("arteriopatia", v)}
            />
            <CampoSimNao
              id="es-mobilidade" rotulo="Mobilidade gravemente reduzida" valor={e.mobilidade}
              ajuda="Por causa musculoesquelética ou neurológica."
              aoMudar={(v) => set("mobilidade", v)}
            />
            <CampoSimNao
              id="es-previa" rotulo="Cirurgia cardíaca prévia" valor={e.cirurgiaCardiacaPrevia}
              ajuda="Uma ou mais operações cardíacas maiores com abertura do pericárdio."
              aoMudar={(v) => set("cirurgiaCardiacaPrevia", v)}
            />
            <CampoSimNao
              id="es-endocardite" rotulo="Endocardite ativa" valor={e.endocarditeAtiva}
              ajuda="Ainda em antibioticoterapia por endocardite no momento da cirurgia."
              aoMudar={(v) => set("endocarditeAtiva", v)}
            />
            <div className="sm:col-span-2">
              <CampoSimNao
                id="es-critico" rotulo="Estado crítico pré-operatório" valor={e.estadoCritico}
                ajuda="Na mesma internação: TV/FV ou morte súbita abortada; massagem cardíaca; ventilação antes da sala; inotrópicos; balão intra-aórtico ou assistência ventricular antes da sala; insuficiência renal aguda."
                aoMudar={(v) => set("estadoCritico", v)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Função renal</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="es-peso" className="text-sm font-medium">Peso (kg)</Label>
                <Input id="es-peso" inputMode="decimal" className="h-10" value={pesoKg}
                  onChange={(ev) => setPesoKg(ev.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="es-creat" className="text-sm font-medium">Creatinina (mg/dL)</Label>
                <Input id="es-creat" inputMode="decimal" className="h-10" value={creatinina}
                  onChange={(ev) => setCreatinina(ev.target.value)} />
                <p className="text-[11px] text-muted-foreground">
                  Em µmol/L? Divida por 88,4 antes. A unidade errada muda a faixa renal.
                </p>
              </div>
            </div>
            {clearance != null && (
              <div className="flex items-start gap-2 rounded-lg bg-secondary/40 p-3">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/85">
                  Clearance por Cockcroft-Gault: <strong>{umaCasa(clearance)} ml/min</strong> —
                  faixa <strong>{faixaRenalPorClearance(clearance)}</strong>.{" "}
                  <Button
                    variant="link" className="h-auto p-0 text-xs"
                    onClick={() => set("renal", faixaRenalPorClearance(clearance))}
                  >
                    usar esta faixa
                  </Button>
                </p>
              </div>
            )}
            <CampoOpcoes<FaixaRenal>
              id="es-renal" rotulo="Faixa de função renal" valor={e.renal}
              opcoes={[
                { valor: "normal", rotulo: "Clearance > 85 ml/min" },
                { valor: "moderada", rotulo: "Clearance 50–85 ml/min" },
                { valor: "grave", rotulo: "Clearance < 50 ml/min" },
                { valor: "dialise", rotulo: "Em diálise (independente da creatinina)" },
              ]}
              aoMudar={(v) => set("renal", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Coração</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <CampoOpcoes<ClasseNyha>
              id="es-nyha" rotulo="Classe funcional NYHA" valor={e.nyha}
              opcoes={[
                { valor: "I", rotulo: "I — sem limitação" },
                { valor: "II", rotulo: "II — limitação leve" },
                { valor: "III", rotulo: "III — limitação importante" },
                { valor: "IV", rotulo: "IV — sintomas em repouso" },
              ]}
              aoMudar={(v) => set("nyha", v)}
            />
            <CampoSimNao
              id="es-ccs4" rotulo="Angina CCS classe 4" valor={e.ccs4}
              ajuda="Incapacidade de qualquer atividade sem angina, ou angina em repouso."
              aoMudar={(v) => set("ccs4", v)}
            />
            <CampoOpcoes<FuncaoVE>
              id="es-ve" rotulo="Função do ventrículo esquerdo" valor={e.funcaoVe}
              opcoes={[
                { valor: "boa", rotulo: "Boa — FEVE ≥ 51%" },
                { valor: "moderada", rotulo: "Moderada — FEVE 31–50%" },
                { valor: "ruim", rotulo: "Ruim — FEVE 21–30%" },
                { valor: "muito_ruim", rotulo: "Muito ruim — FEVE ≤ 20%" },
              ]}
              aoMudar={(v) => set("funcaoVe", v)}
            />
            <CampoSimNao
              id="es-iam" rotulo="Infarto recente" valor={e.infartoRecente}
              ajuda="Nos 90 dias anteriores à operação."
              aoMudar={(v) => set("infartoRecente", v)}
            />
            <div className="sm:col-span-2">
              <CampoOpcoes<PressaoPulmonar>
                id="es-pap" rotulo="Pressão sistólica da artéria pulmonar" valor={e.pressaoPulmonar}
                opcoes={[
                  { valor: "normal", rotulo: "≤ 30 mmHg" },
                  { valor: "31_55", rotulo: "31–55 mmHg" },
                  { valor: "55_ou_mais", rotulo: "≥ 55 mmHg" },
                ]}
                aoMudar={(v) => set("pressaoPulmonar", v)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Operação</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <CampoOpcoes<Urgencia>
              id="es-urgencia" rotulo="Urgência" valor={e.urgencia}
              opcoes={[
                { valor: "eletiva", rotulo: "Eletiva — internação de rotina" },
                { valor: "urgente", rotulo: "Urgente — não recebe alta sem operar" },
                { valor: "emergencia", rotulo: "Emergência — antes do próximo dia útil" },
                { valor: "salvamento", rotulo: "Salvamento — reanimação a caminho da sala" },
              ]}
              aoMudar={(v) => set("urgencia", v)}
            />
            <CampoOpcoes<PesoIntervencao>
              id="es-peso-int" rotulo="Peso da intervenção" valor={e.pesoIntervencao}
              ajuda="A referência do modelo é a revascularização isolada — troca valvar isolada NÃO é a referência."
              opcoes={[
                { valor: "cabg_isolada", rotulo: "Revascularização isolada" },
                { valor: "unica_nao_cabg", rotulo: "Um procedimento maior que não revascularização" },
                { valor: "duas", rotulo: "Dois procedimentos maiores" },
                { valor: "tres_ou_mais", rotulo: "Três ou mais procedimentos maiores" },
              ]}
              aoMudar={(v) => set("pesoIntervencao", v)}
            />
            <div className="sm:col-span-2">
              <CampoSimNao
                id="es-aorta" rotulo="Cirurgia da aorta torácica" valor={e.aortaToracica}
                aoMudar={(v) => set("aortaToracica", v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Mortalidade operatória prevista</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!resultado.calculavel ? (
              <p className="text-sm text-muted-foreground">
                Informe <strong>idade</strong> e <strong>sexo</strong> para o cálculo começar.
              </p>
            ) : resultado.mortalidade != null ? (
              <>
                <p className="font-serif text-5xl text-primary tabular-nums">
                  {umaCasa(resultado.mortalidade)}<span className="text-2xl">%</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Todas as {TOTAL_VARIAVEIS} variáveis do modelo foram respondidas.
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-3xl text-primary tabular-nums">
                  {umaCasa(resultado.minimo)}% – {umaCasa(resultado.maximo)}%
                </p>
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                  <p className="text-xs text-foreground/85 leading-relaxed">
                    <strong>Ainda não é um resultado.</strong> Faltam{" "}
                    {resultado.faltando.length} de {TOTAL_VARIAVEIS} variáveis, e a faixa acima é o
                    intervalo entre o melhor e o pior caso possível para o que não foi respondido.
                    Um número único aqui só existiria tratando cada campo em branco como "não" —
                    que é o que as calculadoras da internet fazem, sempre na direção de deixar o
                    paciente mais saudável do que se sabe.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Falta: {resultado.faltando.join(", ")}.
                  </p>
                </div>
              </>
            )}

            {resultado.contribuicoes.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                  O que somou
                </p>
                <ul className="space-y-1">
                  {resultado.contribuicoes.map((c, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-foreground">{c.rotulo}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        +{c.beta.toFixed(4)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/85 leading-relaxed">
            O EuroSCORE II foi derivado e validado em <strong>cirurgia cardíaca</strong>. Não é
            escore de TAVI nem de procedimento transcateter, e aplicá-lo a essa população é usá-lo
            fora do que ele mede. Apoio à decisão — não substitui a avaliação do Heart Team.
          </p>
        </div>

        <CitacaoDaFonte fonte={FONTE_EUROSCORE2} />
      </div>
    </div>
  );
}
