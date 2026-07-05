// Conteúdo educacional ValvePath — linguagem para pacientes
// Baseado em: 2025 ESC/EACTS, 2020/2021 ACC/AHA, AHA Heart Valve Disease,
// Diretriz Brasileira de Valvopatias SBC 2020, CDC, Heart Valve Voice,
// Cleveland Clinic, Mayo Clinic, NHS UK, UpToDate (patient-level).
// Conteúdo educacional, não substitui avaliação médica.

export interface PatientTopic {
  slug: string;
  title: string;
  category: "fundamentos" | "doencas" | "exames" | "tratamentos" | "jornada" | "aprofundamento";
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
        body: "O coração é um músculo do tamanho do seu punho fechado, que bate cerca de 100.000 vezes por dia, bombeando aproximadamente 7.500 litros de sangue. Ele possui quatro câmaras — dois átrios (superiores) e dois ventrículos (inferiores) — e quatro válvulas que funcionam como portas de mão única. Cada vez que o coração bate, essas válvulas se abrem para deixar o sangue passar e se fecham para impedir que ele retorne. Esse mecanismo garante um fluxo contínuo e organizado: o sangue pobre em oxigênio vai do lado direito do coração para os pulmões, lá recebe oxigênio, volta para o lado esquerdo e é bombeado para todo o corpo através da aorta.",
      },
      {
        heading: "Como funciona o ciclo cardíaco",
        body: "O ciclo cardíaco tem duas fases. Na diástole, o coração relaxa e as válvulas mitral e tricúspide se abrem para encher os ventrículos. Na sístole, o coração contrai: as válvulas mitral e tricúspide se fecham (produzindo a primeira bulha — 'tum') e as válvulas aórtica e pulmonar se abrem para ejetar o sangue. Logo em seguida, aórtica e pulmonar se fecham (produzindo a segunda bulha — 'tá'). Esse 'tum-tá' que o médico escuta com o estetoscópio é o som das válvulas trabalhando.",
      },
      {
        heading: "Por que as válvulas são importantes?",
        body: "Quando uma válvula não abre completamente (estenose), o coração precisa fazer mais força para empurrar o sangue por uma passagem estreita — como tentar soprar água por um canudo fino. Quando não fecha completamente (insuficiência ou regurgitação), parte do sangue volta na direção errada, e o coração precisa bombear um volume extra para compensar. Com o tempo, essa sobrecarga pode levar a aumento do tamanho do coração, enfraquecimento do músculo cardíaco, arritmias, insuficiência cardíaca e até risco de vida.",
      },
      {
        heading: "Quem pode ter doença valvar?",
        body: "Doenças valvares podem afetar pessoas de qualquer idade. No Brasil, a febre reumática (complicação de infecção de garganta não tratada na infância) ainda é uma causa muito importante, especialmente em adultos jovens. Em pessoas mais velhas, a degeneração calcífica — desgaste natural da válvula com depósito de cálcio — é a causa mais frequente. Outras causas incluem malformações congênitas (como a válvula aórtica bicúspide), infecções (endocardite), doenças do tecido conjuntivo e complicações de outros problemas cardíacos.",
      },
      {
        heading: "Existe tratamento?",
        body: "Sim, e as opções avançaram enormemente nas últimas décadas. Dependendo do tipo e da gravidade, o tratamento pode incluir: acompanhamento regular com exames periódicos (vigilância ativa), medicações para controlar sintomas e proteger o coração, procedimentos minimamente invasivos por cateter (como TAVI para a válvula aórtica ou reparo de borda-a-borda para a mitral) e cirurgias de reparo ou troca da válvula. A escolha do melhor caminho é sempre individualizada e decidida em conjunto entre você, seu cardiologista e, nos casos mais complexos, uma equipe multidisciplinar chamada Heart Team.",
      },
    ],
    tags: ["básico", "anatomia"],
  },
  {
    slug: "quatro-valvulas",
    title: "As quatro válvulas do coração",
    category: "fundamentos",
    shortDescription: "Conheça em detalhe as válvulas aórtica, mitral, tricúspide e pulmonar.",
    sections: [
      {
        heading: "Válvula aórtica",
        body: "Localizada entre o ventrículo esquerdo e a artéria aorta (a maior artéria do corpo). Normalmente possui três folhetos (cúspides) que se abrem a cada batimento para permitir que o sangue oxigenado siga para o corpo e se fecham rapidamente para impedir o retorno. É a válvula mais frequentemente afetada em adultos mais velhos, principalmente por calcificação degenerativa. Cerca de 1 a 2% da população nasce com apenas dois folhetos (válvula bicúspide), o que pode acelerar o desgaste e levar a estenose ou insuficiência em idades mais precoces.",
      },
      {
        heading: "Válvula mitral",
        body: "Situada entre o átrio esquerdo e o ventrículo esquerdo. Possui dois folhetos (anterior e posterior) conectados ao músculo cardíaco por cordas tendíneas — estruturas finas como fios que impedem os folhetos de se projetarem para trás. É a segunda válvula mais operada no mundo. O prolapso da válvula mitral — quando um folheto se projeta para o átrio — afeta cerca de 2 a 3% da população e na maioria das vezes é benigno. No entanto, pode evoluir para insuficiência significativa que necessita de reparo ou troca. No Brasil, a doença reumática é uma causa muito prevalente de estenose e insuficiência mitral.",
      },
      {
        heading: "Válvula tricúspide",
        body: "Localizada entre o átrio direito e o ventrículo direito, com três folhetos. Por muito tempo foi considerada a 'válvula esquecida' da cardiologia. Hoje se sabe que a insuficiência tricúspide — quando esta válvula não fecha adequadamente — afeta milhões de pessoas no mundo, geralmente como consequência de doenças do lado esquerdo do coração, hipertensão pulmonar ou fibrilação atrial de longa data. Quando o ventrículo direito dilata, o anel da tricúspide se alarga e os folhetos não conseguem se tocar, causando refluxo. Novas tecnologias transcateter estão revolucionando o tratamento desta condição.",
      },
      {
        heading: "Válvula pulmonar",
        body: "Fica entre o ventrículo direito e a artéria pulmonar, controlando o sangue que vai para os pulmões receber oxigênio. Em adultos, raramente é afetada isoladamente. É mais importante no contexto de cardiopatias congênitas, como a tetralogia de Fallot, em que a válvula pulmonar é frequentemente acometida e pode precisar de intervenção ao longo da vida. Pacientes operados na infância de cardiopatias congênitas precisam de acompanhamento vitalício.",
      },
      {
        heading: "Interação entre as válvulas",
        body: "As quatro válvulas trabalham em sincronia. Quando uma válvula adoece, pode afetar o funcionamento das outras. Por exemplo, uma estenose mitral de longa data pode causar hipertensão pulmonar, que por sua vez dilata o ventrículo direito e leva à insuficiência tricúspide. Essa interconexão explica por que alguns pacientes apresentam doença em mais de uma válvula ao mesmo tempo (doença multivalvar), exigindo uma avaliação integrada e cuidadosa de todo o coração.",
      },
    ],
    tags: ["anatomia"],
  },
  {
    slug: "estenose",
    title: "O que é estenose valvar",
    category: "fundamentos",
    shortDescription: "Quando uma válvula fica estreita e dificulta a passagem do sangue.",
    sections: [
      {
        heading: "O que acontece na estenose",
        body: "Estenose significa que a válvula não abre completamente. Os folhetos ficam espessados, endurecidos ou fundidos — dependendo da causa. Imagine uma porta que só abre pela metade: o coração precisa fazer muito mais força para empurrar o sangue por aquela passagem estreita. Ao longo de meses e anos, essa sobrecarga faz o músculo do coração engrossar (hipertrofia) como forma de compensação, mas eventualmente essa compensação falha.",
      },
      {
        heading: "Causas de estenose",
        body: "As causas mais comuns são: calcificação degenerativa (desgaste com a idade, especialmente após os 65 anos), doença reumática (sequela de febre reumática, muito prevalente no Brasil), e válvula bicúspide congênita (nascimento com dois folhetos em vez de três na aórtica). A calcificação é um processo ativo semelhante à aterosclerose, com inflamação e depósito progressivo de cálcio nos folhetos.",
      },
      {
        heading: "Como a estenose progride",
        body: "A progressão geralmente é lenta e gradual. A pessoa pode conviver com estenose leve ou moderada por anos sem sintomas. O corpo se adapta. Porém, quando os sintomas aparecem — falta de ar, dor no peito, tontura ou desmaio — é sinal de que a doença chegou a um estágio avançado e a compensação está falhando. No caso da estenose aórtica, o aparecimento de sintomas marca um ponto crítico: sem tratamento, a sobrevida média cai drasticamente.",
      },
      {
        heading: "Sintomas de alerta",
        body: "Falta de ar ao subir escadas ou caminhar, cansaço desproporcional ao esforço, dor ou aperto no peito ao se exercitar, tontura ou sensação de que vai desmaiar, e em casos graves, perda de consciência (síncope). Em fases iniciais pode não haver nenhum sintoma — por isso o acompanhamento regular com ecocardiograma é tão importante.",
      },
      {
        heading: "Diagnóstico e tratamento",
        body: "O ecocardiograma é o exame-chave: mede a velocidade do sangue passando pela válvula, o gradiente de pressão (diferença de pressão antes e depois da válvula) e a área de abertura. O tratamento depende da válvula afetada, da gravidade e dos sintomas. Pode envolver acompanhamento vigilante, medicações para controle de sintomas, procedimento por cateter (como TAVI na aórtica ou valvotomia por balão na mitral) ou cirurgia de troca valvar.",
      },
    ],
    tags: ["conceito"],
  },
  {
    slug: "insuficiencia-regurgitacao",
    title: "O que é insuficiência ou regurgitação valvar",
    category: "fundamentos",
    shortDescription: "Quando a válvula não fecha bem e o sangue volta.",
    sections: [
      {
        heading: "O que acontece na insuficiência",
        body: "Insuficiência (também chamada regurgitação ou 'vazamento') significa que a válvula não fecha completamente a cada batimento. Parte do sangue escapa de volta na direção contrária. O coração precisa bombear um volume extra para compensar — como uma bomba d'água que perde parte da água a cada ciclo e precisa trabalhar mais para manter a vazão.",
      },
      {
        heading: "Primária vs secundária",
        body: "Existe uma diferença fundamental: na insuficiência primária, o problema está na própria válvula (folhetos degenerados, prolapsados, rasgados ou infectados). Na insuficiência secundária (ou funcional), a válvula em si é estruturalmente normal, mas o coração dilatou tanto que os folhetos não conseguem mais se tocar para fechar. Essa distinção é crucial porque muda completamente a abordagem de tratamento.",
      },
      {
        heading: "Adaptação e descompensação",
        body: "Quando a insuficiência é crônica e se desenvolve lentamente, o coração tem tempo para se adaptar: as câmaras dilatam gradualmente para acomodar o volume extra, e a pessoa pode ficar sem sintomas por anos ou até décadas. Mas essa adaptação tem limite. Quando o músculo começa a enfraquecer, os sintomas aparecem — e nesse ponto pode já haver dano irreversível ao coração. Por isso, mesmo pacientes assintomáticos precisam de acompanhamento com ecocardiogramas regulares para detectar sinais precoces de deterioração.",
      },
      {
        heading: "Sintomas",
        body: "Cansaço progressivo, falta de ar (primeiro aos esforços, depois em repouso), palpitações ou batimentos irregulares, inchaço nos tornozelos e pernas, dificuldade para dormir deitado (precisa de mais travesseiros), ganho rápido de peso por retenção de líquido. Na insuficiência aguda (ruptura de cordoalha, endocardite), os sintomas são súbitos e graves — é uma emergência.",
      },
      {
        heading: "Quando intervir",
        body: "A decisão de operar depende de vários fatores: gravidade da regurgitação, presença de sintomas, tamanho e função do ventrículo (medidos no eco), tipo de válvula e se o reparo é viável. A tendência atual nas diretrizes é intervir um pouco mais cedo — antes que o coração sofra dano irreversível — em centros com alta taxa de sucesso no reparo.",
      },
    ],
    tags: ["conceito"],
  },
  {
    slug: "sopro-cardiaco",
    title: "O que é sopro cardíaco",
    category: "fundamentos",
    shortDescription: "O som extra que o médico ouve no estetoscópio — nem todo sopro é doença.",
    sections: [
      {
        heading: "O que é um sopro",
        body: "Sopro cardíaco é um som adicional, como um 'sopro' ou 'assobio', que o médico detecta ao examinar o coração com o estetoscópio. É produzido pela turbulência do sangue ao passar pelas estruturas cardíacas. Todo mundo pode ter turbulência em algum momento — durante exercício, febre, gravidez ou anemia, por exemplo.",
      },
      {
        heading: "Sopro inocente vs patológico",
        body: "Sopros inocentes (também chamados funcionais) são extremamente comuns em crianças e adultos jovens. Não indicam doença e não precisam de tratamento. Ocorrem em corações perfeitamente normais. Já os sopros patológicos podem sinalizar uma alteração real na válvula — estenose, insuficiência, prolapso — ou outras condições como defeitos no septo (parede entre as câmaras). Características como intensidade, localização, irradiação e momento no ciclo cardíaco ajudam o médico a diferenciar.",
      },
      {
        heading: "Como é avaliado",
        body: "Quando o médico suspeita que um sopro pode ser significativo, o próximo passo é o ecocardiograma. Este exame mostra a anatomia das válvulas, mede fluxos e gradientes e revela se há ou não doença. Se o eco for normal, o sopro é considerado inocente e não precisa de mais investigação. Se mostrar alguma alteração, o médico definirá o acompanhamento adequado.",
      },
      {
        heading: "O que fazer se descobriram um sopro",
        body: "Não se assuste. A grande maioria dos sopros descobertos por acaso é benigna. Faça o ecocardiograma se seu médico indicou. Se o resultado for normal, viva tranquilamente. Se houver alguma alteração valvar, siga o acompanhamento recomendado — muitas alterações são leves, estáveis e só precisam de monitoramento periódico.",
      },
    ],
    tags: ["sintoma", "exame físico"],
  },
  {
    slug: "febre-reumatica",
    title: "Febre reumática e doença valvar",
    category: "fundamentos",
    shortDescription: "Como uma infecção de garganta na infância pode causar doença cardíaca anos depois.",
    sections: [
      {
        heading: "O que é a febre reumática",
        body: "A febre reumática é uma doença inflamatória que pode ocorrer como complicação de uma infecção de garganta causada pela bactéria estreptococo do grupo A. Quando essa infecção não é tratada adequadamente com antibióticos, o sistema imunológico pode reagir de forma exagerada e atacar os próprios tecidos do corpo — incluindo o coração, as articulações, a pele e o sistema nervoso.",
      },
      {
        heading: "Por que afeta o coração",
        body: "As proteínas da bactéria estreptococo se assemelham a proteínas do tecido cardíaco. O sistema imunológico, ao combater a bactéria, acaba atacando também as válvulas do coração. Essa inflamação repetida (cardite reumática) causa cicatrização, espessamento e até fusão dos folhetos valvares. Com o tempo, as válvulas ficam deformadas — estreitas (estenose), com vazamento (insuficiência) ou ambos.",
      },
      {
        heading: "Realidade no Brasil",
        body: "O Brasil ainda tem uma das maiores prevalências de doença reumática do mundo. Estima-se que cerca de 30.000 novos casos de febre reumática ocorram por ano. A doença é mais comum em populações com menor acesso a saúde — onde infecções de garganta passam sem tratamento. É a causa número um de cirurgia valvar em adultos jovens no país.",
      },
      {
        heading: "Prevenção e profilaxia",
        body: "A melhor prevenção é tratar toda faringite estreptocócica com antibióticos. Quem já teve febre reumática precisa fazer profilaxia secundária — injeções regulares de penicilina benzatina (benzetacil) por anos ou até por toda a vida — para evitar novos surtos que piorariam ainda mais as válvulas. A adesão a essa profilaxia é fundamental e pode evitar cirurgias futuras.",
      },
    ],
    tags: ["reumática", "prevenção"],
  },

  // ============ DOENÇAS ============
  {
    slug: "estenose-aortica",
    title: "Estenose aórtica",
    category: "doencas",
    shortDescription: "A válvula aórtica fica estreita, dificultando a saída do sangue para o corpo.",
    sections: [
      {
        heading: "O que é e por que acontece",
        body: "A estenose aórtica é o estreitamento da válvula aórtica — a porta de saída do coração para todo o corpo. É a doença valvar mais comum em países desenvolvidos e cada vez mais prevalente no Brasil com o envelhecimento da população. Em pessoas acima de 65 anos, a causa mais frequente é a calcificação degenerativa: ao longo de décadas, depósitos de cálcio se acumulam nos folhetos, tornando-os rígidos e incapazes de abrir completamente. Em pessoas mais jovens (30-60 anos), a causa geralmente é uma válvula aórtica bicúspide — uma malformação congênita presente em 1 a 2% da população, onde a válvula tem dois folhetos em vez de três. No Brasil, a doença reumática permanece como causa importante, especialmente em adultos jovens.",
      },
      {
        heading: "Como o coração compensa",
        body: "Quando a válvula vai estreitando, o ventrículo esquerdo precisa gerar mais pressão para empurrar o sangue. Em resposta, suas paredes engrossam (hipertrofia concêntrica) — como um músculo que fica mais forte com exercício. Essa adaptação permite que o paciente fique sem sintomas por anos, mas tem um custo: o músculo hipertrofiado consome mais oxigênio, é menos complacente (fica mais 'duro') e pode desenvolver fibrose. É uma bomba-relógio silenciosa.",
      },
      {
        heading: "Sintomas — a tríade clássica",
        body: "Os três sintomas clássicos da estenose aórtica grave são: (1) falta de ar aos esforços (dispneia) — o mais comum, resultado da pressão elevada no ventrículo que se transmite para os pulmões; (2) dor no peito (angina) — pode ocorrer mesmo sem doença nas coronárias, porque o músculo hipertrofiado demanda mais oxigênio do que recebe; (3) desmaio ou tontura intensa ao esforço (síncope) — ocorre porque o coração não consegue aumentar o débito durante o exercício. O aparecimento de qualquer um destes sintomas muda radicalmente o prognóstico e geralmente indica necessidade de intervenção.",
      },
      {
        heading: "Classificação da gravidade",
        body: "O ecocardiograma classifica a estenose em leve, moderada e importante (grave). Os principais critérios para estenose importante são: velocidade máxima do jato ≥ 4,0 m/s, gradiente médio ≥ 40 mmHg e área valvar < 1,0 cm² (o normal é 3 a 4 cm²). Existe ainda a estenose de 'baixo fluxo e baixo gradiente', em que o ventrículo já está tão fraco que não consegue gerar gradientes altos — é uma forma enganosa que precisa de investigação cuidadosa.",
      },
      {
        heading: "Quando tratar",
        body: "A decisão de intervir segue critérios bem estabelecidos: (1) estenose importante com sintomas — indicação clara; (2) estenose importante assintomática com fração de ejeção já reduzida (< 50%) — indicação forte; (3) em casos selecionados de assintomáticos com marcadores de alto risco (velocidade > 5 m/s, queda de pressão no teste de esforço, BNP muito elevado, calcificação acentuada com progressão rápida). Não existem medicamentos que revertam a estenose aórtica — o tratamento definitivo é a substituição da válvula.",
      },
      {
        heading: "TAVI ou cirurgia — como é a decisão",
        body: "Hoje existem duas opções para substituir a válvula aórtica: cirurgia aberta (SAVR) e implante por cateter (TAVI). A escolha é feita pelo Heart Team levando em conta: idade, expectativa de vida, risco cirúrgico calculado por escores, anatomia da válvula e da aorta, presença de doença coronária associada, fragilidade, outras cirurgias necessárias e as preferências do paciente. De forma simplificada: em pacientes mais idosos ou de alto risco, a TAVI tende a ser preferida; em pacientes mais jovens e de baixo risco, a cirurgia costuma ser escolhida por sua durabilidade mais bem estabelecida a longo prazo. Mas cada caso é único.",
      },
    ],
    alerts: [
      "Desmaio, dor no peito intensa ou falta de ar súbita exigem atendimento médico de emergência — ligue SAMU 192.",
      "Se você tem estenose aórtica importante e sentir qualquer um destes sintomas pela primeira vez, comunique seu cardiologista imediatamente.",
    ],
    tags: ["aórtica", "estenose"],
  },
  {
    slug: "insuficiencia-aortica",
    title: "Insuficiência aórtica",
    category: "doencas",
    shortDescription: "A válvula aórtica não fecha bem e parte do sangue retorna ao coração.",
    sections: [
      {
        heading: "O que acontece",
        body: "Na insuficiência aórtica (também chamada regurgitação aórtica), a válvula aórtica não veda completamente ao se fechar. A cada batimento, parte do sangue que foi ejetado para a aorta retorna ao ventrículo esquerdo. O coração recebe de volta esse sangue extra, se dilata para acomodá-lo e precisa ejetar um volume maior a cada contração.",
      },
      {
        heading: "Causas",
        body: "As causas podem envolver os folhetos da válvula (degeneração, válvula bicúspide, doença reumática, endocardite) ou a raiz da aorta (dilatação da aorta ascendente, síndrome de Marfan, dissecção aórtica). Quando a aorta dilata, o anel da válvula se estica e os folhetos se afastam, causando vazamento mesmo sem estarem doentes. A distinção é importante porque pode exigir cirurgia na aorta junto com a válvula.",
      },
      {
        heading: "Forma crônica vs aguda",
        body: "A forma crônica se desenvolve lentamente e o coração tem tempo para se adaptar. Pacientes podem ficar assintomáticos por 10 a 20 anos. A forma aguda (por endocardite destrutiva, dissecção da aorta ou trauma) é uma emergência: o ventrículo não teve tempo de dilatar, a pressão sobe rapidamente e o paciente desenvolve insuficiência cardíaca grave em horas. A cirurgia de emergência costuma ser necessária.",
      },
      {
        heading: "Sintomas",
        body: "Na forma crônica compensada: assintomático por anos. Com a progressão: palpitações (sensação do coração batendo forte), cansaço, falta de ar aos esforços, desconforto ao deitar sobre o lado esquerdo. Sinais tardios incluem falta de ar em repouso, inchaço, e intolerância ao exercício.",
      },
      {
        heading: "Acompanhamento e tratamento",
        body: "Ecocardiogramas seriados são essenciais para monitorar o tamanho e a função do ventrículo esquerdo e as dimensões da aorta. Medicações anti-hipertensivas (especialmente vasodilatadores) podem ser usadas para controlar a pressão. A cirurgia é indicada quando surgem sintomas, quando a fração de ejeção cai para ≤ 55%, ou quando o ventrículo dilata além de limiares específicos — mesmo sem sintomas. O reparo valvar, quando viável por mãos experientes, pode ser preferido à troca em casos selecionados.",
      },
    ],
    tags: ["aórtica", "insuficiência"],
  },
  {
    slug: "insuficiencia-mitral",
    title: "Insuficiência mitral",
    category: "doencas",
    shortDescription: "A válvula mitral não fecha bem e parte do sangue volta para o átrio.",
    sections: [
      {
        heading: "A doença valvar mais prevalente",
        body: "A insuficiência mitral (IM) é a doença valvar mais comum no mundo, afetando mais de 24 milhões de pessoas globalmente. Ocorre quando a válvula mitral — localizada entre o átrio esquerdo e o ventrículo esquerdo — não fecha completamente, permitindo que o sangue retorne (regurgite) para o átrio a cada contração do ventrículo.",
      },
      {
        heading: "Primária (degenerativa) vs secundária (funcional)",
        body: "Esta é a distinção mais importante: na IM primária, o problema está na própria válvula — folhetos com prolapso, cordas tendíneas rompidas ou alongadas, válvula reumática deformada. O tratamento de escolha é o reparo cirúrgico, que em centros de excelência tem taxa de sucesso acima de 95% para prolapso. Na IM secundária, a válvula em si é normal, mas o ventrículo dilatou tanto (por infarto, miocardiopatia) que os folhetos não conseguem se encontrar. Aqui o tratamento principal é otimizar a insuficiência cardíaca com medicações; procedimentos valvares são reservados para casos selecionados.",
      },
      {
        heading: "Prolapso da válvula mitral",
        body: "O prolapso da válvula mitral (PVM) é a causa mais comum de IM primária em países desenvolvidos. Afeta 2-3% da população. Na maioria das vezes é benigno — apenas um achado de eco sem consequências. Porém, uma minoria dos pacientes evolui com insuficiência progressiva que pode exigir cirurgia. O acompanhamento regular é a chave: ecocardiogramas periódicos permitem detectar se e quando a regurgitação está progredindo.",
      },
      {
        heading: "Sintomas",
        body: "IM crônica leve a moderada costuma ser assintomática. Com a progressão: cansaço, falta de ar ao esforço, palpitações. Fibrilação atrial (arritmia com batimentos irregulares) é muito comum e pode ser a primeira manifestação. Em fases avançadas: falta de ar em repouso, dificuldade para dormir deitado, edema de membros inferiores.",
      },
      {
        heading: "Quando operar — critérios atuais",
        body: "IM primária importante: cirurgia (preferencialmente reparo) quando há sintomas, ou em assintomáticos quando a fração de ejeção cai para ≤ 60% ou o ventrículo dilata acima de 40 mm. Tendência crescente a operar mais cedo em centros com alta taxa de reparo. IM secundária: otimizar medicações e dispositivos para IC (ressincronizador); TEER (MitraClip/PASCAL) pode ser considerada em pacientes selecionados que permanecem sintomáticos apesar do tratamento otimizado.",
      },
    ],
    tags: ["mitral", "insuficiência"],
  },
  {
    slug: "estenose-mitral",
    title: "Estenose mitral",
    category: "doencas",
    shortDescription: "A válvula mitral fica estreita e dificulta o enchimento do ventrículo.",
    sections: [
      {
        heading: "Uma doença com forte marca brasileira",
        body: "A estenose mitral (EM) é o estreitamento da válvula mitral, que dificulta a passagem do sangue do átrio esquerdo para o ventrículo esquerdo. No mundo, a causa esmagadoramente mais comum é a doença reumática — e o Brasil é um dos países mais afetados. Estima-se que milhares de brasileiros convivam com esta condição, muitos diagnosticados tardiamente.",
      },
      {
        heading: "O que acontece no coração",
        body: "Com a válvula estreita, o sangue se acumula no átrio esquerdo, que dilata progressivamente. Essa pressão elevada se transmite para as veias pulmonares e os pulmões, causando congestão e falta de ar. O átrio dilatado é muito propenso a desenvolver fibrilação atrial (arritmia), que piora os sintomas e cria risco de formação de coágulos — aumentando o risco de AVC (derrame cerebral).",
      },
      {
        heading: "Sintomas",
        body: "Falta de ar aos esforços (inicialmente ao subir ladeiras, depois atividades simples), falta de ar ao deitar, tosse noturna, palpitações por fibrilação atrial, cansaço, e em casos avançados, rouquidão (pela compressão do nervo laríngeo pelo átrio muito dilatado). Situações que aumentam a frequência cardíaca — exercício, febre, gravidez, estresse emocional — desmascararam sintomas que antes passavam despercebidos.",
      },
      {
        heading: "Score de Wilkins — o que significa",
        body: "Quando se considera a valvotomia mitral percutânea (dilatação por balão), os médicos usam o Score de Wilkins para avaliar se a anatomia da válvula é favorável. Este score examina quatro aspectos: mobilidade dos folhetos, espessamento, calcificação e acometimento do aparato subvalvar (cordas). Pontuações baixas (≤ 8) indicam boa chance de sucesso com o procedimento percutâneo. Pontuações altas sugerem que a cirurgia pode ser mais adequada.",
      },
      {
        heading: "Tratamentos",
        body: "Valvotomia mitral percutânea por balão: procedimento por cateter em que um balão é inflado dentro da válvula para separar as comissuras fundidas. Excelente opção quando a anatomia é favorável e não há trombo no átrio. Cirurgia: reparo (comissurotomia aberta) ou troca valvar quando a anatomia não permite tratamento percutâneo. Anticoagulação é obrigatória quando há fibrilação atrial. Profilaxia da febre reumática deve ser mantida conforme orientação médica.",
      },
    ],
    tags: ["mitral", "estenose"],
  },
  {
    slug: "insuficiencia-tricuspide",
    title: "Insuficiência tricúspide",
    category: "doencas",
    shortDescription: "A 'válvula esquecida' que afeta milhões — quando o lado direito do coração sofre.",
    sections: [
      {
        heading: "A válvula que saiu da sombra",
        body: "Durante décadas, a insuficiência tricúspide (IT) foi minimizada pela medicina — 'a válvula esquecida'. Hoje sabe-se que a IT moderada a grave afeta milhões de pessoas no mundo, está associada a aumento significativo de mortalidade e hospitalizações, e tem tratamento. É uma mudança de paradigma na cardiologia valvar.",
      },
      {
        heading: "Por que acontece",
        body: "Em mais de 90% dos casos, a IT é secundária (funcional): a válvula em si é normal, mas o anel da tricúspide se dilata porque o ventrículo direito ou o átrio direito cresceram. Causas comuns: doença valvar do lado esquerdo não tratada há anos, hipertensão pulmonar, fibrilação atrial de longa data (dilata o átrio direito e o anel), e insuficiência cardíaca direita por qualquer causa. IT primária (problema nos folhetos) pode ocorrer por endocardite (especialmente em usuários de drogas injetáveis), doença reumática, síndrome carcinoide, trauma ou dispositivos cardíacos implantados.",
      },
      {
        heading: "Consequências no corpo",
        body: "A IT causa congestão sistêmica — o sangue 'volta' para o corpo em vez de seguir para os pulmões. Isso leva a: inchaço progressivo nas pernas e pés, aumento do abdômen por acúmulo de líquido (ascite), congestão do fígado (que pode evoluir para cirrose cardíaca), distensão das veias do pescoço, ganho rápido de peso por retenção de líquido, cansaço profundo e intolerância ao exercício.",
      },
      {
        heading: "Por que não esperar demais",
        body: "Estudos recentes mostraram que tratar a IT tardiamente — quando o ventrículo direito já está muito dilatado e fraco — tem resultados piores. A tendência atual é intervir mais cedo, antes da deterioração irreversível do ventrículo direito. Essa mudança de mentalidade está transformando a abordagem da tricúspide globalmente.",
      },
      {
        heading: "Opções de tratamento",
        body: "Diuréticos para alívio dos sintomas congestivos. Tratar a causa de base (doença esquerda, fibrilação atrial). Na cirurgia esquerda, abordar a tricúspide se o anel estiver dilatado ≥ 40 mm ou houver IT moderada/grave. Para pacientes de alto risco cirúrgico, novas tecnologias transcateter estão emergindo rapidamente: reparo de borda-a-borda (TriClip), anuloplastia transcateter, substituição valvar transcateter, entre outros. A decisão é sempre do Heart Team.",
      },
    ],
    tags: ["tricúspide"],
  },
  {
    slug: "doenca-multivalvar",
    title: "Doença multivalvar",
    category: "doencas",
    shortDescription: "Quando mais de uma válvula do coração está comprometida ao mesmo tempo.",
    sections: [
      {
        heading: "O que é",
        body: "Doença multivalvar significa que duas ou mais válvulas do coração estão afetadas simultaneamente. No Brasil, essa apresentação é particularmente frequente por conta da doença reumática, que costuma acometer múltiplas válvulas. Combinações comuns incluem estenose mitral + insuficiência tricúspide, doença mitral + doença aórtica, e doença em três ou mais válvulas.",
      },
      {
        heading: "Por que é complexa",
        body: "Quando existem múltiplas lesões valvares, uma pode mascarar a gravidade da outra. Por exemplo, uma estenose mitral grave pode reduzir o volume de sangue que chega ao ventrículo esquerdo, fazendo uma estenose aórtica parecer menos grave do que realmente é. Da mesma forma, a insuficiência mitral pode parecer mais leve quando há estenose aórtica associada. Isso torna a avaliação muito mais desafiadora.",
      },
      {
        heading: "Abordagem e tratamento",
        body: "A avaliação exige integração de múltiplos exames de imagem, análise cuidadosa de cada válvula isoladamente e em conjunto, e decisão pelo Heart Team sobre a melhor estratégia: corrigir todas na mesma cirurgia, abordagem estagiada, ou combinação de cirurgia com procedimentos transcateter. É uma das áreas mais complexas da cardiologia valvar moderna.",
      },
    ],
    tags: ["multivalvar"],
  },

  // ============ EXAMES ============
  {
    slug: "ecocardiograma",
    title: "Ecocardiograma",
    category: "exames",
    shortDescription: "O principal exame para avaliar válvulas cardíacas — usa ultrassom, é indolor e seguro.",
    sections: [
      {
        heading: "O que é e como funciona",
        body: "O ecocardiograma é o exame mais importante para diagnosticar e acompanhar doenças valvares. Usa ondas de ultrassom (as mesmas da ultrassonografia) para criar imagens em tempo real do coração em movimento. É totalmente indolor, não usa radiação, não tem efeitos colaterais e pode ser repetido quantas vezes necessário. A tecnologia evoluiu enormemente: hoje permite visualizar as válvulas em 3D, medir velocidades de fluxo com precisão, e detectar alterações muito sutis da função cardíaca.",
      },
      {
        heading: "Ecocardiograma transtorácico (ETT)",
        body: "É o tipo mais comum. O técnico ou médico aplica gel no peito e desliza o transdutor (aparelho que emite e capta ultrassom) em diferentes posições. Dura de 20 a 40 minutos. Você deita geralmente sobre o lado esquerdo. Não requer preparo, jejum ou sedação. É o primeiro exame pedido quando há suspeita de doença valvar.",
      },
      {
        heading: "Ecocardiograma transesofágico (ETE)",
        body: "Para imagens mais detalhadas — especialmente da válvula mitral, próteses valvares, e para descartar trombos (coágulos) — pode ser necessário o eco transesofágico. Uma sonda fina é passada pela boca até o esôfago (que fica atrás do coração). A proximidade permite imagens com resolução superior. Requer jejum de 6 a 8 horas e sedação leve. É desconfortável mas geralmente bem tolerado. É fundamental antes de procedimentos como valvotomia mitral e para planejamento de reparos complexos.",
      },
      {
        heading: "Ecocardiograma de estresse",
        body: "Combina o eco com exercício físico (esteira ou bicicleta) ou medicação que simula o exercício (dobutamina). Tem duas aplicações principais em valvopatias: (1) desmascarar sintomas e alterações hemodinâmicas que só aparecem durante esforço — por exemplo, aumento excessivo do gradiente mitral ao exercício; (2) na estenose aórtica de baixo fluxo com ventrículo fraco, avaliar se a estenose é realmente grave (a 'reserva contrátil'). É um exame que requer expertise e é realizado em centros especializados.",
      },
      {
        heading: "O que o eco mede nas valvopatias",
        body: "Anatomia dos folhetos (espessamento, calcificação, prolapso, vegetações), área da válvula (quanto ela abre), gradientes de pressão (diferença de pressão antes e depois da válvula), gravidade da regurgitação (volume de sangue que vaza), dimensões das câmaras cardíacas (átrios e ventrículos), função do ventrículo esquerdo (fração de ejeção) e direito, pressão arterial pulmonar estimada, e estado do pericárdio. Cada um desses parâmetros tem papel na tomada de decisão sobre tratamento.",
      },
    ],
    tags: ["ultrassom", "imagem"],
  },
  {
    slug: "tomografia",
    title: "Tomografia computadorizada do coração",
    category: "exames",
    shortDescription: "Imagens detalhadas para planejamento de procedimentos e avaliação de calcificação.",
    sections: [
      {
        heading: "Para que serve em valvopatias",
        body: "A tomografia computadorizada cardíaca (angioTC) tornou-se indispensável na cardiologia valvar moderna. Suas principais aplicações são: planejamento de TAVI (medidas precisas do anel aórtico, avaliação de calcificação, estudo dos acessos vasculares), quantificação do escore de cálcio valvar (ajuda a confirmar gravidade em casos duvidosos de estenose aórtica), avaliação da aorta (dilatação, dissecção), e em alguns centros, planejamento de intervenções transcateter mitrais e tricúspides.",
      },
      {
        heading: "Como é feita",
        body: "Você deita em uma mesa que desliza pelo aparelho (formato de anel). A aquisição em si dura segundos — o desafio é a preparação. Geralmente se administra contraste iodado pela veia (importante informar alergias e função renal). Pode ser necessário tomar um betabloqueador para reduzir a frequência cardíaca e obter imagens mais nítidas. É indolor, mas exige ficar parado e prender a respiração por poucos segundos. A dose de radiação é baixa com os aparelhos modernos.",
      },
      {
        heading: "Cuidados e contraindicações relativas",
        body: "Informe sobre alergias (especialmente a contrastes ou iodo), função renal alterada (creatinina elevada), uso de metformina (diabéticos), gravidez, e doenças da tireoide. O médico avaliará a relação risco-benefício e tomará precauções quando necessário.",
      },
    ],
    tags: ["TC", "imagem"],
  },
  {
    slug: "cateterismo",
    title: "Cateterismo cardíaco",
    category: "exames",
    shortDescription: "Avalia o coração e as coronárias por dentro, usando cateteres finos.",
    sections: [
      {
        heading: "O que é",
        body: "O cateterismo cardíaco é um exame invasivo em que cateteres (tubos finos e flexíveis) são introduzidos por uma artéria — geralmente do punho (radial) ou da virilha (femoral) — e guiados até o coração sob fluoroscopia (raio-X em tempo real). Através dos cateteres, é possível injetar contraste para visualizar as coronárias (angiografia coronária) e medir pressões dentro das câmaras cardíacas.",
      },
      {
        heading: "Quando é indicado em valvopatias",
        body: "Antes de cirurgia valvar ou TAVI: para avaliar se há doença coronária associada que precise ser tratada junto (revascularização). Quando o ecocardiograma não foi suficiente para determinar a gravidade: medidas diretas de pressão (gradiente transvalvar, pressão arterial pulmonar) podem ser obtidas. Em casos complexos de doença multivalvar, o cateterismo direito e esquerdo pode ajudar a definir a hemodinâmica.",
      },
      {
        heading: "Como é feito e recuperação",
        body: "O procedimento dura 30 minutos a 1 hora, é feito com sedação leve e anestesia local. Você fica acordado. Após, é necessário ficar em repouso por algumas horas (especialmente se o acesso foi pela virilha). A maioria dos pacientes tem alta no mesmo dia ou no dia seguinte. Complicações são raras em centros experientes.",
      },
    ],
    tags: ["invasivo"],
  },
  {
    slug: "ressonancia",
    title: "Ressonância magnética cardíaca",
    category: "exames",
    shortDescription: "Imagem de alta precisão sem radiação para o músculo e as válvulas.",
    sections: [
      {
        heading: "O que é e quando é usada",
        body: "A ressonância magnética cardíaca (RMC) usa campos magnéticos e ondas de rádio para criar imagens extremamente detalhadas do coração — sem radiação. É considerada o padrão-ouro para medir volumes cardíacos, fração de ejeção e massa do miocárdio. Em valvopatias, é especialmente útil quando o eco não foi conclusivo, para quantificar com precisão a gravidade da regurgitação, e para avaliar fibrose do músculo cardíaco (que pode indicar dano irreversível e influenciar na decisão de operar).",
      },
      {
        heading: "Como é feita",
        body: "O exame dura 45 a 90 minutos. Você deita dentro de um tubo (pode ser aberto em aparelhos mais novos), usa fones ou protetores auriculares (o aparelho faz barulho), e precisa prender a respiração várias vezes por 10-15 segundos. Contraste com gadolínio pode ser usado e é geralmente muito seguro. Claustrofobia é a principal dificuldade — avise seu médico se você tem esse desconforto; sedação leve pode ser oferecida.",
      },
      {
        heading: "Contraindicações",
        body: "Principais contraindicações: marcapasso ou desfibrilador não compatível com RM (cada vez mais raros com dispositivos novos), clipes cerebrais metálicos antigos, implantes cocleares antigos, corpos estranhos metálicos no corpo. Próteses valvares modernas e stents coronários geralmente são compatíveis, mas é fundamental informar ao radiologista.",
      },
    ],
    tags: ["RM", "imagem"],
  },
  {
    slug: "teste-esforco",
    title: "Teste de esforço (ergometria)",
    category: "exames",
    shortDescription: "Avalia como o coração responde ao exercício — importante em valvopatias.",
    sections: [
      {
        heading: "O que é",
        body: "O teste de esforço (ou ergometria) é um exame em que você caminha em uma esteira ou pedala em uma bicicleta enquanto a equipe monitora seu eletrocardiograma, pressão arterial e sintomas. É simples, seguro quando bem indicado, e fornece informações valiosas sobre a capacidade funcional e a resposta cardiovascular ao exercício.",
      },
      {
        heading: "Por que é importante em valvopatias",
        body: "Em pacientes com estenose aórtica 'assintomática', o teste pode revelar sintomas que o paciente não percebia no dia a dia — falta de ar, tontura ou queda de pressão ao esforço. Esses achados podem mudar a conduta e indicar intervenção. Em valvopatias moderadas, ajuda a objetivar a capacidade funcional e acompanhar a evolução. Atenção: o teste de esforço é contraindicado em estenose aórtica grave sintomática.",
      },
    ],
    tags: ["exercício", "funcional"],
  },

  // ============ TRATAMENTOS ============
  {
    slug: "protese-valvar",
    title: "Próteses valvares: biológica e mecânica",
    category: "tratamentos",
    shortDescription: "Quando a válvula precisa ser substituída, existem dois tipos principais — entenda as diferenças.",
    sections: [
      {
        heading: "Prótese biológica (bioprótese)",
        body: "Feita com tecido animal tratado (geralmente de porco ou de pericárdio bovino). Vantagem principal: na maioria dos casos, não exige anticoagulação a longo prazo com warfarina (apenas nos primeiros 3 a 6 meses). Desvantagem: tem durabilidade limitada. Em pacientes jovens (< 60 anos), pode degenerar em 10 a 15 anos e necessitar de nova intervenção. Em pacientes mais velhos (> 70 anos), costuma durar 15 a 20 anos ou mais. Quando degenera, hoje existe a opção de 'válvula-em-válvula' por cateter, evitando nova cirurgia aberta em casos selecionados.",
      },
      {
        heading: "Prótese mecânica",
        body: "Feita de materiais sintéticos extremamente duráveis (carbono pirolítico). Vantagem: durabilidade excepcional — pode durar a vida inteira sem degenerar. Desvantagem: exige uso contínuo e vitalício de anticoagulante (warfarina/marevan), com controle laboratorial regular do INR. Qualquer falha na anticoagulação pode levar à formação de coágulos na prótese (trombose protética) — uma emergência grave. O uso de anticoagulante também aumenta o risco de sangramentos.",
      },
      {
        heading: "Como a escolha é feita",
        body: "É uma decisão compartilhada entre você e seu médico, considerando: idade (pacientes mais jovens podem preferir mecânica pela durabilidade, ou biológica para evitar anticoagulação), estilo de vida (atividades com risco de trauma, esportes de contato contraindicam mecânica pelo risco de sangramento), capacidade e disponibilidade para fazer controles regulares de INR, desejo de gravidez futura (warfarina é contraindicada na gestação), presença de fibrilação atrial (que já exigiria anticoagulação), e suas preferências pessoais após entender bem cada opção.",
      },
      {
        heading: "Cuidados com a prótese",
        body: "Independentemente do tipo: consultas regulares com ecocardiograma para verificar o funcionamento da prótese, profilaxia de endocardite antes de procedimentos dentários e cirúrgicos (antibiótico preventivo conforme orientação médica), cartão de identificação da prótese (leve sempre com você), nunca interromper a anticoagulação por conta própria (no caso de mecânica), e comunicar imediatamente qualquer sintoma novo como falta de ar, febre, sangramento ou embolia.",
      },
    ],
    tags: ["prótese"],
  },
  {
    slug: "tavi",
    title: "TAVI — implante valvar aórtico por cateter",
    category: "tratamentos",
    shortDescription: "Trocar a válvula aórtica sem abrir o tórax — revolução da cardiologia moderna.",
    sections: [
      {
        heading: "O que é TAVI",
        body: "TAVI (Transcatheter Aortic Valve Implantation, em português: Implante Valvar Aórtico por Cateter) é um procedimento revolucionário que permite substituir a válvula aórtica sem necessidade de cirurgia aberta. Uma nova válvula biológica, montada dentro de um stent metálico colapsável, é levada até o coração por um cateter — geralmente pela artéria femoral (virilha). Quando posicionada, a prótese é expandida dentro da válvula doente, que é empurrada para os lados.",
      },
      {
        heading: "Para quem é indicado",
        body: "Indicação consolidada: estenose aórtica grave sintomática. Originalmente reservada para pacientes idosos de alto risco cirúrgico, a TAVI hoje tem indicação expandida para risco intermediário e, em muitos centros, já é discutida em risco baixo. A decisão sempre passa pelo Heart Team, que avalia idade, anatomia, comorbidades, expectativa de vida e preferências do paciente. TAVI não é indicada para insuficiência aórtica pura (sem estenose).",
      },
      {
        heading: "Como é o procedimento",
        body: "Geralmente feito em sala de hemodinâmica ou sala híbrida, sob sedação ou anestesia geral (varia por centro). Dura em média 1 a 2 horas. O acesso mais comum é pela virilha (transfemoral), mas também pode ser feito pela artéria subclávia, pela aorta diretamente (transaórtico) ou pela ponta do coração (transapical) quando as artérias não permitem a passagem do cateter. A técnica transfemoral permite, em muitos casos, alta hospitalar em 2 a 3 dias.",
      },
      {
        heading: "Resultados e durabilidade",
        body: "As taxas de sucesso do procedimento ultrapassam 95% em centros experientes. A mortalidade em 30 dias é de 1 a 3% em pacientes de risco intermediário a baixo. Estudos de seguimento mostram funcionamento adequado das próteses por 5 a 10 anos, com dados emergentes muito favoráveis. A principal preocupação de longo prazo é a possibilidade de degeneração da bioprótese ao longo das décadas, especialmente em pacientes mais jovens — área de intensa pesquisa.",
      },
      {
        heading: "Complicações possíveis",
        body: "Como todo procedimento, não é isento de riscos: necessidade de marcapasso definitivo (5 a 20%, dependendo do tipo de prótese e da anatomia), vazamento ao redor da prótese (regurgitação paravalvar), complicações vasculares no local de acesso, AVC (raro, 1 a 3%), e sangramento. A maioria das complicações é manejável, e os resultados continuam melhorando com a evolução da tecnologia e da experiência dos centros.",
      },
    ],
    tags: ["TAVI", "cateter"],
  },
  {
    slug: "cirurgia-valvar",
    title: "Cirurgia valvar cardíaca",
    category: "tratamentos",
    shortDescription: "Reparo ou troca da válvula em cirurgia — quando e como é feita.",
    sections: [
      {
        heading: "O que é a cirurgia valvar",
        body: "A cirurgia valvar é um procedimento em que o cirurgião cardíaco acessa o coração para reparar ou substituir uma válvula doente. É realizada com circulação extracorpórea (uma máquina que assume temporariamente a função do coração e dos pulmões), permitindo que o cirurgião trabalhe com o coração parado e aberto. É uma cirurgia de grande porte, mas com resultados excelentes em centros experientes — mortalidade cirúrgica de 1 a 3% em pacientes de risco standard.",
      },
      {
        heading: "Reparo vs troca — por que o reparo é preferido",
        body: "Sempre que tecnicamente possível, o reparo (plastia) da válvula é preferido à troca. Isso é especialmente verdadeiro para a válvula mitral com prolapso. Vantagens do reparo: preserva o tecido natural da válvula, geralmente não requer anticoagulação de longo prazo, mantém melhor a geometria e função do ventrículo, menor risco de endocardite, e não há preocupação com degeneração de prótese. Em centros de excelência em reparo mitral, a taxa de sucesso ultrapassa 95% para prolapso, e a durabilidade do reparo supera 90% em 20 anos.",
      },
      {
        heading: "Abordagens cirúrgicas",
        body: "Esternotomia mediana: incisão central no esterno (osso do peito). É o acesso tradicional e o mais utilizado, permitindo excelente visualização de todas as estruturas. Cirurgia minimamente invasiva: incisões menores no lado direito do tórax (mini-toracotomia) ou esternotomia parcial. Vantagens: menos dor, recuperação mais rápida, melhor resultado estético. Requer expertise específica e não é adequada para todos os casos. Cirurgia robótica: em centros altamente especializados, o robô auxilia no reparo através de incisões mínimas.",
      },
      {
        heading: "Recuperação",
        body: "UTI por 1 a 2 dias (em geral), internação total de 5 a 10 dias. Drenos torácicos por 1 a 3 dias. A ferida do esterno leva 6 a 8 semanas para consolidar — durante esse período, evitar dirigir, levantar peso acima de 5 kg e movimentos bruscos com os braços. Reabilitação cardíaca supervisionada é altamente recomendada e melhora significativamente a recuperação. Retorno às atividades normais ocorre tipicamente em 2 a 3 meses.",
      },
    ],
    tags: ["cirurgia"],
  },
  {
    slug: "terapias-transcateter",
    title: "Terapias transcateter mitrais e tricúspides",
    category: "tratamentos",
    shortDescription: "Procedimentos por cateter para válvulas mitral e tricúspide — a fronteira da cardiologia.",
    sections: [
      {
        heading: "O que são",
        body: "Além da TAVI (para a aórtica), a cardiologia intervencionista desenvolveu terapias transcateter para as válvulas mitral e tricúspide — procedimentos realizados por cateteres, sem necessidade de cirurgia aberta nem circulação extracorpórea. Representam uma verdadeira revolução para pacientes que antes não tinham opção de tratamento por serem de alto risco cirúrgico.",
      },
      {
        heading: "TEER — reparo de borda-a-borda",
        body: "A técnica mais estabelecida é a TEER (Transcatheter Edge-to-Edge Repair), conhecida pelos dispositivos MitraClip e PASCAL. Um clipe é colocado nos folhetos da válvula mitral (ou tricúspide) para aproximá-los, reduzindo o vazamento. O acesso é feito pela veia femoral (virilha direita), passando para o lado esquerdo do coração através do septo atrial. Indicação principal: insuficiência mitral grave em pacientes sintomáticos com risco cirúrgico elevado ou anatomia desfavorável para cirurgia.",
      },
      {
        heading: "Outras tecnologias emergentes",
        body: "Anuloplastia transcateter (Cardioband, Millipede): dispositivos que reduzem o anel da válvula por cateter. Substituição valvar mitral transcateter (TMVR): próteses valvares implantadas na posição mitral por cateter — ainda em fase de desenvolvimento clínico. Tecnologias para tricúspide: TriClip, EVOQUE, NaviGate — campo em rápida evolução. Válvula-em-válvula e válvula-em-anel: implante de prótese transcateter dentro de bioprótese ou anel cirúrgico degenerados, evitando nova cirurgia aberta.",
      },
      {
        heading: "Para quem e o que esperar",
        body: "Estes procedimentos são para pacientes selecionados — geralmente com alto risco cirúrgico ou anatomia adequada. A decisão é sempre do Heart Team. A hospitalização é mais curta que a cirurgia (2 a 5 dias), a recuperação mais rápida, e os resultados são promissores. Acompanhamento regular com ecocardiograma é essencial para monitorar o resultado a longo prazo.",
      },
    ],
    tags: ["transcateter"],
  },
  {
    slug: "anticoagulacao",
    title: "Anticoagulação — guia completo para pacientes",
    category: "tratamentos",
    shortDescription: "Entenda por que, como e com que cuidados usar anticoagulantes em valvopatias.",
    sections: [
      {
        heading: "Por que é usada em valvopatias",
        body: "Anticoagulantes são medicamentos que dificultam a formação de coágulos no sangue. Em doenças valvares, são usados em três situações principais: (1) prótese valvar mecânica — obrigatório, vitalício, com warfarina; (2) fibrilação atrial associada a doença valvar — para prevenir AVC; (3) período pós-operatório de prótese biológica ou reparo — geralmente por 3 a 6 meses.",
      },
      {
        heading: "Warfarina (Marevan/Coumadin)",
        body: "É o anticoagulante padrão para próteses mecânicas. Exige controle laboratorial regular do INR (exame de sangue que mede o efeito do medicamento). O INR alvo varia: geralmente 2,0 a 3,0 para prótese aórtica mecânica e 2,5 a 3,5 para prótese mitral mecânica. INR abaixo do alvo: risco de trombose. INR acima: risco de sangramento. Muitos alimentos (especialmente verduras escuras ricas em vitamina K) e medicamentos interagem com a warfarina — mantenha dieta consistente e informe TODOS os médicos.",
      },
      {
        heading: "DOACs (novos anticoagulantes orais)",
        body: "Medicamentos como rivaroxabana, apixabana, edoxabana e dabigatrana são usados em fibrilação atrial não valvar. Vantagens: não precisam de controle de INR, menos interações alimentares. PORÉM: são CONTRAINDICADOS em pacientes com prótese mecânica e em estenose mitral moderada a grave. Nunca substitua warfarina por DOAC em prótese mecânica sem orientação médica — pode ser fatal.",
      },
      {
        heading: "Cuidados práticos diários",
        body: "Tome sempre no mesmo horário. Nunca dobre a dose se esquecer — tome a próxima normalmente e avise seu médico. Mantenha dieta com quantidade relativamente estável de verduras verdes (não precisa evitar, mas manter consistência). Evite álcool em excesso. Informe TODOS os profissionais de saúde que você usa anticoagulante — dentistas, médicos, enfermeiros. Use pulseira ou cartão de identificação. Tenha cuidado com cortes, quedas e atividades com risco de trauma.",
      },
    ],
    alerts: [
      "Sangramento importante, fezes escuras/pretas, sangue na urina, hematomas grandes ou sangramento que não para — atendimento médico imediato.",
      "NUNCA pare ou ajuste a dose do anticoagulante por conta própria. Sempre converse com seu médico antes.",
      "Em prótese mecânica, NUNCA substitua warfarina por outro anticoagulante sem orientação — risco de trombose fatal.",
    ],
    tags: ["medicação"],
  },
  {
    slug: "endocardite-prevencao",
    title: "Endocardite infecciosa — prevenção",
    category: "tratamentos",
    shortDescription: "Infecção grave das válvulas que pode ser prevenida com cuidados simples.",
    sections: [
      {
        heading: "O que é endocardite",
        body: "Endocardite infecciosa é uma infecção das válvulas do coração (naturais ou próteses) causada por bactérias que entram na corrente sanguínea. Pode destruir válvulas, formar abscessos, causar embolias para cérebro e outros órgãos, e é potencialmente fatal mesmo com tratamento. Felizmente, é rara — mas pacientes com próteses valvares, válvulas doentes ou cardiopatias congênitas têm risco aumentado.",
      },
      {
        heading: "Como as bactérias chegam ao coração",
        body: "Qualquer lesão que permita bactérias entrarem na corrente sanguínea pode ser porta de entrada: procedimentos dentários (extração, raspagem de tártaro), cirurgias, infecções de pele, uso de drogas injetáveis, e até escovar os dentes com gengiva inflamada. As bactérias circulam pelo sangue e podem se fixar em válvulas alteradas ou próteses.",
      },
      {
        heading: "Profilaxia antibiótica",
        body: "Para pacientes de alto risco — portadores de prótese valvar, endocardite prévia, cardiopatias congênitas cianóticas ou reparos com material protético — recomenda-se antibiótico preventivo antes de procedimentos dentários que envolvam manipulação de gengiva ou perfuração de mucosa. O antibiótico mais usado é amoxicilina, 2g, 1 hora antes do procedimento (ou clindamicina para alérgicos à penicilina). Converse com seu cardiologista e dentista para saber se você tem indicação.",
      },
      {
        heading: "Prevenção no dia a dia",
        body: "Mantenha excelente higiene bucal: escove os dentes duas vezes ao dia, use fio dental, faça revisões periódicas com o dentista. Cuide de qualquer infecção de pele prontamente. Evite piercings e tatuagens (ou procure locais com esterilização rigorosa). Mantenha as vacinas em dia. Se desenvolver febre inexplicada que persiste por mais de 48 horas — especialmente se você tem prótese valvar — procure atendimento médico e informe sobre sua condição cardíaca.",
      },
    ],
    alerts: [
      "Febre persistente + prótese valvar = procure atendimento médico imediatamente. Hemoculturas devem ser colhidas ANTES de iniciar antibióticos.",
    ],
    tags: ["infecção", "prevenção"],
  },
  {
    slug: "reabilitacao-cardiaca",
    title: "Reabilitação cardíaca",
    category: "tratamentos",
    shortDescription: "Programa supervisionado que melhora recuperação, qualidade de vida e sobrevida.",
    sections: [
      {
        heading: "O que é",
        body: "A reabilitação cardíaca é um programa multidisciplinar supervisionado que combina exercício físico progressivo, educação em saúde, suporte psicológico e orientação nutricional. É recomendada após cirurgia valvar, TAVI e outros procedimentos cardíacos. Apesar dos benefícios comprovados, ainda é subutilizada — menos de 30% dos pacientes elegíveis participam.",
      },
      {
        heading: "Benefícios comprovados",
        body: "Melhora da capacidade física e tolerância ao exercício. Redução de sintomas de ansiedade e depressão (muito comuns após cirurgia cardíaca). Melhor controle de fatores de risco (pressão, colesterol, peso). Retorno mais rápido e seguro às atividades do dia a dia e ao trabalho. Redução de reinternações. E, em muitos estudos, aumento da sobrevida.",
      },
      {
        heading: "Como funciona",
        body: "Geralmente começa 2 a 6 semanas após o procedimento (pode variar). Sessões de exercício supervisionado 2 a 3 vezes por semana, com monitorização de eletrocardiograma e pressão. Intensidade individualizada e progressiva. Duração típica do programa: 3 a 6 meses. Equipe composta por cardiologista, fisioterapeuta, enfermeiro, nutricionista e psicólogo.",
      },
    ],
    tags: ["exercício", "recuperação"],
  },

  // ============ JORNADA ============
  {
    slug: "antes-do-procedimento",
    title: "Antes do procedimento",
    category: "jornada",
    shortDescription: "Tudo que você precisa saber para se preparar com segurança.",
    sections: [
      {
        heading: "Avaliação pré-operatória",
        body: "Inclui consultas com o cardiologista, cirurgião cardíaco (ou intervencionista) e anestesista. Exames habituais: hemograma, função renal e hepática, coagulação, tipo sanguíneo, eletrocardiograma, raio-X de tórax, e ecocardiograma atualizado. Dependendo do caso: tomografia, cateterismo, avaliação odontológica (para tratar focos infecciosos antes da cirurgia), e avaliações por outros especialistas conforme necessidade.",
      },
      {
        heading: "Medicações — o que ajustar",
        body: "Anticoagulantes (warfarina) geralmente precisam ser suspensos dias antes e substituídos por heparina. Antidiabéticos orais podem precisar de ajuste. Anti-hipertensivos costumam ser mantidos. Anti-inflamatórios devem ser suspensos. NUNCA pare ou ajuste medicação por conta própria — siga rigorosamente as instruções da equipe médica. Leve uma lista completa de todas as medicações que usa (incluindo suplementos e fitoterápicos).",
      },
      {
        heading: "Preparo prático",
        body: "Organize quem ficará com você nos primeiros dias após a alta. Prepare sua casa: coloque itens do dia a dia em altura acessível (não precisa esticar os braços acima da cabeça), instale barras de apoio no banheiro se possível, remova tapetes soltos. Separe roupas confortáveis com abertura frontal (botões, zíper). Leve documentos, exames e a lista de medicações para a internação.",
      },
    ],
    tags: ["jornada"],
  },
  {
    slug: "internacao",
    title: "Durante a internação",
    category: "jornada",
    shortDescription: "Como costuma ser a experiência hospitalar — o que esperar em cada fase.",
    sections: [
      {
        heading: "O dia da cirurgia/procedimento",
        body: "Chegada ao hospital com antecedência (geralmente na véspera para cirurgia, no mesmo dia para TAVI). Jejum conforme orientação (geralmente 8 horas para sólidos, 2 horas para líquidos claros). A equipe de enfermagem fará a preparação (tricotomia, acesso venoso, checklist de segurança). O anestesista conversará com você antes. Familiares recebem atualizações durante o procedimento.",
      },
      {
        heading: "UTI / Unidade de cuidados intensivos",
        body: "Após cirurgia valvar, a maioria dos pacientes vai para a UTI por 24 a 48 horas. Você acordará com tubo na garganta (intubação) que geralmente é retirado nas primeiras horas. Haverá drenos no tórax, sonda urinária, monitorização contínua e acesso venoso central. Pode haver alguma confusão ou desorientação ao acordar — isso é normal e temporário. A equipe estará ao seu lado. Após TAVI, muitos pacientes vão direto para a unidade coronariana ou semi-intensiva.",
      },
      {
        heading: "Enfermaria e mobilização",
        body: "Após a UTI, você é transferido para o quarto/enfermaria. A mobilização precoce é muito importante: sentar na cama, levantar para a poltrona, caminhar pelo corredor — tudo progressivamente e com orientação da fisioterapia. Exercícios respiratórios (respiração profunda, tosse assistida) são fundamentais para evitar complicações pulmonares. A dor é controlada com medicações — avise a equipe se estiver desconfortável.",
      },
    ],
    tags: ["jornada"],
  },
  {
    slug: "alta-hospitalar",
    title: "Alta hospitalar",
    category: "jornada",
    shortDescription: "Orientações fundamentais para uma transição segura para casa.",
    sections: [
      {
        heading: "Medicações na alta",
        body: "Você receberá uma receita detalhada com todas as medicações. Leia com atenção, tire todas as dúvidas antes de sair do hospital. Organize as medicações em horários, use caixinhas semanais se necessário. As medicações mais comuns na alta incluem: analgésicos, anticoagulantes (quando indicados), protetores gástricos, medicações para pressão e frequência cardíaca, e profilaxia de endocardite quando aplicável.",
      },
      {
        heading: "Cuidados com a ferida cirúrgica",
        body: "Mantenha a ferida limpa e seca. Lave delicadamente com água e sabão neutro durante o banho. Seque com tapinhas suaves (não esfregue). Não aplique pomadas, álcool, cremes ou curativos caseiros sem orientação. Sinais de alerta: vermelhidão que aumenta, calor local, drenagem de secreção (especialmente se purulenta ou com cheiro), abertura dos pontos, ou febre. Comunique a equipe imediatamente se notar qualquer um destes sinais.",
      },
      {
        heading: "Restrições temporárias",
        body: "O esterno (osso do peito) leva 6 a 8 semanas para consolidar após esternotomia. Nesse período: não dirija por 6 a 8 semanas, não levante peso acima de 5 kg, não faça movimentos de 'empurrar' ou 'puxar', cuidado ao se levantar da cama (role para o lado), não cruze os braços sobre o peito com força. Após TAVI, as restrições são mínimas — geralmente 1 a 2 semanas sem esforço no local da punção na virilha.",
      },
    ],
    tags: ["jornada"],
  },
  {
    slug: "recuperacao",
    title: "Recuperação em casa",
    category: "jornada",
    shortDescription: "Reabilitação, retorno gradual à rotina e cuidados de longo prazo.",
    sections: [
      {
        heading: "As primeiras semanas",
        body: "É normal sentir cansaço, variações de humor, dificuldade de concentração, alterações de sono e apetite. Essas sensações melhoram progressivamente. Caminhadas leves e curtas são encorajadas desde os primeiros dias em casa — comece com 5 a 10 minutos e aumente gradualmente. Tenha alguém com você nas primeiras semanas.",
      },
      {
        heading: "Aspectos emocionais",
        body: "Tristeza, ansiedade, irritabilidade e até depressão são comuns após cirurgia cardíaca — afetam até 30% dos pacientes. NÃO é fraqueza, é uma resposta normal do corpo e da mente a um grande estresse. Converse sobre seus sentimentos com familiares, amigos e profissionais de saúde. Se os sintomas persistirem por mais de 2 semanas ou interferirem muito na recuperação, peça ajuda profissional — psicólogo ou psiquiatra. A reabilitação cardíaca também ajuda muito nesse aspecto.",
      },
      {
        heading: "Retorno às atividades",
        body: "Trabalho leve/escritório: 6 a 12 semanas após cirurgia aberta (varia). Dirigir: 6 a 8 semanas após esternotomia. Atividade sexual: geralmente segura quando você consegue subir 2 lances de escada sem falta de ar. Exercício físico: comece na reabilitação cardíaca e progrida conforme orientação. Viagens de avião: consulte seu médico (geralmente liberada após 4 a 6 semanas). Cada recuperação é única — não se compare com outros pacientes.",
      },
      {
        heading: "Alimentação e estilo de vida",
        body: "Dieta equilibrada com frutas, vegetais, grãos integrais, peixes, e baixo teor de sal e gorduras saturadas. Se usa warfarina: mantenha consumo de vegetais verdes consistente (não elimine). Pare de fumar definitivamente — o tabagismo acelera a degeneração de próteses e aumenta risco cardiovascular. Controle peso, pressão, colesterol e diabetes. Vacinas em dia (influenza e pneumococo especialmente).",
      },
    ],
    tags: ["jornada"],
  },
  {
    slug: "follow-up",
    title: "Acompanhamento de longo prazo",
    category: "jornada",
    shortDescription: "O follow-up regular é fundamental — para sempre.",
    sections: [
      {
        heading: "Por que o acompanhamento nunca acaba",
        body: "Mesmo após uma intervenção bem-sucedida, o acompanhamento cardiológico deve ser mantido pelo resto da vida. Próteses biológicas podem degenerar com o tempo. Próteses mecânicas exigem controle contínuo de anticoagulação. Reparos valvares podem ter recorrência de regurgitação. E novas lesões podem surgir em outras válvulas. A vigilância regular permite detecção precoce de qualquer problema e intervenção oportuna.",
      },
      {
        heading: "Frequência típica de consultas e exames",
        body: "Primeiro mês: consulta 2 a 4 semanas após alta. Primeiro ano: consultas a cada 3 meses, com ecocardiograma de controle. A partir do segundo ano: consultas a cada 6 a 12 meses, com eco anual. Para próteses mecânicas: controle de INR semanal ou quinzenal (ou conforme orientação — existem dispositivos portáteis de automonitoramento). A frequência pode ser ajustada conforme a evolução de cada paciente.",
      },
      {
        heading: "O que comunicar ao médico entre consultas",
        body: "Qualquer sintoma novo ou que piore: falta de ar, cansaço, inchaço, palpitações, tontura, desmaio. Febre sem causa óbvia (especialmente com prótese). Sangramento que não para (para quem usa anticoagulante). Dor no peito. Mudança no som do 'clique' da prótese mecânica (alguns pacientes ouvem). Dificuldade em manter o INR no alvo. Qualquer procedimento dentário ou cirúrgico planejado.",
      },
    ],
    tags: ["jornada"],
  },
  {
    slug: "sinais-de-alerta",
    title: "Sinais de alerta — quando procurar ajuda",
    category: "jornada",
    shortDescription: "Sintomas que exigem atendimento médico imediato — não espere.",
    sections: [
      {
        heading: "EMERGÊNCIA — ligue SAMU 192 ou vá ao pronto-socorro",
        body: "Dor no peito intensa ou que irradia para braço, pescoço ou mandíbula. Falta de ar súbita ou que piora rapidamente. Desmaio (síncope). Palpitações intensas com tontura ou mal-estar. Sangramento importante que não para. Febre alta com calafrios (especialmente se tem prótese valvar — risco de endocardite). Fraqueza ou dormência súbita em um lado do corpo (pode ser AVC). Dificuldade para falar, visão turva ou perda de visão súbita. Dor intensa na perna com inchaço e calor (pode ser trombose venosa profunda).",
      },
      {
        heading: "URGENTE — procure atendimento em até 24 horas",
        body: "Piora progressiva da falta de ar ao longo de dias. Ganho rápido de peso (mais de 1 kg em um dia ou 2 kg em uma semana) — pode ser retenção de líquido. Inchaço novo ou crescente nas pernas, tornozelos ou abdômen. Tosse persistente nova. Dificuldade para deitar sem elevar a cabeceira. Febre que não cede em 48 horas. Vermelhidão ou secreção na ferida cirúrgica. Sangramentos pequenos mas repetidos (nariz, gengiva, urina).",
      },
      {
        heading: "O que fazer enquanto espera atendimento",
        body: "Ligue SAMU 192. Se está com falta de ar, sente-se inclinado para frente com os pés apoiados. Se está sangrando, faça compressão local. Tenha sempre à mão: lista de medicações, contato do cardiologista, cartão da prótese (se aplicável), e identificação de que usa anticoagulante. Ensine familiares próximos sobre estes sinais de alerta.",
      },
    ],
    alerts: [
      "Em emergência, ligue SAMU 192 ou vá ao pronto-socorro mais próximo. Não espere.",
      "Se tem prótese valvar e desenvolve febre sem causa aparente por mais de 48h, procure atendimento — endocardite deve ser investigada.",
    ],
    tags: ["alerta", "emergência"],
  },
  {
    slug: "vida-com-valvopatia",
    title: "Vivendo com doença valvar",
    category: "jornada",
    shortDescription: "Como manter qualidade de vida, exercício e bem-estar com uma valvopatia.",
    sections: [
      {
        heading: "Atividade física — sim, é possível e recomendada",
        body: "A grande maioria dos pacientes com doença valvar pode e deve se exercitar. A atividade física regular melhora a capacidade funcional, o controle de fatores de risco, o humor e a qualidade de vida. O tipo e a intensidade devem ser discutidos com seu cardiologista. Caminhadas, natação, bicicleta estacionária e exercícios de resistência leve são geralmente seguros. Esportes de contato e exercícios isométricos intensos (levantamento de peso pesado) podem ser restringidos em certas condições.",
      },
      {
        heading: "Alimentação e saúde cardiovascular",
        body: "Dieta mediterrânea ou DASH: ênfase em frutas, vegetais, grãos integrais, peixes, azeite e oleaginosas. Limite sódio (sal) para ajudar no controle da pressão e da retenção de líquido. Se usa warfarina: não elimine vegetais verdes, mas mantenha quantidade consistente. Hidratação adequada. Limite álcool. Evite excesso de cafeína se tem arritmia.",
      },
      {
        heading: "Saúde mental e suporte",
        body: "Viver com doença crônica pode gerar ansiedade e preocupação. Isso é normal e legítimo. Busque informação confiável (como esta plataforma). Converse abertamente com seu médico sobre seus medos e dúvidas. Considere grupos de apoio ou acompanhamento psicológico. A saúde mental é parte integral da saúde cardiovascular.",
      },
      {
        heading: "Viagens e situações especiais",
        body: "Viagens de avião são geralmente seguras para pacientes estáveis — consulte seu médico antes de viagens longas. Leve medicações na bagagem de mão (nunca na despachada). Tenha relatório médico em inglês para viagens internacionais. Informe sobre próteses ao passar por detectores de metal no aeroporto (podem apitar). Se vai fazer procedimento dentário ou cirúrgico, informe todos os profissionais sobre sua condição valvar e medicações.",
      },
    ],
    tags: ["qualidade de vida", "jornada"],
  },

  // ============ APROFUNDAMENTO (avançado, linguagem acessível) ============
  {
    slug: "entendendo-laudo-eco",
    title: "Entendendo seu laudo de ecocardiograma",
    category: "aprofundamento",
    shortDescription: "Traduza os números do seu eco para saber conversar de igual para igual com o cardiologista.",
    sections: [
      {
        heading: "Fração de ejeção (FE)",
        body: "É a porcentagem de sangue que o ventrículo esquerdo consegue ejetar a cada batimento. Valores normais ficam entre 55% e 70%. FE entre 41% e 54% é considerada 'levemente reduzida'; abaixo de 40%, 'reduzida' — o que indica que o músculo cardíaco está enfraquecido. Em doenças valvares, uma queda progressiva da FE é um dos sinais mais fortes de que o coração está sofrendo e pode indicar hora de intervir, mesmo antes de sintomas graves.",
      },
      {
        heading: "Gradiente médio e máximo (mmHg)",
        body: "Medem a diferença de pressão que o sangue precisa vencer ao passar por uma válvula estreitada. Na estenose aórtica: gradiente médio abaixo de 20 mmHg é leve; entre 20 e 40 é moderada; acima de 40 mmHg é grave. Quanto mais alto o gradiente, mais o coração 'sua' para bombear o sangue. Em situações de baixo fluxo (FE reduzida), gradientes menores ainda podem representar doença grave — por isso o cardiologista pode pedir um eco com estresse por dobutamina.",
      },
      {
        heading: "Área valvar (cm²)",
        body: "É o tamanho da abertura útil da válvula. Aórtica normal: 3 a 4 cm². Estenose grave: menor que 1,0 cm² (ou índice AVA < 0,6 cm²/m² quando corrigido pela superfície corporal). Mitral normal: 4 a 6 cm². Estenose mitral grave: menor que 1,5 cm². É uma medida menos dependente do fluxo — útil quando a FE está baixa.",
      },
      {
        heading: "Regurgitação: leve, moderada, grave",
        body: "É a quantidade de sangue que volta na direção errada. O laudo pode usar graus (I a IV) ou os termos leve, moderada e grave. Parâmetros como vena contracta, volume regurgitante e fração regurgitante são medidas quantitativas: uma vena contracta acima de 7 mm ou volume regurgitante acima de 60 mL/batimento indicam regurgitação grave. Nem toda regurgitação grave precisa de cirurgia imediata — depende de sintomas, tamanho e função do ventrículo.",
      },
      {
        heading: "Diâmetros do ventrículo esquerdo (DDVE e DSVE)",
        body: "DDVE é o diâmetro no fim da diástole (relaxamento); DSVE, no fim da sístole (contração). Em regurgitação aórtica ou mitral crônica, o ventrículo dilata para acomodar o excesso de sangue. Quando o DSVE ultrapassa 50 mm (ou 40 mm indexado em regurgitação mitral primária), as diretrizes sugerem considerar intervenção mesmo em pacientes com poucos sintomas — porque esperar demais pode causar dano irreversível.",
      },
      {
        heading: "PSAP — pressão sistólica da artéria pulmonar",
        body: "Estima a pressão dentro dos pulmões. Valor normal: até 35 mmHg. Acima de 50 mmHg indica hipertensão pulmonar significativa, frequentemente resultado de doença valvar de longa data (especialmente mitral). É um marcador de gravidade e influencia decisões terapêuticas e prognóstico.",
      },
      {
        heading: "'Stress echo' e outros termos que aparecem",
        body: "Eco sob estresse (exercício ou dobutamina) avalia como a válvula e o coração respondem sob demanda — útil quando os sintomas não batem com o repouso. Strain longitudinal global (GLS) é uma medida moderna de deformação do músculo cardíaco; valores menos negativos que -18% podem indicar disfunção precoce, mesmo com FE normal. Se aparecerem no seu laudo, peça ao médico para explicar o que significam no seu contexto.",
      },
    ],
    alerts: ["Este texto ajuda você a entender o laudo — a interpretação clínica final é sempre do seu médico, que integra os números ao seu quadro global."],
    tags: ["exame", "avançado", "ecocardiograma"],
  },
  {
    slug: "escolha-de-protese",
    title: "Prótese mecânica ou biológica: como escolher",
    category: "aprofundamento",
    shortDescription: "Compare vantagens, riscos e impacto na vida diária de cada tipo de válvula artificial.",
    sections: [
      {
        heading: "Prótese mecânica",
        body: "Feita de materiais como carbono pirolítico e titânio. Vantagem principal: durabilidade praticamente vitalícia — normalmente não precisa ser trocada. Desvantagem: exige anticoagulação com varfarina para o resto da vida, com monitoramento periódico do INR (idealmente entre 2,0 e 3,0 para aórtica; 2,5 a 3,5 para mitral). Os anticoagulantes diretos (rivaroxabana, apixabana, dabigatrana) NÃO são aprovados para próteses mecânicas — apenas varfarina.",
      },
      {
        heading: "Prótese biológica",
        body: "Feita de tecido animal (pericárdio bovino ou válvula porcina) tratado quimicamente. Vantagem: não exige anticoagulação de longo prazo (apenas 3 a 6 meses após a cirurgia, dependendo do caso). Desvantagem: durabilidade limitada — em pacientes jovens, pode degenerar em 10 a 15 anos; em idosos acima de 65 anos, tende a durar mais tempo relativo à expectativa de vida. Quando falha, pode ser tratada com uma nova cirurgia ou com uma prótese percutânea 'válvula em válvula' (valve-in-valve).",
      },
      {
        heading: "O que as diretrizes sugerem por idade",
        body: "As diretrizes ESC 2021 e AHA/ACC 2020 são práticas: em pacientes com menos de 50 anos, geralmente se recomenda prótese mecânica; entre 50 e 65 anos, a escolha é individualizada (chamada 'zona cinzenta'); acima de 65 anos, prótese biológica é preferida na maioria dos casos. Mulheres em idade fértil que desejam engravidar geralmente evitam prótese mecânica pelo risco da varfarina no feto.",
      },
      {
        heading: "Fatores que influenciam a decisão",
        body: "Além da idade: estilo de vida (esportes de contato ou profissões de risco desaconselham anticoagulação vitalícia), preferência do paciente após ser bem informado, aceitação da rotina de exames de INR, risco de sangramento (doenças hepáticas, gástricas), planos reprodutivos, expectativa de vida, e acesso ao serviço de saúde. Essa é uma decisão compartilhada — você tem voz.",
      },
      {
        heading: "TAVI/SAVI conta como prótese biológica",
        body: "As válvulas implantadas por cateter (TAVI para aórtica, TMVI para mitral) são sempre biológicas. A durabilidade das TAVIs modernas parece boa em 5 a 10 anos, e estudos de longo prazo ainda estão em andamento. Isso é relevante especialmente para pacientes mais jovens elegíveis.",
      },
      {
        heading: "E a válvula do próprio paciente (reparo)?",
        body: "Quando possível, reparar a válvula nativa (especialmente a mitral) é melhor do que trocar por qualquer prótese: preserva a função do ventrículo, evita anticoagulação e reduz complicações a longo prazo. Não é sempre viável — depende da anatomia. Sempre pergunte se o reparo é uma opção para você.",
      },
    ],
    tags: ["cirurgia", "prótese", "decisão"],
  },
  {
    slug: "tavi-em-profundidade",
    title: "TAVI em profundidade: o que perguntar antes de decidir",
    category: "aprofundamento",
    shortDescription: "Entenda quem se beneficia, os riscos reais e o que esperar antes, durante e depois do procedimento.",
    sections: [
      {
        heading: "Como o TAVI funciona",
        body: "TAVI (implante transcateter de válvula aórtica) coloca uma válvula biológica montada sobre um stent através de um cateter, geralmente introduzido pela artéria femoral (virilha). A prótese é expandida dentro da válvula doente, empurrando os folhetos calcificados para as bordas. Não é preciso abrir o tórax nem parar o coração. A hospitalização típica é de 2 a 4 dias, comparada a 5 a 10 dias da cirurgia convencional.",
      },
      {
        heading: "Quem se beneficia mais",
        body: "As diretrizes atuais recomendam TAVI para: pacientes acima de 75 anos com estenose aórtica grave sintomática; pacientes de qualquer idade com risco cirúrgico alto ou proibitivo; pacientes entre 65 e 75 anos após decisão do Heart Team, considerando anatomia favorável e preferência informada; e, cada vez mais, pacientes mais jovens em ensaios clínicos e casos selecionados. Não é apenas 'para idoso frágil' — hoje é opção robusta em muitos cenários.",
      },
      {
        heading: "Riscos reais que você deve conhecer",
        body: "Riscos principais: sangramento vascular no local do acesso (1 a 5%), acidente vascular cerebral (1 a 3%), necessidade de marca-passo definitivo (5 a 15%, dependendo do modelo de válvula), regurgitação paravalvar (vazamento ao redor da prótese — cada vez menos comum com válvulas modernas), lesão renal aguda pelo contraste. Mortalidade em 30 dias em centros experientes: 1 a 2%. Discuta esses números com sua equipe.",
      },
      {
        heading: "Como se preparar",
        body: "Você fará: angiotomografia de aorta e ilíacas (mede a anatomia), ecocardiograma detalhado, coronariografia (para tratar coronárias antes se necessário), avaliação de fragilidade e cognitiva, exames de sangue e função renal. Pergunte se você precisará suspender algum medicamento antes (metformina, anticoagulantes). Chegue jejuno, com acompanhante, e prepare-se emocionalmente — é normal sentir ansiedade.",
      },
      {
        heading: "O que esperar depois",
        body: "No dia seguinte, geralmente já se levanta e caminha. A alta ocorre em 2 a 4 dias. Nas primeiras semanas: evite esforço com o braço/perna do acesso, siga a antiagregação prescrita (geralmente AAS + clopidogrel por curto período, depois AAS isolado), acompanhe pressão arterial. A maioria dos pacientes relata melhora significativa dos sintomas em dias a semanas. Retorno a atividades leves em 1 a 2 semanas; direção após liberação médica.",
      },
      {
        heading: "Perguntas para levar ao Heart Team",
        body: "Quantos TAVIs seu centro realiza por ano? Qual sua taxa de complicações? Qual o modelo de válvula sugerido para mim e por quê? Sou candidato a cirurgia também — quais os prós e contras no meu caso? Preciso tratar coronárias antes? Quais medicamentos vou tomar depois e por quanto tempo? Como será o seguimento no primeiro ano? Um centro que responde essas perguntas com transparência é um bom sinal.",
      },
    ],
    tags: ["TAVI", "avançado", "aórtica"],
  },
  {
    slug: "anticoagulacao-vida-real",
    title: "Anticoagulação na vida real: o que você precisa dominar",
    category: "aprofundamento",
    shortDescription: "Guia prático para viver bem com varfarina ou anticoagulantes diretos após cirurgia valvar.",
    sections: [
      {
        heading: "Por que você toma anticoagulante",
        body: "Após implante de prótese mecânica, ou em quem tem fibrilação atrial associada à valvopatia, o anticoagulante evita a formação de coágulos sobre a prótese ou dentro do átrio — coágulos que podem viajar e causar AVC ou obstruir a válvula (trombose de prótese, uma emergência). Não é um remédio 'opcional': parar por conta própria pode ser fatal em dias.",
      },
      {
        heading: "Varfarina e o INR",
        body: "A varfarina exige exames de sangue (INR) periódicos. Alvo típico: 2,0 a 3,0 (aórtica mecânica) ou 2,5 a 3,5 (mitral mecânica ou fatores de risco adicionais). INR abaixo do alvo = risco de coágulo; acima do alvo = risco de sangramento. Muitos alimentos e remédios interferem — mas a solução não é evitar vegetais verdes (fonte de vitamina K): é manter a ingestão estável e ajustar a dose com seu médico. Álcool em excesso, antibióticos, anti-inflamatórios e chá verde podem alterar o INR.",
      },
      {
        heading: "Anticoagulantes diretos (DOACs)",
        body: "Rivaroxabana, apixabana, dabigatrana e edoxabana têm dose fixa e não exigem INR. Podem ser usados em fibrilação atrial não valvar, incluindo em pacientes com prótese biológica após 3 meses e com estenose aórtica ou insuficiência valvar. NÃO são aprovados para prótese mecânica nem estenose mitral reumática moderada a grave — nestes casos, apenas varfarina. Nunca troque de anticoagulante sem orientação.",
      },
      {
        heading: "Sinais de sangramento que exigem atenção imediata",
        body: "Procure emergência se tiver: sangramento pela urina (rosa/vermelha) ou fezes escuras como borra de café ou vermelho vivo; hematomas grandes sem trauma; sangramento nasal ou gengival que não para em 15 minutos; vômito com sangue; dor de cabeça súbita e intensa, tontura, fraqueza em um lado do corpo, alterações visuais (podem ser AVC hemorrágico). Nem todo hematoma pequeno é problema — mas na dúvida, ligue para seu médico.",
      },
      {
        heading: "Procedimentos, dentista e cirurgias",
        body: "SEMPRE informe qualquer profissional (dentista, endoscopista, cirurgião, tatuador) sobre o anticoagulante. Extrações dentárias simples podem ser feitas com o anticoagulante, com cuidados locais. Cirurgias maiores exigem 'ponte' — suspender o anticoagulante alguns dias antes e substituir por heparina se você é de alto risco. NUNCA suspenda por conta própria: seu médico decide o plano.",
      },
      {
        heading: "Rotina que salva",
        body: "Tome sempre no mesmo horário. Não pule doses. Não dobre se esquecer (siga a orientação do médico). Tenha uma carteirinha ou pulseira identificando o anticoagulante. Faça INR na frequência combinada — a maioria dos pacientes estáveis, a cada 4 a 6 semanas. Peça um plano por escrito com alvos, o que fazer se INR estiver fora e telefones de contato. Muitos hospitais têm ambulatórios de anticoagulação — vale a pena procurar.",
      },
    ],
    alerts: ["Nunca pare o anticoagulante por conta própria. Trombose de prótese é uma emergência médica com alta mortalidade."],
    tags: ["medicação", "anticoagulação", "segurança"],
  },
  {
    slug: "sinais-descompensacao",
    title: "Sinais de descompensação: quando procurar ajuda",
    category: "aprofundamento",
    shortDescription: "Aprenda a reconhecer cedo os sinais de que sua doença valvar está piorando.",
    sections: [
      {
        heading: "Ganho de peso rápido",
        body: "Ganhar mais de 1 kg em 24 horas ou 2 kg em uma semana geralmente NÃO é gordura — é retenção de líquido, um dos primeiros sinais de insuficiência cardíaca descompensada. Pese-se todos os dias, no mesmo horário (idealmente pela manhã, após urinar, com roupas leves) e anote. Ligue para seu médico ao observar essa variação, mesmo se estiver se sentindo bem.",
      },
      {
        heading: "Falta de ar que muda de padrão",
        body: "Sinais preocupantes: falta de ar aos esforços que antes você fazia sem problema (subir uma escada, caminhar um quarteirão); falta de ar ao deitar (ortopneia) que exige mais travesseiros; despertar sufocado no meio da noite (dispneia paroxística noturna). Não são 'coisa da idade' — são sinais de sobrecarga cardíaca e devem ser comunicados no mesmo dia ou dia seguinte.",
      },
      {
        heading: "Inchaço que aumenta",
        body: "Inchaço nos tornozelos, pés ou pernas que piora ao longo do dia; barriga estufada ou inchada; roupas e sapatos ficando apertados. Pressione com o dedo sobre a canela: se ficar uma marca (edema depressível), há retenção de líquido significativa. Procure seu médico em até 48 horas.",
      },
      {
        heading: "Sintomas que exigem emergência AGORA",
        body: "Vá imediatamente ao pronto-socorro se tiver: dor no peito forte, opressiva, que não passa em 10-15 minutos ou piora; falta de ar súbita e intensa em repouso; desmaio ou quase desmaio; palpitação forte com tontura; batimentos muito rápidos e irregulares que não passam; sinais de AVC (fraqueza súbita em um lado do corpo, boca torta, dificuldade para falar). Ligue 192 (SAMU) ou vá acompanhado — não dirija.",
      },
      {
        heading: "Fadiga anormal e outros alertas",
        body: "Cansaço muito maior que o habitual, sem motivo aparente; perda de apetite; náusea; confusão mental leve em idosos (às vezes é o único sinal); tosse seca persistente, principalmente à noite. Isolados podem ser inespecíficos, mas juntos costumam indicar descompensação. Ligue para a equipe.",
      },
      {
        heading: "Como se preparar",
        body: "Tenha à mão: lista atualizada de medicações com doses; telefones do cardiologista, cardiologista de plantão e pronto-socorro de referência; último eco e exames; carteirinha identificando prótese (se houver) e alergias. Combine com sua equipe um 'plano de ação' — o que fazer diante de cada sintoma, quando ir ao PS, quando ajustar diurético em casa (se autorizado). Isso salva vidas.",
      },
    ],
    alerts: ["Em caso de dor no peito intensa, falta de ar súbita, desmaio ou sinais de AVC, procure emergência imediatamente."],
    tags: ["segurança", "urgência", "autocuidado"],
  },
  {
    slug: "endocardite-prevencao",
    title: "Endocardite: proteção prática no dia a dia",
    category: "aprofundamento",
    shortDescription: "Como reduzir o risco de infecção grave da válvula com hábitos simples.",
    sections: [
      {
        heading: "O que é e por que se preocupar",
        body: "Endocardite infecciosa é a infecção do revestimento interno do coração, geralmente sobre uma válvula (nativa ou prótese). Pode danificar rapidamente a válvula, formar coágulos infectados que embolizam para cérebro, rins ou pulmões, e tem mortalidade significativa mesmo com tratamento (15 a 30% dependendo do caso). Prevenir é infinitamente melhor que tratar.",
      },
      {
        heading: "Quem tem risco alto e precisa de profilaxia antibiótica",
        body: "As diretrizes indicam antibiótico preventivo antes de procedimentos dentários com sangramento em: portadores de prótese valvar (qualquer tipo, incluindo TAVI); história prévia de endocardite; cardiopatias congênitas cianóticas não corrigidas ou com material protético; transplantados cardíacos com valvopatia. Se você se encaixa, informe SEMPRE o dentista e leve uma orientação escrita do seu cardiologista.",
      },
      {
        heading: "Saúde bucal é saúde cardíaca",
        body: "A boca é a porta de entrada mais comum das bactérias que causam endocardite. Escove os dentes duas a três vezes por dia com creme fluoretado; use fio dental diariamente (gengiva sangrando é sinal de inflamação = mais risco); vá ao dentista a cada 6 meses para limpeza profissional; trate cáries e problemas gengivais ativamente. Isso é mais protetor do que qualquer antibiótico.",
      },
      {
        heading: "Tatuagens, piercings e drogas injetáveis",
        body: "Tatuagens e piercings introduzem bactérias na corrente sanguínea. Se decidir fazer, escolha estúdio com padrões rigorosos de esterilização, evite língua/boca e mucosas, e discuta com seu cardiologista sobre profilaxia. Uso de drogas injetáveis é um dos maiores fatores de risco para endocardite grave — se você usa, procure ajuda e nunca compartilhe agulhas.",
      },
      {
        heading: "Cuide da pele e de infecções pequenas",
        body: "Ferimentos, foliculites, infecções de unha, furúnculos e infecções urinárias devem ser tratados prontamente — não deixe evoluir. Lave bem cortes com água e sabão. Procure médico se houver vermelhidão que aumenta, calor, pus, febre. Evite espremer espinhas no rosto (área de drenagem venosa perigosa).",
      },
      {
        heading: "Febre inexplicada em portador de valvopatia = investigar",
        body: "Febre persistente por mais de uma semana sem causa clara (não é gripe/covid/dengue óbvia), cansaço extremo, suor noturno, perda de peso, dores articulares novas — em quem tem doença valvar ou prótese, essas queixas exigem HEMOCULTURAS antes de qualquer antibiótico. Isso é fundamental: iniciar antibiótico antes das culturas pode 'apagar' o diagnóstico. Informe TODO médico sobre sua condição valvar.",
      },
    ],
    alerts: ["Nunca tome antibiótico por conta própria antes de investigar febre inexplicada — pode mascarar endocardite."],
    tags: ["prevenção", "endocardite", "segurança"],
  },
  {
    slug: "perguntas-heart-team",
    title: "Perguntas essenciais para o Heart Team",
    category: "aprofundamento",
    shortDescription: "Um roteiro para você conduzir a consulta e decidir junto com a equipe.",
    sections: [
      {
        heading: "Sobre o meu caso",
        body: "Qual exatamente é minha doença valvar e sua gravidade? A doença é primária (da própria válvula) ou secundária (por outra causa cardíaca)? Como ela está evoluindo comparando com meus exames anteriores? Quais são meus fatores de risco individuais (idade, comorbidades, função renal, fragilidade)? Qual meu escore de risco (STS, EuroSCORE II) e o que ele significa na prática?",
      },
      {
        heading: "Sobre as opções de tratamento",
        body: "Quais são todas as opções para o meu caso: acompanhar, medicar, cateter, cirurgia? Qual a diferença de risco e benefício entre elas no meu caso específico? Se cirurgia, é possível REPARAR ou terei que trocar a válvula? Se TAVI/TMVI, qual modelo e por quê? Existem centros com mais experiência para o meu caso? Posso ter uma segunda opinião?",
      },
      {
        heading: "Sobre a intervenção proposta",
        body: "Se optarmos por intervir: quando é o momento ideal (agora, em 3 meses, esperar)? Qual a taxa de sucesso e de complicações do seu centro para esse procedimento? Quantos casos como o meu vocês fazem por ano? Qual a mortalidade em 30 dias e em 1 ano? Vou precisar de UTI? Por quanto tempo? Como será a reabilitação?",
      },
      {
        heading: "Sobre medicações e vida depois",
        body: "Quais medicamentos vou tomar depois e por quanto tempo? Como serão os primeiros 3 meses? Quando poderei voltar a trabalhar, dirigir, ter atividade sexual, praticar exercício? Que sinais devo vigiar em casa? Com que frequência serão os retornos? Quem eu ligo se algo acontecer fora do horário comercial?",
      },
      {
        heading: "Sobre custos e logística",
        body: "O procedimento é coberto pelo meu plano ou SUS? Se particular, qual o custo estimado (equipe, hospital, prótese)? Preciso de acompanhante o tempo todo? Onde ficarei internado? Se moro em outra cidade, existe hospedagem próxima? Vocês emitem relatórios detalhados que posso levar para meu cardiologista local?",
      },
      {
        heading: "Direito à informação e decisão",
        body: "Você tem direito de: ler seu prontuário e cópia dos exames; entender riscos e alternativas antes de assinar consentimento; pedir segunda opinião em outro serviço sem quebrar o vínculo com sua equipe; recusar um tratamento após ser informado; ter tempo para pensar em decisões não urgentes. Uma equipe boa RECEBE bem essas perguntas — e responde com clareza. Se você sente pressa ou dificuldade em obter respostas, considere outra avaliação.",
      },
    ],
    tags: ["decisão compartilhada", "Heart Team", "avançado"],
  },
];

