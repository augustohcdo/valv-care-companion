import { describe, it, expect } from "vitest";
import {
  montarResumo,
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

  it("contas aguardando confirmação só aparecem quando existem", () => {
    expect(montarResumo(base, emDia).corpo).not.toContain("aguardando confirmação");
    expect(montarResumo({ ...base, contas_pendentes: 4 }, emDia).corpo)
      .toContain("4 aguardando confirmação");
  });
});
