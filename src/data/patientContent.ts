// Conteúdo educacional ValvePath — linguagem para pacientes
// Baseado em: 2025 ESC/EACTS, 2020 ACC/AHA, AHA Heart Valve Disease, CDC.
// Conteúdo educacional, não substitui avaliação médica.

export interface PatientTopic {
  slug: string;
  title: string;
  category: "fundamentos" | "doencas" | "exames" | "tratamentos" | "jornada";
  shortDescription: string;
  sections: { heading: string; body: string }[];
  alerts?: string[];
  tags?: string[];
}

export const patientTopics: PatientTopic[] = [
  // ============ FUNDAMENTOS ============
  {
    slug: "o-que-sao-valvulas",
    title: "O que são válvulas cardíacas",
    category: "fundamentos",
    shortDescription: "Entenda o papel das válvulas no funcionamento do coração.",
    sections: [
      {
        heading: "O coração e suas válvulas",
        body: "O coração tem quatro câmaras e quatro válvulas que funcionam como portas. Elas se abrem para deixar o sangue passar e se fecham para impedir que ele volte. Esse movimento garante que o sangue siga sempre na direção certa: dos pulmões para o corpo e do corpo de volta aos pulmões.",
      },
      {
        heading: "Por que isso importa?",
        body: "Quando uma válvula não abre direito (estenose) ou não fecha direito (insuficiência ou regurgitação), o coração precisa trabalhar mais. Com o tempo, isso pode causar cansaço, falta de ar, inchaço nas pernas e outros sintomas.",
      },
      {
        heading: "Existe tratamento?",
        body: "Sim. Existem medicamentos, procedimentos minimamente invasivos por cateter e cirurgias. A escolha depende do tipo e da gravidade da doença, da sua idade, das outras condições de saúde e da decisão do seu médico em conjunto com o Heart Team.",
      },
    ],
    tags: ["básico", "anatomia"],
  },
  {
    slug: "quatro-valvulas",
    title: "As quatro válvulas do coração",
    category: "fundamentos",
    shortDescription: "Conheça as válvulas aórtica, mitral, tricúspide e pulmonar.",
    sections: [
      { heading: "Válvula aórtica", body: "Fica entre o ventrículo esquerdo e a aorta. Controla a saída do sangue do coração para o corpo todo. É a válvula mais frequentemente afetada em adultos mais velhos." },
      { heading: "Válvula mitral", body: "Fica entre o átrio esquerdo e o ventrículo esquerdo. Tem dois folhetos. É comum apresentar prolapso ou insuficiência (regurgitação) em diferentes idades." },
      { heading: "Válvula tricúspide", body: "Fica entre o átrio direito e o ventrículo direito. Quando o lado direito do coração dilata, pode levar à insuficiência tricúspide secundária." },
      { heading: "Válvula pulmonar", body: "Fica entre o ventrículo direito e a artéria pulmonar. É menos comumente afetada em adultos, mas é importante em cardiopatias congênitas." },
    ],
    tags: ["anatomia"],
  },
  {
    slug: "estenose",
    title: "O que é estenose valvar",
    category: "fundamentos",
    shortDescription: "Quando uma válvula fica estreita e dificulta a passagem do sangue.",
    sections: [
      { heading: "O que acontece", body: "Estenose significa que a válvula não abre completamente. Imagine uma porta que abre só pela metade. O coração precisa fazer mais força para empurrar o sangue por aquela passagem estreita." },
      { heading: "Sintomas comuns", body: "Falta de ar aos esforços, cansaço, dor no peito, tontura ou desmaio. Em fases iniciais pode não haver sintomas." },
      { heading: "O que esperar", body: "O tratamento depende da válvula afetada, da gravidade e dos sintomas. Pode envolver acompanhamento, medicações, procedimento por cateter ou cirurgia." },
    ],
    tags: ["conceito"],
  },
  {
    slug: "insuficiencia-regurgitacao",
    title: "O que é insuficiência ou regurgitação valvar",
    category: "fundamentos",
    shortDescription: "Quando a válvula não fecha bem e o sangue volta.",
    sections: [
      { heading: "O que acontece", body: "Insuficiência (também chamada de regurgitação) significa que a válvula não fecha completamente, e parte do sangue retorna na direção contrária. O coração trabalha mais para compensar esse refluxo." },
      { heading: "Sintomas comuns", body: "Pode ser silenciosa por muitos anos. Quando aparece, costuma trazer cansaço, falta de ar, palpitações e inchaço." },
      { heading: "Tratamento", body: "Depende da gravidade, da causa, do tamanho e função do coração e dos sintomas. Vai desde acompanhamento até cirurgia de reparo ou troca da válvula." },
    ],
    tags: ["conceito"],
  },
  {
    slug: "sopro-cardiaco",
    title: "O que é sopro cardíaco",
    category: "fundamentos",
    shortDescription: "O som extra que o médico ouve no estetoscópio — nem todo sopro é doença.",
    sections: [
      { heading: "O que é", body: "Sopro é um som adicional produzido pelo fluxo turbulento de sangue dentro do coração. Pode ser ouvido com o estetoscópio." },
      { heading: "É sempre doença?", body: "Não. Existem sopros inocentes, especialmente em crianças e jovens, sem qualquer doença. Outros sopros, no entanto, podem indicar uma alteração valvar." },
      { heading: "O que fazer", body: "Se o seu médico identificou um sopro, ele pode pedir um ecocardiograma para investigar. Não se assuste; muitas vezes não significa doença grave." },
    ],
    tags: ["sintoma", "exame físico"],
  },

  // ============ DOENÇAS ============
  {
    slug: "estenose-aortica",
    title: "Estenose aórtica",
    category: "doencas",
    shortDescription: "A válvula aórtica fica estreita, dificultando a saída do sangue.",
    sections: [
      { heading: "Por que acontece", body: "Em adultos mais velhos, a causa mais comum é o depósito de cálcio na válvula com o passar dos anos. Em pessoas mais jovens, pode estar relacionada a uma válvula bicúspide (anomalia congênita) ou doença reumática." },
      { heading: "Sintomas", body: "Falta de ar aos esforços, cansaço, dor no peito (angina), tontura ou desmaio. O aparecimento de sintomas é um marco clínico importante e deve ser comunicado ao seu cardiologista." },
      { heading: "Como é avaliada", body: "O ecocardiograma é o principal exame. Ele mede a velocidade do fluxo, o gradiente de pressão e a área da válvula. Em alguns casos, é necessária tomografia para planejamento de procedimentos." },
      { heading: "Tratamentos discutidos", body: "Quando a doença é grave e há sintomas, costuma-se discutir troca da válvula — por cirurgia (SAVR) ou por cateter (TAVI). A decisão é individual e tomada em conjunto com o Heart Team." },
    ],
    alerts: ["Desmaio, dor no peito intensa ou falta de ar súbita exigem atendimento médico imediato."],
    tags: ["aórtica", "estenose"],
  },
  {
    slug: "insuficiencia-aortica",
    title: "Insuficiência aórtica",
    category: "doencas",
    shortDescription: "A válvula aórtica não fecha bem e parte do sangue retorna ao coração.",
    sections: [
      { heading: "Por que acontece", body: "Pode ser causada por dilatação da aorta, válvula bicúspide, doença reumática, endocardite ou outras condições. Existem formas crônicas (de longa data) e agudas (mais raras e graves)." },
      { heading: "Sintomas", body: "A forma crônica pode ser silenciosa por anos. Quando aparece, traz cansaço, falta de ar e palpitações. A forma aguda é uma emergência." },
      { heading: "Como é avaliada", body: "Ecocardiograma para avaliar gravidade, função do ventrículo esquerdo e dimensões da aorta. Tomografia ou ressonância podem ser indicadas em casos específicos." },
      { heading: "Tratamentos discutidos", body: "Pode envolver acompanhamento, medicações para controle da pressão e, em casos selecionados, cirurgia de reparo ou troca da válvula." },
    ],
    tags: ["aórtica", "insuficiência"],
  },
  {
    slug: "insuficiencia-mitral",
    title: "Insuficiência mitral",
    category: "doencas",
    shortDescription: "A válvula mitral não fecha bem e parte do sangue volta para o átrio.",
    sections: [
      { heading: "Tipos", body: "Existem duas formas principais: primária (a válvula em si está alterada — por exemplo, prolapso) e secundária (a válvula é estruturalmente normal, mas o ventrículo dilatou e ela não consegue mais fechar)." },
      { heading: "Sintomas", body: "Cansaço, falta de ar, palpitação, em alguns casos arritmias como fibrilação atrial." },
      { heading: "Como é avaliada", body: "Ecocardiograma transtorácico e, com frequência, transesofágico. A avaliação detalhada do mecanismo é fundamental para planejar o tratamento." },
      { heading: "Tratamentos discutidos", body: "Medicações de base, reparo cirúrgico (preferido sempre que possível na forma primária), troca valvar ou terapia transcateter (TEER). A decisão é individualizada e discutida em Heart Team." },
    ],
    tags: ["mitral", "insuficiência"],
  },
  {
    slug: "estenose-mitral",
    title: "Estenose mitral",
    category: "doencas",
    shortDescription: "A válvula mitral fica estreita e dificulta a passagem do sangue.",
    sections: [
      { heading: "Por que acontece", body: "A causa mais comum em todo o mundo é a doença reumática, sequela de infecção por estreptococo na infância. Existe também a forma degenerativa, com calcificação do anel mitral, mais comum em idosos." },
      { heading: "Sintomas", body: "Falta de ar (especialmente ao se deitar), cansaço, palpitações, em alguns casos tosse com sangue ou eventos como AVC quando associada a fibrilação atrial." },
      { heading: "Como é avaliada", body: "Ecocardiograma com medida da área valvar e do gradiente. O ecocardiograma transesofágico é frequentemente necessário." },
      { heading: "Tratamentos discutidos", body: "Inclui controle de arritmias, anticoagulação quando indicada, valvotomia por balão (em casos selecionados), reparo ou troca cirúrgica. Na forma degenerativa, abordagens são mais complexas." },
    ],
    tags: ["mitral", "estenose"],
  },
  {
    slug: "insuficiencia-tricuspide",
    title: "Insuficiência tricúspide",
    category: "doencas",
    shortDescription: "A válvula tricúspide não fecha bem e o sangue volta no lado direito do coração.",
    sections: [
      { heading: "Por que acontece", body: "Na maioria das vezes é secundária — a válvula em si está estruturalmente normal, mas o lado direito do coração dilatou. Causas comuns: hipertensão pulmonar, doença valvar esquerda de longa data, fibrilação atrial." },
      { heading: "Sintomas", body: "Inchaço nas pernas, aumento da barriga, cansaço, congestão do fígado. Por muito tempo foi subdiagnosticada e subtratada." },
      { heading: "Como é avaliada", body: "Ecocardiograma com avaliação cuidadosa da gravidade, do tamanho e função do ventrículo direito e da pressão pulmonar." },
      { heading: "Tratamentos discutidos", body: "Diuréticos para alívio dos sintomas, tratamento da causa de base, em casos selecionados cirurgia ou terapias transcateter emergentes. Discussão em Heart Team é essencial." },
    ],
    tags: ["tricúspide"],
  },
  {
    slug: "protese-valvar",
    title: "Próteses valvares: biológica e mecânica",
    category: "tratamentos",
    shortDescription: "Quando a válvula precisa ser substituída, existem dois tipos principais.",
    sections: [
      { heading: "Prótese biológica", body: "Feita com tecido animal tratado. Não exige anticoagulação a longo prazo na maioria dos casos. Tem durabilidade limitada e pode degenerar com os anos, especialmente em pessoas mais jovens." },
      { heading: "Prótese mecânica", body: "Feita de material sintético, costuma durar muitos anos. Exige uso contínuo de anticoagulante, com controle laboratorial regular." },
      { heading: "Como é a escolha", body: "Depende da idade, do estilo de vida, da capacidade de fazer controles regulares de anticoagulação, dos riscos individuais e das suas preferências. É uma decisão compartilhada com o seu médico." },
    ],
    tags: ["prótese"],
  },
  {
    slug: "tavi",
    title: "TAVI — implante valvar aórtico por cateter",
    category: "tratamentos",
    shortDescription: "Implante da válvula aórtica por cateter, sem abrir o tórax.",
    sections: [
      { heading: "Como funciona", body: "A nova válvula é levada até o coração por um cateter, geralmente passando por uma artéria da virilha. Não é necessária parar o coração nem abrir o tórax na maioria dos casos." },
      { heading: "Para quem", body: "Indicado em casos selecionados de estenose aórtica grave sintomática. A escolha entre TAVI e cirurgia é tomada pelo Heart Team levando em conta idade, anatomia, risco e preferências." },
      { heading: "Recuperação", body: "Costuma ser mais rápida do que a cirurgia. Hospitalização breve. Acompanhamento regular é essencial para checar o funcionamento da prótese." },
    ],
    tags: ["TAVI", "cateter"],
  },
  {
    slug: "cirurgia-valvar",
    title: "Cirurgia valvar",
    category: "tratamentos",
    shortDescription: "Reparo ou troca da válvula em cirurgia cardíaca.",
    sections: [
      { heading: "O que é", body: "Cirurgia em que o cirurgião acessa o coração para reparar ou trocar uma válvula. Pode ser feita por esternotomia ou, em casos selecionados, por técnicas minimamente invasivas." },
      { heading: "Reparo vs troca", body: "Sempre que possível, prefere-se reparar a válvula em vez de trocá-la, especialmente na válvula mitral primária. O reparo costuma preservar melhor a função do coração a longo prazo." },
      { heading: "Recuperação", body: "Inclui internação hospitalar, alguns dias na unidade de cuidados, retorno gradual às atividades, reabilitação cardíaca e acompanhamento ambulatorial." },
    ],
    tags: ["cirurgia"],
  },
  {
    slug: "terapias-transcateter",
    title: "Terapias transcateter mitrais e tricúspides",
    category: "tratamentos",
    shortDescription: "Procedimentos por cateter para válvulas mitral e tricúspide em casos selecionados.",
    sections: [
      { heading: "O que são", body: "Tratamentos que abordam essas válvulas sem necessidade de cirurgia aberta, usando cateteres. Inclui técnicas de borda-a-borda (TEER), implantes valvares transcateter e outras." },
      { heading: "Para quem", body: "Para pacientes selecionados, geralmente com alto risco cirúrgico ou anatomia adequada. A decisão é sempre do Heart Team." },
      { heading: "O que esperar", body: "Hospitalização mais curta que cirurgia tradicional, recuperação mais rápida na maioria dos casos, e acompanhamento regular para avaliar o resultado." },
    ],
    tags: ["transcateter"],
  },

  // ============ EXAMES ============
  {
    slug: "ecocardiograma",
    title: "Ecocardiograma",
    category: "exames",
    shortDescription: "O principal exame para avaliar válvulas cardíacas — usa ultrassom.",
    sections: [
      { heading: "O que é", body: "Exame de imagem que usa ultrassom para mostrar as estruturas e o funcionamento do coração em tempo real. É indolor e não usa radiação." },
      { heading: "Para que serve", body: "Avalia o tamanho e a função das câmaras, a anatomia e a movimentação das válvulas, mede gradientes e regurgitações, estima pressões." },
      { heading: "Tipos", body: "Transtorácico (pelo tórax — o mais comum) e transesofágico (sonda passada pela boca/esôfago, com sedação leve, para imagens mais detalhadas)." },
    ],
    tags: ["ultrassom", "imagem"],
  },
  {
    slug: "tomografia",
    title: "Tomografia computadorizada do coração",
    category: "exames",
    shortDescription: "Exame de imagem detalhado para planejamento de procedimentos.",
    sections: [
      { heading: "Para que serve", body: "Muito utilizada para planejamento de TAVI e outros procedimentos transcateter. Avalia anatomia precisa, calcificação, dimensões e acessos vasculares." },
      { heading: "Como é feita", body: "Em poucos minutos, dentro de um aparelho aberto. Pode usar contraste iodado e o paciente deve seguir orientações sobre função renal e medicações." },
    ],
    tags: ["TC", "imagem"],
  },
  {
    slug: "cateterismo",
    title: "Cateterismo cardíaco",
    category: "exames",
    shortDescription: "Avalia coração e coronárias por dentro, usando cateteres.",
    sections: [
      { heading: "O que é", body: "Exame em que cateteres finos são levados até o coração e às coronárias, geralmente pela artéria do punho ou da virilha." },
      { heading: "Para que serve em valvopatias", body: "Pode ser indicado para avaliar coronárias antes de cirurgia ou TAVI, medir pressões dentro do coração ou esclarecer dúvidas após o ecocardiograma." },
    ],
    tags: ["invasivo"],
  },
  {
    slug: "ressonancia",
    title: "Ressonância magnética cardíaca",
    category: "exames",
    shortDescription: "Imagem detalhada do músculo cardíaco e das válvulas.",
    sections: [
      { heading: "O que é", body: "Exame de imagem que usa campos magnéticos, sem radiação. Fornece informações detalhadas sobre o músculo cardíaco, a função e algumas valvopatias." },
      { heading: "Quando é pedida", body: "Em casos em que o ecocardiograma não foi suficiente, para avaliar fibrose cardíaca ou em valvopatias específicas, especialmente em pacientes mais jovens." },
    ],
    tags: ["RM", "imagem"],
  },
  {
    slug: "anticoagulacao",
    title: "Anticoagulação — entendendo de forma simples",
    category: "tratamentos",
    shortDescription: "Medicações que evitam coágulos. Devem ser usadas exatamente como prescrito.",
    sections: [
      { heading: "Por que é usada", body: "Em algumas valvopatias e após implante de prótese mecânica, é necessário usar anticoagulante para reduzir o risco de coágulos no coração." },
      { heading: "Cuidados gerais", body: "Tomar exatamente como prescrito, fazer os controles laboratoriais quando indicado, avisar todos os médicos e dentistas que faz uso, ter cuidado com sangramentos e nunca interromper sem orientação." },
    ],
    alerts: [
      "Sangramento importante, fezes pretas, sangue na urina ou hematomas grandes exigem atendimento imediato.",
      "Nunca pare ou ajuste a dose por conta própria. Sempre converse com seu médico.",
    ],
    tags: ["medicação"],
  },

  // ============ JORNADA ============
  {
    slug: "antes-do-procedimento",
    title: "Antes do procedimento",
    category: "jornada",
    shortDescription: "O que esperar e como se preparar.",
    sections: [
      { heading: "Avaliação pré-operatória", body: "Inclui exames de sangue, eletrocardiograma, avaliação cardiológica e, em muitos casos, anestésica. O objetivo é planejar o procedimento com segurança." },
      { heading: "Medicações", body: "Algumas medicações precisam ser ajustadas ou suspensas antes do procedimento. Sempre siga as orientações do seu médico — não pare nada por conta própria." },
      { heading: "Preparo no dia", body: "Geralmente é necessário jejum. Você receberá orientações específicas sobre horário, exames a levar e acompanhante." },
    ],
    tags: ["jornada"],
  },
  {
    slug: "internacao",
    title: "Durante a internação",
    category: "jornada",
    shortDescription: "Como costuma ser a experiência hospitalar.",
    sections: [
      { heading: "O que esperar", body: "Após o procedimento, você ficará em uma área de cuidados intensivos por um período. A equipe monitora o coração, a pressão e a recuperação." },
      { heading: "Movimentação", body: "A mobilização precoce é estimulada quando seguro. Caminhar, respirar fundo e seguir as orientações da fisioterapia ajuda na recuperação." },
    ],
    tags: ["jornada"],
  },
  {
    slug: "alta-hospitalar",
    title: "Alta hospitalar",
    category: "jornada",
    shortDescription: "Orientações fundamentais para o retorno para casa.",
    sections: [
      { heading: "Medicações", body: "Você sairá com uma lista de medicações. Tome exatamente como prescrito e leve a lista a todas as consultas." },
      { heading: "Atividades", body: "Há restrições temporárias para esforço físico, dirigir e levantar peso. Siga as orientações da equipe." },
      { heading: "Cuidado com a ferida", body: "Mantenha limpa e seca. Avise o médico se houver vermelhidão, secreção, calor local ou febre." },
    ],
    tags: ["jornada"],
  },
  {
    slug: "recuperacao",
    title: "Recuperação em casa",
    category: "jornada",
    shortDescription: "Reabilitação e retorno gradual à rotina.",
    sections: [
      { heading: "Reabilitação cardíaca", body: "Programa supervisionado de exercícios, educação e suporte. Quando indicada, melhora muito a recuperação e a qualidade de vida." },
      { heading: "Volta às atividades", body: "Acontece de forma gradual. Cada paciente tem seu ritmo. Não compare seu tempo com o de outras pessoas." },
    ],
    tags: ["jornada"],
  },
  {
    slug: "follow-up",
    title: "Follow-up — acompanhamento",
    category: "jornada",
    shortDescription: "O acompanhamento regular é fundamental, mesmo se você se sentir bem.",
    sections: [
      { heading: "Por que é importante", body: "Permite ao seu médico avaliar a evolução, ajustar medicações, identificar precocemente qualquer alteração e reforçar orientações." },
      { heading: "Quando voltar", body: "Em geral, há consultas mais próximas no início e depois com intervalos maiores. Seu médico definirá o melhor cronograma." },
    ],
    tags: ["jornada"],
  },
  {
    slug: "sinais-de-alerta",
    title: "Sinais de alerta — quando procurar ajuda",
    category: "jornada",
    shortDescription: "Sintomas que exigem atendimento médico imediato.",
    sections: [
      {
        heading: "Procure atendimento de emergência se:",
        body: "Dor no peito intensa, falta de ar súbita ou em repouso, desmaio, palpitações com mal-estar, sangramento importante, febre persistente após procedimento, vermelhidão e secreção na ferida, fraqueza ou dormência súbita em um lado do corpo, dificuldade para falar ou alteração visual aguda.",
      },
      {
        heading: "Comunique seu médico em até 24-48h se:",
        body: "Aumento do cansaço, ganho rápido de peso, inchaço novo nas pernas, tosse persistente, dificuldade para deitar, sangramentos pequenos repetidos.",
      },
    ],
    alerts: ["Em emergência, ligue para o serviço local (SAMU 192) ou vá ao pronto-socorro mais próximo."],
    tags: ["alerta", "emergência"],
  },
];

