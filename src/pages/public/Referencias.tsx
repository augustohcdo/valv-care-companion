import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { BookOpen, ExternalLink } from "lucide-react";

const refs = [
  {
    section: "Diretrizes clínicas",
    items: [
      { title: "2025 ESC/EACTS Guidelines for the management of valvular heart disease", org: "European Society of Cardiology / European Association for Cardio-Thoracic Surgery" },
      { title: "2020 ACC/AHA Guideline for the Management of Patients With Valvular Heart Disease", org: "American College of Cardiology / American Heart Association" },
    ],
  },
  {
    section: "Conteúdo educacional",
    items: [
      { title: "Heart Valve Disease — materiais para pacientes", org: "American Heart Association (AHA)" },
      { title: "Heart Valve Disease — informações de saúde pública", org: "Centers for Disease Control and Prevention (CDC)" },
    ],
  },
  {
    section: "Marco regulatório e proteção de dados",
    items: [
      { title: "LGPD — Lei nº 13.709/2018", org: "Tratamento de dados pessoais e dados pessoais sensíveis de saúde" },
      { title: "Anvisa RDC nº 657/2022", org: "Software as a Medical Device (SaMD) — quando aplicável" },
    ],
  },
];

const Referencias = () => {
  return (
    <>
      <PageHeader
        eyebrow="Base científica"
        title="Referências e bases científicas"
        description="O conteúdo do ValvePath é orientado por diretrizes internacionais e materiais educacionais reconhecidos."
      />
      <section className="container-vp py-12 max-w-4xl">
        {refs.map((r) => (
          <div key={r.section} className="mb-10">
            <h2 className="font-display font-semibold text-2xl text-foreground mb-4">{r.section}</h2>
            <div className="space-y-3">
              {r.items.map((it, i) => (
                <Card key={i} className="p-5 flex items-start gap-4 card-elevated">
                  <div className="h-10 w-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-base text-foreground">{it.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{it.org}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}

        <Card className="p-6 bg-secondary/40 mt-10">
          <p className="text-sm text-foreground/85 leading-relaxed">
            <strong>Nota metodológica:</strong> ValvePath não reproduz textualmente recomendações específicas com classes ou níveis de evidência. O conteúdo apresentado é educacional, orientado por essas referências, e serve para apoiar a discussão clínica entre o profissional, o paciente e o Heart Team. Recomendações detalhadas devem ser consultadas diretamente nos documentos originais.
          </p>
        </Card>
      </section>
    </>
  );
};

export default Referencias;
