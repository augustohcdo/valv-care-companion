import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * A tela que dizia "Suas informações foram salvas" sem ter salvado nada.
 *
 * ## O defeito
 *
 * `handleSave` gravava em `profiles` e em `doctors` conferindo só o `error`:
 *
 *     const { error: dErr } = await supabase.from("doctors").update({…});
 *     if (dErr) throw dErr;
 *     …
 *     toast({ title: "Perfil atualizado", description: "Suas informações foram salvas." });
 *
 * Só que `error` não é como a recusa chega num UPDATE. Quando a RLS não alcança
 * a linha — ou quando a linha não existe —, o PostgREST responde **200 com
 * `error: null` e zero linhas**. O `if (dErr)` não dispara, o toast sai, o
 * médico recarrega e o formulário volta vazio. Sem explicação nenhuma.
 *
 * ## E o estado é alcançável de propósito, não hipotético
 *
 * O gatilho de cadastro só cria a linha de `doctors` quando o CRM vem nos
 * metadados:
 *
 *     IF v_account_type = 'medico' AND v_meta->>'crm' IS NOT NULL THEN
 *       INSERT INTO public.doctors (…)
 *
 * E `admin_definir_papel(u, 'medico', true)` concede o papel sem criar linha
 * nenhuma — é o que a tela de administração faz ao promover um paciente a
 * médico. Nesse estado `useDoctor()` devolve `null` (não erro), a tela abre o
 * formulário, e o médico **não tem como registrar o próprio CRM**: cada
 * tentativa responde "salvas".
 *
 * A política `"Doctor inserts own record"` existe para este caso desde o
 * primeiro dia — exige `has_role(auth.uid(), 'medico')`, que esse médico tem.
 * O que faltava era a tela usá-la.
 *
 * ## Por que estes quatro testes
 *
 * Esta tela não tinha teste nenhum, e o ramo de INSERT é a coisa mais nova
 * daqui: ele roda só quando `doctor === null`, que é justamente o estado que
 * ninguém reproduz à mão.
 */

const PROFILE = { user_id: "u1", full_name: "Dra. Ana", phone: "11999990000" };
const DOCTOR = {
  id: "d1", user_id: "u1", crm: "123456", crm_uf: "SP", specialty: "Cardiologia",
  rqe: "", institution: "HC", city: "São Paulo", bio: "", verified: false,
  no_diretorio: true, aceita_novos_pacientes: true,
};

let doutor: any = DOCTOR;
let erroDoDoutor: any = null;
/** Quantas linhas cada tabela devolve — é por aqui que a recusa é encenada. */
const linhasAfetadas: Record<string, number> = { profiles: 1, doctors: 1 };

const updateSpy = vi.fn();
const insertSpy = vi.fn();

/**
 * Resultado de escrita no formato do cliente real: dá para aguardar direto ou
 * encadear `.select(...)`. Os dois são necessários e **diferentes** — sem
 * `.select(...)` não vem `data`. Modelando os dois iguais, a conferência de
 * linhas passaria sem ninguém ter pedido as linhas, e o teste ficaria verde
 * sobre nada.
 */
function escrita(resultado: { error: { message: string } | null }, afetadas = 1) {
  const p: any = Promise.resolve(resultado);
  p.select = () =>
    Promise.resolve({
      data: resultado.error ? [] : Array.from({ length: afetadas }, () => ({ id: "r" })),
      error: resultado.error,
    });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: any) => ({
        eq: () => {
          updateSpy(table, values);
          return escrita({ error: null }, linhasAfetadas[table] ?? 1);
        },
      }),
      insert: (values: any) => {
        insertSpy(table, values);
        return escrita({ error: null }, linhasAfetadas[table] ?? 1);
      },
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    profile: PROFILE,
    refreshProfile: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/useDoctor", () => ({
  doctorKey: (id?: string) => ["doctor", id],
  useDoctor: () => ({ data: doutor, isLoading: false, error: erroDoDoutor }),
}));