export const patientCategories = {
  fundamentos: { label: "Fundamentos", description: "Conceitos básicos sobre válvulas e doenças valvares." },
  doencas: { label: "Doenças", description: "Conheça as principais doenças valvares cardíacas." },
  exames: { label: "Exames", description: "Como cada exame é feito e o que avalia." },
  tratamentos: { label: "Tratamentos", description: "Opções terapêuticas frequentemente discutidas." },
  jornada: { label: "Jornada", description: "Do diagnóstico ao acompanhamento de longo prazo." },
};

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const glossary: GlossaryEntry[] = [
  { term: "Aorta", definition: "Maior artéria do corpo, sai do ventrículo esquerdo e leva sangue oxigenado para o organismo." },
  { term: "Anel valvar", definition: "Estrutura em forma de anel onde os folhetos da válvula se inserem." },
  { term: "Bicúspide", definition: "Válvula com dois folhetos, em vez dos três habituais. Comum na válvula aórtica como variação congênita." },
  { term: "Cateterismo", definition: "Procedimento em que cateteres finos são levados até o coração para avaliar coronárias e pressões." },
  { term: "Ecocardiograma", definition: "Exame de imagem que usa ultrassom para avaliar o coração e as válvulas." },
  { term: "Estenose", definition: "Estreitamento de uma válvula que dificulta a passagem do sangue." },
  { term: "FEVE", definition: "Fração de ejeção do ventrículo esquerdo. Indica quanto do sangue é bombeado a cada batimento." },
  { term: "Fibrilação atrial", definition: "Arritmia comum em valvopatias, com batimentos irregulares dos átrios." },
  { term: "Folhetos", definition: "Lâminas finas que se abrem e fecham para permitir a passagem do sangue pela válvula." },
  { term: "Gradiente", definition: "Diferença de pressão através de uma válvula. Quanto maior, geralmente mais estreita está a válvula." },
  { term: "Heart Team", definition: "Equipe multidisciplinar (cardiologistas, cirurgiões, intervencionistas, imagem) que decide em conjunto o melhor tratamento." },
  { term: "Insuficiência valvar", definition: "Também chamada de regurgitação. A válvula não fecha bem e parte do sangue retorna." },
  { term: "Mitral", definition: "Válvula entre o átrio esquerdo e o ventrículo esquerdo." },
  { term: "NYHA", definition: "Classificação funcional dos sintomas de insuficiência cardíaca (de I a IV)." },
  { term: "Prolapso", definition: "Quando um ou mais folhetos se projetam além de sua posição normal durante o fechamento." },
  { term: "Prótese", definition: "Válvula artificial implantada quando a original precisa ser substituída. Pode ser biológica ou mecânica." },
  { term: "Regurgitação", definition: "Mesmo que insuficiência valvar — sangue retorna por má coaptação." },
  { term: "SAVR", definition: "Sigla para troca cirúrgica da válvula aórtica." },
  { term: "Sopro", definition: "Som extra ouvido com estetoscópio. Pode ser inocente ou indicar uma alteração valvar." },
  { term: "TAVI", definition: "Implante valvar aórtico por cateter, sem necessidade de abrir o tórax." },
  { term: "TEER", definition: "Reparo de borda-a-borda transcateter, técnica para insuficiência mitral ou tricúspide em casos selecionados." },
  { term: "Tricúspide", definition: "Válvula com três folhetos, entre átrio direito e ventrículo direito." },
  { term: "Vmax", definition: "Velocidade máxima do fluxo através de uma válvula, medida ao ecocardiograma." },
];

