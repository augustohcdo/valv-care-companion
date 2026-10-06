import { describe, it, expect } from "vitest";
import {
  montarResumo,
  vereditoDaEntrega,
  type Metricas,
  type SaudeTarefa,
} from "../../supabase/functions/_shared/adminDigest";

/**
 * O resumo semanal é a única coisa que vai atrás do administrador em vez de
 * esperar que ele abra o painel. Se ele descrever errado o que aconteceu, é
 * pior que não existir — quem recebe passa a decidir com base num número que
 * mede outra coisa.
 */

const base: Metricas = {
  medicos: 10, medicos_7d: 0, medicos_30d: 0,
  pacientes: 20, pacientes_7d: 0, pacientes_30d: 0,
  casos: 30, casos_7d: 0, casos_30d: 0,
  contas_confirmadas: 28, contas_pendentes: 0,
  views_7d: 0, visitas_7d: 0, views_30d: 0, visitas_30d: 0,
  erros_7d: 0, erros_ocorrencias_7d: 0,
  dpo_abertos: 0, dpo_vencidos: 0, dpo_vence_3d: 0,
  documentos_ausentes: 0, arquivos_orfaos: 0,
};

const emDia: SaudeTarefa[] = [
  { job: "weekly-export", label: "Backup semanal", diasDesdeSucesso: 1, limiteDias: 8 },
];

describe("resumo semanal do administrador", () => {
  it("semana tranquila diz que está tudo em dia, sem inventar urgência", () => {
    const r = montarResumo(base, emDia);
    expect(r.pendencias).toBe(0);
    expect(r.assunto).toContain("tudo em dia");
    expect(r.corpo).toContain("Nada pendente nesta semana.");
    expect(r.corpo).not.toContain("PRECISA DA SUA ATENÇÃO");
  });

  // Prazo legal correndo é a informação mais cara do e-mail. Enterrá-la no
  // rodapé, embaixo de números bonitos, é o mesmo que não mandar.
  it("pedido de LGPD vencido abre o e-mail e muda o assunto", () => {
    const r = montarResumo({ ...base, dpo_abertos: 2, dpo_vencidos: 1 }, emDia);
    expect(r.pendencias).toBe(1);
    expect(r.assunto).toContain("pedindo atenção");
    const posAtencao = r.corpo.indexOf("PRECISA DA SUA ATENÇÃO");
    const posCadastros = r.corpo.indexOf("CADASTROS");
    expect(posAtencao).toBeGreaterThan(-1);
    expect(posAtencao).toBeLessThan(posCadastros);
    expect(r.corpo).toContain("FORA DO PRAZO");
  });

  it("pedido perto do prazo aparece antes de vencer", () => {
    const r = montarResumo({ ...base, dpo_abertos: 1, dpo_vence_3d: 1 }, emDia);
    expect(r.pendencias).toBe(1);
    expect(r.corpo).toContain("vencem nos próximos 3 dias");
  });

  it("tarefa atrasada e tarefa que nunca rodou viram pendência, cada uma com seu texto", () => {
    const r = montarResumo(base, [
      { job: "weekly-export", label: "Backup semanal", diasDesdeSucesso: 20, limiteDias: 8 },
      { job: "welcome-email", label: "Boas-vindas", diasDesdeSucesso: null, limiteDias: 2 },
    ]);
    expect(r.pendencias).toBe(2);
    expect(r.corpo).toContain("sem execução bem sucedida há 20 dias");
    expect(r.corpo).toContain("Boas-vindas: nunca concluiu com sucesso.");
  });

  it("tarefa dentro do prazo não vira pendência", () => {
    const r = montarResumo(base, [
      { job: "weekly-export", label: "Backup semanal", diasDesdeSucesso: 8, limiteDias: 8 },
    ]);
    expect(r.pendencias).toBe(0);
  });

  // O contador não identifica ninguém, então não sabe dizer quantas pessoas
  // são. Chamar sessão de "visitante" seria um número verdadeiro com o nome
  // errado — o defeito mais recorrente desta base.
  it("chama a audiência pelo nome certo e explica o limite", () => {
    const r = montarResumo({ ...base, views_7d: 120, visitas_7d: 40 }, emDia);
    expect(r.corpo).toContain("Telas abertas na semana: 120");
    expect(r.corpo).toContain("Sessões de navegador na semana: 40");
    expect(r.corpo).toContain("Não são visitantes únicos");
    expect(r.corpo).not.toMatch(/\bvisitantes: /i);
  });

  it("mostra crescimento com sinal e distingue semana de 30 dias", () => {
    const r = montarResumo(
      { ...base, medicos_7d: 3, medicos_30d: 11, pacientes_7d: 5, pacientes_30d: 9 },
      emDia,
    );
    expect(r.corpo).toContain("Médicos: 10 (+3 na semana, +11 em 30 dias)");
    expect(r.corpo).toContain("Pacientes: 20 (+5 na semana, +9 em 30 dias)");
    expect(r.resumoCurto).toContain("+8 cadastro(s) na semana");
  });

  it("semana sem erro diz isso, em vez de mostrar um zero solto", () => {
    expect(montarResumo(base, emDia).corpo).toContain("Nenhum erro registrado na semana.");
    const comErro = montarResumo({ ...base, erros_7d: 2, erros_ocorrencias_7d: 37 }, emDia);
    expect(comErro.corpo).toContain("2 erro(s) distinto(s) na semana, 37 ocorrência(s)");
  });

  // Erro é informação, não pendência: quem decide se é grave é quem lê. Só o
  // que tem prazo ou parou de funcionar entra em "precisa da sua atenção".
  it("erro na semana não é tratado como item de ação", () => {
    expect(montarResumo({ ...base, erros_7d: 9 }, emDia).pendencias).toBe(0);
  });

  // Um exame que consta no prontuário e não abre só é descoberto pelo médico
  // no momento em que ele precisa do exame. Tem que chegar antes disso.
  it("documento vivo sem arquivo é pendência, e abre o e-mail", () => {
    const r = montarResumo({ ...base, documentos_ausentes: 2 }, emDia);
    expect(r.pendencias).toBe(1);
    expect(r.corpo).toContain("2 documento(s) constam no prontuário mas o arquivo não existe mais");
    const posAtencao = r.corpo.indexOf("PRECISA DA SUA ATENÇÃO");
    expect(posAtencao).toBeGreaterThan(-1);
    expect(posAtencao).toBeLessThan(r.corpo.indexOf("CADASTROS"));
  });

  // Arquivo sem linha não some nada do prontuário — só ocupa espaço. Tratar
  // como urgência gastaria a atenção que o caso acima precisa.
  it("arquivo órfão é informativo, não pendência", () => {
    const r = montarResumo({ ...base, arquivos_orfaos: 3 }, emDia);
    expect(r.pendencias).toBe(0);
    expect(r.corpo).toContain("3 arquivo(s) no storage sem registro correspondente");
  });

  it("sem inconsistência, nenhuma das duas linhas aparece", () => {
    const r = montarResumo(base, emDia);
    expect(r.corpo).not.toContain("sem registro correspondente");
    expect(r.corpo).not.toContain("o arquivo não existe mais");
  });

  it("contas aguardando confirmação só aparecem quando existem", () => {
    expect(montarResumo(base, emDia).corpo).not.toContain("aguardando confirmação");
    expect(montarResumo({ ...base, contas_pendentes: 4 }, emDia).corpo)
      .toContain("4 aguardando confirmação");
  });
});