const toastDaTela = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({ toast: (...a: any[]) => toastDaTela(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MedicoPerfil from "./MedicoPerfil";
import { toast as sonner } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

/** O título do toast de confirmação, como a tela o escreve. */
const confirmou = () =>
  toastDaTela.mock.calls.some(([arg]) => arg?.title === "Perfil atualizado");

describe("MedicoPerfil — salvar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doutor = DOCTOR;
    erroDoDoutor = null;
    linhasAfetadas.profiles = 1;
    linhasAfetadas.doctors = 1;
  });

  it("médico com registro: grava por UPDATE e só então confirma", async () => {
    render(<MedicoPerfil />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("CRM")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(confirmou()).toBe(true));
    const tabelas = updateSpy.mock.calls.map(([t]) => t);
    expect(tabelas).toContain("profiles");
    expect(tabelas).toContain("doctors");
    expect(insertSpy, "criou linha nova havendo registro").not.toHaveBeenCalled();

    // As nove colunas que o grant de `doctors` libera — nem uma a mais:
    // `verified` fora, porque quem a marca é o `admin_verificar_medico`.
    const [, valores] = updateSpy.mock.calls.find(([t]) => t === "doctors")!;
    expect(Object.keys(valores).sort()).toEqual([
      "aceita_novos_pacientes", "bio", "city", "crm", "crm_uf",
      "institution", "no_diretorio", "rqe", "specialty",
    ]);
    expect(valores).not.toHaveProperty("verified");
  });

  it("médico SEM registro: cria a linha em vez de atualizar o nada", async () => {
    /**
     * O ramo novo, e o conserto do defeito real. Antes daqui o UPDATE acertava
     * zero linhas, o `if (dErr)` não disparava e a tela confirmava.
     */
    doutor = null;
    render(<MedicoPerfil />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("CRM")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("CRM"), { target: { value: "654321" } });
    fireEvent.change(screen.getByLabelText("Especialidade"), { target: { value: "Cirurgia cardíaca" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(insertSpy).toHaveBeenCalled());
    const [tabela, valores] = insertSpy.mock.calls[0];
    expect(tabela).toBe("doctors");
    // `user_id` é o que a política `"Doctor inserts own record"` confere:
    // `auth.uid() = user_id AND has_role(auth.uid(), 'medico')`.
    expect(valores).toMatchObject({
      user_id: "u1", crm: "654321", crm_uf: "SP", specialty: "Cirurgia cardíaca",
    });
    expect(
      updateSpy.mock.calls.map(([t]) => t),
      "tentou atualizar `doctors` sem haver linha — é o defeito, não o conserto",
    ).not.toContain("doctors");
    await waitFor(() => expect(confirmou()).toBe(true));
  });

  it("zero linhas no UPDATE: NÃO diz que salvou", async () => {
    /**
     * A inversão do defeito, no nível da tela. Com `error: null` e zero linhas
     * — a forma exata como a RLS recusa um UPDATE —, a confirmação não pode
     * sair. É este teste que reprova se alguém tirar o `.select("id")` ou
     * trocar o `aplicarEmSilencio` por um `await` cru.
     */
    linhasAfetadas.doctors = 0;
    render(<MedicoPerfil />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("CRM")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(sonner.error).toHaveBeenCalled());
    expect(
      confirmou(),
      'disse "Perfil atualizado" sobre zero linhas — é exatamente o defeito',
    ).toBe(false);
    expect(sonner.error).toHaveBeenCalledWith(
      "Não foi possível salvar o perfil profissional",
      { description: expect.stringContaining("permissão") },
    );
  });

  it("CRM vazio não vira linha de CRM vazio", async () => {
    /**
     * `crm`, `crm_uf` e `specialty` são NOT NULL em `doctors`, e o Postgres
     * aceita string vazia: sem esta trava o médico apagava o próprio CRM e lia
     * "salvas". No ramo de INSERT é pior — uma linha de CRM vazio ocuparia o
     * `UNIQUE (crm, crm_uf)` e a próxima tentativa falharia por outro motivo.
     */
    render(<MedicoPerfil />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("CRM")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("CRM"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(toastDaTela).toHaveBeenCalled());
    expect(updateSpy, "gravou com CRM vazio").not.toHaveBeenCalled();
    expect(insertSpy, "gravou com CRM vazio").not.toHaveBeenCalled();
    expect(confirmou()).toBe(false);
  });
});
