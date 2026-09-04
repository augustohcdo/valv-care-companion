// Lista de tutoriais do MMCTS — a mesma em todo lugar que os mostra.
//
// Existe porque são quatro telas (biblioteca, técnica cirúrgica, detalhe do
// caso e catálogo de próteses) e a parte que não pode variar é a atribuição:
// o título é da EACTS, o vídeo é deles, o link sai do site. Uma cópia por tela
// seria quatro lugares para essa atribuição se perder.

import { ExternalLink } from "lucide-react";
import { urlDoTutorial, type TutorialMmcts } from "@/data/mmcts";

export const ListaDeTutoriais = ({
  tutoriais,
  compacta,
}: {
  tutoriais: TutorialMmcts[];
  /** Sem a linha do "porque" — para onde o vídeo é nota de rodapé, não o assunto. */
  compacta?: boolean;
}) => (
  <ul className={compacta ? "space-y-1.5" : "space-y-3"}>
    {tutoriais.map((t) => (
      <li key={t.id}>
        <a
          href={urlDoTutorial(t.id)}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-medium text-primary hover:underline inline-flex items-start gap-1.5 ${
            compacta ? "text-xs" : "text-sm"
          }`}
        >
          <span>{t.titulo}</span>
          <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
        </a>
        {!compacta && <p className="text-xs text-muted-foreground mt-0.5">{t.porque}</p>}
      </li>
    ))}
  </ul>
);
