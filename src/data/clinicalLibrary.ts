// Biblioteca clínica — alinhada à ESC/EACTS 2025, com cada referência conferível.
// Conteúdo é educacional. Não substitui julgamento clínico individual.
//
// ## O que mudou, e por que importava
//
// Esta biblioteca ficou em ESC/EACTS 2021 e SBC 2020 enquanto o motor de conduta
// (`src/lib/guidelines.ts`) passou para 2025. O médico via os dois na mesma
// sessão: a ferramenta calculando por uma diretriz e o texto ao lado ensinando
// outra. Duas afirmações eram falsas em 2025, não apenas desatualizadas:
//
//   · estenose aórtica — "indicação: sintomática ou FEVE < 50%" omitia a
//     recomendação IIa A de intervir no assintomático com FE preservada, teste
//     de esforço normal e risco baixo, que é a mudança central de 2025;
//   · insuficiência aórtica — "FEVE ≤ 55%" era apresentada como indicação
//     cirúrgica. Em 2025, ≤ 55% é **IIb** e só com risco cirúrgico baixo; a
//     Classe I é ≤ 50%. Tratar as duas como a mesma coisa empurra para cirurgia
//     um paciente que a diretriz manda apenas considerar.
//
// ## As referências deixaram de ser texto solto
//
// Eram 29 linhas sem um link. O `npm run pmids` existe porque eu já escrevi três
// PMIDs que apontavam para artigos sem relação — um deles sobre o genoma de uma
// lesma —, e ele varre `src/` procurando URLs do PubMed. Sem nenhuma, a
// biblioteca estava inteiramente fora do guarda.
//
// Agora cada referência carrega o PubMed, e o guarda passou a cobri-la sem
// precisar de uma linha de código nova.

/**
 * Uma referência com procedência verificável.
 *
 * `url` é o link do PubMed, e é ele que põe a citação sob o `npm run pmids`: o
 * guarda acha a URL e compara o título do artigo com o texto da citação ao lado.
 *
 * Fica opcional porque nem toda fonte legítima é indexada — a diretriz da SBC,
 * por exemplo, não tem PMID. Quando falta, `nota` diz por quê. Ausência sem
 * motivo escrito é indistinguível de esquecimento.
 */
export interface Referencia {
  citacao: string;
  url?: string;
  nota?: string;
}

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
  references: Referencia[];
}

/**
 * As fontes, uma vez cada, com o PubMed ao lado.
 *
 * Repetidas em oito arrays, elas divergiam no primeiro ajuste — e a biblioteca
 * já tinha três redações diferentes da mesma diretriz de 2021. Declaradas aqui,
 * a correção acontece num lugar só.
 */
const REF = {
  esc2025: {
    citacao:
      "Praz F, Borger MA, Lanz J, et al. 2025 ESC/EACTS Guidelines for the management of " +
      "valvular heart disease. Eur Heart J. 2025;46(44):4635-4736.",
    url: "https://pubmed.ncbi.nlm.nih.gov/40878295/",
  },
  esc2025Errata: {
    citacao:
      "Correction to: 2025 ESC/EACTS Guidelines for the management of valvular heart disease. " +
      "Eur Heart J. 2026. Corrige a seção 9.2.4.2: onde se lia NYHA class II-V, leia-se II-IV.",
    url: "https://pubmed.ncbi.nlm.nih.gov/42557008/",
  },
  accAha2020: {
    citacao:
      "Otto CM, Nishimura RA, Bonow RO, et al. 2020 ACC/AHA Guideline for the Management of " +
      "Patients With Valvular Heart Disease. J Am Coll Cardiol. 2021;77(4):e25-e197.",
    url: "https://pubmed.ncbi.nlm.nih.gov/33342586/",
  },
  earlyTavr: {
    citacao:
      "Genereux P, Schwartz A, Oldemeyer JB, et al. Transcatheter Aortic-Valve Replacement for " +
      "Asymptomatic Severe Aortic Stenosis. N Engl J Med. 2025;392(3):217-227. (EARLY TAVR)",
    url: "https://pubmed.ncbi.nlm.nih.gov/39466903/",
  },
  avatar: {
    citacao:
      "Banovic M, Putnik S, Penicka M, et al. Aortic Valve Replacement Versus Conservative " +
      "Treatment in Asymptomatic Severe Aortic Stenosis: The AVATAR Trial. Circulation. " +
      "2022;145(9):648-658.",
    url: "https://pubmed.ncbi.nlm.nih.gov/34779220/",
  },
  avatarLongo: {
    citacao:
      "Banovic M, Putnik S, Da Costa BR, et al. Aortic valve replacement vs. conservative " +
      "treatment in asymptomatic severe aortic stenosis: long-term follow-up of the AVATAR trial. " +
      "Eur Heart J. 2024;45(43):4526-4535.",
    url: "https://pubmed.ncbi.nlm.nih.gov/39217448/",
  },
  recovery10: {
    citacao:
      "Kang DH, Park SJ, Lee SA, et al. Early Surgery or Conservative Care for Asymptomatic " +
      "Aortic Stenosis at 10 Years. N Engl J Med. 2026;394(12):1085-1095. (RECOVERY, 10 anos)",
    url: "https://pubmed.ncbi.nlm.nih.gov/41880613/",
  },
  escEndocardite2023: {
    citacao:
      "Delgado V, Ajmone Marsan N, de Waha S, et al. 2023 ESC Guidelines for the management of " +
      "endocarditis. Eur Heart J. 2023;44(39):3948-4042.",
    url: "https://pubmed.ncbi.nlm.nih.gov/37622656/",
  },
  escFa2024: {
    citacao:
      "Van Gelder IC, Rienstra M, Bunting KV, et al. 2024 ESC Guidelines for the management of " +
      "atrial fibrillation. Eur Heart J. 2024;45(36):3314-3414.",
    url: "https://pubmed.ncbi.nlm.nih.gov/39210723/",
  },
  febreReumaticaBr: {
    citacao:
      "Temporal Trends in the Epidemiology of Acute Rheumatic Fever: A Nationwide Analysis. " +
      "Arq Bras Cardiol. 2025.",
    url: "https://pubmed.ncbi.nlm.nih.gov/40834210/",
  },
  sbcValvopatias: {
    citacao: "Diretriz Brasileira de Valvopatias - Sociedade Brasileira de Cardiologia, 2020.",
    nota:
      "Sem PMID: a diretriz da SBC nao e indexada no PubMed com este titulo. Fica citada sem " +
      "link para nao inventar um numero que pareceria conferido.",
  },
} satisfies Record<string, Referencia>;

