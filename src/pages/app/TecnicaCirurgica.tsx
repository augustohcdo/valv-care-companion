// Seção própria de técnica cirúrgica, organizada por OPERAÇÃO.
//
// A biblioteca clínica já mostra os mesmos tutoriais, mas organizados por
// DOENÇA — que é a pergunta de quem está decidindo se opera. Esta tela responde
// a outra: "vou fazer um reimplante de raiz; onde vejo o passo a passo?".
//
// Nada do MMCTS é copiado. Os vídeos, o texto e as ilustrações são da EACTS e
// abrem no site deles. O que este projeto guarda é o endereço e o título
// conferido — ver o cabeçalho de `src/data/mmcts.ts`.

import { Link } from "react-router-dom";
import { PlayCircle, ExternalLink, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListaDeTutoriais } from "@/components/mmcts/ListaDeTutoriais";
import {
  MMCTS,
  PROCEDIMENTOS,
  ORDEM_DOS_PROCEDIMENTOS,
  TUTORIAIS,
  tutoriaisDoProcedimento,
} from "@/data/mmcts";

const TecnicaCirurgica = () => {
  const grupos = ORDEM_DOS_PROCEDIMENTOS.map((chave) => ({
    chave,
    procedimento: PROCEDIMENTOS[chave],
    tutoriais: tutoriaisDoProcedimento(chave),
  })).filter((g) => g.tutoriais.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Técnica operatória"
        title="Técnica cirúrgica em vídeo"
        description="Tutoriais do Multimedia Manual of Cardio-Thoracic Surgery, a publicação de acesso aberto da EACTS, organizados pela operação que demonstram."
      />

      <Card className="bg-secondary/40 border-border">
        <CardContent className="py-4 space-y-2">
          <p className="text-sm text-foreground/85 leading-relaxed">
            <strong className="text-foreground">O que esta página é:</strong> uma lista de
            links conferidos. Os vídeos, o texto e as ilustrações são do{" "}
            <a
              href={MMCTS.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              MMCTS <ExternalLink className="h-3 w-3" />
            </a>{" "}
            (ISSN {MMCTS.issn}), de acesso {MMCTS.acesso}, e abrem no site da EACTS.
            Nada do conteúdo deles é reproduzido aqui.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {TUTORIAIS.length} tutoriais, cada endereço aberto e o título conferido em{" "}
            {MMCTS.conferidoEm}. É técnica operatória — o que fazer depois que a indicação
            já foi decidida. Para a indicação, veja a{" "}
            <Link to="/app/medico/biblioteca" className="text-primary hover:underline">
              biblioteca clínica
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {grupos.map(({ chave, procedimento, tutoriais }) => (
        <Card key={chave} className="shadow-sm-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="h-5 w-5 text-primary" />
              {procedimento.rotulo}
              <Badge variant="outline" className="text-[10px] ml-1">
                {tutoriais.length} {tutoriais.length === 1 ? "vídeo" : "vídeos"}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{procedimento.descricao}</p>
          </CardHeader>
          <CardContent>
            <ListaDeTutoriais tutoriais={tutoriais} />
          </CardContent>
        </Card>
      ))}

      <Card className="border-dashed">
        <CardContent className="py-4 flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">A cobertura é parcial, de propósito.</strong>{" "}
            Não há vídeo aqui para TAVI, para MitraClip nem para o manejo do anticoagulante:
            o MMCTS é manual de técnica operatória, e o catálogo do ValvePath só entra com o
            que foi aberto e conferido. Lacuna declarada vale mais que link forçado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TecnicaCirurgica;
