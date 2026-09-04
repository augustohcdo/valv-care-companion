// Índice do conteúdo educacional do PACIENTE logado.
//
// ## Por que este arquivo não importa mais `clinicalLibrary`
//
// Até esta rodada ele servia `src/data/clinicalLibrary.ts` — a biblioteca do
// MÉDICO — sob um cabeçalho que promete "linguagem cuidadosa". O paciente lia
// "Indicação Classe I", "IIa B no assintomático de risco baixo", "DSVE indexado
// > 25 mm/m²". O conteúdo escrito para ele já existia e estava parado em
// `src/data/patientContent.ts`, usado só pelas páginas públicas.
//
// A troca não perde a personalização: `caseToGuidelineSlug` devolve os slugs da
// valvopatia registrada pelo médico, e os seis de valva existem com o mesmo
// nome nos dois arquivos. O que ele ganha é o resto — exames, internação,
// alta, recuperação, sinais de alerta —, agrupado pelas categorias que
// `patientContent` já declara.
//
// `src/test/pacienteSemNotacao.test.tsx` reprova se alguma tela sob
// `/app/paciente/` voltar a importar a biblioteca do médico.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, HeartPulse, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { patientTopics, patientCategories, type PatientTopic } from "@/data/patientContent";
import { categoryIllustrations } from "@/components/illustrations/categoryIllustrations";
import { caseToGuidelineSlug } from "@/lib/clinicalLabels";

/** Ordem de exibição das categorias. A do arquivo é de escrita, não de leitura. */
const ORDEM: (keyof typeof patientCategories)[] = [
  "doencas",
  "fundamentos",
  "exames",
  "tratamentos",
  "jornada",
  "aprofundamento",
];

const PacienteAprender = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState<{ valve_type: string; valve_disease: string }[]>([]);
  const [loading, setLoading] = useState(true);
  // Falha de leitura NÃO pode virar "você não tem caso registrado". Sem os
  // casos, a seção personalizada não aparece — e a tela diz por quê, em vez de
  // deixar o paciente concluir que o médico não registrou nada.
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pat, error: erroPaciente } = await supabase
        .from("patients")
        .select("id")
        .is("deleted_at", null)
        .eq("user_id", user.id)
        .maybeSingle();
      if (erroPaciente) {
        setFalhou(true);
        setLoading(false);
        return;
      }
      if (!pat) {
        setLoading(false);
        return;
      }
      const { data: cs, error: erroCasos } = await supabase
        .from("clinical_cases")
        .select("id, valve_type, valve_disease")
        .is("deleted_at", null)
        .eq("patient_id", pat.id)
        .neq("status", "draft" as any);
      if (erroCasos) {
        setFalhou(true);
        setLoading(false);
        return;
      }
      setCases(cs || []);
      setLoading(false);
    })();
  }, [user]);

  const slugsDaCondicao = new Set<string>();
  cases.forEach((c) => {
    const s = caseToGuidelineSlug(c.valve_type, c.valve_disease);
    if (s) slugsDaCondicao.add(s);
  });

  const personalizados = patientTopics.filter((t) => slugsDaCondicao.has(t.slug));

  const porCategoria = ORDEM.map((chave) => ({
    chave,
    categoria: patientCategories[chave],
    topicos: patientTopics.filter((t) => t.category === chave),
  })).filter((g) => g.topicos.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conteúdo educacional"
        title="Aprender sobre minhas valvopatias"
        description="Conteúdo organizado especialmente para você, com base nos casos clínicos registrados pelo seu médico. Linguagem cuidadosa, sem substituir a consulta médica."
      />

      {!loading && personalizados.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-sm-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" /> Personalizado para você
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conteúdos relacionados à sua condição. Selecionados a partir dos casos
              registrados na plataforma.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {personalizados.map((t) => (
                <CartaoTopico key={t.slug} topico={t} destaque />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && falhou && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/85 leading-relaxed">
              <strong className="text-foreground">Não conseguimos carregar seus casos agora.</strong>{" "}
              Isso é uma falha de conexão com o sistema — não quer dizer que você
              não tenha casos registrados. Todo o conteúdo abaixo continua
              disponível; recarregue a página para ver os destaques da sua condição.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !falhou && cases.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <HeartPulse className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Quando seu médico registrar um caso clínico, conteúdos personalizados
            aparecerão aqui automaticamente.
          </CardContent>
        </Card>
      )}

      {porCategoria.map(({ chave, categoria, topicos }) => {
        const Ilustracao = categoryIllustrations[chave];
        return (
          <Card key={chave} className="shadow-sm-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                {Ilustracao ? (
                  <span className="h-9 w-9 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
                    <Ilustracao className="h-6 w-6" />
                  </span>
                ) : (
                  <BookOpen className="h-5 w-5 text-primary" />
                )}
                <span className="min-w-0">
                  <span className="block">{categoria.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {categoria.description}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {topicos.map((t) => (
                  <CartaoTopico
                    key={t.slug}
                    topico={t}
                    daSuaCondicao={slugsDaCondicao.has(t.slug)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="bg-secondary/40 border-border">
        <CardContent className="py-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Importante:</strong> Este conteúdo é educativo
            e baseado em diretrizes nacionais e internacionais. Não substitui a avaliação do seu
            cardiologista. Em caso de sintomas novos, dor torácica, falta de ar súbita ou síncope,
            procure imediatamente um pronto-atendimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const CartaoTopico = ({
  topico,
  destaque,
  daSuaCondicao,
}: {
  topico: PatientTopic;
  destaque?: boolean;
  daSuaCondicao?: boolean;
}) => (
  <Link
    to={`/app/paciente/aprender/${topico.slug}`}
    className={
      destaque
        ? "group p-4 rounded-lg bg-card border border-border hover:border-primary hover:shadow-md transition-all"
        : "group p-4 rounded-lg border border-border hover:border-primary/60 hover:bg-secondary/40 transition-all"
    }
  >
    <div className="flex items-center gap-2 flex-wrap">
      {daSuaCondicao && (
        <Badge variant="secondary" className="text-[10px]">Da sua condição</Badge>
      )}
      {topico.tags?.slice(0, 2).map((tag) => (
        <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
      ))}
    </div>
    <h3 className="font-serif text-base text-primary mt-2 leading-snug">{topico.title}</h3>
    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topico.shortDescription}</p>
    {destaque && (
      <span className="text-xs text-primary font-medium inline-flex items-center gap-1 mt-2 group-hover:gap-2 transition-all">
        Ler conteúdo <ChevronRight className="h-3 w-3" />
      </span>
    )}
  </Link>
);

export default PacienteAprender;
