import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { aplicar } from "./mutate";
import { toast } from "sonner";

describe("aplicar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("escrita que passou: anuncia sucesso e libera o que vem depois", async () => {
    const ok = await aplicar(Promise.resolve({ error: null }), {
      sucesso: "Exame removido",
      falha: "Não foi possível remover o exame",
    });
    expect(ok).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Exame removido");
    expect(toast.error).not.toHaveBeenCalled();
  });

  // A forma de falha que NÃO é `error`, e que eu só descobri testando contra o
  // banco de produção: quando a RLS recusa um UPDATE, o PostgREST responde 200
  // com `error: null` e zero linhas. Conferir só o `error` deixaria passar
  // justamente a causa mais provável — o médico mexendo no caso de outro.
  it("zero linhas alteradas é falha, mesmo sem erro", async () => {
    const ok = await aplicar(Promise.resolve({ error: null, data: [] }), {
      sucesso: "Exame removido",
      falha: "Não foi possível remover o exame",
    });
    expect(ok).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Não foi possível remover o exame", {
      description: expect.stringContaining("permissão"),
    });
  });

  it("linha alterada com data preenchida é sucesso", async () => {
    const ok = await aplicar(Promise.resolve({ error: null, data: [{ id: "e1" }] }), {
      sucesso: "Exame removido",
      falha: "Não foi possível remover o exame",
    });
    expect(ok).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Exame removido");
  });

  // O ponto do helper: uma recusa de RLS não pode virar "removido" na tela nem
  // liberar a linha de auditoria que vem logo depois.
  it("escrita recusada: não anuncia sucesso e devolve falso", async () => {
    const ok = await aplicar(
      Promise.resolve({ error: { message: "new row violates row-level security policy" } }),
      { sucesso: "Exame removido", falha: "Não foi possível remover o exame" },
    );
    expect(ok).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível remover o exame",
      // A mensagem do banco é técnica demais para virar título, mas sem ela
      // ninguém distingue "sem permissão" de "sem internet".
      { description: "new row violates row-level security policy" },
    );
  });
});
