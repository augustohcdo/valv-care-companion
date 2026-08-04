import { describe, it, expect, vi, beforeEach } from "vitest";

let insertResult: { error: { message: string } | null } = { error: null };
const insertSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => ({
      insert: (values: unknown) => {
        insertSpy(values);
        return Promise.resolve(insertResult);
      },
    }),
  },
}));
vi.mock("@/lib/reportError", () => ({ reportError: vi.fn() }));

import { logAudit } from "./auditLog";
import { reportError } from "@/lib/reportError";

describe("logAudit", () => {
  beforeEach(() => {
    insertResult = { error: null };
    vi.clearAllMocks();
  });

  it("grava a ação com quem fez, o que e onde", async () => {
    const gravou = await logAudit("exam_deleted", "case_exams", "e1", { case_id: "c1" });
    expect(gravou).toBe(true);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        action: "exam_deleted",
        target_table: "case_exams",
        target_id: "e1",
      }),
    );
    expect(reportError).not.toHaveBeenCalled();
  });

  // O defeito que este teste tranca: o cliente do Supabase devolve `{ error }`
  // em vez de lançar, então o try/catch antigo nunca via nada. A trilha de
  // auditoria de um prontuário podia parar de receber linhas em silêncio.
  it("gravação recusada não some: vira erro reportado", async () => {
    insertResult = { error: { message: "permission denied for table audit_logs" } };
    const gravou = await logAudit("exam_deleted", "case_exams", "e1");
    expect(gravou).toBe(false);
    expect(reportError).toHaveBeenCalledTimes(1);
    const reportado = (reportError as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0];
    expect(String(reportado)).toContain("auditoria não gravada");
    expect(String(reportado)).toContain("permission denied");
  });

  // Continua sem lançar: a ação que estava sendo registrada já aconteceu, e
  // derrubá-la depois do fato não desfaz nada — só quebra a tela.
  it("nunca lança, mesmo quando a gravação falha", async () => {
    insertResult = { error: { message: "boom" } };
    await expect(logAudit("x", "y")).resolves.toBe(false);
  });
});
