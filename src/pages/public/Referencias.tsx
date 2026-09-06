import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

const refs = [
  {
    section: "Diretrizes clínicas",
    items: [
      {
        // Esta linha dizia "2024". Procurando a edição para citá-la direito, as
        // buscas — inclusive uma restrita ao site do próprio periódico —
        // encontram a linhagem 2011 → 2017 → 2020 e nenhuma de 2024. Busca não
        // prova ausência, mas atribuir recomendação clínica a um documento que
        // não se consegue apresentar é fabricar procedência. Fica a edição
        // apontável, com volume e páginas.
        title: "Atualização das Diretrizes Brasileiras de Valvopatias — 2020",
        org: "Sociedade Brasileira de Cardiologia (SBC) — Arq Bras Cardiol. 2020;115(4):720-775",
      },
      {
        // A citação completa passou a valer a partir do momento em que o motor
        // de conduta realmente segue esta diretriz. Antes, a página a listava e
        // o `guidelines.ts` carimbava ESC 2021 — a tela afirmava o que o código
        // não fazia.
        title: "2025 ESC/EACTS Guidelines for the management of valvular heart disease",
        org: "European Society of Cardiology / European Association for Cardio-Thoracic Surgery — Eur Heart J. 2025;46(44):4635–4736. DOI 10.1093/eurheartj/ehaf194",
      },
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

        {/*
          Quem responde pelo site, e o que ISSO significa.

          O pedido foi "coloque meu nome como avaliador e gestor". Gestor é
          verdade e vai aqui. Avaliador, no vocabulário desta base, é o selo de
          REVISÃO MÉDICA — e ele exige CRM, que ele não tem. Um site que orienta
          conduta valvar dizendo "revisado" sem médico por trás é a pior versão
          do defeito que este projeto persegue, porque o leitor confia no selo
          justamente quando não tem como conferir.

          Então o bloco diz as duas coisas na mesma tela: quem cuida do site, e
          que o conteúdo clínico ainda não passou por revisão médica. A segunda
          frase protege quem lê e protege quem assina.
        */}
        <Card className="p-6 mt-6 border-l-4 border-l-accent">
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">
            Responsável pelo site
          </h2>
          <p className="text-sm text-foreground/85 leading-relaxed">
            <strong>Augusto Henrique</strong> — criação, curadoria e gestão do ValvePath.
            Responde pela seleção das fontes, pela organização do conteúdo e pela manutenção
            da plataforma.
          </p>
          <p className="text-sm text-foreground/85 leading-relaxed mt-3">
            <strong>Revisão médica:</strong> o conteúdo clínico é organizado a partir das
            diretrizes citadas acima e <strong>ainda não passou por revisão de médico
            registrado no CRM</strong>. Onde a plataforma usa material gerado por IA — como
            os trechos que alimentam as respostas do assistente clínico — isso vem sinalizado
            como preliminar na própria resposta. Nenhum conteúdo aqui substitui avaliação
            médica, decisão do Heart Team ou conduta individualizada.
          </p>
        </Card>
      </section>
    </>
  );
};

export default Referencias;
