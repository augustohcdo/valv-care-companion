import LegalPage from "./LegalPage";

const Termos = () => (
  <LegalPage
    doc={{
      eyebrow: "Documentos legais",
      title: "Termos e Condições de Uso",
      description: "Regras para utilização da plataforma ValvePath por médicos e pacientes em conformidade com a legislação brasileira.",
      effectiveDate: "01 de maio de 2026",
      version: "2.0",
      contact: { dpoEmail: "dpo@valvepath.com", supportEmail: "suporte@valvepath.com" },
      sections: [
        {
          heading: "Aceitação destes Termos",
          body: "Ao criar uma conta ou utilizar a plataforma ValvePath (a 'Plataforma'), você declara que leu, compreendeu e concorda integralmente com estes Termos e Condições de Uso, com a Política de Privacidade, com o Aviso Médico e com a Política de Cookies. Caso não concorde com qualquer disposição, não utilize a Plataforma. Estes Termos são regidos pela legislação da República Federativa do Brasil, em especial pela Lei nº 12.965/2014 (Marco Civil da Internet), pela Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD), pela Lei nº 13.787/2018 (digitalização e uso de prontuário eletrônico), pela Lei nº 8.078/1990 (Código de Defesa do Consumidor) e pelas resoluções aplicáveis do Conselho Federal de Medicina (CFM) e da Anvisa.",
        },
        {
          heading: "Definições",
          body: [
            "Plataforma: o conjunto de páginas, aplicativos, APIs e serviços disponibilizados sob a marca ValvePath.",
            "Usuário Médico: profissional médico devidamente inscrito em Conselho Regional de Medicina (CRM), ativo, que se cadastra para acompanhar pacientes e organizar casos clínicos.",
            "Usuário Paciente: pessoa natural maior de 18 anos que utiliza a Plataforma para sua educação em saúde e/ou para se vincular a um Usuário Médico.",
            "Conteúdo Educacional: materiais informativos baseados em diretrizes científicas (ESC/EACTS, ACC/AHA), publicações revisadas por pares e literatura validada.",
            "Dados Sensíveis: dados pessoais relativos à saúde, conforme definidos no Art. 5º, II da LGPD.",
            "Heart Team: equipe multidisciplinar responsável por decisões compartilhadas em doenças valvares.",
          ],
        },
        {
          heading: "Natureza e finalidade da Plataforma",
          body: "ValvePath é uma ferramenta de apoio educacional, de organização e de comunicação clínica voltada às doenças valvares cardíacas. Não constitui dispositivo médico autônomo de diagnóstico, prescrição ou conduta terapêutica e, portanto, conforme entendimento aplicável à RDC Anvisa nº 657/2022, opera como software de finalidade administrativa, educacional e de organização de informações clínicas, sob responsabilidade do profissional médico que a utiliza.",
          subsections: [
            { heading: "O que a Plataforma faz", body: ["Organiza prontuário e documentos enviados pelos próprios usuários.", "Facilita comunicação entre médico e paciente vinculado.", "Apresenta material educacional baseado em diretrizes.", "Sugere referências e roteiros, sempre como apoio à decisão humana."] },
            { heading: "O que a Plataforma NÃO faz", body: ["Não emite diagnóstico autônomo.", "Não prescreve medicamentos ou condutas.", "Não emite laudos ou pareceres oficiais.", "Não substitui consulta presencial ou telemedicina formalmente prestada nos termos da Resolução CFM nº 2.314/2022.", "Não realiza atendimento de urgência ou emergência."] },
          ],
        },
        {
          heading: "Cadastro, conta e elegibilidade",
          body: [
            "É vedado o cadastro de menores de 18 anos sem representação legal.",
            "O Usuário Médico declara, sob as penas da lei, possuir CRM ativo e regular, e que as informações profissionais fornecidas são verdadeiras (Art. 299 do Código Penal).",
            "É proibido criar contas em nome de terceiros sem autorização expressa.",
            "O usuário é integralmente responsável pela guarda de suas credenciais e por toda atividade realizada em sua conta. Comunicar imediatamente o suporte em caso de uso indevido.",
            "Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos, a legislação ou normas éticas profissionais.",
          ],
        },
        {
          heading: "Responsabilidades do Usuário Médico",
          body: [
            "Cumprir o Código de Ética Médica (Resolução CFM nº 2.217/2018), em especial o sigilo profissional (Art. 73).",
            "Não cadastrar dados de pacientes sem o respectivo consentimento ou base legal de tutela da saúde (Art. 11, II, 'f', LGPD).",
            "Manter dados profissionais atualizados, incluindo CRM, UF e especialidade.",
            "Validar todas as informações antes de tomar qualquer decisão clínica — a Plataforma é apoio, não fonte primária de verdade.",
            "Atuar como controlador conjunto dos dados clínicos dos seus pacientes na Plataforma, conforme Art. 5º, VI, LGPD, sendo o responsável pela conduta clínica.",
            "Não utilizar a Plataforma para qualquer finalidade que viole o Capítulo XIII do Código de Ética Médica (publicidade médica) ou a Resolução CFM nº 1.974/2011.",
          ],
        },
        {
          heading: "Responsabilidades do Usuário Paciente",
          body: [
            "Inserir informações verdadeiras a seu respeito.",
            "Procurar atendimento médico presencial em sintomas graves — não substituir consulta pela Plataforma.",
            "Em emergências (dor torácica intensa, falta de ar súbita, desmaio, sangramento): ligar 192 (SAMU) ou ir a um pronto-socorro.",
            "Controlar suas permissões de compartilhamento e revogá-las quando desejar.",
            "Não enviar dados de terceiros sem autorização.",
          ],
        },
        {
          heading: "Conteúdo do usuário e licença",
          body: "Você mantém a titularidade dos dados e arquivos que envia ('Conteúdo do Usuário'). Para que possamos operar a Plataforma, você concede uma licença gratuita, não exclusiva, mundial e revogável para armazenar, exibir e processar seu Conteúdo, exclusivamente para as finalidades descritas na Política de Privacidade. Esta licença termina ao excluir o Conteúdo ou encerrar a conta, ressalvadas as retenções legais obrigatórias (Lei 13.787/2018, art. 6º — prontuário por no mínimo 20 anos do último registro).",
        },
        {
          heading: "Condutas proibidas",
          body: [
            "Inserir dados ilícitos, ofensivos, discriminatórios ou que violem direitos de terceiros.",
            "Tentar acessar dados de outros usuários sem autorização ou explorar vulnerabilidades.",
            "Fazer engenharia reversa, copiar ou redistribuir o software sem autorização escrita.",
            "Usar a Plataforma para realizar publicidade médica em desacordo com as normas do CFM.",
            "Fazer upload de conteúdo malicioso (malware, scripts) ou utilizar a Plataforma para spam.",
            "Coletar informações de outros usuários por meios automatizados (scraping).",
          ],
        },
        {
          heading: "Propriedade intelectual",
          body: "Marca, logotipo, layout, código-fonte, base de conteúdo educacional, organização editorial e demais elementos da Plataforma pertencem à ValvePath e/ou seus licenciadores. É vedado o uso comercial sem autorização. Trechos de diretrizes médicas (ESC/EACTS, ACC/AHA) são citados em conformidade com o uso justo (Art. 46 da Lei 9.610/1998), com referência expressa às fontes.",
        },
        {
          heading: "Pagamentos e planos (quando aplicável)",
          body: "Caso planos pagos sejam oferecidos, as condições serão exibidas previamente à contratação, incluindo preço, periodicidade, forma de cancelamento e direito de arrependimento de 7 dias para contratações à distância (Art. 49, CDC). Reembolsos seguem a legislação consumerista vigente.",
        },
        {
          heading: "Disponibilidade, manutenção e força maior",
          body: "Empenhamos esforços técnicos razoáveis para manter a Plataforma disponível, sem garantir, contudo, operação ininterrupta ou livre de erros. Manutenções programadas serão comunicadas com antecedência sempre que possível. Não nos responsabilizamos por indisponibilidades decorrentes de caso fortuito, força maior, ataques cibernéticos, falhas de provedores de internet/energia ou ações de terceiros.",
        },
        {
          heading: "Limitação de responsabilidade",
          body: "Na máxima extensão permitida pela legislação aplicável, a ValvePath não responde por: (a) decisões clínicas tomadas pelo Usuário Médico ou pelo Usuário Paciente; (b) danos indiretos, lucros cessantes ou perda de dados decorrentes de uso indevido da Plataforma; (c) conteúdo inserido pelos próprios usuários; (d) interrupções temporárias de serviço comunicadas previamente; (e) eventos de força maior. Esta limitação não exclui responsabilidades inafastáveis do CDC, da LGPD ou de normas de saúde aplicáveis.",
        },
        {
          heading: "Indenização",
          body: "Você concorda em isentar e indenizar a ValvePath, suas afiliadas e equipe por reclamações, perdas, danos, custos e honorários advocatícios decorrentes do seu uso indevido da Plataforma, da violação destes Termos, da legislação ou de direitos de terceiros.",
        },
        {
          heading: "Suspensão e encerramento",
          body: "Podemos suspender ou encerrar sua conta em caso de violação destes Termos, suspeita de fraude, ordem judicial ou requisito regulatório. Você também pode encerrar a conta a qualquer momento; dados clínicos sob obrigação legal de retenção (ex.: prontuário) serão mantidos pelo prazo mínimo previsto em lei e depois eliminados.",
        },
        {
          heading: "Alterações destes Termos",
          body: "Podemos modificar estes Termos para refletir alterações legais, regulatórias ou de produto. Modificações materiais serão comunicadas com antecedência mínima de 30 dias por e-mail e por aviso na Plataforma. O uso continuado após o prazo significa aceitação. Quando exigido pela LGPD (Art. 8º, §6º), solicitaremos novo aceite explícito.",
        },
        {
          heading: "Comunicações eletrônicas",
          body: "Você concorda em receber comunicações relacionadas à conta, segurança, atualizações destes Termos, lembretes clínicos e suporte por meio do e-mail e telefone informados. Comunicações promocionais dependem de consentimento separado, revogável a qualquer momento.",
        },
        {
          heading: "Resolução de conflitos, foro e legislação",
          body: "Estes Termos são interpretados conforme a legislação brasileira. Em conformidade com o Art. 11 do Marco Civil da Internet, o tratamento de dados realizado em território nacional ou cujo serviço seja ofertado a brasileiros submete-se à jurisdição brasileira. Fica eleito o foro da Comarca de São Paulo/SP para dirimir controvérsias, sem prejuízo do foro do consumidor (Art. 101, I, CDC) quando aplicável. Antes de medidas judiciais, as partes envidarão esforços de solução amigável.",
        },
        {
          heading: "Disposições finais",
          body: "A invalidade de qualquer cláusula não afeta as demais. A tolerância a descumprimento não importa renúncia. Estes Termos constituem o acordo integral entre as partes sobre a matéria, em conjunto com a Política de Privacidade, o Aviso Médico e a Política de Cookies.",
        },
      ],
    }}
  />
);

export default Termos;
