import LegalPage from "./LegalPage";

const AvisoMedico = () => (
  <LegalPage
    doc={{
      eyebrow: "Documentos legais",
      title: "Aviso Médico",
      description: "Esclarecimento sobre o caráter de apoio do ValvePath e suas limitações clínicas.",
      sections: [
        { heading: "Ferramenta de apoio", body: "ValvePath é uma ferramenta de apoio educacional e de organização de casos clínicos. Não realiza diagnóstico autônomo, não prescreve medicações, não emite laudos e não substitui a avaliação de profissional médico habilitado." },
        { heading: "Decisões clínicas", body: "Toda decisão clínica — diagnóstico, escolha de exames, conduta terapêutica, indicação de procedimento — é de responsabilidade do médico assistente e, quando aplicável, do Heart Team multidisciplinar." },
        { heading: "Conteúdo educacional", body: "As informações apresentadas são de natureza educacional, baseadas em diretrizes internacionais e literatura validada. Podem precisar de atualização conforme novas evidências." },
        { heading: "Sinais de alerta", body: "Em caso de dor torácica intensa, falta de ar súbita, desmaio, sangramento importante, febre persistente ou outros sintomas graves, procure atendimento médico de emergência (SAMU 192 ou pronto-socorro)." },
        { heading: "Compartilhamento de informações", body: "O paciente é o titular dos seus dados de saúde. O compartilhamento com médico vinculado depende de consentimento ativo e pode ser revogado a qualquer momento." },
      ],
    }}
  />
);

export default AvisoMedico;
