/**
 * O texto do resumo semanal do administrador.
 *
 * Função pura, separada do envio, porque é a parte que dá para provar: um
 * e-mail que descreve errado o que aconteceu é pior que e-mail nenhum — foi
 * exatamente essa a família de defeitos que esta base acumulou (o backup que
 * dizia "22 tabelas, 0 falhas" sem dizer 22 de quantas; o resumo que respondia
 * "0 enviados" quando na verdade nunca conseguia enviar).
 *
 * Duas regras que o texto respeita e os testes cobram:
 *
 * 1. **O que precisa de ação vem primeiro.** Um resumo que abre com números
 *    bonitos e esconde "pedido de LGPD vencido" no rodapé treina quem recebe a
 *    ignorá-lo. Se não há nada pendente, o e-mail diz isso com todas as letras
 *    em vez de omitir a seção — "nada pendente" é informação.
 * 2. **Cada número diz o que mede.** Audiência é tela aberta e sessão de
 *    navegador, nunca "visitante": o contador não identifica ninguém, então
 *    não sabe dizer quantas pessoas são.
 */
export type Metricas = {
  medicos: number; medicos_7d: number; medicos_30d: number;
  pacientes: number; pacientes_7d: number; pacientes_30d: number;
  casos: number; casos_7d: number; casos_30d: number;
  contas_confirmadas: number; contas_pendentes: number;
  views_7d: number; visitas_7d: number;
  views_30d: number; visitas_30d: number;
  erros_7d: number; erros_ocorrencias_7d: number;
  dpo_abertos: number; dpo_vencidos: number; dpo_vence_3d: number;
  documentos_ausentes: number; arquivos_orfaos: number;
};

export type SaudeTarefa = {
  job: string;
  label: string;
  /** Dias desde a última execução bem sucedida; `null` = nunca concluiu. */
  diasDesdeSucesso: number | null;
  limiteDias: number;
};

export type Resumo = {
  assunto: string;
  corpo: string;
  /** Uma linha para a notificação no app. */
  resumoCurto: string;
  /** Quantos itens exigem ação — o que decide o tom do assunto. */
  pendencias: number;
};

const cresc = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function montarResumo(m: Metricas, tarefas: SaudeTarefa[]): Resumo {
  const atrasadas = tarefas.filter(
    (t) => t.diasDesdeSucesso === null || t.diasDesdeSucesso > t.limiteDias,
  );

  const acoes: string[] = [];
  if (m.dpo_vencidos > 0) {
    acoes.push(
      `${m.dpo_vencidos} pedido(s) de LGPD FORA DO PRAZO — o prazo legal é de 15 dias corridos.`,
    );
  }
  if (m.dpo_vence_3d > 0) {
    acoes.push(`${m.dpo_vence_3d} pedido(s) de LGPD vencem nos próximos 3 dias.`);
  }
  if (m.documentos_ausentes > 0) {
    // Um documento que consta no prontuário e não abre é falha clínica, não
    // estatística: o médico só descobre no momento em que precisa do exame.
    acoes.push(
      `${m.documentos_ausentes} documento(s) constam no prontuário mas o arquivo não existe mais.`,
    );
  }
  for (const t of atrasadas) {
    acoes.push(
      t.diasDesdeSucesso === null
        ? `${t.label}: nunca concluiu com sucesso.`
        : `${t.label}: sem execução bem sucedida há ${t.diasDesdeSucesso} dias (limite: ${t.limiteDias}).`,
    );
  }

  const linhas: string[] = [];

  linhas.push(
    acoes.length ? "PRECISA DA SUA ATENÇÃO" : "Nada pendente nesta semana.",
    "",
  );
  if (acoes.length) {
    linhas.push(...acoes.map((a) => `• ${a}`), "");
  }

  linhas.push(
    "CADASTROS",
    "",
    `• Médicos: ${m.medicos} (${cresc(m.medicos_7d)} na semana, ${cresc(m.medicos_30d)} em 30 dias)`,
    `• Pacientes: ${m.pacientes} (${cresc(m.pacientes_7d)} na semana, ${cresc(m.pacientes_30d)} em 30 dias)`,
    `• Casos clínicos: ${m.casos} (${cresc(m.casos_7d)} na semana, ${cresc(m.casos_30d)} em 30 dias)`,
    `• Contas com e-mail confirmado: ${m.contas_confirmadas}` +
      (m.contas_pendentes > 0 ? ` · ${m.contas_pendentes} aguardando confirmação` : ""),
    "",
    "AUDIÊNCIA DO SITE",
    "",
    `• Telas abertas na semana: ${m.views_7d} (30 dias: ${m.views_30d})`,
    `• Sessões de navegador na semana: ${m.visitas_7d} (30 dias: ${m.visitas_30d})`,
    "",
    "Não são visitantes únicos: a contagem não usa cookie, IP nem identificador,",
    "então quem volta outro dia conta como uma nova sessão.",
    "",
    "SAÚDE DO SISTEMA",
    "",
    m.erros_7d === 0
      ? "• Nenhum erro registrado na semana."
      : `• ${m.erros_7d} erro(s) distinto(s) na semana, ${m.erros_ocorrencias_7d} ocorrência(s) no total.`,
  );

  for (const t of tarefas) {
    linhas.push(
      t.diasDesdeSucesso === null
        ? `• ${t.label}: nunca concluiu`
        : `• ${t.label}: última execução bem sucedida há ${t.diasDesdeSucesso} dia(s)`,
    );
  }

  linhas.push(
    "",
    m.dpo_abertos === 0
      ? "• Nenhum pedido de LGPD em aberto."
      : `• ${m.dpo_abertos} pedido(s) de LGPD em aberto.`,
    // Arquivo sem linha é rastro de upload cujo registro falhou. Informativo:
    // não some nada do prontuário, só ocupa espaço.
    ...(m.arquivos_orfaos > 0
      ? [`• ${m.arquivos_orfaos} arquivo(s) no storage sem registro correspondente.`]
      : []),
    "",
    "Painel: https://valvepath.com.br/app/admin/erros",
    "Fila de LGPD: https://valvepath.com.br/app/admin/dpo",
    "",
    "ValvePath — resumo semanal automático.",
  );

  // O assunto precisa distinguir a semana tranquila da semana com pendência;
  // um assunto sempre igual vira e-mail que ninguém abre.
  const assunto = acoes.length
    ? `[ValvePath] Resumo semanal — ${acoes.length} item(ns) pedindo atenção`
    : "[ValvePath] Resumo semanal — tudo em dia";

  const resumoCurto = acoes.length
    ? `${acoes.length} item(ns) pedindo atenção · ${cresc(m.medicos_7d + m.pacientes_7d)} cadastro(s) na semana`
    : `Tudo em dia · ${cresc(m.medicos_7d + m.pacientes_7d)} cadastro(s) na semana`;

  return { assunto, corpo: linhas.join("\n"), resumoCurto, pendencias: acoes.length };
}
