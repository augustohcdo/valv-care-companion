import LegalPage from "./LegalPage";

const AvisoMedico = () => (
  <LegalPage
    doc={{
      eyebrow: "Documentos legais",
      title: "Aviso Médico e Limitações Clínicas",
      description: "Esclarecimento, em conformidade com o Conselho Federal de Medicina e a Anvisa, sobre o caráter de apoio do ValvePath e suas limitações.",
      effectiveDate: "01 de maio de 2026",
      version: "2.0",
      contact: { supportEmail: "valvepath@gmail.com" },
      sections: [
        {
          heading: "Natureza da Plataforma",
          body: "ValvePath é uma ferramenta de apoio educacional, organizacional e de comunicação clínica, voltada à área de doenças valvares cardíacas. Conforme entendimento aplicável à RDC Anvisa nº 657/2022, a Plataforma não foi projetada para diagnosticar, prevenir, tratar ou monitorar doenças de forma autônoma e, portanto, não é classificada como software dispositivo médico. Toda interpretação e decisão clínica permanece sob responsabilidade do profissional médico habilitado.",
        },
        {
          heading: "Não substitui consulta médica",
          body: "As informações apresentadas na Plataforma — sejam textos educacionais, sugestões da IA clínica, recomendações baseadas em diretrizes ou organização visual de dados — não constituem diagnóstico, prescrição, laudo ou parecer médico. Não substituem consulta presencial ou telemedicina formalmente prestada nos termos da Resolução CFM nº 2.314/2022.",
        },
        {
          heading: "Responsabilidade do médico assistente",
          body: [
            "Toda decisão clínica (diagnóstico, escolha de exames, conduta terapêutica, indicação de procedimento, alta, encaminhamento) é exclusiva do médico assistente.",
            "Quando aplicável, decisões em doença valvar devem considerar o Heart Team multidisciplinar, conforme diretrizes ESC/EACTS e ACC/AHA.",
            "O médico deve validar as informações apresentadas pela Plataforma antes de qualquer ato médico. Sugestões da IA são auxiliares e não vinculantes.",
            "O médico se compromete com o sigilo profissional (Art. 73 do Código de Ética Médica — CFM 2.217/2018).",
          ],
        },
        {
          heading: "Sobre conteúdo gerado por IA",
          body: "Recursos de inteligência artificial dentro da Plataforma têm finalidade meramente acessória. Não realizam diagnóstico autônomo. As saídas devem ser revisadas criticamente por médico habilitado antes de qualquer aplicação clínica. A Plataforma cumpre o disposto no Art. 20 da LGPD: não tomamos decisões clínicas por automação.",
        },
        {
          heading: "Conteúdo educacional",
          body: "Os materiais educacionais são baseados em diretrizes internacionais (ESC/EACTS, ACC/AHA), literatura revisada por pares e fontes reconhecidas. Podem precisar de atualização conforme novas evidências e revisões dessas diretrizes.",
        },
        {
          heading: "Sinais de alerta — emergências",
          body: "Em caso de dor torácica intensa, falta de ar súbita, desmaio, sangramento importante, palpitação com mal-estar significativo, alterações neurológicas agudas (perda de força, fala, visão), febre alta persistente em portador de prótese valvar, ou outros sintomas graves: NÃO use a Plataforma. Procure atendimento médico de emergência imediatamente — ligue para o SAMU 192 ou dirija-se ao pronto-socorro mais próximo.",
        },
        {
          heading: "Telemedicina",
          body: "A Plataforma pode oferecer comunicação assíncrona entre médico e paciente vinculado (mensagens, documentos, lembretes). Esta comunicação não constitui, por si só, consulta de telemedicina nos termos da Resolução CFM nº 2.314/2022, que exige requisitos específicos como identificação do médico, consentimento informado específico, registro em prontuário e infraestrutura de teleconsulta. Quando o médico optar por realizar teleconsulta, deverá observar integralmente a Resolução vigente.",
        },
        {
          heading: "Compartilhamento de informações de saúde",
          body: "O paciente é o titular de seus dados de saúde (Art. 5º, II, LGPD). O compartilhamento com médico vinculado depende de consentimento ativo e revogável, exibido no painel 'Privacidade e segurança'. A revogação não retroage para invalidar tratamentos clínicos já realizados de boa-fé pelo médico.",
        },
        {
          heading: "Atualizações e melhorias",
          body: "Buscamos manter o conteúdo alinhado às melhores evidências disponíveis, mas não garantimos que cada material reflita a versão mais recente de toda a literatura. Em caso de dúvida, consulte fontes primárias e o profissional médico responsável.",
        },
        {
          heading: "Limitação de responsabilidade",
          body: "A ValvePath não responde por eventuais decisões tomadas em desacordo com este Aviso, com os Termos de Uso ou com a melhor prática clínica.",
        },
      ],
    }}
  />
);

export default AvisoMedico;
