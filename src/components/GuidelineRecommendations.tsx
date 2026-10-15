import { Link } from "react-router-dom";
import { Sparkles, AlertTriangle, Eye, ArrowRight, Info as InfoIcon, PlayCircle, Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRecommendations, statusSintomatico } from "@/lib/guidelines";
import { FONTE_2025 } from "@/data/diretriz2025";
import { FONTE_BR_2026 } from "@/data/diretrizBr2026";
import {
  divergeNaEscolhaDaTecnica, escTemCondicaoPropria, recomendacoesBrasileiras,
} from "@/lib/diretrizBrasileira";
import { MMCTS, tutoriaisDaConduta } from "@/data/mmcts";
import { ListaDeTutoriais } from "@/components/mmcts/ListaDeTutoriais";

interface Props {
  caso: any;
}

const levelConfig: Record<string, { color: string; icon: any; label: string }> = {
  urgent: { color: "border-destructive/40 bg-destructive/5", icon: AlertTriangle, label: "Indicação clara" },
  consider: { color: "border-warning/40 bg-warning/5", icon: Sparkles, label: "Considerar" },
  watch: { color: "border-primary/30 bg-primary/5", icon: Eye, label: "Vigilância" },
  info: { color: "border-border bg-secondary/30", icon: InfoIcon, label: "Informativo" },
};