export const patientCategories = {
  fundamentos: { label: "Fundamentos", description: "Conceitos essenciais sobre válvulas cardíacas, doenças e como o coração funciona." },
  doencas: { label: "Doenças valvares", description: "Cada doença valvar explicada em profundidade — causas, sintomas e tratamento." },
  exames: { label: "Exames e diagnóstico", description: "Como cada exame é feito, o que avalia e como se preparar." },
  tratamentos: { label: "Tratamentos", description: "Todas as opções terapêuticas — medicações, cateter e cirurgia." },
  jornada: { label: "Jornada do paciente", description: "Do diagnóstico à vida plena — cada fase da sua jornada." },
  aprofundamento: { label: "Aprofundamento", description: "Conteúdo avançado com linguagem acessível — para você conversar de igual para igual com sua equipe." },
};


export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const glossary: GlossaryEntry[] = [
  { term: "Aorta", definition: "Maior artéria do corpo, sai do ventrículo esquerdo e leva sangue oxigenado para o organismo." },
  { term: "Anel valvar", definition: "Estrutura em forma de anel onde os folhetos da válvula se inserem. Sua dilatação pode causar insuficiência valvar." },
  { term: "Anticoagulante", definition: "Medicamento que dificulta a formação de coágulos. Essencial para próteses mecânicas e fibrilação atrial." },
  { term: "Bicúspide", definition: "Válvula com dois folhetos, em vez dos três habituais. Variação congênita mais comum da válvula aórtica (1-2% da população)." },
  { term: "Bioprótese", definition: "Prótese valvar feita de tecido biológico (porcino ou bovino). Não exige anticoagulação crônica mas tem durabilidade limitada." },
  { term: "BNP/NT-proBNP", definition: "Marcador sanguíneo que se eleva quando o coração está sob estresse. Útil no diagnóstico e seguimento de insuficiência cardíaca." },
  { term: "Calcificação", definition: "Depósito de cálcio nos folhetos valvares. Causa mais comum de estenose aórtica em idosos." },
  { term: "Cateterismo", definition: "Procedimento em que cateteres finos são levados até o coração para avaliar coronárias, pressões e anatomia." },
  { term: "Circulação extracorpórea", definition: "Máquina que assume temporariamente a função do coração e pulmões durante a cirurgia, permitindo operar o coração parado." },
  { term: "Coaptação", definition: "Encontro dos folhetos ao fechar a válvula. Quando os folhetos não coaptam, há regurgitação." },
  { term: "Comissuras", definition: "Pontos onde os folhetos da válvula se encontram. Na doença reumática, as comissuras se fundem causando estenose." },
  { term: "Cordas tendíneas", definition: "Estruturas finas como fios que conectam os folhetos da mitral e tricúspide aos músculos papilares. Previnem o prolapso." },
  { term: "DOACs", definition: "Anticoagulantes orais diretos (rivaroxabana, apixabana, etc.). Usados em FA não valvar. Contraindicados em prótese mecânica." },
  { term: "Doppler", definition: "Técnica do ecocardiograma que mede velocidade e direção do fluxo sanguíneo. Essencial para quantificar estenoses e regurgitações." },
  { term: "Ecocardiograma", definition: "Exame de imagem que usa ultrassom para avaliar o coração e as válvulas. É o exame central em valvopatias." },
  { term: "Endocardite", definition: "Infecção das válvulas cardíacas. Grave, potencialmente fatal. Prevenível com higiene bucal e profilaxia antibiótica quando indicada." },
  { term: "ERO", definition: "Effective Regurgitant Orifice — área efetiva do orifício regurgitante. Parâmetro quantitativo da gravidade da insuficiência." },
  { term: "Estenose", definition: "Estreitamento de uma válvula que dificulta a passagem do sangue. Força o coração a trabalhar mais." },
  { term: "Esternotomia", definition: "Incisão cirúrgica no esterno (osso do peito). Acesso tradicional para cirurgia cardíaca." },
  { term: "FEVE", definition: "Fração de ejeção do ventrículo esquerdo. Mede a porcentagem de sangue bombeado a cada batimento. Normal: 55-70%." },
  { term: "Fibrilação atrial", definition: "Arritmia em que os átrios batem de forma rápida e desordenada. Muito comum em valvopatias. Aumenta risco de AVC." },
  { term: "Folhetos", definition: "Lâminas finas que se abrem e fecham para permitir a passagem do sangue pela válvula." },
  { term: "Gradiente", definition: "Diferença de pressão através de uma válvula, medida pelo eco. Quanto maior, geralmente mais estreita a válvula." },
  { term: "Heart Team", definition: "Equipe multidisciplinar (cardiologistas, cirurgiões, intervencionistas, imagem) que decide em conjunto o melhor tratamento." },
  { term: "Hipertrofia", definition: "Engrossamento do músculo cardíaco. Resposta adaptativa à sobrecarga de pressão (como na estenose aórtica)." },
  { term: "INR", definition: "International Normalized Ratio. Exame que mede o efeito da warfarina. Mantê-lo no alvo é fundamental." },
  { term: "Insuficiência valvar", definition: "Também chamada regurgitação. A válvula não fecha bem e parte do sangue retorna na direção errada." },
  { term: "Mitral", definition: "Válvula com dois folhetos entre o átrio esquerdo e o ventrículo esquerdo." },
  { term: "NYHA", definition: "Classificação funcional dos sintomas: I (sem limitação), II (limitação leve), III (limitação moderada), IV (sintomas em repouso)." },
  { term: "Prolapso", definition: "Quando um folheto se projeta além de sua posição normal durante o fechamento. Causa mais comum de IM primária." },
  { term: "Prótese", definition: "Válvula artificial implantada quando a original precisa ser substituída. Pode ser biológica ou mecânica." },
  { term: "Regurgitação", definition: "Mesmo que insuficiência valvar — sangue retorna por fechamento incompleto da válvula." },
  { term: "SAVR", definition: "Surgical Aortic Valve Replacement — troca cirúrgica da válvula aórtica." },
  { term: "Score de Wilkins", definition: "Sistema de pontuação ecocardiográfica que avalia a anatomia da mitral para prever sucesso da valvotomia por balão." },
  { term: "Sopro", definition: "Som extra ouvido com estetoscópio, causado por turbulência do sangue. Pode ser inocente ou indicar doença." },
  { term: "TAVI/TAVR", definition: "Implante valvar aórtico por cateter. Substitui a válvula aórtica sem cirurgia aberta." },
  { term: "TEER", definition: "Transcatheter Edge-to-Edge Repair — reparo de borda-a-borda por cateter. Usado para insuficiência mitral ou tricúspide." },
  { term: "Tricúspide", definition: "Válvula com três folhetos, entre átrio direito e ventrículo direito. A 'válvula esquecida' que ganhou destaque recente." },
  { term: "Valvotomia", definition: "Procedimento para abrir uma válvula estenosada. Pode ser por balão (percutânea) ou cirúrgica." },
  { term: "Vena contracta", definition: "Largura mais estreita do jato regurgitante, medida pelo eco. Quanto maior, mais grave a regurgitação." },
  { term: "Vmax", definition: "Velocidade máxima do fluxo através de uma válvula. Vmax ≥ 4,0 m/s na aórtica indica estenose grave." },
  { term: "Warfarina", definition: "Anticoagulante oral (Marevan/Coumadin). Obrigatório em próteses mecânicas. Requer controle de INR." },
];

