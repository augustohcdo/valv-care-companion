import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { aplicar, aplicarEmSilencio } from "./mutate";
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

/**
 * O irmão silencioso — e o que NÃO pode ser silencioso nele.
 *
 * `aplicarEmSilencio` existe para dois casos em que o toast de sucesso é ruído:
 * a escrita que é um passo (`MedicoPerfil` grava em `profiles` e em `doctors` e
 * dá UMA confirmação no fim) e a escrita repetitiva (marcar "tomei" em cada
 * horário são três a seis toques por dia).
 *
 * O risco do nome é ler "em silêncio" como "sem relatar nada". Os dois sítios
 * que ele passou a atender eram, antes, `await` cru — `logTake` não lia nem o
 * `error`. Se este helper calar na falha também, ele terá trocado um silêncio
 * por outro e dado ao defeito um nome respeitável.
 */
describe("aplicarEmSilencio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sucesso: devolve verdadeiro e NÃO anuncia nada", () => {
    return aplicarEmSilencio(Promise.resolve({ error: null, data: [{ id: "r1" }] }), {
      falha: "Não foi possível registrar esta dose",
    }).then((ok) => {
      expect(ok).toBe(true);
      expect(toast.success, "anunciou sucesso — é justamente o ruído que ele evita")
        .not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it("zero linhas: a MESMA conferência do `aplicar`, e ela reclama", async () => {
    // A forma de falha que não é `error`: a RLS recusando um UPDATE devolve 200
    // com `error: null` e zero linhas. "Em silêncio" vale para o sucesso.
    const ok = await aplicarEmSilencio(Promise.resolve({ error: null, data: [] }), {
      falha: "Não foi possível registrar esta dose",
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Não foi possível registrar esta dose", {
      description: expect.stringContaining("permissão"),
    });
  });

  it("erro: reclama com a mensagem do banco atrás", async () => {
    const ok = await aplicarEmSilencio(
      Promise.resolve({ error: { message: "permission denied for table doctors" } }),
      { falha: "Não foi possível salvar o perfil profissional" },
    );
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar o perfil profissional", {
      description: "permission denied for table doctors",
    });
  });

  it("os dois pontos de entrada decidem igual — só o anúncio difere", async () => {
    /**
     * A propriedade que mantém os dois honestos: o veredito é o mesmo, e o que
     * muda é só o toast de sucesso. Duas cópias da conferência divergiriam na
     * primeira vez que alguém consertasse uma delas — foi assim que dez lugares
     * desta base conferiam `error` e nenhum conferia linhas.
     */
    const casos = [
      { error: null, data: [{ id: "r1" }] },
      { error: null, data: [] },
      { error: { message: "boom" } },
      { error: null }, // sem `.select(...)`: não dá para saber, segue como sucesso
    ];
    for (const caso of casos) {
      vi.clearAllMocks();
      const comAnuncio = await aplicar(Promise.resolve(caso), { sucesso: "s", falha: "f" });
      vi.clearAllMocks();
      const silencioso = await aplicarEmSilencio(Promise.resolve(caso), { falha: "f" });
      expect(
        silencioso,
        `vereditos diferentes para ${JSON.stringify(caso)} — a conferência se duplicou`,
      ).toBe(comAnuncio);
    }
  });
});
