import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const PATIENT = { id: "p1", user_id: "u1", linked_doctor_id: null, deleted_at: null };

/**
 * Datas relativas a HOJE, não fixas.
 *
 * Com `entry_date: "2026-07-30"` cravado, o teste seguiria verde para sempre
 * — o mock ignora filtros —, mas o registro sairia da janela de 60 dias em
 * produção sem nada acusar. Fixture que envelhece é guarda que expira sozinha.
 */
const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const ENTRIES = [
  { id: "s1", patient_id: "p1", entry_date: diasAtras(3), dyspnea: 8, fatigue: 4, chest_pain: 2, palpitations: 0, edema: true, syncope: false, orthopnea: false, weight_kg: 72, bp_systolic: 130, bp_diastolic: 80, notes: "Cansaço ao subir escada", deleted_at: null },
];

let patientRow: any = PATIENT;
let entries: any[] = [...ENTRIES];
const upsertSpy = vi.fn();
const gteSpy = vi.fn();
const updateSpy = vi.fn();


/**
 * Resultado de escrita no formato do cliente real: dá para aguardar direto ou
 * encadear `.select(...)`. Precisa dos dois porque o código passou a pedir as
 * linhas afetadas — a RLS recusa devolvendo 200 com zero linhas, não erro.
 */
function escrita(resultado: { error: { message: string } | null }, afetadas = 1) {
  const p: any = Promise.resolve(resultado);
  p.select = () =>
    Promise.resolve({
      data: resultado.error ? [] : Array.from({ length: afetadas }, (_, i) => ({ id: `r${i}` })),
      error: resultado.error,
    });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const chain: any = {
          is: () => chain,
          eq: () => chain,
          // O `gte` existe porque a consulta real filtra por DATA: a tela diz
          // "Registros (60 dias)" e antes buscava as 60 últimas LINHAS. Sem
          // este elo o encadeamento quebra — mock que não modela o cliente
          // real reprova o código certo, que é o erro que as catorze cópias do
          // `escrita()` ensinaram nesta mesma base.
          gte: (coluna: string, valor: string) => { gteSpy(coluna, valor); return chain; },
          order: () => chain,
          limit: () => Promise.resolve({ data: entries, error: null }),
          maybeSingle: () => Promise.resolve({ data: patientRow, error: null }),
        };
        return chain;
      },
      upsert: (values: any, opts: any) => {
        upsertSpy(table, values, opts);
        // Pelo `escrita()`, como o update: o cliente real encadeia `.select(...)`
        // depois do upsert, e o mock devolvia uma promessa sem ele. O teste
        // ficava VERDE e o Vitest acusava "unhandled rejection" — falso positivo
        // com aviso, que é o formato mais fácil de ignorar.
        return escrita({ error: null });
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(table, values, col, val);
          entries = entries.filter((e) => e.id !== val);
          return escrita({ error: null });
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PacienteDiario, { symptomEntriesKey } from "./PacienteDiario";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

/** Abre a aba "Histórico" (o Radix troca no mousedown, não no click). */
const openHistorico = () =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Histórico/i }));

