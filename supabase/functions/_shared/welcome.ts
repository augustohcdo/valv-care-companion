/**
 * Mensagens de boas-vindas por tipo de conta.
 *
 * Cada texto descreve o que a pessoa encontra de verdade no app — as telas
 * existem e estão em produção. Nada de promessa vaga: quem chega deve
 * reconhecer, no primeiro acesso, aquilo que a mensagem disse que teria.
 *
 * O tom evita duas armadilhas de produto clínico: prometer diagnóstico (a IA é
 * apoio à decisão, com o médico decidindo) e prometer ao paciente
 * interpretação do próprio caso (o conteúdo é educativo, quem interpreta é o
 * médico dele).
 *
 * CLÍNICA e HOSPITAL estão escritos e prontos, mas HOJE NÃO TÊM COMO SER
 * DISPARADOS: a tela de cadastro só oferece médico e paciente, e não existe
 * fluxo de registro de organização. Ficam aqui para o dia em que existir, e
 * para deixar explícito que não estão no ar em vez de dar a impressão de que
 * estão.
 */
export type Publico = "medico" | "paciente" | "clinica" | "hospital";

export type Boasvindas = {
  /** Título curto — vira o título da notificação no app. */
  titulo: string;
  /** Uma frase, para o sino de notificações. */
  resumo: string;
  /** Corpo do e-mail, em texto puro. */
  email: string;
  /** Para onde a notificação leva. */
  link: string;
};

const ASSINATURA = `
Precisa de ajuda? É só responder este e-mail — ele chega direto para a nossa equipe.

ValvePath — cuidado valvar organizado
https://valvepath.com.br

Este é um endereço de envio automático. Sua resposta vai para a nossa caixa de contato.`;

const RODAPE_CLINICO = `
Lembrete importante: o ValvePath é ferramenta de apoio e organização. Ele não
faz diagnóstico nem substitui a avaliação médica presencial.`;

export function boasVindas(publico: Publico, nome?: string | null): Boasvindas {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";

  switch (publico) {
    case "medico":
      return {
        titulo: "Bem-vindo ao ValvePath",
        resumo: "Sua conta está ativa. Comece cadastrando seu primeiro caso.",
        link: "/app/medico/casos/novo",
        email: `${ola}

Que bom ter você aqui. O ValvePath nasceu de uma inquietação simples: acompanhar
um paciente valvar ao longo de anos exige juntar ecocardiogramas, sintomas,
decisões e retornos que costumam viver espalhados. Aqui eles ficam no mesmo
lugar.

O que já está disponível para você:

• Casos clínicos organizados — cada paciente com sua linha do tempo, exames
  comparados lado a lado e a evolução dos parâmetros visível de uma olhada.

• Apoio à decisão baseado em diretrizes — sugestões fundamentadas em SBC,
  ACC/AHA e ESC, sempre com a fonte citada. Quem decide é você; a ferramenta
  organiza o raciocínio e mostra em que se apoiou.

• Discussão de casos com colegas — convide outro médico para um caso específico
  e conversem ali dentro, sem tirar dado clínico do ambiente protegido.

• Catálogo de próteses — modelos, tamanhos e faixas de anel, para consultar na
  hora de planejar.

• Relatórios e exportação — visão da sua coorte em PDF e Excel, para
  apresentação, auditoria ou registro próprio.

• Agenda de retornos — para que acompanhamento de anos não dependa de memória.

Um bom primeiro passo é cadastrar um caso que você já conhece bem. Em poucos
minutos dá para ver como a plataforma organiza o que você já tem na cabeça.
${RODAPE_CLINICO}
${ASSINATURA}`,
      };

    case "paciente":
      return {
        titulo: "Bem-vindo ao ValvePath",
        resumo: "Sua conta está ativa. Conheça sua jornada de cuidado.",
        link: "/app/paciente/jornada",
        email: `${ola}

Seja bem-vindo. Receber um diagnóstico de doença de válvula cardíaca costuma
vir acompanhado de muita informação difícil e de dúvidas que só aparecem depois
da consulta. O ValvePath existe para te ajudar entre uma consulta e outra.

O que você encontra aqui:

• Sua jornada de cuidado — o que já aconteceu e o que vem pela frente, em
  linguagem que dá para entender.

• Diário de sintomas — registre como se sentiu, com que esforço cansou, se
  houve falta de ar. Com o tempo isso vira um histórico que ajuda seu médico a
  enxergar o que uma consulta isolada não mostra.

• Controle de medicações — o que tomar, quando, e o registro do que já tomou.

• Conteúdo educativo — explicações sobre as valvopatias, exames e tratamentos,
  escritas para você e não para o médico.

• Seus documentos — exames e laudos guardados em um só lugar, e você escolhe o
  que compartilhar com seu médico.

• Privacidade sob seu controle — você decide o que é compartilhado e pode
  revogar quando quiser. Seus dados são seus.

Uma sugestão para começar: registre hoje como você está se sentindo. É o
primeiro ponto de uma linha que vai valer muito daqui a alguns meses.
${RODAPE_CLINICO}
${ASSINATURA}`,
      };

    case "clinica":
      return {
        titulo: "Bem-vinda ao ValvePath",
        resumo: "Conta da clínica ativa.",
        link: "/app/medico",
        email: `${ola}

Bem-vinda ao ValvePath. A partir de agora sua equipe tem um lugar comum para
acompanhar os pacientes valvares da clínica.

O que a plataforma oferece:

• Casos compartilhados entre a equipe — o acompanhamento não se perde quando um
  profissional entra de férias ou sai.

• Apoio à decisão com diretrizes citadas — SBC, ACC/AHA e ESC, com a fonte
  sempre visível.

• Relatórios da coorte — perfil dos pacientes, gravidade e desfechos, em PDF e
  Excel.

• Trilha de auditoria — quem viu e alterou cada prontuário fica registrado,
  requisito de qualquer operação clínica séria.
${RODAPE_CLINICO}
${ASSINATURA}`,
      };

    case "hospital":
      return {
        titulo: "Bem-vindo ao ValvePath",
        resumo: "Conta hospitalar ativa.",
        link: "/app/medico",
        email: `${ola}

Bem-vindo ao ValvePath. Além do acompanhamento clínico, a conta hospitalar
habilita a integração com os sistemas que vocês já usam.

O que está disponível:

• Integração FHIR — troca de dados clínicos no padrão internacional, com chave
  de API própria e escopo controlado.

• Autorização por paciente — cada troca depende de consentimento explícito do
  titular, registrado e revogável.

• Trilha de integração auditável — toda leitura e escrita fica registrada, com
  origem, horário e resultado.

• Casos e relatórios — a mesma organização clínica disponível para o corpo
  clínico da instituição.
${RODAPE_CLINICO}
${ASSINATURA}`,
      };
  }
}

/** Assunto do e-mail por público. */
export function assuntoBoasVindas(publico: Publico): string {
  return publico === "paciente"
    ? "Bem-vindo ao ValvePath — seu cuidado começa aqui"
    : "Bem-vindo ao ValvePath";
}
