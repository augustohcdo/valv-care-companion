import LegalPage from "./LegalPage";

const Privacidade = () => (
  <LegalPage
    doc={{
      eyebrow: "Documentos legais",
      title: "Política de Privacidade",
      description: "Como o ValvePath coleta, usa e protege seus dados, em conformidade com a LGPD.",
      sections: [
        { heading: "1. Dados coletados", body: [
          "Médico: nome, CRM, UF, especialidade, instituição, e-mail, telefone, senha (hash).",
          "Paciente: dados pessoais e clínicos informados pelo próprio paciente ou pelo médico vinculado.",
          "Anexos: arquivos enviados pelos usuários (PDFs, imagens, laudos, exames).",
          "Logs técnicos necessários à operação e auditoria.",
        ]},
        { heading: "2. Finalidade", body: "Os dados são tratados para apoiar organização de casos clínicos, comunicação médico-paciente, geração de dashboards, suporte à discussão clínica, segurança e cumprimento de obrigações legais." },
        { heading: "3. Base legal (LGPD)", body: [
          "Consentimento explícito do titular para dados pessoais sensíveis de saúde.",
          "Cumprimento de obrigação legal e exercício regular de direitos.",
          "Tutela da saúde, exclusivamente em procedimento realizado por profissionais de saúde, conforme art. 11 da LGPD.",
        ]},
        { heading: "4. Compartilhamento", body: "O compartilhamento entre paciente e médico só ocorre após vínculo aprovado e consentimento ativo. Não vendemos seus dados. Não usamos dados clínicos para treinamento de modelos sem consentimento explícito." },
        { heading: "5. Direitos do titular", body: [
          "Acesso aos dados.",
          "Correção de dados incompletos ou desatualizados.",
          "Anonimização, bloqueio ou eliminação.",
          "Portabilidade dos dados.",
          "Revogação de consentimento a qualquer momento.",
        ]},
        { heading: "6. Segurança", body: "Em produção, adotamos criptografia em trânsito e em repouso, controle de acesso por perfil, logs de auditoria e processos de revisão. Esta versão de demonstração não deve receber dados reais." },
        { heading: "7. Retenção", body: "Os dados são mantidos pelo tempo necessário às finalidades, observadas obrigações legais e regulatórias específicas do setor de saúde." },
        { heading: "8. Contato do encarregado", body: "Em produção, será disponibilizado um canal específico do Encarregado de Dados (DPO) conforme exigido pela LGPD." },
      ],
    }}
  />
);

export default Privacidade;