export const clinicalLibrary: ClinicalGuideline[] = [
  {
    slug: "estenose-aortica",
    valve: "Aórtica",
    title: "Estenose Aórtica — abordagem clínica completa",
    shortTitle: "Estenose Aórtica",
    pathology: "Estenose",
    summary:
      "Doença valvar mais prevalente em idosos. Causa obstrução à ejeção do ventrículo esquerdo, com remodelamento hipertrófico e potencial evolução para insuficiência cardíaca, síncope e morte súbita. Prevalência de 2-7% acima de 65 anos.",
    keyPoints: [
      "Tríade clássica: dispneia, angina e síncope (sinais de mau prognóstico).",
      "EA importante: área valvar < 1,0 cm², gradiente médio ≥ 40 mmHg, Vmax ≥ 4,0 m/s.",
      "Indicação Classe I: EA grave sintomática, ou assintomática com FEVE < 50% sem outra causa.",
      "NOVO em 2025 (IIa A): no assintomático com FEVE ≥ 50%, teste de esforço normal e risco do procedimento baixo, a intervenção é alternativa à vigilância ativa — não mais apenas esperar.",
      "IIa B no assintomático de risco baixo com FEVE ≥ 50% e um critério adicional: gradiente médio ≥ 60 mmHg ou Vmax > 5,0 m/s; calcificação grave com progressão de Vmax ≥ 0,3 m/s/ano; BNP/NT-proBNP mais de três vezes o normal; ou FEVE < 55% sem outra causa.",
      "Modo de intervenção por idade (2025): TAVI a partir de 70 anos com valva tricúspide e anatomia adequada (I A); cirurgia abaixo de 70 anos com risco baixo (I B). O corte era 75 anos em 2021.",
      "Decisão SAVR vs TAVI deve ser tomada em Heart Team multidisciplinar.",
      "Avaliação geriátrica e de fragilidade é mandatória em idosos.",
      "EA de baixo fluxo / baixo gradiente paradoxal: FEVE preservada, stroke volume indexado < 35 mL/m², gradiente < 40 mmHg — avaliar escore de cálcio por TC.",
      "Não há terapia farmacológica que reverta ou retarde a progressão da EA calcificada.",
    ],
    sections: [
      {
        heading: "Epidemiologia e etiologia",
        body: "Prevalência global: 2-7% em > 65 anos, aumentando com o envelhecimento populacional. Etiologias: (1) Degenerativa/calcificada — causa dominante em > 70 anos, processo ativo semelhante à aterosclerose com inflamação, deposição lipídica e calcificação; (2) Bicúspide congênita — 1-2% da população, causa mais comum em < 65 anos, frequentemente associada a aortopatia; (3) Reumática — relevante no Brasil, comissuras fundidas com calcificação sobreposta, frequentemente com doença mitral associada.",
        bullets: [
          "Fatores de risco compartilhados com aterosclerose: idade, HAS, dislipidemia, DM, tabagismo, DRC.",
          "Válvula bicúspide: associada a dilatação da aorta ascendente em 20-80% dos casos.",
          "EA reumática: quase sempre acompanhada de insuficiência aórtica e/ou doença mitral.",
        ],
      },
      {
        heading: "Fisiopatologia detalhada",
        body: "Obstrução progressiva → sobrecarga de pressão → hipertrofia concêntrica do VE → aumento do consumo de O₂ miocárdico → isquemia subendocárdica → fibrose intersticial → disfunção diastólica (precoce) e sistólica (tardia). A reserva coronariana é comprometida mesmo sem DAC. A transição de compensada para descompensada pode ser abrupta.",
        bullets: [
          "Hipertrofia concêntrica: aumento da espessura parietal com massa preservada ou aumentada.",
          "Disfunção diastólica: contribui para dispneia aos esforços mesmo com FEVE preservada.",
          "Fibrose miocárdica (detectável por RM): pode ser irreversível e impactar prognóstico pós-intervenção.",
          "Remodelamento reverso pós-TAVI/SAVR: regressão da hipertrofia em semanas a meses.",
        ],
      },
      {
        heading: "Apresentação clínica",
        body: "Pacientes podem permanecer assintomáticos por anos (fase compensada). O surgimento de sintomas marca queda abrupta da sobrevida sem intervenção: sobrevida média de 5 anos após angina, 3 anos após síncope, 2 anos após IC.",
        bullets: [
          "Dispneia aos esforços é o sintoma mais comum e precoce.",
          "Angina: mesmo sem DAC obstrutiva, por mismatch oferta/demanda na hipertrofia.",
          "Síncope ao esforço: incapacidade de aumentar débito + vasodilatação periférica.",
          "IC descompensada: estágio tardio, FEVE pode estar preservada ou reduzida.",
          "Heyde syndrome: angiodisplasia GI + EA → sangramento GI por deficiência adquirida de von Willebrand.",
        ],
      },
      {
        heading: "Avaliação por imagem",
        bullets: [
          "Ecocardiograma transtorácico é o método inicial e mais importante.",
          "Parâmetros: Vmax, gradiente médio, área valvar (equação de continuidade), FEVE, massa VE, dimensões.",
          "Avaliar strain longitudinal global (GLS): detecta disfunção subclínica mesmo com FEVE preservada.",
          "Eco sob estresse (dobutamina): EA de baixo fluxo/baixo gradiente com FEVE reduzida — diferencia EA verdadeira de pseudoestenose.",
          "Eco de estresse com exercício: em assintomáticos, para desmascarar sintomas e verificar resposta pressórica.",
          "Angio-TC: planejamento de TAVI (sizing do anel, acessos vasculares, distância coronária, calcificação), escore de cálcio valvar (confirma gravidade em casos duvidosos — cut-off: > 2000 AU homens, > 1200 AU mulheres).",
          "RM cardíaca: quantificar fibrose miocárdica (realce tardio), volumes e FEVE quando eco subótimo.",
        ],
      },
      {
        heading: "EA de baixo fluxo / baixo gradiente — fluxograma",
        body: "Desafio diagnóstico frequente. Duas entidades distintas:",
        bullets: [
          "FEVE reduzida (< 50%): eco com dobutamina para avaliar reserva contrátil e reclassificar gravidade. Com reserva: se área permanece < 1.0 cm², EA verdadeira grave → intervenção. Sem reserva: prognóstico reservado, considerar escore de cálcio por TC.",
          "FEVE preservada (paradoxal): stroke volume indexado < 35 mL/m², frequente em idosas hipertensas com ventrículo pequeno. Escore de cálcio valvar pela TC é o melhor discriminador.",
          "Armadilha: não subestimar gravidade baseando-se apenas em gradiente baixo.",
        ],
      },
      {
        heading: "Indicações de intervenção (ESC 2021 / ACC 2020)",
        bullets: [
          "Classe I: EA importante sintomática (dispneia, angina, síncope).",
          "Classe I: EA importante assintomática com FEVE < 50%.",
          "Classe I: EA importante assintomática indo para outra cirurgia cardíaca.",
          "Classe IIa: EA importante assintomática com Vmax > 5,5 m/s (ESC) ou > 5,0 m/s com progressão rápida (ACC).",
          "Classe IIa: EA importante assintomática com BNP > 3x o normal, sem outra causa.",
          "Classe IIa: EA importante assintomática com teste de esforço positivo (sintomas, queda de PA).",
          "Classe IIb: EA importante assintomática com escore de cálcio muito elevado e progressão rápida (> 100 AU/ano).",
        ],
      },
      {
        heading: "SAVR vs TAVI — algoritmo decisional",
        bullets: [
          "< 65 anos + baixo risco cirúrgico → SAVR (maior evidência de durabilidade a longo prazo).",
          "65-80 anos → decisão individualizada pelo Heart Team; ambas são opções razoáveis.",
          "> 80 anos ou STS/EuroSCORE II elevado → TAVI transfemoral preferida quando anatomicamente viável.",
          "Contraindicação cirúrgica → TAVI é a única opção (não operar é contraindicado se expectativa > 1 ano).",
          "Bicúspide: TAVI factível em anatomias selecionadas com dispositivos de nova geração; cirurgia permanece preferida.",
          "Considerar: necessidade de revascularização concomitante (favorece SAVR ou TAVI + PCI), doença de aorta, outras valvopatias.",
          "Durabilidade TAVI: dados de 5-10 anos favoráveis com novas próteses; follow-up > 10 anos ainda limitado.",
        ],
      },
      {
        heading: "Seguimento pós-intervenção",
        bullets: [
          "Eco basal 30 dias pós-procedimento (novo 'baseline').",
          "Eco anual + consulta clínica.",
          "Monitorar: gradientes transprotéticos, regurgitação paravalvar (TAVI), função de VE, complicações.",
          "TAVI: atenção a distúrbios de condução (marca-passo em 5-20%), leak paravalvar, trombose de folhetos.",
          "SAVR biológica: vigilância para degeneração estrutural, especialmente após 8-10 anos.",
          "Profilaxia de endocardite: obrigatória em todos os portadores de prótese.",
        ],
      },
    ],
    references: [
      REF.esc2025,
      REF.earlyTavr,
      REF.avatar,
      REF.avatarLongo,
      REF.recovery10,
      REF.accAha2020,
      REF.sbcValvopatias,
    ],
  },
  {
    slug: "insuficiencia-aortica",
    valve: "Aórtica",
    title: "Insuficiência Aórtica — abordagem clínica completa",
    shortTitle: "Insuficiência Aórtica",
    pathology: "Regurgitação",
    summary:
      "Refluxo diastólico para o VE, causando sobrecarga de volume e remodelamento excêntrico. Distinguir forma aguda (emergência) de crônica, e etiologia valvar de aórtica (aortopatia).",
    keyPoints: [
      "Forma aguda (endocardite, dissecção) é emergência cirúrgica.",
      "Forma crônica é tolerada por anos antes de descompensar.",
      "Classe I: sintomas independentemente da função ventricular; ou, no assintomático, FEVE em repouso ≤ 50%, DSVE > 50 mm, ou DSVE indexado > 25 mm/m² — este último pega o paciente de porte pequeno que o valor absoluto não pega.",
      "FEVE ≤ 55% NÃO é Classe I: em 2025 é IIb, e só com risco cirúrgico baixo, junto de DSVE indexado > 22 mm/m² ou volume sistólico final indexado > 45 mL/m².",
      "Avaliar sempre etiologia: degenerativa, bicúspide, aortopatia associada.",
      "Reparo valvar aórtico em centros experientes: opção em casos selecionados (bicúspide, prolapso).",
      "Aorta ascendente > 55 mm (ou > 50 mm em bicúspide / Marfan com fatores de risco): indicação de cirurgia de aorta.",
    ],
    sections: [
      {
        heading: "Etiologias e mecanismos",
        bullets: [
          "Doença dos folhetos: degenerativa, bicúspide, reumática, endocardite.",
          "Doença da raiz/aorta: dilatação da aorta ascendente (ectasia anuloaórtica), Marfan, Ehlers-Danlos, aortite, dissecção.",
          "Mecanismo funcional (raro): dilatação do anel por remodelamento de VE em miocardiopatia dilatada.",
          "Aguda: endocardite destrutiva, dissecção tipo A, trauma, deiscência de prótese.",
        ],
      },
      {
        heading: "Fisiopatologia — crônica vs aguda",
        body: "Crônica: sobrecarga de volume → dilatação excêntrica progressiva do VE → hipertrofia compensatória → fase compensada longa → eventualmente disfunção sistólica. O VE funciona como bomba de alto volume com alta complacência. Aguda: VE não dilatado, baixa complacência → pressão diastólica de VE sobe abruptamente → edema pulmonar → choque cardiogênico. Fechamento precoce da mitral é achado ecocardiográfico típico na forma aguda.",
      },
      {
        heading: "Avaliação por imagem",
        bullets: [
          "Eco com Doppler colorido: vena contracta, EROA, volume regurgitante, PHT, holodiastólica em aorta descendente.",
          "Volumes ventriculares e FEVE seriados (DSVE e DDVE indexados).",
          "Avaliação da aorta ascendente (diâmetro, morfologia) — eco + TC ou RM.",
          "RM cardíaca: padrão-ouro para volumes, fração regurgitante, fibrose miocárdica.",
          "TC/RM: medições precisas da aorta em múltiplos níveis (seios de Valsalva, junção sinotubular, ascendente).",
        ],
      },
      {
        heading: "Indicações de intervenção",
        bullets: [
          "IAo importante sintomática → cirurgia.",
          "IAo grave assintomática: cirurgia é Classe I com FEVE em repouso ≤ 50%, DSVE > 50 mm ou " +
          "DSVE indexado > 25 mm/m². Com FEVE ≤ 55% e risco cirúrgico baixo a recomendação é IIb — " +
          "considerar, não indicar.",
          "DSVE > 50 mm (ou > 25 mm/m² indexado) → cirurgia.",
          "DDVE > 65 mm com dilatação progressiva documentada → considerar cirurgia.",
          "Indicação concomitante a cirurgia de aorta ascendente.",
          "Aorta ascendente > 55 mm → cirurgia (> 50 mm se bicúspide com fatores, > 45 mm se Marfan com fatores).",
          "Reparo aórtico: possível em centros de referência para bicúspide com prolapso de cúspide, sem calcificação significativa.",
        ],
      },
      {
        heading: "Tratamento farmacológico",
        bullets: [
          "Vasodilatadores (IECAs/BRAs, nifedipina): indicados se HAS associada ou como ponte para cirurgia.",
          "Não há evidência de que vasodilatadores retardem necessidade de cirurgia em assintomáticos normotensos.",
          "Na forma aguda: vasodilatadores IV (nitroprussiato) como ponte para cirurgia de emergência. Balão intra-aórtico é CONTRAINDICADO (piora regurgitação).",
        ],
      },
    ],
    references: [
      REF.esc2025,
      REF.accAha2020,
      REF.sbcValvopatias,
    ],
  },
  {
    slug: "estenose-mitral",
    valve: "Mitral",
    title: "Estenose Mitral — abordagem clínica completa",
    shortTitle: "Estenose Mitral",
    pathology: "Estenose",
    summary:
      "Restrição à abertura mitral, predominantemente reumática no Brasil. Cursa com aumento de pressão atrial esquerda, congestão pulmonar, fibrilação atrial e risco tromboembólico elevado.",
    keyPoints: [
      "EM importante: área valvar ≤ 1,5 cm² (normal: 4-6 cm²).",
      "Fibrilação atrial com estenose mitral moderada a grave: o DOAC NÃO é recomendado (Classe III). Anticoagular com antagonista da vitamina K. Na EM reumática com área ≤ 2,0 cm² a recomendação é III B.",
      "Comissurotomia percutânea por balão: tratamento de escolha em anatomia favorável (Wilkins ≤ 8).",
      "Profilaxia secundária da febre reumática é mandatória.",
      "Gravidez: EM pode descompensar gravemente por aumento do débito e frequência cardíaca.",
    ],
    sections: [
      {
        heading: "Epidemiologia e etiologia",
        bullets: [
          "Causa reumática: > 90% dos casos no Brasil e países em desenvolvimento.",
          "Forma degenerativa (calcificação do anel mitral - MAC): idosos, DRC, radiação torácica prévia.",
          "MAC: abordagem muito mais complexa — comissurotomia por balão não é opção, cirurgia de alto risco.",
          "Outras causas raras: cor triatriatum, mixoma atrial, endocardite com vegetação obstrutiva.",
        ],
      },
      {
        heading: "Fisiopatologia",
        body: "Obstrução ao fluxo AE → VE → ↑ pressão AE → ↑ pressão venocapilar pulmonar → congestão pulmonar → hipertensão pulmonar (inicialmente reativa, depois fixa) → sobrecarga de VD → IT secundária → IC direita. A taquicardia encurta a diástole e piora dramaticamente a hemodinâmica (o gradiente transmitral é dependente do tempo de enchimento e do fluxo).",
      },
      {
        heading: "Apresentação clínica",
        bullets: [
          "Dispneia aos esforços, ortopneia, DPN.",
          "Hemoptise (ruptura de veias brônquicas dilatadas).",
          "Rouquidão (síndrome de Ortner: compressão do nervo laríngeo recorrente pelo AE dilatado).",
          "Embolia sistêmica: AVC, embolia periférica — FA + AE dilatado = alto risco.",
          "Descompensação na gravidez (2º-3º trimestre), febre, exercício, FA de início recente.",
          "Face de 'maçãs do rosto' (facies mitralis): rubor malar por baixo débito.",
        ],
      },
      {
        heading: "Avaliação",
        bullets: [
          "Eco TT: planimetria da área valvar (melhor método), gradiente médio, pressão sistólica da AP, dimensões de AE e VD.",
          "Score de Wilkins: mobilidade + espessamento + calcificação + aparato subvalvar (cada 0-4, total 0-16). ≤ 8: favorável para balão.",
          "Eco TE: obrigatório antes de valvotomia por balão — descartar trombo em apêndice atrial esquerdo.",
          "Eco de estresse com exercício: quando sintomas são desproporcionais ao grau de EM — avaliar aumento do gradiente e da PAP.",
          "Cateterismo: quando há discordância entre eco e clínica.",
        ],
      },
      {
        heading: "Conduta terapêutica",
        bullets: [
          "EM importante sintomática + anatomia favorável + sem trombo em AE → valvotomia mitral percutânea por balão (Inoue).",
          "EM importante sintomática + anatomia desfavorável → cirurgia (comissurotomia aberta ou troca valvar).",
          "Anticoagulação: obrigatória em FA, embolia prévia, trombo em AE, AE muito dilatado (> 50 mm — discutir).",
          "Warfarina é o anticoagulante de escolha na EM reumática com FA (DOACs: evidência limitada neste contexto).",
          "Controle de FC: betabloqueador ou diltiazem na FA com RVR — fundamental para alívio sintomático.",
          "Profilaxia secundária de febre reumática: penicilina benzatina IM a cada 3-4 semanas.",
          "Gravidez: valvotomia por balão pode ser realizada no 2º trimestre em casos refratários.",
        ],
      },
    ],
    references: [
      REF.esc2025,
      REF.escFa2024,
      REF.febreReumaticaBr,
      REF.sbcValvopatias,
    ],
  },
  {
    slug: "insuficiencia-mitral",
    valve: "Mitral",
    title: "Insuficiência Mitral — abordagem clínica completa",
    shortTitle: "Insuficiência Mitral",
    pathology: "Regurgitação",
    summary:
      "Refluxo sistólico do VE para o AE. A distinção entre IM primária (lesão estrutural) e secundária (funcional) é a decisão mais importante e define toda a estratégia terapêutica.",
    keyPoints: [
      "IM primária importante sintomática → cirurgia (preferencialmente reparo).",
      "IM primária assintomática com disfunção do VE — FEVE ≤ 60%, DSVE ≥ 40 mm, ou DSVE indexado ≥ 20 mm/m² — tem indicação cirúrgica (I B). A plástica é a técnica recomendada quando o resultado durável é provável.",
      "IM secundária: tratar IC otimamente; considerar TEER (MitraClip/PASCAL) em selecionados.",
      "Reparo > troca quando viável — durabilidade superior e melhor preservação da função de VE.",
      "Flail leaflet: risco de morte súbita; considerar cirurgia precoce em centros de excelência.",
      "COAPT trial: TEER + TMO > TMO isolada em IM secundária com critérios específicos.",
    ],
    sections: [
      {
        heading: "Classificação de Carpentier",
        body: "Sistema fundamental que orienta a estratégia de reparo:",
        bullets: [
          "Tipo I: folhetos com movimento normal, IM por dilatação anelar ou perfuração (endocardite).",
          "Tipo II: movimento excessivo dos folhetos — prolapso, flail (cordoalha rota).",
          "Tipo III: movimento restrito — IIIa: reumática (diástole restrita); IIIb: isquêmica/funcional (sístole restrita por tethering).",
        ],
      },
      {
        heading: "IM primária — fisiopatologia e etiologias",
        bullets: [
          "Doença degenerativa (mixomatosa): prolapso, redundância de folhetos, elongação/ruptura de cordas. Causa mais comum em países desenvolvidos.",
          "Doença de Barlow: degeneração mixomatosa difusa com excesso de tecido — reparo complexo mas factível.",
          "Deficiência fibroelástica: folhetos finos com ruptura de corda isolada — reparo mais simples.",
          "Reumática: espessamento e retração de folhetos e cordas — reparo possível em mãos experientes.",
          "Endocardite: destruição de folheto, perfuração, abscesso.",
          "Outras: radiação, drogas (fenfluramina, ergotamina), cardiopatias congênitas.",
        ],
      },
      {
        heading: "IM secundária (funcional)",
        bullets: [
          "Folhetos e cordas estruturalmente normais.",
          "Mecanismo: remodelamento e dilatação do VE → deslocamento dos músculos papilares → tethering dos folhetos → perda de coaptação.",
          "Etiologia isquêmica (pós-IAM) ou não isquêmica (miocardiopatia dilatada).",
          "IM atrial funcional: FA crônica → dilatação do AE e anel → IM por incompetência anelar com VE normal.",
          "Tratamento: otimizar terapia de IC (iECA/BRA/ARNI, BB, MRA, iSGLT2), TRC quando indicada.",
        ],
      },
      {
        heading: "Quantificação por imagem",
        bullets: [
          "ETT com Doppler quantitativo: EROA (≥ 0,40 cm² = importante na primária; ≥ 0,20 cm² na secundária), volume regurgitante (≥ 60 mL primária; ≥ 30 mL secundária), fração regurgitante.",
          "Vena contracta ≥ 7 mm → IM importante.",
          "ETE: mandatório para planejamento cirúrgico (anatomia do prolapso, feasibility de reparo).",
          "ETE 3D: reconstrução en-face da válvula — padrão-ouro para guiar reparo e TEER.",
          "RM: quantificação mais precisa da fração regurgitante (especialmente quando eco é discordante).",
          "Eco de exercício: desmascarar IM dinâmica e HP latente.",
        ],
      },
      {
        heading: "Indicações cirúrgicas — IM primária",
        bullets: [
          "IM importante sintomática → cirurgia (Classe I).",
          "IM importante assintomática + FEVE ≤ 60% ou DSVE ≥ 40 mm → cirurgia (Classe I).",
          "IM importante assintomática + FA de início recente ou PSAP > 50 mmHg → cirurgia (Classe IIa).",
          "IM importante assintomática + alta probabilidade de reparo durável (> 95%) + baixo risco → considerar cirurgia precoce (Classe IIa ESC).",
          "Flail leaflet com DSVE ≥ 40 mm: risco de morte súbita — reforça indicação precoce.",
        ],
      },
      {
        heading: "TEER — indicações e evidência",
        bullets: [
          "IM primária: opção para pacientes com risco cirúrgico proibitivo e anatomia favorável (critérios ecocardiográficos específicos).",
          "IM secundária (COAPT): TEER + TMO superior a TMO isolada em pacientes com FEVE 20-50%, DSVE < 70 mm, EROA ≥ 0,30 cm², e IC sintomática apesar de terapia otimizada.",
          "MITRA-FR (neutro): população diferente — IM menos grave proporcionalmente ao grau de dilatação de VE.",
          "Conceito de proporcionalidade: IM 'desproporcional' ao grau de disfunção de VE beneficia-se mais de TEER.",
          "Dispositivos: MitraClip (Abbott), PASCAL (Edwards) — resultados semelhantes.",
        ],
      },
    ],
    references: [
      REF.esc2025,
      REF.esc2025Errata,
      REF.accAha2020,
      REF.sbcValvopatias,
    ],
  },
  {
    slug: "insuficiencia-tricuspide",
    valve: "Tricúspide",
    title: "Insuficiência Tricúspide — abordagem clínica atualizada",
    shortTitle: "Insuficiência Tricúspide",
    pathology: "Regurgitação",
    summary:
      "A 'válvula esquecida' ganha destaque. IT importante está associada a aumento de mortalidade independente da FEVE e da PAP. Novas terapias transcateter estão transformando o cenário.",
    keyPoints: [
      "Quase sempre secundária (funcional) — investigar doença esquerda, HP e FA.",
      "Dilatação do anel ≥ 40 mm ou IT ≥ moderada: indicação de abordagem na cirurgia esquerda concomitante.",
      "IT isolada: considerar cirurgia antes de deterioração irreversível do VD.",
      "Tratamento percutâneo (TEER tricúspide, TTVR): opção em centros experientes.",
      "TRILUMINATE Pivotal: TriClip superior ao tratamento clínico em IT grave sintomática.",
      "Novo grading: IT massive (EROA 0,60-0,79 cm²) e torrential (≥ 0,80 cm²) reconhecidos.",
    ],
    sections: [
      {
        heading: "Epidemiologia e impacto",
        body: "IT moderada a grave afeta > 1,6 milhão de pessoas nos EUA, com prevalência crescente pelo envelhecimento e FA. Mortalidade associada: HR 1,5-2,5 comparada com IT leve. Historicamente subtratada: < 0,5% dos pacientes com IT grave recebem cirurgia isolada.",
      },
      {
        heading: "Etiologia e mecanismos",
        bullets: [
          "Secundária (> 90%): dilatação do anel por dilatação de VD (doença esquerda, HP) ou de AD (FA crônica — 'IT atrial funcional').",
          "Primária: endocardite (drogas IV), reumática, carcinoide, Ebstein, radiação, trauma, eletrodos de MP/CDI.",
          "IT por eletrodo: aderência do eletrodo aos folhetos impede coaptação — problema crescente com envelhecimento da população com dispositivos.",
        ],
      },
      {
        heading: "Avaliação",
        bullets: [
          "ETT: gravidade da IT (vena contracta, EROA, PISA), dimensões do anel, VD (diâmetro basal > 41 mm, TAPSE < 17 mm, S' < 9,5 cm/s), PAP estimada.",
          "ETE 3D: anatomia detalhada dos folhetos e do anel para planejamento transcateter.",
          "TC cardíaca: sizing para dispositivos transcateter, relação com coronária direita.",
          "RM: volumes e função do VD (padrão-ouro), fração regurgitante.",
          "Novo grading (Hahn et al.): leve / moderada / importante / massive / torrential.",
          "Biomarcadores: BNP/NT-proBNP elevados, função hepática alterada (GGT, bilirrubinas).",
        ],
      },
      {
        heading: "Indicações de intervenção",
        bullets: [
          "Na cirurgia esquerda: IT importante ou anel ≥ 40 mm ou IT moderada + HP → anuloplastia tricúspide (Classe I-IIa).",
          "IT primária importante sintomática → cirurgia.",
          "IT secundária isolada importante sintomática apesar de diuréticos → cirurgia em centros experientes antes de disfunção avançada de VD.",
          "IT secundária com alto risco cirúrgico → TEER tricúspide (TriClip) em centros com experiência.",
          "TTVR (substituição transcateter): EVOQUE, GATE — dados iniciais promissores.",
        ],
      },
      {
        heading: "Evidência recente — TRILUMINATE Pivotal",
        bullets: [
          "Trial randomizado: TriClip vs tratamento médico em IT grave sintomática.",
          "Endpoint primário (composto): superioridade de TriClip em redução de IT, qualidade de vida e capacidade funcional em 1 ano.",
          "IT reduzida para ≤ moderada em ~87% dos pacientes com TriClip.",
          "Limitação: sem redução demonstrada em mortalidade ou hospitalizações (underpowered?).",
          "Impacto: FDA approval 2023 — primeiro dispositivo transcateter aprovado para IT.",
        ],
      },
    ],
    references: [
      REF.esc2025,
      REF.accAha2020,
      REF.sbcValvopatias,
    ],
  },
  {
    slug: "doenca-multivalvar",
    valve: "Multivalvar",
    title: "Doença Multivalvar — princípios e desafios",
    shortTitle: "Doença Multivalvar",
    pathology: "Mista",
    summary:
      "Acometimento simultâneo de mais de uma valva. Interações hemodinâmicas complexas — uma lesão pode mascarar ou amplificar a gravidade de outra. Heart Team mandatório.",
    keyPoints: [
      "Avaliar cada valva isoladamente e em conjunto — interações hemodinâmicas são a regra.",
      "Atenção a lesões 'mascaradas' por baixo débito (EA + IM: a IM reduz o gradiente transaórtico).",
      "Heart Team é mandatório — complexidade aumenta com cada valva acometida.",
      "Considerar etiologia reumática no Brasil — frequente acometimento de mitral + aórtica ± tricúspide.",
      "Abordagem cirúrgica combinada vs estagiada: decisão individualizada baseada em risco operatório.",
      "Abordagens híbridas (cirurgia + transcateter): opção emergente para reduzir invasividade.",
    ],
    sections: [
      {
        heading: "Interações hemodinâmicas relevantes",
        bullets: [
          "EA + IM: a IM descomprime o VE e pode subestimar o gradiente transaórtico; corrigir a EA pode desmascarar ou melhorar a IM.",
          "EM + IT: a IT é quase sempre secundária à HP gerada pela EM; corrigir a EM pode reduzir a IT ao longo do tempo (mas nem sempre).",
          "EA + IAo (doença mista aórtica): avaliar predominância — o tratamento de ambas na mesma operação é comum.",
          "IM + EA: avaliar a IM sob dobutamina pode ser útil (IM funcional pode melhorar com SAVR).",
          "Doença mitro-aórtico-tricúspide: cirurgia tripla com risco aumentado — avaliar benefício de cada intervenção.",
        ],
      },
      {
        heading: "Avaliação e decisão",
        bullets: [
          "Eco TT com Doppler completo de todas as valvas.",
          "ETE e/ou RM quando eco TT insuficiente.",
          "TC: avaliar calcificação, acessos, anatomia para planejamento.",
          "Cateterismo: coronárias pré-operatórias e hemodinâmica quando indicado.",
          "Decisão: cirurgia única (preferida quando possível), estagiada ou híbrida (cirurgia + percutâneo).",
          "Risco operatório: considerar scores mas reconhecer suas limitações em doença multivalvar (não foram validados nesta população).",
        ],
      },
    ],
    references: [
      REF.esc2025,
      REF.accAha2020,
      REF.sbcValvopatias,
    ],
  },
  {
    slug: "endocardite-infecciosa",
    valve: "Multivalvar",
    title: "Endocardite Infecciosa — diagnóstico e manejo",
    shortTitle: "Endocardite Infecciosa",
    pathology: "Infecção",
    summary:
      "Doença grave com mortalidade de 15-30% mesmo com tratamento. Diagnóstico requer integração de critérios clínicos, microbiológicos e de imagem. Endocarditis Team melhora desfechos.",
    keyPoints: [
      "Hemoculturas seriadas (3 sets) antes do antibiótico, sempre que possível.",
      "Critérios de Duke modificados: 2 maiores, ou 1 maior + 3 menores, ou 5 menores = EI definida.",
      "Eco TT inicial; eco TE se suspeita persistir, em prótese, ou complicação.",
      "PET-CT com FDG: grande valor em EI de prótese e dispositivo quando eco inconclusivo.",
      "Indicações cirúrgicas: IC por disfunção valvar, infecção não controlada, prevenção de embolização.",
      "Endocarditis Team (cardiologista, infectologista, cirurgião, imagem) melhora desfechos significativamente.",
      "Profilaxia: higiene bucal é a medida mais importante; antibiótico profilático em alto risco.",
    ],
    sections: [
      {
        heading: "Epidemiologia e microbiologia",
        bullets: [
          "Incidência: 3-10/100.000 habitantes/ano, aumentando com idade e dispositivos.",
          "Em valva nativa: Streptococcus (30-40%), Staphylococcus aureus (25-30%), Enterococcus (10%).",
          "Em prótese precoce (< 1 ano): S. aureus, estafilococos coagulase-negativa, fungos.",
          "Em prótese tardia (> 1 ano): perfil semelhante a valva nativa.",
          "HACEK: 3-5%, bom prognóstico, raramente requerem cirurgia.",
          "Cultura-negativa (10-30%): uso prévio de ATB, fastidiosos (Coxiella, Bartonella, Tropheryma).",
        ],
      },
      {
        heading: "Diagnóstico — Critérios de Duke 2023",
        bullets: [
          "Critérios maiores: hemoculturas típicas (2 sets positivos), imagem positiva (eco: vegetação/abscesso/deiscência; PET-CT com captação; TC com lesão paravalvar).",
          "Critérios menores: predisposição, febre > 38°C, fenômenos vasculares (embolia, Janeway, aneurisma micótico), fenômenos imunológicos (Osler, Roth, GN, FR+), hemocultura não preenchendo critério maior.",
          "Integração com PET-CT e TC cardíaca nos novos critérios — aumentam sensibilidade.",
        ],
      },
      {
        heading: "Indicações cirúrgicas (resumo)",
        bullets: [
          "IC aguda por disfunção valvar grave (regurgitação ou obstrução) → cirurgia de emergência/urgência.",
          "Infecção não controlada: abscesso, fístula, pseudoaneurisma, febre > 7-10 dias sob ATB adequada, fungo ou organismo multiresistente.",
          "Vegetações > 10 mm com episódio embólico ou > 30 mm → cirurgia urgente para prevenir embolização.",
          "EI de prótese com complicação (deiscência, abscesso, infecção persistente) → cirurgia.",
          "Timing: mais precoce possível quando há indicação — dados suportam cirurgia nos primeiros 7 dias em casos com indicação clara.",
        ],
      },
      {
        heading: "Profilaxia",
        bullets: [
          "Alto risco: prótese valvar, EI prévia, CC cianótica, CC reparada com material protético < 6 meses.",
          "Procedimentos: dentários que envolvam gengiva ou perfuração mucosa.",
          "Amoxicilina 2g VO 30-60 min antes (ou ampicilina IM/IV; clindamicina 600mg se alérgico).",
          "Higiene bucal diária é a medida preventiva mais eficaz — revisões odontológicas regulares.",
        ],
      },
    ],
    references: [
      REF.escEndocardite2023,
      REF.esc2025,
      REF.sbcValvopatias,
    ],
  },
  {
    slug: "anticoagulacao-protese",
    valve: "Multivalvar",
    title: "Anticoagulação em próteses e valvopatias",
    shortTitle: "Anticoagulação",
    pathology: "Manejo",
    summary:
      "A anticoagulação é peça fundamental no manejo de próteses mecânicas, FA valvar e situações especiais. Erros na anticoagulação são causa importante de morbimortalidade.",
    keyPoints: [
      "Prótese mecânica: warfarina é o ÚNICO anticoagulante aceito. DOACs são CONTRAINDICADOS (RE-ALIGN).",
      "INR alvo: 2,5 (aórtica) a 3,0 (mitral) para próteses mecânicas bileaflet atuais.",
      "FA em EM reumática com área ≤ 2,0 cm²: DOAC é Classe III — contraindicado, não apenas preterido. Antagonista da vitamina K.",
      "FA com estenose aórtica, insuficiência aórtica ou insuficiência mitral: o DOAC é preferencial em relação ao antagonista da vitamina K (I A). Após bioprótese cirúrgica, manter o DOAC pode ser considerado (IIb B).",
      "Ponte com heparina: necessária em prótese mecânica antes de procedimentos invasivos.",
      "Automonitoramento de INR com dispositivo portátil: associado a melhor TRT e menores eventos.",
    ],
    sections: [
      {
        heading: "Regimes de anticoagulação por cenário",
        bullets: [
          "Prótese mecânica aórtica (bileaflet, sem FR): INR 2,0-3,0.",
          "Prótese mecânica aórtica + FR (FA, FEVE < 35%, TEP prévio): INR 2,5-3,5.",
          "Prótese mecânica mitral: INR 2,5-3,5.",
          "Bioprótese pós-cirúrgica: warfarina ou DOAC por 3-6 meses, depois AAS.",
          "Pós-TAVI: dupla antiagregação (AAS + clopidogrel) por 3-6 meses, depois AAS isolada (se sem FA).",
          "TAVI + FA: anticoagulante oral + AAS por período limitado → anticoagulante isolado.",
        ],
      },
      {
        heading: "Manejo perioperatório (bridge therapy)",
        bullets: [
          "Prótese mecânica: suspender warfarina 3-5 dias antes → heparina IV ou enoxaparina SC → reiniciar warfarina pós-procedimento.",
          "Alto risco embólico (mitral mecânica, evento embólico recente): bridge mandatória.",
          "Risco embólico baixo-moderado (aórtica bileaflet sem FR): individualizar — bridge pode não ser necessária em procedimentos de baixo risco de sangramento.",
          "Procedimentos dentários menores: manter warfarina com INR no alvo, hemostasia local.",
        ],
      },
    ],
    references: [
      REF.esc2025,
      REF.escFa2024,
      REF.accAha2020,
    ],
  },
];

export const libraryByValve = clinicalLibrary.reduce<Record<string, ClinicalGuideline[]>>(
  (acc, g) => {
    (acc[g.valve] ||= []).push(g);
    return acc;
  },
  {},
);
