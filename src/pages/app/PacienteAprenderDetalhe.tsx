// Detalhe de um tópico educacional do PACIENTE logado.
//
// Serve `src/data/patientContent.ts`, não `clinicalLibrary`. O tipo do paciente
// não tem `keyPoints` nem `references` — e nenhum dos dois faz falta aqui: o
// primeiro era uma lista de recomendações com Classe e Nível; o segundo, uma
// citação em inglês. O que ele tem, e a tela do médico não tinha, é `alerts`:
// sinais que mandam procurar atendimento. Esses aparecem em destaque.

import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { patientTopics, patientCategories } from "@/data/patientContent";
import { categoryIllustrations } from "@/components/illustrations/categoryIllustrations";

/**
 * Endereços que a versão antiga desta tela servia com a biblioteca do médico e
 * que não existem como tópico de paciente. Sem isto, um link salvo pelo
 * paciente cairia no índice sem explicação. `endocardite-infecciosa` e
 * `anticoagulacao-protese` têm equivalente escrito para leigo.
 */
const APELIDOS: Record<string, string> = {
  "endocardite-infecciosa": "endocardite-prevencao",
  "anticoagulacao-protese": "anticoagulacao",
};

const PacienteAprenderDetalhe = () => {
  const { slug } = useParams();
  const destino = slug && APELIDOS[slug];
  const topico = patientTopics.find((t) => t.slug === slug);

  if (!topico) {
    return (
      <Navigate
        to={destino ? `/app/paciente/aprender/${destino}` : "/app/paciente/aprender"}
        replace
      />
    );
  }

  const categoria = patientCategories[topico.category];
  const Ilustracao = categoryIllustrations[topico.category];
  const relacionados = patientTopics
    .filter((t) => t.category === topico.category && t.slug !== topico.slug)
    .slice(0, 4);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow={categoria?.label ?? "Conteúdo educacional"}
        title={topico.title}
        description={topico.shortDescription}
        breadcrumbs={[
          { label: "Início", to: "/app/paciente" },
          { label: "Aprender", to: "/app/paciente/aprender" },
          { label: topico.title },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/app/paciente/aprender"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
        }
      />

      {Ilustracao && (
        <Card className="bg-accent-soft/60 border-border">
          <CardContent className="py-6 flex items-center justify-center">
            <Ilustracao className="w-full max-w-[200px] h-auto" />
          </CardContent>
        </Card>
      )}

      {topico.alerts && topico.alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Sinais de atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topico.alerts.map((a, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {topico.sections.map((secao, i) => (
        <Card key={i} className="shadow-sm-soft">
          <CardHeader>
            <CardTitle className="text-base">{secao.heading}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-foreground leading-relaxed">
            <p className="whitespace-pre-wrap">{secao.body}</p>
          </CardContent>
        </Card>
      ))}

      {relacionados.length > 0 && (
        <Card className="bg-secondary/40">
          <CardHeader>
            <CardTitle className="text-sm">Continue lendo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {relacionados.map((t) => (
              <Link
                key={t.slug}
                to={`/app/paciente/aprender/${t.slug}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">{t.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {topico.tags && topico.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topico.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
          ))}
        </div>
      )}

      <Card className="bg-secondary/40 border-border">
        <CardContent className="py-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Importante:</strong> Este conteúdo é educativo
            e não substitui a avaliação do seu cardiologista. Leve suas dúvidas para a próxima
            consulta — e, diante de sintoma novo e intenso, procure um pronto-atendimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PacienteAprenderDetalhe;
