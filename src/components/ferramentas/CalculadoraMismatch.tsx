import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Info } from "lucide-react";
import { CitacaoDaFonte } from "./CitacaoDaFonte";
import { FONTE_EACVI_PROTESES, FONTE_DUBOIS, FONTE_LIMITE_PROJECAO } from "@/lib/fontes";
import { superficieCorporal, imc as calcularImc } from "@/lib/bsa";
import {
  classificarPPM, eoaPorContinuidade, dvi as calcularDvi, avaliarHemodinamica,
  LIMIARES_PPM, IMC_OBESIDADE,
  type PosicaoValvar, type GrauPPM,
} from "@/lib/mismatch";
import { useCatalogoProteses } from "@/hooks/useCatalogoProteses";

/**
 * Gradiente transprotético e risco de *mismatch*.
 *
 * Duas perguntas clínicas diferentes, em duas abas, porque misturá-las é o erro
 * comum: **antes** de operar usa-se a EOA de referência publicada do modelo
 * (projeção, para escolher a prótese); **depois**, a EOA medida no eco, o DVI e
 * o gradiente (para separar *mismatch* de obstrução).
 *
 * Todos os limiares vêm das Tabelas 12, 13 e 15 da publicação da EACVI e estão
 * em `src/lib/mismatch.ts`, exportados — a tela mostra a tabela ao lado do
 * resultado, porque limiar clínico escondido dentro de um `if` é limiar que
 * ninguém confere.
 */

const numero = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};
const duas = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CORES_PPM: Record<GrauPPM, string> = {
  ausente: "bg-success/15 text-success border-success/30",
  moderado: "bg-warning/15 text-warning border-warning/30",
  grave: "bg-destructive/15 text-destructive border-destructive/30",
};
const TEXTO_PPM: Record<GrauPPM, string> = {
  ausente: "Sem mismatch relevante",
  moderado: "Mismatch moderado",
  grave: "Mismatch grave",
};

const CORES_LEITURA = {
  normal: "text-success",
  possivel: "text-warning",
  significativa: "text-destructive",
} as const;
const TEXTO_LEITURA = {
  normal: "normal",
  possivel: "possível obstrução",
  significativa: "obstrução significativa",
} as const;

export interface PreenchimentoMismatch {
  posicao?: PosicaoValvar;
  proteseId?: string;
  gradienteMedio?: number | null;
  eoa?: number | null;
}

