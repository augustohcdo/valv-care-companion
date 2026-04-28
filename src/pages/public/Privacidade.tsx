import LegalPage from "./LegalPage";

const Privacidade = () => (
  <LegalPage
    doc={{
      eyebrow: "Documentos legais",
      title: "Política de Privacidade e Proteção de Dados",
      description: "Como coletamos, usamos, compartilhamos e protegemos seus dados pessoais e dados sensíveis de saúde, em conformidade com a LGPD.",
      effectiveDate: "01 de maio de 2026",
      version: "2.0",
      contact: { dpoEmail: "dpo@valvepath.com", supportEmail: "suporte@valvepath.com" },
      sections: [
        {
          heading: "Quem somos e nosso papel sob a LGPD",
          body: "ValvePath ('nós', 'a Plataforma') é responsável pelo tratamento dos seus dados pessoais e atua na condição de controlador (Art. 5º, VI, LGPD) para os dados de cadastro, autenticação, navegação e operação. Para os dados clínicos inseridos pelo Usuário Médico sobre o Usuário Paciente, atuamos como operador (Art. 5º, VII, LGPD), sendo o médico o controlador principal sob a base de tutela da saúde. O Encarregado de Dados (DPO), conforme exige o Art. 41 da LGPD, é nosso ponto focal para qualquer assunto de privacidade.",
        },
        {
          heading: "Dados que coletamos",
          subsections: [
            { heading: "Cadastro do Médico", body: ["Nome completo, CPF (quando solicitado para verificação), e-mail, telefone.", "CRM, UF, especialidade, RQE (opcional), instituição.", "Senha (armazenada de forma criptografada e irreversível)."] },
            { heading: "Cadastro do Paciente", body: ["Nome completo, e-mail, telefone, data de nascimento, sexo, cidade/UF.", "Comorbidades e demais dados clínicos que você inserir voluntariamente."] },
            { heading: "Dados clínicos (sensíveis, Art. 5º, II e Art. 11, LGPD)", body: ["Histórico, sintomas, sinais vitais, exames (ECO, ECG, NT-proBNP etc.), medicações, eventos clínicos, documentos enviados, mensagens com seu médico, decisões e anotações."] },
            { heading: "Dados técnicos e de uso", body: ["Endereço IP, tipo de navegador, sistema operacional, identificador de sessão.", "Logs de acesso à aplicação por 6 meses (Art. 15, Marco Civil da Internet).", "Cookies estritamente necessários (sessão, segurança) e, mediante seu consentimento, cookies analíticos e funcionais — vide Política de Cookies."] },
          ],
        },
        {
          heading: "Para quais finalidades tratamos seus dados",
          body: [
            "Autenticação, manutenção da conta e segurança.",
            "Organização do prontuário, evolução clínica e comunicação médico-paciente.",
            "Geração de dashboards, relatórios e indicadores agregados (sempre que possível, anonimizados).",
            "Apoio à decisão clínica baseado em diretrizes — sem substituir o julgamento médico.",
            "Atendimento a obrigações legais e regulatórias (CFM, Anvisa, prontuário eletrônico).",
            "Cumprimento de ordens judiciais e atendimento a autoridades competentes.",
            "Comunicações operacionais (segurança, atualizações de termos, lembretes clínicos).",
            "Envio de comunicações educativas e informativas (somente com seu consentimento).",
          ],
        },
        {
          heading: "Bases legais (Art. 7º e Art. 11 da LGPD)",
          body: [
            "Consentimento (Art. 7º, I; Art. 11, I): comunicações por e-mail, processamento por IA clínica, compartilhamento com médico vinculado, cookies não essenciais.",
            "Tutela da saúde (Art. 11, II, 'f'): tratamento de dados clínicos exclusivamente em procedimento realizado por profissional de saúde habilitado.",
            "Execução de contrato (Art. 7º, V): manutenção de sua conta e funcionalidades essenciais.",
            "Cumprimento de obrigação legal/regulatória (Art. 7º, II; Art. 11, II, 'a'): retenção de prontuário (Lei 13.787/2018), logs (Marco Civil) e demais normas aplicáveis.",
            "Legítimo interesse (Art. 7º, IX): segurança, prevenção a fraudes e melhoria de produto, sempre balanceado com seus direitos fundamentais.",
            "Exercício regular de direitos (Art. 7º, VI; Art. 11, II, 'd'): em processos administrativos, judiciais ou arbitrais.",
          ],
        },
        {
          heading: "Compartilhamento de dados",
          body: [
            "Médico vinculado: o paciente autoriza, em consentimento granular e revogável, que seu médico vinculado acesse os dados clínicos registrados na Plataforma.",
            "Operadores e provedores de tecnologia: provedor de nuvem (armazenamento e processamento), provedor de e-mail transacional, provedor de autenticação. Todos obrigados contratualmente ao sigilo e a padrões equivalentes da LGPD.",
            "Autoridades competentes: mediante requisição legal ou ordem judicial.",
            "Sucessores em operações societárias: em caso de fusão, aquisição ou reorganização, mediante notificação prévia.",
            "Não vendemos seus dados. Não usamos seus dados clínicos para treinar modelos de IA de terceiros sem seu consentimento explícito e separado.",
          ],
        },
        {
          heading: "Transferência internacional",
          body: "Quando dados forem processados fora do Brasil (por exemplo, por subprocessadores de nuvem), garantimos que o destino oferece grau de proteção adequado, conforme Art. 33 e seguintes da LGPD, mediante cláusulas contratuais padrão, certificações ou outros mecanismos reconhecidos pela ANPD.",
        },
        {
          heading: "Seus direitos como titular (Art. 18, LGPD)",
          body: [
            "Confirmação da existência de tratamento.",
            "Acesso aos dados.",
            "Correção de dados incompletos, inexatos ou desatualizados.",
            "Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade.",
            "Portabilidade a outro fornecedor.",
            "Eliminação de dados tratados com base no consentimento, ressalvadas as hipóteses do Art. 16.",
            "Informação sobre entidades com as quais compartilhamos seus dados.",
            "Informação sobre a possibilidade de não fornecer consentimento e suas consequências.",
            "Revogação do consentimento (Art. 8º, §5º).",
            "Oposição ao tratamento realizado com fundamento em uma das hipóteses sem consentimento, em caso de descumprimento da LGPD.",
            "Revisão de decisões automatizadas (Art. 20) — atualmente não tomamos decisões clínicas por automação; sugestões da IA exigem validação médica.",
          ],
          subsections: [
            { heading: "Como exercer", body: "Acesse 'Privacidade e segurança' dentro da sua conta para visualizar consentimentos, exportar dados e gerenciar preferências. Para solicitações que não puderem ser resolvidas pelo painel, escreva ao DPO. Responderemos em até 15 dias (Art. 19)." },
          ],
        },
        {
          heading: "Retenção de dados",
          body: [
            "Cadastro e dados de conta: enquanto a conta estiver ativa, e por até 5 anos após o encerramento, para defesa em eventuais demandas (Art. 27, CDC).",
            "Prontuário e dados clínicos: prazo mínimo de 20 anos a partir do último registro, conforme Art. 6º da Lei 13.787/2018.",
            "Logs de acesso à aplicação: 6 meses (Art. 15, Marco Civil).",
            "Logs de auditoria de consentimentos: enquanto necessários para comprovação (Art. 8º, §2º, LGPD).",
            "Após esses prazos, os dados são eliminados ou anonimizados de forma segura.",
          ],
        },
        {
          heading: "Segurança da informação",
          body: [
            "Criptografia em trânsito (TLS 1.2+) e em repouso.",
            "Verificação contra senhas vazadas (Have I Been Pwned).",
            "Row-Level Security (RLS) em todas as tabelas clínicas.",
            "Segregação de papéis (médico, paciente, admin) e princípio do menor privilégio.",
            "Trilha de auditoria imutável de consentimentos.",
            "Restrição de canais de Realtime ao próprio usuário.",
            "Avaliação periódica de vulnerabilidades.",
          ],
        },
        {
          heading: "Incidentes de segurança",
          body: "Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a ANPD e os titulares afetados em prazo razoável, conforme Art. 48 da LGPD e regulamentação da ANPD.",
        },
        {
          heading: "Crianças e adolescentes",
          body: "A Plataforma não se destina a menores de 18 anos. Caso identifiquemos cadastro indevido, a conta será suspensa e os dados eliminados, salvo obrigação legal de retenção. O tratamento de dados de crianças e adolescentes, quando autorizado, observará o Art. 14 da LGPD e o melhor interesse do menor.",
        },
        {
          heading: "Cookies e tecnologias semelhantes",
          body: "Detalhes em nossa Política de Cookies. Você pode configurar suas preferências a qualquer momento pelo banner de cookies ou pelo painel 'Privacidade e segurança'.",
        },
        {
          heading: "Alterações desta Política",
          body: "Esta Política pode ser atualizada para refletir mudanças legais, regulatórias ou de produto. Versionamos cada alteração e indicamos a data de vigência. Mudanças materiais serão comunicadas com antecedência mínima de 30 dias.",
        },
        {
          heading: "Como falar conosco",
          body: "Para dúvidas, solicitações de direitos ou denúncias, fale com nosso Encarregado de Dados (DPO) pelo e-mail abaixo. Você também pode acionar a ANPD (https://www.gov.br/anpd) caso entenda que seus direitos não foram atendidos.",
        },
      ],
    }}
  />
);

export default Privacidade;
