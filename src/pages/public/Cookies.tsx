import LegalPage from "./LegalPage";

const Cookies = () => (
  <LegalPage
    doc={{
      eyebrow: "Documentos legais",
      title: "Política de Cookies",
      description: "Quais tecnologias usamos para lembrar suas preferências, manter sua sessão e melhorar a Plataforma — em conformidade com a LGPD e o Guia da ANPD sobre cookies.",
      effectiveDate: "01 de maio de 2026",
      version: "1.0",
      contact: { dpoEmail: "dpo@valvepath.com" },
      sections: [
        {
          heading: "O que são cookies",
          body: "Cookies são pequenos arquivos armazenados no seu dispositivo que permitem reconhecer o navegador entre acessos. Tecnologias semelhantes incluem localStorage, sessionStorage e pixels. Quando essas tecnologias coletam ou tratam dados pessoais, aplicamos a LGPD.",
        },
        {
          heading: "Categorias de cookies que utilizamos",
          subsections: [
            { heading: "Estritamente necessários", body: "Indispensáveis para autenticação, segurança e funcionamento básico (token de sessão, prevenção a CSRF). Base legal: execução de contrato e legítimo interesse. Não exigem consentimento e não podem ser desativados." },
            { heading: "Funcionais", body: "Lembram suas preferências (idioma, modo escuro, filtros salvos). Base legal: consentimento. Podem ser desativados sem impedir o uso da Plataforma." },
            { heading: "Analíticos", body: "Ajudam a entender, de forma agregada e quando possível anonimizada, como os usuários interagem com a Plataforma para melhorias de UX. Base legal: consentimento. Podem ser desativados a qualquer momento." },
            { heading: "Publicidade", body: "Atualmente não utilizamos cookies de publicidade direcionada." },
          ],
        },
        {
          heading: "Como gerenciar",
          body: [
            "Use o banner de cookies ao acessar a Plataforma para aceitar, recusar ou personalizar.",
            "Acesse 'Privacidade e segurança' dentro da sua conta para alterar consentimentos a qualquer momento.",
            "Configure também o seu navegador para bloquear ou apagar cookies — note que isso pode afetar a navegação.",
          ],
        },
        {
          heading: "Retenção",
          body: "Cookies de sessão expiram ao fechar o navegador. Cookies persistentes têm duração máxima de 12 meses, sendo renovados apenas se você continuar utilizando a Plataforma.",
        },
        {
          heading: "Terceiros",
          body: "Quando utilizarmos provedores de análise ou monitoramento de erros, listaremos aqui o nome do provedor, finalidade, dados acessados e país de processamento. Atualmente: nenhum provedor de analytics de terceiros está ativo nesta versão.",
        },
        {
          heading: "Atualizações",
          body: "Esta Política pode ser atualizada. A data de vigência é indicada no topo. Mudanças materiais serão comunicadas no banner de cookies, exigindo nova manifestação de consentimento.",
        },
      ],
    }}
  />
);

export default Cookies;