export function CalculadoraMismatch({ inicial }: { inicial?: PreenchimentoMismatch }) {
  const { data: catalogo = [] } = useCatalogoProteses();

  const [posicao, setPosicao] = useState<PosicaoValvar>(inicial?.posicao ?? "aortica");
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [proteseId, setProteseId] = useState<string>(inicial?.proteseId ?? "");

  // Aba "depois": medidas do ecocardiograma.
  const [eoaMedida, setEoaMedida] = useState(inicial?.eoa != null ? String(inicial.eoa) : "");
  const [gradiente, setGradiente] = useState(inicial?.gradienteMedio != null ? String(inicial.gradienteMedio) : "");
  const [velocidade, setVelocidade] = useState("");
  const [diametroVsve, setDiametroVsve] = useState("");
  const [vtiVsve, setVtiVsve] = useState("");
  const [vtiProtese, setVtiProtese] = useState("");
  const [tempoAceleracao, setTempoAceleracao] = useState("");
  const [tempoHemipressao, setTempoHemipressao] = useState("");

  const bsa = useMemo(() => superficieCorporal(numero(altura) ?? 0, numero(peso) ?? 0), [altura, peso]);
  const imc = useMemo(() => calcularImc(numero(altura) ?? 0, numero(peso) ?? 0), [altura, peso]);

  /** Só as próteses da posição escolhida — e as que têm EOA publicada primeiro. */
  const opcoes = useMemo(
    () => catalogo.filter((p) => p.valve_position === posicao),
    [catalogo, posicao],
  );
  const protese = useMemo(() => catalogo.find((p) => p.id === proteseId), [catalogo, proteseId]);

  const projetado = useMemo(() => {
    if (!protese?.effective_orifice_area || !bsa) return null;
    return classificarPPM(protese.effective_orifice_area, bsa, posicao, "projetada", imc);
  }, [protese, bsa, posicao, imc]);

  const eoaCalculada = useMemo(
    () => eoaPorContinuidade(numero(diametroVsve) ?? 0, numero(vtiVsve) ?? 0, numero(vtiProtese) ?? 0),
    [diametroVsve, vtiVsve, vtiProtese],
  );
  const eoaFinal = numero(eoaMedida) ?? eoaCalculada;
  const dviCalculado = useMemo(
    () => calcularDvi(posicao, numero(vtiVsve) ?? 0, numero(vtiProtese) ?? 0),
    [posicao, vtiVsve, vtiProtese],
  );

  const medido = useMemo(() => {
    if (!eoaFinal || !bsa) return null;
    return classificarPPM(eoaFinal, bsa, posicao, "medida", imc);
  }, [eoaFinal, bsa, posicao, imc]);

  const leitura = useMemo(
    () => avaliarHemodinamica(posicao, {
      velocidadePico: numero(velocidade),
      gradienteMedio: numero(gradiente),
      dvi: dviCalculado,
      eoa: eoaFinal,
      tempoAceleracao: numero(tempoAceleracao),
      tempoHemipressao: numero(tempoHemipressao),
      eoaReferencia: protese?.effective_orifice_area ?? null,
    }),
    [posicao, velocidade, gradiente, dviCalculado, eoaFinal, tempoAceleracao, tempoHemipressao, protese],
  );

  const limiares = LIMIARES_PPM[posicao][imc != null && imc >= IMC_OBESIDADE ? "obeso" : "normal"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Paciente e posição valvar</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Posição</Label>
            <Select value={posicao} onValueChange={(v) => { setPosicao(v as PosicaoValvar); setProteseId(""); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aortica">Aórtica</SelectItem>
                <SelectItem value="mitral">Mitral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mm-altura" className="text-sm font-medium">Altura (cm)</Label>
            <Input id="mm-altura" inputMode="decimal" className="h-10" value={altura} onChange={(e) => setAltura(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mm-peso" className="text-sm font-medium">Peso (kg)</Label>
            <Input id="mm-peso" inputMode="decimal" className="h-10" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Superfície corporal</Label>
            <div className="h-10 flex items-center text-sm">
              {bsa ? (
                <span>
                  <strong className="tabular-nums">{duas(bsa)}</strong> m²
                  {imc != null && (
                    <span className="text-muted-foreground"> · IMC {duas(imc)}</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">informe altura e peso</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="antes">
        {/* `flex-wrap h-auto`: medido em 390px, os dois rótulos por extenso
            somavam 434px numa tela de 390 e cortavam a página inteira. Os
            rótulos encurtam no celular e voltam completos a partir de `sm`. */}
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="antes">
            Antes de operar<span className="hidden sm:inline"> — projeção</span>
          </TabsTrigger>
          <TabsTrigger value="depois">
            Depois<span className="hidden sm:inline"> — medidas do eco</span>
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------- PROJEÇÃO ------------------------------- */}
        <TabsContent value="antes" className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px] items-start">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Prótese considerada</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={proteseId} onValueChange={setProteseId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Escolha modelo e tamanho no catálogo" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.manufacturer} · {p.model_name}{p.size ? ` · ${p.size} mm` : ""}
                      {p.effective_orifice_area ? ` · EOA ${p.effective_orifice_area} cm²` : " · sem EOA publicada"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {protese && !protese.effective_orifice_area && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
                  <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/85 leading-relaxed">
                    <strong>Não há EOA de referência publicada</strong> para este modelo neste
                    tamanho. Das 246 linhas do catálogo, 29 têm valor citável — o resto ficou nulo
                    de propósito: preencher por interpolação ou por "modelo parecido" seria inventar
                    hemodinâmica. Use a aba <strong>Depois</strong> com a EOA medida no eco.
                  </p>
                </div>
              )}

              {protese?.eoa_source_url && (
                <p className="text-xs text-muted-foreground">
                  EOA de referência: <strong>{protese.effective_orifice_area} cm²</strong>
                  {protese.eoa_reference_sd ? ` ± ${protese.eoa_reference_sd}` : ""} —{" "}
                  <a href={protese.eoa_source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {protese.eoa_source_label}
                  </a>
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <ResultadoPPM
              titulo="EOA indexada projetada"
              resultado={projetado}
              vazio="Escolha a prótese e informe altura e peso."
              limiares={limiares}
            />
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/85 leading-relaxed">
                A projeção por tabela de referência <strong>superestima</strong> o mismatch em
                relação à EOA medida — há literatura específica sobre isso. Serve para escolher
                prótese, não para carimbar diagnóstico.
              </p>
            </div>
            <CitacaoDaFonte fonte={FONTE_LIMITE_PROJECAO} />
          </div>
        </TabsContent>

        {/* -------------------------------- MEDIDO -------------------------------- */}
        <TabsContent value="depois" className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px] items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Medidas do ecocardiograma</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Campo id="mm-grad" rotulo="Gradiente médio (mmHg)" valor={gradiente} aoMudar={setGradiente} />
                <Campo id="mm-vel" rotulo="Velocidade de pico (m/s)" valor={velocidade} aoMudar={setVelocidade} />
                <Campo
                  id="mm-dvsve" rotulo="Diâmetro da VSVE (mm)" valor={diametroVsve} aoMudar={setDiametroVsve}
                  ajuda="Entra ao quadrado na equação de continuidade: 1 mm de erro em 20 mm muda a EOA em ~10%."
                />
                <Campo id="mm-vtivsve" rotulo="VTI da VSVE (cm)" valor={vtiVsve} aoMudar={setVtiVsve} />
                <Campo id="mm-vtiprot" rotulo="VTI da prótese (cm)" valor={vtiProtese} aoMudar={setVtiProtese} />
                {posicao === "aortica" ? (
                  <Campo id="mm-at" rotulo="Tempo de aceleração (ms)" valor={tempoAceleracao} aoMudar={setTempoAceleracao} />
                ) : (
                  <Campo id="mm-pht" rotulo="Tempo de meia-pressão (ms)" valor={tempoHemipressao} aoMudar={setTempoHemipressao} />
                )}
                <div className="sm:col-span-2">
                  <Campo
                    id="mm-eoa" rotulo="EOA medida (cm²)" valor={eoaMedida} aoMudar={setEoaMedida}
                    ajuda={
                      eoaCalculada
                        ? `Em branco, usa-se a calculada pela continuidade: ${duas(eoaCalculada)} cm².`
                        : "Informe a EOA do laudo, ou preencha VSVE e VTIs para calculá-la pela continuidade."
                    }
                  />
                </div>
                {dviCalculado != null && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    DVI calculado ({posicao === "aortica" ? "VTI VSVE ÷ VTI prótese" : "VTI prótese ÷ VTI VSVE"}):{" "}
                    <strong className="tabular-nums">{duas(dviCalculado)}</strong>
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Leitura do gradiente — {posicao === "aortica" ? "Tabela 13" : "Tabela 15"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leitura.informados === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma medida informada. <strong>Sem medida não há leitura</strong> — nem a
                    leitura tranquilizadora.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-2">
                      {leitura.achados.map((a, i) => (
                        <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm border-b border-border/60 pb-2 last:border-0">
                          <span className="text-foreground">{a.rotulo}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {a.valor}{a.unidade && ` ${a.unidade}`}
                          </span>
                          <span className={`text-xs font-medium ${CORES_LEITURA[a.leitura]}`}>
                            {TEXTO_LEITURA[a.leitura]}
                          </span>
                          <span className="w-full text-[11px] text-muted-foreground">
                            faixas da tabela: {a.faixas}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm text-foreground/85 leading-relaxed">{leitura.conclusao}</p>
                    {leitura.diferencaParaReferencia != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        EOA de referência menos EOA medida:{" "}
                        <strong className="tabular-nums">{duas(leitura.diferencaParaReferencia)} cm²</strong>{" "}
                        (a tabela separa em &lt; 0,25 · 0,25–0,35 · &gt; 0,35).
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <ResultadoPPM
              titulo="EOA indexada medida"
              resultado={medido}
              vazio="Informe altura, peso e a EOA (do laudo ou pela continuidade)."
              limiares={limiares}
            />
            <CitacaoDaFonte fonte={FONTE_EACVI_PROTESES} />
            <CitacaoDaFonte fonte={FONTE_DUBOIS} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Campo({ id, rotulo, valor, aoMudar, ajuda }: {
  id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; ajuda?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{rotulo}</Label>
      <Input id={id} inputMode="decimal" className="h-10" value={valor} onChange={(e) => aoMudar(e.target.value)} />
      {ajuda && <p className="text-[11px] text-muted-foreground leading-snug">{ajuda}</p>}
    </div>
  );
}

function ResultadoPPM({ titulo, resultado, vazio, limiares }: {
  titulo: string;
  resultado: ReturnType<typeof classificarPPM>;
  vazio: string;
  limiares: { grave: number; moderado: number };
}) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!resultado ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <>
            <p className="font-serif text-4xl text-primary tabular-nums">
              {duas(resultado.ieoa)} <span className="text-lg">cm²/m²</span>
            </p>
            <Badge variant="outline" className={CORES_PPM[resultado.grau]}>
              {TEXTO_PPM[resultado.grau]}
            </Badge>
            {resultado.faixaDeObesidade && (
              <p className="text-xs text-muted-foreground">
                IMC ≥ {IMC_OBESIDADE}: valem os limiares próprios da obesidade.
              </p>
            )}
          </>
        )}
        <div className="rounded-lg bg-secondary/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
            Limiares aplicados
          </p>
          <p className="text-xs text-foreground/85">
            grave ≤ {duas(limiares.grave)} · moderado até {duas(limiares.moderado)} · acima
            disso, sem mismatch relevante
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