describe("o resumo chegou, ou não — o `ok` de `job_runs`", () => {
  /**
   * Era `ok: true` cravado, com `itemsFailed` contando as notificações que não
   * entraram na mesma chamada. `job_runs.ok` é o campo por onde se sabe se a
   * tarefa fez o trabalho, e os dois leitores filtram por `.eq("ok", true)` sem
   * olhar `items_failed` — então um resumo que não chegou a ninguém deixava uma
   * linha de SUCESSO, e o `job-watchdog` a lia como prova de que o canal de
   * aviso do administrador está de pé.
   *
   * Cada caso abaixo é um estado que de fato acontece. Os dois últimos são os
   * que NÃO podem alarmar: alarme falso no semanal é como se ensina alguém a
   * não ler o semanal, e aí o alarme verdadeiro morre junto.
   */
  it("entregou a todos: ok", () => {
    const v = vereditoDaEntrega({ destinatarios: 3, notificados: 3, motivoDoEmail: null });
    expect(v).toEqual({ ok: true, erro: null });
  });

  it("nenhuma notificação entrou e o e-mail não saiu: NÃO ok, e diz as duas coisas", () => {
    const v = vereditoDaEntrega({
      destinatarios: 3, notificados: 0,
      motivoDoEmail: "send_failed", detalheDoEmail: "422 domain not verified",
    });
    expect(v.ok).toBe(false);
    expect(v.erro).toContain("3 de 3 notificações não entraram");
    expect(v.erro).toContain("422 domain not verified");
  });

  it("uma única notificação faltando já é falha", () => {
    // Zero tolerância, como os outros cinco `recordJobRun` desta base fazem
    // (`ok: failed === 0`). Um administrador que não recebeu é um administrador
    // que decide sem a informação.
    const v = vereditoDaEntrega({ destinatarios: 3, notificados: 2, motivoDoEmail: null });
    expect(v.ok).toBe(false);
    expect(v.erro).toContain("1 de 3");
  });

  it("notificações entraram mas o provedor recusou o e-mail: NÃO ok", () => {
    // O e-mail é o canal que atravessa — quem não abrir o app não soube.
    const v = vereditoDaEntrega({ destinatarios: 2, notificados: 2, motivoDoEmail: "send_failed" });
    expect(v.ok).toBe(false);
    expect(v.erro).toContain("e-mail não saiu");
    expect(v.erro, "não há notificação faltando; não invente uma").not.toContain("notificações");
  });

  it("sem administrador cadastrado: ok, porque não é falha desta tarefa", () => {
    // Estado do sistema, não defeito. Alarmar aqui esconderia que a tarefa
    // está funcionando.
    const v = vereditoDaEntrega({ destinatarios: 0, notificados: 0, motivoDoEmail: "sem_destinatario" });
    expect(v).toEqual({ ok: true, erro: null });
  });

  it("ambiente sem `RESEND_API_KEY`: ok, porque as notificações no app entraram", () => {
    // `not_configured` é ambiente, não falha de execução. Semanalmente
    // alarmando sobre uma chave que ninguém pretende configurar, o e-mail do
    // vigia vira ruído. O motivo continua visível em `details.email_motivo`.
    const v = vereditoDaEntrega({ destinatarios: 2, notificados: 2, motivoDoEmail: "not_configured" });
    expect(v).toEqual({ ok: true, erro: null });
  });

  it("mas sem a chave E com notificação faltando: NÃO ok", () => {
    // O que absolve o `not_configured` é justamente as notificações terem
    // entrado. Sem elas, ninguém soube de nada.
    const v = vereditoDaEntrega({ destinatarios: 2, notificados: 1, motivoDoEmail: "not_configured" });
    expect(v.ok).toBe(false);
  });
});
