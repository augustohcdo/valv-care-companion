// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Toda tabela que guarda `user_id` tem de ter um destino no encerramento.
 *
 * ## O que esta guarda pega
 *
 * Uma varredura das migrations mostrou que **14 tabelas guardam `user_id` e o
 * `encerrar_conta` tocava 5**. As outras nove ficavam com a linha intacta depois
 * de a conta ser encerrada — algumas por decisão, outras por esquecimento, e do
 * lado de fora não havia como distinguir os dois casos.
 *
 * É a mesma classe de defeito que esta sessão persegue: um estado que ninguém
 * declarou, lido como se fosse deliberado. A diferença aqui é o custo — dado
 * pessoal que sobrevive a um pedido de exclusão é violação da LGPD Art. 18, e
 * papel de acesso que sobrevive é problema de segurança.
 *
 * ## Como ela funciona
 *
 * Tabela com `user_id` precisa estar num dos dois lados: **tocada** pela função
 * de encerramento, ou **na lista de exceções com motivo escrito**. Não existe
 * terceira opção, e tabela nova quebra o teste até alguém decidir o destino dela.
 *
 * O motivo escrito não é burocracia: foi escrevendo o motivo que ficou claro que
 * "apagar ou preservar" não dava conta, e que faltava um terceiro destino —
 * anonimizar, para a linha cujo registro precisa sobreviver e cuja identificação
 * não.
 */

const DIR = "supabase/migrations";

/**
 * Tabelas que sobrevivem ao encerramento, e por quê.
 *
 * Se não dá para escrever o motivo, não é decisão — é esquecimento.
 */
const SOBREVIVEM: Record<string, string> = {
  audit_logs:
    "trilha de auditoria: é a prova do que aconteceu, inclusive do próprio encerramento",
  consent_audit_log:
    "histórico de consentimento: LGPD Art. 8º §1º exige poder demonstrar que houve consentimento",
  user_consents:
    "estado do consentimento: prova de defesa da empresa; o histórico fica no consent_audit_log",
  pseudonym_map:
    "base restrita de reidentificação do processo do DPO — apagá-la destrói a prova, não protege o titular; nasce com RLS e revoke all",
};

function migrations(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
}

/** Toda tabela criada com uma coluna `user_id`. */
function tabelasComUserId(): string[] {
  const achadas = new Set<string>();
  for (const f of migrations()) {
    const sql = readFileSync(join(DIR, f), "utf8");
    for (const m of sql.matchAll(
      /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      if (/\buser_id\b/.test(m[2])) achadas.add(m[1]);
    }
  }
  return [...achadas].sort();
}

/**
 * O corpo da versão MAIS RECENTE de `encerrar_conta`.
 *
 * A função é redefinida por `create or replace` em mais de uma migration; olhar
 * a primeira mostraria um estado que o banco não tem mais.
 */
function corpoDoEncerramento(): string {
  let corpo = "";
  for (const f of migrations()) {
    const sql = readFileSync(join(DIR, f), "utf8");
    const i = sql.toLowerCase().indexOf("create or replace function public.encerrar_conta");
    if (i >= 0) corpo = sql.slice(i);
  }
  return corpo;
}

const corpo = corpoDoEncerramento();
const tocadas = new Set(
  [...corpo.matchAll(/(?:delete\s+from|update)\s+public\.(\w+)/gi)].map((m) => m[1]),
);

describe("encerramento de conta: cobertura das tabelas", () => {
  it("achou a função e as tabelas — a varredura não está vazia", () => {
    // Contraprova: um detector que não acha nada passaria em todos os testes
    // abaixo, com o projeto inteiro correto ou inteiro quebrado.
    expect(corpo, "não achei `encerrar_conta` em migration nenhuma").toContain("encerrar_conta");
    expect(tabelasComUserId().length, "nenhuma tabela com user_id — a varredura quebrou").toBeGreaterThan(5);
    expect(tocadas.size, "a função não toca tabela nenhuma — a extração quebrou").toBeGreaterThan(3);
  });

  it("toda tabela com user_id é tocada ou tem motivo escrito para sobreviver", () => {
    const semDestino = tabelasComUserId().filter(
      (t) => !tocadas.has(t) && !(t in SOBREVIVEM),
    );
    expect(
      semDestino,
      `\nTabelas com user_id sem destino no encerramento:\n  ${semDestino.join("\n  ")}\n\n` +
        "Cada uma precisa ser apagada, anonimizada, ou entrar em SOBREVIVEM com o\n" +
        "motivo. Dado pessoal que sobrevive a um pedido de exclusão é LGPD Art. 18;\n" +
        "papel de acesso que sobrevive é problema de segurança.",
    ).toEqual([]);
  });

  it("as quatro que sobrevivem estão nomeadas, e a trilha legal está entre elas", () => {
    for (const t of ["audit_logs", "consent_audit_log"]) {
      expect(SOBREVIVEM[t], `${t} tem de sobreviver ao encerramento`).toBeTruthy();
    }
    // E nenhuma delas pode ser apagada pela função — seria contradição direta.
    for (const t of Object.keys(SOBREVIVEM)) {
      expect(
        new RegExp(`delete\\s+from\\s+public\\.${t}\\b`, "i").test(corpo),
        `${t} está em SOBREVIVEM mas a função a apaga`,
      ).toBe(false);
    }
  });

  it("o motivo de cada exceção é escrito, não um rótulo vazio", () => {
    for (const [t, motivo] of Object.entries(SOBREVIVEM)) {
      expect(motivo.length, `${t}: motivo curto demais para ser uma decisão`).toBeGreaterThan(40);
    }
  });

  it("o papel de acesso não sobrevive ao titular", () => {
    // Não é LGPD, é segurança: conta encerrada carregando `admin` é privilégio
    // órfão. Fica em teste próprio para não se perder no meio da lista.
    expect(
      /delete\s+from\s+public\.user_roles\b/i.test(corpo),
      "user_roles não é apagada no encerramento",
    ).toBe(true);
  });

  it("o que é anonimizado mantém o registro e perde a identificação", () => {
    // A distinção que motivou o terceiro destino. Se alguém trocar o `update`
    // por `delete` aqui, some a prova de que o pedido ao DPO foi atendido.
    expect(/update\s+public\.dpo_requests[\s\S]*?requester_cpf\s*=\s*null/i.test(corpo)).toBe(true);
    expect(
      /delete\s+from\s+public\.dpo_requests\b/i.test(corpo),
      "o pedido ao DPO é a prova de que o direito foi exercido — não se apaga",
    ).toBe(false);
  });
});