export const GuidelineRecommendations = ({ caso }: Props) => {
  const recs = getRecommendations({
    valve_type: caso.valve_type,
    valve_disease: caso.valve_disease,
    severity: caso.severity,
    nyha: caso.nyha,
    ejection_fraction: caso.ejection_fraction,
    mean_gradient: caso.mean_gradient,
    peak_gradient: caso.peak_gradient,
    valve_area: caso.valve_area,
    symptoms: caso.symptoms,
    patient_age: caso.patient_age,
    // As medidas da diretriz de 2025. Sem repassá-las aqui, o motor as trata
    // como não informadas e a atualização inteira vira fachada: o código sabe
    // ler Vmax e DSVE, e a tela nunca os entrega.
    vmax_m_s: caso.vmax_m_s,
    svi_ml_m2: caso.svi_ml_m2,
    lvesd_mm: caso.lvesd_mm,
    altura_cm: caso.altura_cm,
    peso_kg: caso.peso_kg,
    teste_esforco: caso.teste_esforco,
    risco_cirurgico: caso.risco_cirurgico,
    fibrilacao_atrial: caso.fibrilacao_atrial,
    em_etiologia: caso.em_etiologia,
  });

  return (
    <Card className="shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" /> Sugestão de conduta
          <Badge variant="outline" className="text-[10px] ml-1">Apoio à decisão</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recs.map((r, i) => {
          const cfg = levelConfig[r.level];
          const Icon = cfg.icon;
          return (
            <div key={i} className={`p-3 rounded-lg border ${cfg.color}`}>
              <div className="flex items-start gap-2.5">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    {r.classRec && (
                      <Badge variant="secondary" className="text-[10px]">
                        Classe {r.classRec}{r.evidence ? ` • ${r.evidence}` : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.detail}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1.5 inline-flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> {r.source}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <TecnicaDaConduta recs={recs} />
        <DiretrizBrasileira caso={caso} />

        {/* Esta linha dizia "ESC 2021 e AHA-ACC 2020" depois que o motor já
            tinha sido reescrito para a ESC/EACTS 2025 — a tela nomeando uma
            fonte que o código não usava mais. O DOI vem do arquivo de citações,
            então a frase não pode voltar a divergir sozinha. */}
        <p className="text-[11px] text-muted-foreground italic pt-1">
          Recomendações automáticas segundo a ESC/EACTS 2025 (DOI {FONTE_2025.doi}), com a
          Diretriz Brasileira de Valvopatias 2026 (DOI {FONTE_BR_2026.doi}) ao lado. Não
          substituem julgamento clínico nem decisão do Heart Team.
        </p>
      </CardContent>
    </Card>
  );
};

/**
 * O que a diretriz BRASILEIRA diz sobre o mesmo caso.
 *
 * Bloco separado, e não misturado às recomendações acima, por dois motivos que
 * não são de leiaute:
 *
 * 1. a escala é outra. A brasileira usa GRADE (Força: Forte/Fraca · Certeza:
 *    Alta/Moderada/Baixa) e a europeia usa Classe I–III / Nível A–C. Encostar
 *    uma na outra como se fossem a mesma coluna é inventar equivalência que
 *    nenhuma das duas publicou;
 * 2. onde elas divergem, o médico precisa VER que divergem. Fundir as duas
 *    produziria uma frase só, de origem indistinguível.
 *
 * O texto de cada linha é o verbatim do quadro, não paráfrase — é o que permite
 * ao cardiologista conferir no PDF sem ler uma linha de TypeScript.
 */
const DiretrizBrasileira = ({ caso }: Props) => {
  const sel = recomendacoesBrasileiras({
    valve_type: caso.valve_type,
    valve_disease: caso.valve_disease,
    severity: caso.severity,
    patient_age: caso.patient_age,
    risco_cirurgico: caso.risco_cirurgico,
    // A MESMA leitura de sintomas do motor da ESC — ver `statusSintomatico`.
    sintomatico: statusSintomatico(caso),
  });

  if (sel.linhas.length === 0 && sel.faltam.length === 0) return null;

  const idade = caso.patient_age;
  const divergeAqui =
    caso.valve_type === "aortica" && caso.valve_disease === "estenose"
    && typeof idade === "number" && Number.isFinite(idade) && divergeNaEscolhaDaTecnica(idade);

  return (
    <details className="rounded-lg border border-border bg-secondary/20 px-3 py-2" open={divergeAqui}>
      <summary className="text-xs font-medium text-foreground cursor-pointer inline-flex items-center gap-1.5">
        <Flag className="h-3.5 w-3.5 text-primary" />
        Diretriz Brasileira de Valvopatias 2026 ({sel.linhas.length})
        {divergeAqui && (
          <Badge variant="outline" className="text-[10px] border-warning/50">diverge da europeia</Badge>
        )}
      </summary>

      <div className="pt-2.5 space-y-2">
        {divergeAqui && (
          <p className="text-[11px] text-foreground bg-warning/10 border border-warning/30 rounded px-2 py-1.5 leading-relaxed">
            <strong>Entre 70 e 80 anos as duas diretrizes dizem coisas diferentes.</strong> A
            ESC/EACTS 2025 recomenda TAVI a partir de 70 anos (Classe I, Nível A). A brasileira
            de 2026 chama cirurgia e TAVI de equivalentes nessa faixa — as duas Forte/Alta. A
            decisão é do Heart Team; o site não escolhe por você.
          </p>
        )}

        {sel.linhas.map(({ chave, r, porque }) => (
          <div key={chave} className="rounded border border-border/70 bg-background px-2.5 py-2">
            <div className="flex items-start gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                SBC {r.forca}/{r.certeza}
              </Badge>
              {r.esc && (
                <Badge variant="outline" className="text-[10px]">
                  ESC {r.esc}
                  {escTemCondicaoPropria(r) ? " ⚠" : ""}
                </Badge>
              )}
              {r.aha && <Badge variant="outline" className="text-[10px]">AHA {r.aha}</Badge>}
              <span className="text-[10px] text-muted-foreground">
                {r.quadro}, p. {r.pagina}
              </span>
            </div>
            <p className="text-xs text-foreground mt-1.5 leading-relaxed">{r.condicao}</p>
            <p className="text-xs font-medium text-foreground mt-0.5">→ {r.intervencao}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Neste caso: {porque}.</p>
            {r.nota && (
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed border-l-2 border-border pl-2">
                {r.nota}
              </p>
            )}
          </div>
        ))}

        {sel.faltam.length > 0 && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            A diretriz brasileira divide por dados que este caso não registra:{" "}
            {sel.faltam.join("; ")}. Sem eles o site não escolhe um ramo — preencher o caso
            mostra as linhas que se aplicam.
          </p>
        )}

        {sel.notaObrigatoria && (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Pré-requisito do Quadro 27:</strong> {sel.notaObrigatoria}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground">
          {sel.fonte.citacao}{" "}
          <a
            href={sel.fonte.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline"
          >
            Abrir a diretriz
          </a>
        </p>
      </div>
    </details>
  );
};

/**
 * O tutorial de técnica, quando a conduta sugerida é uma operação.
 *
 * Discreto de propósito: some por inteiro no paciente em vigilância, e nunca
 * aparece como bloco no meio das recomendações. A pergunta "como se faz" só
 * existe depois que a pergunta "faz?" foi respondida.
 *
 * A ligação é pela chave da recomendação, não por palavra no título — ver
 * `GESTO_DA_RECOMENDACAO` em `src/data/mmcts.ts`.
 */
const TecnicaDaConduta = ({ recs }: { recs: ReturnType<typeof getRecommendations> }) => {
  const tutoriais = tutoriaisDaConduta(recs.map((r) => r.chave));
  if (tutoriais.length === 0) return null;

  return (
    <details className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <summary className="text-xs font-medium text-foreground cursor-pointer inline-flex items-center gap-1.5">
        <PlayCircle className="h-3.5 w-3.5 text-primary" />
        Técnica operatória em vídeo ({tutoriais.length})
      </summary>
      <div className="pt-2.5 space-y-2">
        <ListaDeTutoriais tutoriais={tutoriais} compacta />
        <p className="text-[10px] text-muted-foreground">
          {MMCTS.fonte}, acesso aberto — abre no site da EACTS.{" "}
          <Link to="/app/medico/tecnica" className="text-primary hover:underline">
            Ver todas por operação
          </Link>
        </p>
      </div>
    </details>
  );
};
