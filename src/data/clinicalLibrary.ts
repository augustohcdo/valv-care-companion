// Biblioteca clínica — resumos baseados em recomendações gerais
// das diretrizes brasileiras (SBC) e internacionais (ESC/EACTS, AHA/ACC).
// Conteúdo é educacional. Não substitui julgamento clínico individual.

export interface GuidelineSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

export interface ClinicalGuideline {
  slug: string;
  valve: "Aórtica" | "Mitral" | "Tricúspide" | "Pulmonar" | "Multivalvar";
  title: string;
  shortTitle: string;
  pathology: string;
  summary: string;
  keyPoints: string[];
  sections: GuidelineSection[];
  references: string[];
}

export const clinicalLibrary: ClinicalGuideline[] = [
  {
    slug: "estenose-aortica",
    valve: "Aórtica",
    title: "Estenose Aórtica — abordagem clínica",
    shortTitle: "Estenose Aórtica",
    pathology: "Estenose",
    summary:
      "Doença valvar mais prevalente em idosos. Causa obstrução à ejeção do ventrículo esquerdo, com remodelamento hipertrófico e potencial evolução para insuficiência cardíaca, síncope e morte súbita.",
    keyPoints: [
      "Tríade clássica: dispneia, angina e síncope (sinais de mau prognóstico).",
      "EA importante: área valvar < 1,0 cm², gradiente médio ≥ 40 mmHg, Vmax ≥ 4,0 m/s.",
      "Indicação de intervenção: EA importante sintomática ou com disfunção de VE.",
      "Decisão SAVR vs TAVI deve ser tomada em Heart Team multidisciplinar.",
      "Avaliação geriátrica e de fragilidade é mandatória em idosos.",
    ],
    sections: [
      {
        heading: "Apresentação clínica",
        body:
          "Pacientes podem permanecer assintomáticos por anos. O surgimento de sintomas (dispneia, angina ou síncope) marca queda abrupta da sobrevida sem intervenção.",
        bullets: [
          "Dispneia aos esforços é o sintoma mais comum.",
          "Angina, mesmo sem DAC obstrutiva, pode ocorrer pela hipertrofia.",
          "Síncope ao esforço sugere obstrução crítica.",
        ],
      },
      {
        heading: "Avaliação por imagem",
        bullets: [
          "Ecocardiograma transtorácico é o método inicial.",
          "Gradiente médio, Vmax, área valvar e fração de ejeção.",
          "Eco sob estresse (dobutamina) na EA de baixo fluxo / baixo gradiente com FE reduzida.",
          "Angio-TC para planejamento de TAVI (acessos, anel, calcificação).",
        ],
      },
      {
        heading: "Indicações de intervenção (resumo)",
        bullets: [
          "EA importante sintomática.",
          "EA importante assintomática com FEVE < 50%.",
          "EA importante assintomática indo para outra cirurgia cardíaca.",
          "Considerar em assintomáticos com critérios de alto risco (Vmax > 5 m/s, BNP elevado, teste de esforço positivo).",
        ],
      },
      {
        heading: "SAVR vs TAVI",
        bullets: [
          "Idade, expectativa de vida, anatomia, comorbidades e preferência do paciente.",
          "TAVI tem evidência crescente também em risco intermediário e baixo, mas decisão é individualizada.",
          "Heart Team é o padrão-ouro de decisão.",
        ],
      },
      {
        heading: "Seguimento",
        bullets: [
          "EA leve: eco a cada 3–5 anos.",
          "EA moderada: eco anual.",
          "EA importante assintomática: eco a cada 6 meses + reavaliação clínica.",
        ],
      },
    ],
    references: [
      "Diretriz Brasileira de Valvopatias — SBC, 2020.",
      "ESC/EACTS Guidelines for the management of valvular heart disease, 2021.",
      "ACC/AHA Guideline for the Management of Patients with Valvular Heart Disease, 2020.",
    ],
  },
  {
    slug: "insuficiencia-aortica",
    valve: "Aórtica",
    title: "Insuficiência Aórtica — abordagem clínica",
    shortTitle: "Insuficiência Aórtica",
    pathology: "Regurgitação",
    summary:
      "Refluxo diastólico de sangue para o ventrículo esquerdo, levando à sobrecarga de volume e remodelamento excêntrico. Pode ser aguda (emergência) ou crônica.",
    keyPoints: [
      "Forma aguda (endocardite, dissecção) é emergência cirúrgica.",
      "Forma crônica é tolerada por anos antes de descompensar.",
      "Indicação de cirurgia: sintomas, FEVE ≤ 55% ou DSVE > 50 mm (>25 mm/m²).",
      "Avaliar sempre etiologia: degenerativa, bicúspide, aortopatia associada.",
    ],
    sections: [
      {
        heading: "Etiologias frequentes",
        bullets: [
          "Doença degenerativa.",
          "Valva aórtica bicúspide.",
          "Endocardite infecciosa.",
          "Dilatação da raiz da aorta / aortopatias.",
          "Dissecção aórtica (forma aguda).",
        ],
      },
      {
        heading: "Avaliação por imagem",
        bullets: [
          "Eco com Doppler colorido — vena contracta, jato regurgitante.",
          "Volumes ventriculares e FEVE seriados.",
          "Avaliação da aorta ascendente (eco / TC / RM).",
        ],
      },
      {
        heading: "Quando intervir",
        bullets: [
          "IAo importante sintomática.",
          "IAo importante assintomática com FEVE ≤ 55%.",
          "DSVE > 50 mm ou indexado > 25 mm/m².",
          "Indicação concomitante a cirurgia de aorta ou outra valva.",
        ],
      },
    ],
    references: [
      "ESC/EACTS Guidelines, 2021.",
      "ACC/AHA Guideline VHD, 2020.",
    ],
  },
  {
    slug: "estenose-mitral",
    valve: "Mitral",
    title: "Estenose Mitral — abordagem clínica",
    shortTitle: "Estenose Mitral",
    pathology: "Estenose",
    summary:
      "Restrição à abertura mitral, predominantemente reumática no Brasil. Cursa com aumento de pressão atrial esquerda, congestão pulmonar, fibrilação atrial e risco tromboembólico.",
    keyPoints: [
      "EM importante: área valvar ≤ 1,5 cm².",
      "Fibrilação atrial é altamente prevalente — anticoagular.",
      "Comissurotomia percutânea é tratamento de escolha em anatomia favorável.",
      "Score de Wilkins orienta a aptidão para tratamento percutâneo.",
    ],
    sections: [
      {
        heading: "Apresentação clínica",
        bullets: [
          "Dispneia aos esforços, ortopneia.",
          "Hemoptise, embolia sistêmica.",
          "Sintomas frequentemente surgem na gravidez ou esforços novos.",
        ],
      },
      {
        heading: "Avaliação",
        bullets: [
          "Eco transtorácico — área valvar, gradiente, anatomia.",
          "Eco transesofágico — descartar trombo em apêndice atrial antes de procedimento.",
          "Avaliar HP, AE, função do VD.",
        ],
      },
      {
        heading: "Conduta",
        bullets: [
          "EM importante sintomática → comissurotomia percutânea ou cirurgia.",
          "Anticoagulação em FA, embolia prévia ou trombo em AE.",
          "Profilaxia secundária da febre reumática quando indicado.",
        ],
      },
    ],
    references: ["Diretriz Brasileira de Valvopatias — SBC, 2020.", "ESC/EACTS Guidelines, 2021."],
  },
  {
    slug: "insuficiencia-mitral",
    valve: "Mitral",
    title: "Insuficiência Mitral — abordagem clínica",
    shortTitle: "Insuficiência Mitral",
    pathology: "Regurgitação",
    summary:
      "Refluxo sistólico do VE para o AE. Distinguir IM primária (lesão estrutural da valva) de IM secundária (consequência de remodelamento ventricular ou atrial) é fundamental para a conduta.",
    keyPoints: [
      "IM primária importante sintomática → cirurgia (preferencialmente reparo).",
      "IM primária assintomática com FEVE ≤ 60% ou DSVE ≥ 40 mm → cirurgia.",
      "IM secundária — tratar IC otimamente; considerar TEER em pacientes selecionados.",
      "Reparo > troca quando viável.",
    ],
    sections: [
      {
        heading: "Classificação",
        bullets: [
          "Primária: prolapso, ruptura de cordoalha, endocardite, reumática.",
          "Secundária: isquêmica ou por dilatação de VE/AE.",
        ],
      },
      {
        heading: "Avaliação por imagem",
        bullets: [
          "Eco com quantificação (vena contracta, ERO, volume regurgitante).",
          "Eco transesofágico para planejamento cirúrgico/percutâneo.",
          "RM cardíaca em casos com discordância clínico-ecocardiográfica.",
        ],
      },
      {
        heading: "Conduta",
        bullets: [
          "IM primária importante: cirurgia, com prioridade ao reparo.",
          "IM secundária: terapia medicamentosa otimizada de IC; TEER em selecionados.",
          "Heart Team para casos complexos.",
        ],
      },
    ],
    references: ["ESC/EACTS Guidelines, 2021.", "ACC/AHA VHD Guideline, 2020."],
  },
  {
    slug: "insuficiencia-tricuspide",
    valve: "Tricúspide",
    title: "Insuficiência Tricúspide — abordagem clínica",
    shortTitle: "Insuficiência Tricúspide",
    pathology: "Regurgitação",
    summary:
      "Frequentemente secundária à dilatação do anel tricúspide e do VD por doença esquerda ou hipertensão pulmonar. Tem sido reconhecida como entidade de impacto prognóstico próprio.",
    keyPoints: [
      "Quase sempre secundária — investigar doença esquerda.",
      "Dilatação do anel ≥ 40 mm é critério para abordagem na cirurgia esquerda.",
      "Tratamento percutâneo (TTVR/TEER) é opção em pacientes selecionados.",
      "Considerar precocemente — esperar até descompensação piora desfechos.",
    ],
    sections: [
      {
        heading: "Quando intervir",
        bullets: [
          "IT importante sintomática.",
          "Dilatação do anel ≥ 40 mm em cirurgia esquerda concomitante.",
          "IT secundária com sintomas refratários — avaliar percutâneo em centros experientes.",
        ],
      },
    ],
    references: ["ESC/EACTS Guidelines, 2021."],
  },
  {
    slug: "doenca-multivalvar",
    valve: "Multivalvar",
    title: "Doença Multivalvar — princípios",
    shortTitle: "Doença Multivalvar",
    pathology: "Mista",
    summary:
      "Acometimento simultâneo de mais de uma valva. Avaliar interações hemodinâmicas — uma lesão pode mascarar a gravidade de outra. Decisão sempre por Heart Team.",
    keyPoints: [
      "Avaliar cada valva isoladamente e em conjunto.",
      "Atenção a lesões 'mascaradas' por baixo débito.",
      "Heart Team é mandatório.",
      "Considerar etiologia reumática no Brasil — frequente acometimento múltiplo.",
    ],
    sections: [
      {
        heading: "Pontos práticos",
        bullets: [
          "Reumática: mitral + aórtica é combinação comum.",
          "EA + IM secundária: revascularização e abordagem da EA podem reduzir IM.",
          "Decisão entre cirurgia única vs estagiada é individualizada.",
        ],
      },
    ],
    references: ["ESC/EACTS Guidelines, 2021."],
  },
  {
    slug: "endocardite-infecciosa",
    valve: "Multivalvar",
    title: "Endocardite Infecciosa — visão geral",
    shortTitle: "Endocardite Infecciosa",
    pathology: "Infecção",
    summary:
      "Doença grave com mortalidade significativa. Diagnóstico requer integração de critérios clínicos, microbiológicos e de imagem (Critérios de Duke modificados).",
    keyPoints: [
      "Hemoculturas seriadas antes do antibiótico, sempre que possível.",
      "Eco TT inicial; eco TE se suspeita persistir ou em prótese.",
      "Indicações cirúrgicas: IC, infecção não controlada, risco embólico.",
      "Endocarditis Team melhora desfechos.",
    ],
    sections: [
      {
        heading: "Indicações cirúrgicas (resumo)",
        bullets: [
          "Insuficiência cardíaca aguda por disfunção valvar.",
          "Infecção não controlada (abscesso, fístula, germe agressivo).",
          "Vegetações grandes (>10 mm) com embolização ou alto risco.",
          "Endocardite de prótese complicada.",
        ],
      },
    ],
    references: ["ESC Guidelines for the management of infective endocarditis, 2023."],
  },
];

export const libraryByValve = clinicalLibrary.reduce<Record<string, ClinicalGuideline[]>>(
  (acc, g) => {
    (acc[g.valve] ||= []).push(g);
    return acc;
  },
  {},
);
