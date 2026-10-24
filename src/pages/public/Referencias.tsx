import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

const refs = [
  {
    section: "Diretrizes clínicas",
    items: [
      {
        // Esta linha já disse "2024" e depois "2020", e as duas correções
        // valem como história.
        //
        // A de 2024 foi inventada: nenhuma busca, nem a restrita ao site do
        // próprio periódico, encontrava tal edição — e atribuir recomendação
        // clínica a documento que não se consegue apresentar é fabricar
        // procedência. Ficou a de 2020, que era a apontável.
        //
        // Em 15/10/2026 a edição nova saiu e o projeto passou a carregá-la
        // inteira: o `src/data/diretrizBr2026.ts` traz as recomendações
        // verbatim, com quadro e página, e o motor de conduta a mostra ao lado
        // da ESC. Esta página, que é a cara pública da procedência, ficou nove
        // dias dizendo 2020 — a guarda de ano não a via porque procurava o ano
        // COLADO ao nome, e aqui havia um travessão no meio. Ver
        // `diretrizVigente.test.ts`.
        title: "Diretriz Brasileira de Valvopatias — 2026",
        org: "Sociedade Brasileira de Cardiologia (SBC), Sociedade Brasileira de Hemodinâmica e Cardiologia Intervencionista (SBHCI) e Sociedade Brasileira de Cirurgia Cardiovascular (SBCCV) — Arq Bras Cardiol. 2026;123(10):e20260796. DOI 10.36660/abc.20260796",
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
          O estado de revisão do conteúdo — sem nome de pessoa.

          A primeira versão deste bloco creditava o responsável pelo site pelo
          nome. O pedido do usuário foi tirar: o nome dele aparece só onde a lei
          exige, nas páginas legais, e não numa página de conteúdo.

          A frase sobre revisão médica FICA, e não depende de nome nenhum. Ela
          está aqui porque é aqui que alguém procura procedência, e porque o
          silêncio nesse ponto é lido como "revisado" — o mesmo engano do selo,
          por omissão. Enquanto nenhum médico com CRM tiver revisado, a página
          diz isso.
        */}
        <Card className="p-6 mt-6 border-l-4 border-l-accent">
          <h2 className="font-display font-semibold text-lg text-foreground mb-2">
            Estado da revisão do conteúdo
          </h2>
          <p className="text-sm text-foreground/85 leading-relaxed">
            O conteúdo clínico do ValvePath é organizado a partir das diretrizes citadas
            acima e <strong>ainda não passou por revisão de médico registrado no CRM</strong>.
            Onde a plataforma usa material gerado por IA — como os trechos que alimentam as
            respostas do assistente clínico — isso vem sinalizado como preliminar na própria
            resposta. Nenhum conteúdo aqui substitui avaliação médica, decisão do Heart Team
            ou conduta individualizada.
          </p>
        </Card>
      </section>
    </>
  );
};

export default Referencias;