export interface FAQ {
  question: string;
  answer: string;
}

export const faqs: FAQ[] = [
  {
    question: "Toda doença valvar exige cirurgia?",
    answer: "Não. Muitas valvopatias são acompanhadas por anos sem necessidade de procedimento. A decisão depende da gravidade, dos sintomas, da função do coração e da sua condição geral.",
  },
  {
    question: "Posso ter uma vida normal com uma valvopatia?",
    answer: "Em muitos casos, sim. Com acompanhamento regular, controle de fatores de risco e tratamento adequado quando indicado, é possível manter qualidade de vida e atividade física.",
  },
  {
    question: "Sopro no coração é sempre grave?",
    answer: "Não. Existem sopros chamados inocentes, especialmente em crianças e jovens, que não significam doença. Outros podem indicar alteração valvar e merecem investigação.",
  },
  {
    question: "TAVI é melhor que cirurgia?",
    answer: "Não há resposta única. As duas opções têm vantagens e indicações específicas. A escolha é feita em conjunto pelo Heart Team, considerando idade, anatomia, risco cirúrgico, expectativa de vida e preferências do paciente.",
  },
  {
    question: "Vou precisar tomar anticoagulante para sempre?",
    answer: "Depende. Próteses mecânicas geralmente exigem anticoagulação contínua. Próteses biológicas, na maioria dos casos, não. Algumas condições associadas (como fibrilação atrial) também influenciam.",
  },
  {
    question: "Posso fazer atividade física?",
    answer: "Em geral, sim — e é recomendado. Mas o tipo e a intensidade dependem da sua condição. Converse sempre com seu cardiologista antes de iniciar ou intensificar exercícios.",
  },
  {
    question: "O que é Heart Team?",
    answer: "É uma equipe multidisciplinar (cardiologistas clínicos, intervencionistas, cirurgiões, especialistas em imagem) que discute casos complexos para definir o melhor tratamento, com base nas diretrizes e na situação individual.",
  },
  {
    question: "ValvePath substitui meu médico?",
    answer: "Não. ValvePath é uma ferramenta de apoio educacional e organizacional. Toda decisão clínica deve ser tomada pelo seu médico, com base em avaliação individual.",
  },
];
