import LegalPage from "./LegalPage";

const Termos = () => (
  <LegalPage
    doc={{
      eyebrow: "Documentos legais",
      title: "Termos de Uso",
      description: "Condições para uso da plataforma ValvePath por médicos e pacientes.",
      sections: [
        { heading: "1. Natureza da ferramenta", body: "ValvePath é uma plataforma de apoio educacional, organização de casos e suporte à discussão clínica. Não é um dispositivo médico autônomo de diagnóstico, prescrição ou conduta terapêutica." },
        { heading: "2. Não substituição do médico", body: "A plataforma não substitui avaliação médica, julgamento clínico, diagnóstico, prescrição, laudo ou decisão do Heart Team. Toda decisão clínica é responsabilidade do profissional habilitado." },
        { heading: "3. Responsabilidade do usuário médico", body: [
          "Cadastrar dados verdadeiros e atualizados, incluindo CRM válido.",
          "Validar dados e anexos enviados por pacientes ou inseridos no caso.",
          "Manter sigilo profissional conforme legislação e códigos de ética.",
          "Não inserir dados de pacientes sem autorização.",
        ]},
        { heading: "4. Responsabilidade do paciente", body: [
          "Inserir informações verdadeiras sobre si.",
          "Procurar atendimento médico em sinais de alerta — não substituir consulta pelo uso da plataforma.",
          "Controlar suas permissões de compartilhamento.",
        ]},
        { heading: "5. Limitações", body: "A plataforma não garante resultado clínico específico. Informações podem precisar de atualização conforme novas evidências e diretrizes." },
        { heading: "6. Conta e segurança", body: "Você é responsável por manter a confidencialidade de sua senha e por toda atividade realizada em sua conta." },
        { heading: "7. Foro e legislação", body: "Estes termos são regidos pela legislação brasileira. Foro: Brasil (a definir conforme contrato comercial). Recomenda-se revisão jurídica antes de produção." },
      ],
    }}
  />
);

export default Termos;
