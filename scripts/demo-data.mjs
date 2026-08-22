/**
 * Base fictícia de demonstração — só dados, sem nenhum efeito colateral.
 *
 * Separada do script que insere para poder ser lida, revisada e testada: a
 * guarda `src/test/demoDados.test.ts` confere cada valor contra os
 * vocabulários reais do app (`src/lib/clinicalLabels.ts`), então um enum
 * errado quebra no CI e não na hora de inserir — foi assim que um `'grave'`
 * inválido chegou ao digest semanal antes.
 *
 * Nada aqui descreve pessoa real. Os nomes são inventados, os CRMs estão numa
 * faixa acima da emitida em qualquer UF, e os e-mails usam o domínio `.invalid`
 * reservado pela RFC 2606, que não resolve em lugar nenhum.
 *
 * As datas são relativas a `HOJE` para a base não envelhecer: seguimento,
 * tendência e relatório mensal continuam com distribuição em qualquer dia que
 * o seed rodar.
 */

export const HOJE = new Date();

/** `d` dias atrás, em AAAA-MM-DD. */
export function dia(d) {
  const t = new Date(HOJE);
  t.setUTCDate(t.getUTCDate() - d);
  return t.toISOString().slice(0, 10);
}

/** `d` dias atrás (negativo = futuro), em ISO completo. */
export function instante(d, hora = 14) {
  const t = new Date(HOJE);
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(hora, 0, 0, 0);
  return t.toISOString();
}

/**
 * Os três colegas do Heart Team.
 *
 * As contas são criadas banidas e nunca conseguem entrar. Elas existem para
 * a discussão ter autoria distinta e para a colaboração poder ser demonstrada.
 */
export const MEDICOS = [
  {
    chave: "helena",
    nome: "Helena Marques",
    email: "helena.marques@demonstracao.invalid",
    crm: "999101", uf: "SP",
    especialidade: "Cardiologia clínica",
    papel: "cardiologia clínica",
  },
  {
    chave: "rafael",
    nome: "Rafael Tôrres",
    email: "rafael.torres@demonstracao.invalid",
    crm: "999202", uf: "SP",
    especialidade: "Cirurgia cardiovascular",
    papel: "cirurgia cardíaca",
  },
  {
    chave: "paulo",
    nome: "Paulo Anselmo",
    email: "paulo.anselmo@demonstracao.invalid",
    crm: "999303", uf: "SP",
    especialidade: "Hemodinâmica e cardiologia intervencionista",
    papel: "hemodinâmica",
  },
];

/**
 * O nome do autor abre o corpo de cada comentário.
 *
 * Não é estilo: hoje a policy de `profiles` só permite ler a própria linha, e
 * o cabeçalho do comentário de um colega renderiza "Dr(a). Médico". Enquanto
 * isso não for corrigido, o nome dentro do texto é o que sustenta a leitura da
 * discussão. Some no dia em que o diretório de médicos existir.
 */
function fala(chave, texto) {
  const m = MEDICOS.find((x) => x.chave === chave);
  return { autor: chave, body: `Dr(a). ${m.nome} (${m.papel}) — ${texto}` };
}
function decisao(chave, texto) {
  return { ...fala(chave, texto), heart_team: true };
}
/** Comentário do próprio dono do caso: o nome dele resolve normalmente. */
function dono(texto) {
  return { autor: null, body: texto };
}