export interface FAQ {
  question: string;
  answer: string;
}

export const faqs: FAQ[] = [
  {
    question: "Toda doença valvar exige cirurgia?",
    answer: "Não. Muitas valvopatias são acompanhadas por anos sem necessidade de procedimento. A decisão depende da gravidade, dos sintomas, da função do coração e da sua condição geral. Muitos pacientes vivem décadas com doença valvar leve ou moderada, apenas com acompanhamento regular.",
  },
  {
    question: "Posso ter uma vida normal com uma valvopatia?",
    answer: "Na grande maioria dos casos, sim. Com acompanhamento regular, tratamento adequado quando indicado e estilo de vida saudável, pacientes com doença valvar mantêm qualidade de vida excelente — trabalham, se exercitam, viajam e têm relações normais.",
  },
  {
    question: "Sopro no coração é sempre grave?",
    answer: "Não. Sopros inocentes são extremamente comuns em crianças e adultos jovens e não significam doença. Quando o médico identifica um sopro, pode pedir um ecocardiograma para verificar. Se o eco for normal, não há com o que se preocupar.",
  },
  {
    question: "TAVI é melhor que cirurgia?",
    answer: "Não há resposta única. Cada técnica tem vantagens em perfis diferentes de paciente. A TAVI tem recuperação mais rápida e é menos invasiva; a cirurgia tem durabilidade mais comprovada a longo prazo. A escolha ideal é feita pelo Heart Team considerando sua anatomia, idade, risco e preferências.",
  },
  {
    question: "Vou precisar tomar anticoagulante para sempre?",
    answer: "Depende do tipo de prótese e de condições associadas. Próteses mecânicas exigem warfarina vitalícia. Próteses biológicas geralmente não após os primeiros meses. Se você tem fibrilação atrial, a anticoagulação também é necessária independentemente do tipo de prótese.",
  },
  {
    question: "Posso fazer atividade física?",
    answer: "Em geral, sim — e é altamente recomendado. A atividade física regular melhora a recuperação e a qualidade de vida. O tipo e intensidade devem ser discutidos com seu cardiologista. A reabilitação cardíaca supervisionada é o ponto de partida ideal após procedimentos.",
  },
  {
    question: "O que é Heart Team?",
    answer: "É uma equipe multidisciplinar — cardiologistas clínicos, intervencionistas, cirurgiões cardíacos, especialistas em imagem — que analisa casos complexos juntos para definir a melhor estratégia de tratamento. É o padrão-ouro internacional de decisão em valvopatias.",
  },
  {
    question: "Posso engravidar com doença valvar?",
    answer: "Em muitos casos, sim, mas requer planejamento cuidadoso. A gravidez aumenta a demanda sobre o coração. Pacientes com prótese mecânica enfrentam desafios com a anticoagulação (warfarina é teratogênica). A consulta pré-concepcional com cardiologista e obstetra de alto risco é essencial.",
  },
  {
    question: "Doença reumática tem cura?",
    answer: "A sequela valvar da febre reumática é irreversível — a válvula danificada não volta ao normal. Porém, a profilaxia com penicilina benzatina previne novos surtos e piora adicional das válvulas. Tratar a infecção de garganta nas crianças é a melhor prevenção.",
  },
  {
    question: "ValvePath substitui meu médico?",
    answer: "Não. ValvePath é uma ferramenta de apoio educacional e organizacional. Toda decisão clínica deve ser tomada pelo seu médico, com base em avaliação individual e no contexto do seu caso.",
  },
];