describe("PacienteDiario", () => {
  beforeEach(() => {
    patientRow = PATIENT;
    entries = [...ENTRIES];
    upsertSpy.mockClear();
    updateSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lista os registros de sintomas no histórico", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());
    openHistorico();
    await waitFor(() =>
      expect(screen.getByText(/Cansaço ao subir escada/)).toBeInTheDocument(),
    );
  });

  it("sinaliza o registro com sintomas relevantes", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());
    openHistorico();
    // dispneia 8/10 passa do limiar de destaque
    await waitFor(() => expect(screen.getByText(/Sintomas relevantes/)).toBeInTheDocument());
  });

  it("pede para completar o perfil quando o usuário não tem registro de paciente", async () => {
    patientRow = null;
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Complete seu perfil/i)).toBeInTheDocument());
  });

  it("remover faz soft-delete e registra auditoria", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());
    openHistorico();
    await waitFor(() => expect(screen.getByText(/Cansaço ao subir escada/)).toBeInTheDocument());

    fireEvent.click(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive"))[0],
    );

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [table, values, col, val] = updateSpy.mock.calls[0];
    expect(table).toBe("symptom_entries");
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(logAudit).toHaveBeenCalledWith("symptom_entry_deleted", "symptom_entries", val);
  });

  // O upsert usa patient_id+entry_date como chave. Sem o deleted_at: null no
  // payload, registrar de novo um dia cujo registro foi apagado atualizaria a
  // linha soft-deletada — o paciente salvaria e não veria nada aparecer.
  it("o upsert limpa o deleted_at, para não reviver um registro invisível", async () => {
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Registros \(60 dias\)/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Registrar hoje|Atualizar hoje/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/i }));

    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    const [table, values, opts] = upsertSpy.mock.calls[0];
    expect(table).toBe("symptom_entries");
    expect(values.deleted_at).toBeNull();
    expect(values.patient_id).toBe("p1");
    expect(opts).toEqual({ onConflict: "patient_id,entry_date" });
  });

  it("a janela é de DIAS, não de linhas — o rótulo da tela e a consulta concordam", async () => {
    /**
     * O defeito que este teste impede de voltar.
     *
     * A consulta era `.limit(60)` **sem filtro de data nenhum**, e os três
     * números da tela falavam em dias:
     *
     *   · "Registros (60 dias)" — eram as 60 últimas LINHAS;
     *   · "Média de dispneia (7d)" — era `items.slice(0, 7)`, as 7 últimas
     *     LINHAS. Quem registrasse sete vezes em dois dias via uma "média de
     *     7 dias" calculada sobre dois. Em valvopatia, sintomático ×
     *     assintomático decide intervenção: um número de sintoma que significa
     *     outra coisa que a legenda diz é pior do que número nenhum;
     *   · e o gráfico monta uma grade de 30 dias procurando em `items` — com a
     *     lista cortada por linhas, ele perdia dias em silêncio.
     */
    render(<PacienteDiario />, { wrapper });
    await waitFor(() => expect(gteSpy).toHaveBeenCalled());

    const [coluna, valor] = gteSpy.mock.calls[0];
    expect(coluna, "o filtro precisa ser sobre a data do registro").toBe("entry_date");

    const limite = new Date(`${valor}T00:00:00`);
    const dias = Math.round((Date.now() - limite.getTime()) / 86_400_000);
    expect(
      dias,
      `a consulta pediu a partir de ${valor}, que são ${dias} dias — a tela diz 60`,
    ).toBeGreaterThanOrEqual(59);
    expect(dias).toBeLessThanOrEqual(61);
  });

  it("a média de 7 dias cobre 7 dias, mesmo com vários registros no mesmo dia", async () => {
    // Oito registros em dois dias. Pela contagem de LINHAS, a "média de 7d"
    // sairia sobre os sete primeiros — todos de dois dias. Pela janela de
    // DATA, os oito entram, porque todos estão dentro dos últimos sete dias.
    entries = [
      ...Array.from({ length: 4 }, (_, i) => ({
        ...ENTRIES[0], id: `hoje${i}`, entry_date: diasAtras(0), dyspnea: 10,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        ...ENTRIES[0], id: `ontem${i}`, entry_date: diasAtras(1), dyspnea: 2,
      })),
    ];
    render(<PacienteDiario />, { wrapper });
    // (10×4 + 2×4) / 8 = 6.0 — pelas sete primeiras linhas daria 8.9.
    await waitFor(() => expect(screen.getByText("6.0")).toBeInTheDocument());
  });

  it("a chave da query inclui o id do paciente, para não vazar cache entre contas", () => {
    expect(symptomEntriesKey("p1")).toEqual(["symptom-entries", "p1"]);
    expect(symptomEntriesKey("p2")).not.toEqual(symptomEntriesKey("p1"));
  });
});