export const CASOS = [
  // ---------------------------------------------------------------- 1
  {
    patient_name: "Marlene Figueiredo Braga",
    patient_age: 78, patient_sex: "F",
    valve_type: "aortica", valve_disease: "estenose", severity: "importante",
    nyha: "III",
    symptoms: ["Dispneia aos esforços", "Pré-síncope", "Fadiga"],
    comorbidities: ["Hipertensão arterial", "Diabetes mellitus", "Doença renal crônica"],
    ejection_fraction: 58, mean_gradient: 52, peak_gradient: 84, valve_area: 0.7,
    regurgitation_grade: "aórtica discreta (1+/4+)",
    status: "pre_intervencao",
    proposed_management:
      "TAVI por via transfemoral. Idade e comorbidades favorecem via transcateter; anatomia adequada na angioTC.",
    clinical_notes:
      "Encaminhada pela UBS após episódio de pré-síncope no banho. STS estimado em 6,8%. Aguardando data no serviço de hemodinâmica.",
    dias_atras: 84,
    exames: [
      { tipo: "eco", dias: 84, titulo: "Eco transtorácico inicial",
        ejection_fraction: 60, mean_gradient: 46, peak_gradient: 74, valve_area: 0.8, psap: 38,
        notes: "Valva aórtica tricúspide com calcificação importante e abertura reduzida." },
      { tipo: "eco", dias: 21, titulo: "Eco de reavaliação",
        ejection_fraction: 58, mean_gradient: 52, peak_gradient: 84, valve_area: 0.7, psap: 42,
        notes: "Progressão do gradiente médio em três meses." },
      { tipo: "bnp", dias: 20, titulo: "NT-proBNP", nt_probnp: 1840 },
    ],
    eventos: [
      { tipo: "consulta", dias: 84, titulo: "Primeira consulta",
        descricao: "Dispneia aos médios esforços há seis meses, com piora progressiva." },
      { tipo: "exame", dias: 21, titulo: "Eco de reavaliação",
        descricao: "Gradiente médio subiu de 46 para 52 mmHg." },
      { tipo: "mudanca_nyha", dias: 20, titulo: "Progressão para NYHA III",
        descricao: "Passou a referir dispneia aos pequenos esforços." },
      { tipo: "observacao", dias: 14, titulo: "Discussão em Heart Team",
        descricao: "Indicação de TAVI transfemoral acordada em reunião." },
    ],
    comentarios: [
      dono("Estenose aórtica importante sintomática, com progressão documentada entre os dois ecos. Trago para discussão a via de abordagem."),
      fala("rafael", "Aos 78 anos, com clearance reduzido e diabetes, o risco cirúrgico não é desprezível. STS 6,8% coloca a paciente na faixa em que a diretriz já favorece transcateter."),
      fala("paulo", "AngioTC mostra anel de 23 mm, ilíacas pérvias e sem calcificação circunferencial. Via transfemoral é viável sem necessidade de acesso alternativo."),
      decisao("helena", "DECISÃO DO HEART TEAM: TAVI por via transfemoral. Manter controle glicêmico e função renal antes do procedimento; hidratação protocolar pelo contraste."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: 45, status: "realizado", local: "Ambulatório de valvopatias" },
      { tipo: "procedimento", dias: -12, status: "agendado", local: "Serviço de hemodinâmica", duracao: 180,
        notas: "TAVI transfemoral. Jejum de 8 h; suspender metformina 48 h antes." },
    ],
    colaboradores: ["rafael", "paulo", "helena"],
    laudo: true,
  },

  // ---------------------------------------------------------------- 2
  {
    patient_name: "Sebastião Ramos de Alencar",
    patient_age: 62, patient_sex: "M",
    valve_type: "aortica", valve_disease: "estenose", severity: "importante",
    nyha: "II",
    symptoms: ["Dispneia aos esforços", "Dor torácica"],
    comorbidities: ["Dislipidemia", "Tabagismo"],
    ejection_fraction: 45, mean_gradient: 44, peak_gradient: 70, valve_area: 0.8,
    regurgitation_grade: "",
    status: "pre_intervencao",
    proposed_management:
      "Troca valvar aórtica cirúrgica (SAVR) com bioprótese. Abaixo de 65 anos, com risco cirúrgico baixo.",
    clinical_notes:
      "Valva aórtica bicúspide. Aorta ascendente de 44 mm, sem indicação isolada de abordagem. Coronariografia sem lesões obstrutivas.",
    dias_atras: 61,
    exames: [
      { tipo: "eco", dias: 61, titulo: "Eco transtorácico",
        ejection_fraction: 48, mean_gradient: 41, peak_gradient: 66, valve_area: 0.9,
        lv_diameter: 54, septal_thickness: 13, notes: "Valva aórtica bicúspide (Sievers tipo 1)." },
      { tipo: "hemodinamica", dias: 34, titulo: "Coronariografia",
        notes: "Coronárias sem lesões obstrutivas. Sem indicação de revascularização associada." },
      { tipo: "eco", dias: 12, titulo: "Eco pré-operatório",
        ejection_fraction: 45, mean_gradient: 44, peak_gradient: 70, valve_area: 0.8,
        notes: "Discreta queda da fração de ejeção em relação ao exame anterior." },
    ],
    eventos: [
      { tipo: "consulta", dias: 61, titulo: "Avaliação inicial" },
      { tipo: "exame", dias: 34, titulo: "Coronariografia",
        descricao: "Sem lesões obstrutivas; procedimento isolado sobre a valva." },
      { tipo: "observacao", dias: 10, titulo: "Queda da FE",
        descricao: "FE de 48% para 45% — reforça a indicação cirúrgica." },
    ],
    comentarios: [
      dono("Bicúspide, 62 anos, com queda da FE entre os dois ecos. Minha leitura é cirúrgica, mas quero a opinião de vocês sobre a aorta de 44 mm."),
      fala("rafael", "Concordo com SAVR. Abaixo de 65 anos a durabilidade pesa, e a bicúspide costuma ter anatomia menos favorável ao transcateter. Aorta de 44 mm eu inspeciono no intraoperatório e decido lá."),
      decisao("rafael", "DECISÃO DO HEART TEAM: troca valvar aórtica cirúrgica com bioprótese. Aorta ascendente reavaliada no intraoperatório; substituição só se houver alteração de parede."),
    ],
    compromissos: [
      { tipo: "cirurgia", dias: -25, status: "agendado", local: "Centro cirúrgico — Hospital referência", duracao: 300 },
    ],
    colaboradores: ["rafael"],
    laudo: true,
  },

  // ---------------------------------------------------------------- 3
  {
    patient_name: "Otávio Bernardes Pinto",
    patient_age: 55, patient_sex: "M",
    valve_type: "mitral", valve_disease: "prolapso", severity: "importante",
    nyha: "II",
    symptoms: ["Dispneia aos esforços", "Palpitações"],
    comorbidities: ["Hipertensão arterial"],
    ejection_fraction: 62, mean_gradient: 4, peak_gradient: 11, valve_area: null,
    regurgitation_grade: "mitral importante (4+/4+)",
    status: "avaliacao_inicial",
    proposed_management:
      "Reparo valvar mitral em centro com experiência. Prolapso de folheto posterior, anatomia favorável ao reparo.",
    clinical_notes:
      "Prolapso do segmento P2 com jato excêntrico. Volume regurgitante estimado em 62 mL/batimento.",
    dias_atras: 27,
    exames: [
      { tipo: "eco", dias: 27, titulo: "Eco transtorácico",
        ejection_fraction: 62, regurgitation_grade: "mitral importante (4+/4+)",
        lv_diameter: 58, psap: 34, notes: "Prolapso de P2 com ruptura de cordoalha." },
      { tipo: "eco", dias: 9, titulo: "Eco transesofágico",
        ejection_fraction: 62, regurgitation_grade: "mitral importante (4+/4+)",
        notes: "Confirma prolapso isolado de P2. Anel mitral de 34 mm. Anatomia favorável ao reparo." },
    ],
    eventos: [
      { tipo: "consulta", dias: 27, titulo: "Encaminhado por sopro" },
      { tipo: "exame", dias: 9, titulo: "Eco transesofágico",
        descricao: "Prolapso isolado de P2, anatomia favorável ao reparo." },
    ],
    comentarios: [
      dono("Prolapso isolado de P2 com ruptura de cordoalha. Assintomático limítrofe, FE preservada, VE em 58 mm."),
      fala("rafael", "Anatomia clássica de reparo, com alta probabilidade de sucesso e durabilidade. Em centro experiente, reparo precoce é preferível a esperar a FE cair."),
      fala("helena", "De acordo. Vale registrar que ele já refere dispneia aos médios esforços, então não é um assintomático puro."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: -8, status: "agendado", local: "Ambulatório de valvopatias" },
    ],
    colaboradores: ["rafael", "helena"],
    laudo: true,
  },

  // ---------------------------------------------------------------- 4
  {
    patient_name: "Rosângela Duarte Nogueira",
    patient_age: 41, patient_sex: "F",
    valve_type: "mitral", valve_disease: "estenose", severity: "importante",
    nyha: "III",
    symptoms: ["Dispneia aos esforços", "Ortopneia", "Palpitações"],
    comorbidities: ["Fibrilação atrial"],
    ejection_fraction: 64, mean_gradient: 12, peak_gradient: 22, valve_area: 1.0,
    regurgitation_grade: "mitral discreta (1+/4+)",
    status: "pre_intervencao",
    proposed_management:
      "Valvoplastia mitral percutânea por balão. Escore de Wilkins 6, sem trombo em átrio esquerdo.",
    clinical_notes:
      "Doença reumática. Em anticoagulação com varfarina por fibrilação atrial associada. Profilaxia secundária com penicilina benzatina mantida.",
    dias_atras: 133,
    exames: [
      { tipo: "eco", dias: 133, titulo: "Eco transtorácico",
        ejection_fraction: 65, mean_gradient: 10, valve_area: 1.1, psap: 48,
        notes: "Estenose mitral reumática. Escore de Wilkins 6." },
      { tipo: "eco", dias: 30, titulo: "Eco transesofágico",
        ejection_fraction: 64, mean_gradient: 12, valve_area: 1.0,
        notes: "Sem trombo em apêndice atrial esquerdo. Regurgitação mitral discreta." },
      { tipo: "ergometria", dias: 28, titulo: "Teste de caminhada de 6 minutos", six_min_walk: 340 },
    ],
    eventos: [
      { tipo: "consulta", dias: 133, titulo: "Primeira consulta" },
      { tipo: "medicacao", dias: 130, titulo: "Início de varfarina",
        descricao: "Anticoagulação por fibrilação atrial associada à estenose mitral reumática." },
      { tipo: "exame", dias: 30, titulo: "Eco transesofágico",
        descricao: "Sem trombo — libera a valvoplastia por balão." },
      { tipo: "mudanca_nyha", dias: 25, titulo: "Progressão para NYHA III" },
    ],
    comentarios: [
      dono("Estenose mitral reumática, 41 anos, Wilkins 6, sem trombo no transesofágico. NYHA III apesar do tratamento clínico."),
      fala("paulo", "Perfil clássico para valvoplastia por balão: escore favorável, regurgitação discreta e ausência de trombo. Espero área final acima de 1,5 cm²."),
      decisao("paulo", "DECISÃO DO HEART TEAM: valvoplastia mitral percutânea por balão. Manter INR entre 2 e 3 até 72 h antes; profilaxia secundária com penicilina benzatina mantida indefinidamente."),
    ],
    compromissos: [
      { tipo: "exame", dias: 30, status: "realizado", local: "Ecocardiografia" },
      { tipo: "procedimento", dias: -19, status: "agendado", local: "Serviço de hemodinâmica", duracao: 120 },
    ],
    colaboradores: ["paulo", "helena"],
  },

  // ---------------------------------------------------------------- 5
  {
    patient_name: "Cláudio Meirelles Vasques",
    patient_age: 49, patient_sex: "M",
    valve_type: "aortica", valve_disease: "insuficiencia", severity: "importante",
    nyha: "I",
    symptoms: ["Assintomático"],
    comorbidities: ["Hipertensão arterial"],
    ejection_fraction: 52, mean_gradient: null, peak_gradient: null, valve_area: null,
    regurgitation_grade: "aórtica importante (4+/4+)",
    status: "em_seguimento",
    proposed_management:
      "Cirurgia indicada por FE ≤ 55% e diâmetro sistólico final acima de 50 mm, mesmo assintomático. Aguardando decisão do paciente.",
    clinical_notes:
      "Assintomático com critérios de intervenção por remodelamento ventricular. Discutido risco de esperar a piora sintomática.",
    dias_atras: 190,
    exames: [
      { tipo: "eco", dias: 190, titulo: "Eco transtorácico",
        ejection_fraction: 58, lv_diameter: 46,
        regurgitation_grade: "aórtica importante (4+/4+)" },
      { tipo: "eco", dias: 95, titulo: "Eco de seguimento",
        ejection_fraction: 55, lv_diameter: 49,
        regurgitation_grade: "aórtica importante (4+/4+)" },
      { tipo: "eco", dias: 16, titulo: "Eco de seguimento",
        ejection_fraction: 52, lv_diameter: 51,
        regurgitation_grade: "aórtica importante (4+/4+)",
        notes: "Queda progressiva da FE e aumento do diâmetro sistólico final." },
    ],
    eventos: [
      { tipo: "consulta", dias: 190, titulo: "Avaliação inicial" },
      { tipo: "exame", dias: 95, titulo: "Eco de seguimento em 3 meses" },
      { tipo: "observacao", dias: 15, titulo: "Critérios de intervenção atingidos",
        descricao: "FE 52% e LVESD 51 mm — indicação cirúrgica mesmo sem sintomas." },
    ],
    comentarios: [
      dono("Assintomático, mas com três ecos mostrando queda de FE (58 → 55 → 52) e dilatação progressiva. A diretriz indica cirurgia."),
      fala("helena", "A curva é clara. Vale insistir com o paciente: esperar o sintoma aparecer costuma significar operar com ventrículo pior."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: -5, status: "agendado", local: "Ambulatório de valvopatias",
        notas: "Rediscutir indicação cirúrgica." },
    ],
    colaboradores: ["helena"],
  },

  // ---------------------------------------------------------------- 6
  {
    patient_name: "Terezinha Albuquerque Sena",
    patient_age: 71, patient_sex: "F",
    valve_type: "tricuspide", valve_disease: "insuficiencia", severity: "importante",
    nyha: "III",
    symptoms: ["Edema de membros inferiores", "Fadiga", "Dispneia aos esforços"],
    comorbidities: ["Fibrilação atrial", "Insuficiência cardíaca", "Doença renal crônica"],
    ejection_fraction: 55, mean_gradient: null, peak_gradient: null, valve_area: null,
    regurgitation_grade: "tricúspide importante (4+/4+)",
    status: "em_seguimento",
    proposed_management:
      "Otimização clínica com diurético e controle de frequência. Reavaliar intervenção transcateter após compensação.",
    clinical_notes:
      "Regurgitação tricúspide funcional com anel dilatado (44 mm) e disfunção de ventrículo direito incipiente. TRI-SCORE elevado.",
    dias_atras: 152,
    exames: [
      { tipo: "eco", dias: 152, titulo: "Eco transtorácico",
        ejection_fraction: 56, psap: 58, regurgitation_grade: "tricúspide importante (4+/4+)" },
      { tipo: "eco", dias: 40, titulo: "Eco de seguimento",
        ejection_fraction: 55, psap: 62, regurgitation_grade: "tricúspide importante (4+/4+)",
        notes: "Anel tricúspide de 44 mm. TAPSE 15 mm." },
      { tipo: "bnp", dias: 38, titulo: "NT-proBNP", nt_probnp: 2960 },
    ],
    eventos: [
      { tipo: "consulta", dias: 152, titulo: "Encaminhada por edema refratário" },
      { tipo: "medicacao", dias: 150, titulo: "Ajuste de diurético",
        descricao: "Furosemida ajustada; espironolactona associada." },
      { tipo: "internacao", dias: 68, titulo: "Internação por descompensação",
        descricao: "Três dias, com resposta a diurético endovenoso." },
      { tipo: "alta", dias: 65, titulo: "Alta hospitalar" },
      { tipo: "exame", dias: 40, titulo: "Eco de seguimento" },
    ],
    comentarios: [
      dono("Tricúspide funcional importante, com internação recente e PSAP subindo. Pergunta é se há janela para intervenção."),
      fala("paulo", "TRI-SCORE alto e função de VD já no limite. Eu não abordaria agora — o resultado de intervenção nessa faixa é ruim. Otimizar e reavaliar em três meses."),
      decisao("helena", "DECISÃO DO HEART TEAM: manter tratamento clínico otimizado por 3 meses, com reavaliação de função de VD antes de considerar intervenção transcateter."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: 20, status: "realizado", local: "Ambulatório de insuficiência cardíaca" },
      { tipo: "exame", dias: -30, status: "agendado", local: "Ecocardiografia",
        notas: "Reavaliação de função de ventrículo direito." },
    ],
    colaboradores: ["paulo", "helena"],
  },

  // ---------------------------------------------------------------- 7
  {
    patient_name: "Domingos Peçanha Vilela",
    patient_age: 69, patient_sex: "M",
    valve_type: "aortica", valve_disease: "protese_disfuncao", severity: "importante",
    nyha: "II",
    symptoms: ["Dispneia aos esforços", "Fadiga"],
    comorbidities: ["Hipertensão arterial", "Doença arterial coronariana"],
    ejection_fraction: 54, mean_gradient: 38, peak_gradient: 62, valve_area: 0.9,
    regurgitation_grade: "aórtica discreta (1+/4+)",
    status: "avaliacao_inicial",
    proposed_management:
      "Avaliação para valve-in-valve transcateter. Bioprótese aórtica de 21 mm implantada há 11 anos, com degeneração estenótica.",
    clinical_notes:
      "Risco de mismatch paciente-prótese pela prótese pequena. AngioTC solicitada para medir o anel interno.",
    dias_atras: 19,
    exames: [
      { tipo: "eco", dias: 19, titulo: "Eco transtorácico",
        ejection_fraction: 54, mean_gradient: 38, peak_gradient: 62, valve_area: 0.9,
        notes: "Bioprótese aórtica com folhetos espessados e mobilidade reduzida." },
    ],
    eventos: [
      { tipo: "consulta", dias: 19, titulo: "Retorno após 11 anos da cirurgia",
        descricao: "Dispneia progressiva há quatro meses." },
    ],
    comentarios: [
      dono("Degeneração de bioprótese aórtica de 21 mm implantada em 2015. Gradiente médio de 38 mmHg."),
      fala("paulo", "Valve-in-valve é o caminho, mas com prótese de 21 mm o risco de mismatch é real. Vale considerar fratura do anel da bioprótese durante o procedimento."),
    ],
    compromissos: [
      { tipo: "exame", dias: -3, status: "agendado", local: "Tomografia", notas: "AngioTC de aorta e ilíacas." },
    ],
    colaboradores: ["paulo"],
  },

  // ---------------------------------------------------------------- 8
  {
    patient_name: "Neusa Portilho Camargo",
    patient_age: 66, patient_sex: "F",
    valve_type: "multipla", valve_disease: "mista", severity: "importante",
    nyha: "III",
    symptoms: ["Dispneia aos esforços", "Ortopneia", "Edema de membros inferiores"],
    comorbidities: ["Hipertensão arterial", "Fibrilação atrial", "Insuficiência cardíaca"],
    ejection_fraction: 48, mean_gradient: 34, peak_gradient: 56, valve_area: 1.0,
    regurgitation_grade: "mitral moderada (3+/4+)",
    status: "pre_intervencao",
    proposed_management:
      "Abordagem cirúrgica dupla: troca valvar aórtica e reparo mitral no mesmo tempo cirúrgico.",
    clinical_notes:
      "Estenose aórtica importante associada a regurgitação mitral moderada a importante de origem degenerativa. EuroSCORE II 4,1%.",
    dias_atras: 105,
    exames: [
      { tipo: "eco", dias: 105, titulo: "Eco transtorácico",
        ejection_fraction: 50, mean_gradient: 31, peak_gradient: 52, valve_area: 1.1,
        regurgitation_grade: "mitral moderada (3+/4+)", psap: 46 },
      { tipo: "eco", dias: 24, titulo: "Eco transesofágico",
        ejection_fraction: 48, mean_gradient: 34, peak_gradient: 56, valve_area: 1.0,
        regurgitation_grade: "mitral moderada (3+/4+)",
        notes: "Regurgitação mitral degenerativa, com espessamento difuso dos folhetos." },
      { tipo: "bnp", dias: 22, titulo: "BNP", bnp: 610 },
    ],
    eventos: [
      { tipo: "consulta", dias: 105, titulo: "Avaliação inicial" },
      { tipo: "exame", dias: 24, titulo: "Eco transesofágico" },
      { tipo: "observacao", dias: 18, titulo: "Discussão em Heart Team" },
    ],
    comentarios: [
      dono("Dupla lesão: estenose aórtica importante e regurgitação mitral moderada a importante. Pergunta é abordar as duas ou só a aórtica."),
      fala("rafael", "Com a mitral em 3+ e sintomática, deixar para depois costuma significar uma segunda operação em situação pior. Abordo as duas no mesmo tempo."),
      fala("helena", "Concordo. EuroSCORE II de 4,1% suporta o procedimento combinado."),
      decisao("rafael", "DECISÃO DO HEART TEAM: troca valvar aórtica com bioprótese e reparo mitral com anel de anuloplastia, no mesmo tempo cirúrgico."),
    ],
    compromissos: [
      { tipo: "cirurgia", dias: -40, status: "agendado", local: "Centro cirúrgico — Hospital referência", duracao: 360 },
    ],
    colaboradores: ["rafael", "helena"],
  },

  // ---------------------------------------------------------------- 9
  {
    patient_name: "Elias Toledo Bittencourt",
    patient_age: 58, patient_sex: "M",
    valve_type: "aortica", valve_disease: "estenose", severity: "importante",
    nyha: "I",
    symptoms: ["Assintomático"],
    comorbidities: ["Dislipidemia"],
    ejection_fraction: 60, mean_gradient: 11, peak_gradient: 19, valve_area: 1.9,
    regurgitation_grade: "",
    status: "pos_intervencao",
    proposed_management:
      "Pós-operatório de troca valvar aórtica com bioprótese de 23 mm. AAS 100 mg/dia; seguimento anual com eco.",
    clinical_notes:
      "Operado há dois meses, sem intercorrências. Gradientes transprotéticos dentro do esperado para o modelo.",
    dias_atras: 220,
    exames: [
      { tipo: "eco", dias: 220, titulo: "Eco pré-operatório",
        ejection_fraction: 55, mean_gradient: 49, peak_gradient: 78, valve_area: 0.7 },
      { tipo: "eco", dias: 52, titulo: "Eco pós-operatório",
        ejection_fraction: 60, mean_gradient: 11, peak_gradient: 19, valve_area: 1.9,
        notes: "Bioprótese aórtica normofuncionante." },
      { tipo: "ergometria", dias: 20, titulo: "Teste de caminhada de 6 minutos", six_min_walk: 520 },
    ],
    eventos: [
      { tipo: "consulta", dias: 220, titulo: "Avaliação inicial" },
      { tipo: "cirurgia", dias: 62, titulo: "Troca valvar aórtica",
        descricao: "Bioprótese de 23 mm. Circulação extracorpórea de 78 minutos, sem intercorrências." },
      { tipo: "alta", dias: 56, titulo: "Alta hospitalar", descricao: "Sexto dia de pós-operatório." },
      { tipo: "exame", dias: 52, titulo: "Eco pós-operatório",
        descricao: "Gradiente médio de 11 mmHg — prótese normofuncionante." },
    ],
    comentarios: [
      dono("Pós-operatório de dois meses, assintomático, com prótese normofuncionante e caminhada de 520 m."),
      fala("rafael", "Evolução dentro do esperado. Mantenho AAS 100 mg e seguimento anual com eco."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: 52, status: "realizado", local: "Ambulatório de pós-operatório" },
      { tipo: "consulta_retorno", dias: -120, status: "agendado", local: "Ambulatório de valvopatias",
        notas: "Seguimento anual com eco." },
    ],
    colaboradores: ["rafael"],
  },

  // ---------------------------------------------------------------- 10
  {
    patient_name: "Ivone Salgueiro Mattos",
    patient_age: 67, patient_sex: "F",
    valve_type: "aortica", valve_disease: "estenose", severity: "leve",
    nyha: "I",
    symptoms: ["Assintomático"],
    comorbidities: ["Hipertensão arterial", "Obesidade"],
    ejection_fraction: 66, mean_gradient: 14, peak_gradient: 24, valve_area: 1.7,
    regurgitation_grade: "",
    status: "em_seguimento",
    proposed_management:
      "Seguimento clínico. Novo ecocardiograma em 12 meses, ou antes se surgirem sintomas.",
    clinical_notes:
      "Achado incidental em eco solicitado por hipertensão. Sem repercussão hemodinâmica.",
    dias_atras: 245,
    exames: [
      { tipo: "eco", dias: 245, titulo: "Eco transtorácico",
        ejection_fraction: 65, mean_gradient: 12, peak_gradient: 21, valve_area: 1.8 },
      { tipo: "eco", dias: 8, titulo: "Eco de seguimento anual",
        ejection_fraction: 66, mean_gradient: 14, peak_gradient: 24, valve_area: 1.7,
        notes: "Progressão discreta em oito meses." },
    ],
    eventos: [
      { tipo: "consulta", dias: 245, titulo: "Achado incidental em eco" },
      { tipo: "exame", dias: 8, titulo: "Eco de seguimento anual",
        descricao: "Progressão discreta; mantém critérios de estenose leve." },
    ],
    comentarios: [
      dono("Estenose aórtica leve, assintomática. Seguimento anual, sem indicação de intervenção."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: -300, status: "agendado", local: "Ambulatório de valvopatias" },
    ],
    colaboradores: [],
  },

  // ---------------------------------------------------------------- 11
  {
    patient_name: "Waldemar Guimarães Prado",
    patient_age: 74, patient_sex: "M",
    valve_type: "mitral", valve_disease: "insuficiencia", severity: "importante",
    nyha: "III",
    symptoms: ["Dispneia aos esforços", "Dispneia paroxística noturna", "Fadiga"],
    comorbidities: ["Insuficiência cardíaca", "Doença arterial coronariana", "Diabetes mellitus", "Doença renal crônica"],
    ejection_fraction: 32, mean_gradient: null, peak_gradient: null, valve_area: null,
    regurgitation_grade: "mitral importante (4+/4+)",
    status: "em_seguimento",
    proposed_management:
      "Terapia medicamentosa otimizada para insuficiência cardíaca. Avaliar TEER se persistirem sintomas após otimização plena.",
    clinical_notes:
      "Regurgitação mitral secundária a remodelamento ventricular pós-infarto. Perfil próximo ao do estudo COAPT.",
    dias_atras: 118,
    exames: [
      { tipo: "eco", dias: 118, titulo: "Eco transtorácico",
        ejection_fraction: 30, regurgitation_grade: "mitral importante (4+/4+)",
        lv_diameter: 66, psap: 52 },
      { tipo: "eco", dias: 33, titulo: "Eco de seguimento",
        ejection_fraction: 32, regurgitation_grade: "mitral importante (4+/4+)",
        lv_diameter: 65, psap: 48, notes: "Discreta melhora após otimização medicamentosa." },
      { tipo: "bnp", dias: 31, titulo: "NT-proBNP", nt_probnp: 3420 },
      { tipo: "ergometria", dias: 30, titulo: "Teste de caminhada de 6 minutos", six_min_walk: 265 },
    ],
    eventos: [
      { tipo: "consulta", dias: 118, titulo: "Encaminhado da insuficiência cardíaca" },
      { tipo: "medicacao", dias: 115, titulo: "Otimização de terapia",
        descricao: "Quatro pilares em doses crescentes, conforme tolerância renal." },
      { tipo: "exame", dias: 33, titulo: "Eco de seguimento" },
    ],
    comentarios: [
      dono("Regurgitação mitral secundária, FE 32%, sintomático apesar de terapia otimizada há quatro meses."),
      fala("helena", "A otimização ainda não está plena — a dose do inibidor está limitada pela função renal. Antes de indicar TEER, eu esgotaria o ajuste."),
      fala("paulo", "De acordo. Se em três meses persistir NYHA III com terapia máxima tolerada, o perfil é COAPT-like e aí discutimos TEER."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: -45, status: "agendado", local: "Ambulatório de insuficiência cardíaca" },
      { tipo: "teleconsulta", dias: 10, status: "cancelado", notas: "Paciente sem acesso à internet no dia." },
    ],
    colaboradores: ["helena", "paulo"],
  },

  // ---------------------------------------------------------------- 12
  {
    patient_name: "Lourdes Bandeira Ferraz",
    patient_age: 53, patient_sex: "F",
    valve_type: "mitral", valve_disease: "prolapso", severity: "moderada",
    nyha: "I",
    symptoms: ["Assintomático"],
    comorbidities: [],
    ejection_fraction: 63, mean_gradient: 3, peak_gradient: 8, valve_area: null,
    regurgitation_grade: "mitral discreta (1+/4+)",
    status: "alta",
    proposed_management:
      "Alta do seguimento especializado. Reparo mitral há sete meses, com resultado estável e regurgitação residual discreta.",
    clinical_notes:
      "Retorna ao acompanhamento do cardiologista de origem. Orientada a procurar reavaliação se surgirem sintomas.",
    dias_atras: 275,
    exames: [
      { tipo: "eco", dias: 275, titulo: "Eco pré-operatório",
        ejection_fraction: 64, regurgitation_grade: "mitral importante (4+/4+)", lv_diameter: 55 },
      { tipo: "eco", dias: 196, titulo: "Eco pós-operatório",
        ejection_fraction: 61, regurgitation_grade: "mitral discreta (1+/4+)", lv_diameter: 50 },
      { tipo: "eco", dias: 47, titulo: "Eco de seguimento",
        ejection_fraction: 63, regurgitation_grade: "mitral discreta (1+/4+)", lv_diameter: 48,
        notes: "Reparo estável. Regurgitação residual discreta." },
    ],
    eventos: [
      { tipo: "consulta", dias: 275, titulo: "Avaliação inicial" },
      { tipo: "cirurgia", dias: 210, titulo: "Reparo valvar mitral",
        descricao: "Ressecção quadrangular de P2 com anel de anuloplastia de 32 mm." },
      { tipo: "alta", dias: 204, titulo: "Alta hospitalar" },
      { tipo: "exame", dias: 47, titulo: "Eco de seguimento em 6 meses" },
      { tipo: "alta", dias: 44, titulo: "Alta do seguimento especializado",
        descricao: "Retorna ao cardiologista de origem." },
    ],
    comentarios: [
      dono("Reparo estável aos sete meses, com regurgitação residual discreta e ventrículo remodelado. Alta do seguimento especializado."),
      fala("rafael", "Resultado excelente. Recomendo eco anual pelo cardiologista de origem."),
    ],
    compromissos: [
      { tipo: "consulta_retorno", dias: 47, status: "realizado", local: "Ambulatório de pós-operatório" },
      { tipo: "consulta_retorno", dias: 120, status: "faltou", local: "Ambulatório de valvopatias" },
    ],
    colaboradores: ["rafael"],
  },
];
