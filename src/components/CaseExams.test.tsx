import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const base = {
  case_id: "c1", title: null, notes: null, regurgitation_grade: null,
  ejection_fraction: null, mean_gradient: null, peak_gradient: null, valve_area: null,
  psap: null, lv_diameter: null, septal_thickness: null, bnp: null, nt_probnp: null,
  six_min_walk: null, deleted_at: null,
};

// Ordem desc por exam_date, como vem da query: [0] = atual, [1] = anterior.
const EXAMS = [
  { ...base, id: "e1", exam_type: "eco", exam_date: "2026-07-30", title: "ECO controle", ejection_fraction: 45, mean_gradient: 45, valve_area: 1.1, bnp: 400 },
  { ...base, id: "e2", exam_type: "eco", exam_date: "2026-01-30", title: "ECO inicial", ejection_fraction: 55, mean_gradient: 30, valve_area: 0.8, bnp: 900 },
];

let rows: any[] = [...EXAMS];
const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          order: () => Promise.resolve({ data: rows, error: null }),
        };
        return chain;
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(values, col, val);
          rows = rows.filter((r) => r.id !== val);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CaseExams } from "./CaseExams";
import { logAudit } from "@/lib/auditLog";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderComp = (props = {}) => render(<CaseExams caseId="c1" {...props} />, { wrapper });

/** Abre a aba "Comparativo" (o Radix troca no mousedown, não no click). */
const openComparativo = () =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Comparativo/i }));

describe("CaseExams", () => {
  beforeEach(() => {
    rows = [...EXAMS];
    updateSpy.mockClear();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lista os exames do caso", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());
    expect(screen.getByText("ECO inicial")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há exames", async () => {
    rows = [];
    renderComp();
    await waitFor(() => expect(screen.getByText(/Nenhum exame registrado/i)).toBeInTheDocument());
  });

  it("excluir faz soft-delete e registra auditoria", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole("button").filter((b) =>
      b.className.includes("text-destructive"),
    );
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values).toHaveProperty("deleted_at");
    expect(values.deleted_at).toBeTruthy();
    expect(col).toBe("id");
    expect(logAudit).toHaveBeenCalledWith(
      "exam_deleted", "case_exams", val, expect.objectContaining({ case_id: "c1" }),
    );

    await waitFor(() => expect(screen.queryByText("ECO controle")).not.toBeInTheDocument());
  });

  it("em readOnly não oferece criar, editar nem excluir", async () => {
    renderComp({ readOnly: true });
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Novo exame/i })).not.toBeInTheDocument();
    // queryAllBy*, não getAllBy*: em readOnly não sobra botão nenhum e o
    // getAllBy* lançaria em vez de devolver lista vazia.
    expect(
      screen.queryAllByRole("button").filter((b) => b.className.includes("text-destructive")),
    ).toHaveLength(0);
  });

  it("o comparativo mede o exame atual contra o anterior", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());
    openComparativo();

    // FE 55 → 45 (queda de 10); a query vem em ordem decrescente de data,
    // então o "anterior" é o de janeiro, não o de julho.
    await waitFor(() => expect(screen.getByText(/55\s*→\s*45/)).toBeInTheDocument());
    expect(screen.getByText("-10.0")).toBeInTheDocument();
  });

  // A cor sinaliza melhora/piora clínica, não o sinal do número. Sem isso, um
  // gradiente médio subindo (estenose progredindo) apareceria em verde.
  it("pinta como piora um gradiente médio que subiu", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());
    openComparativo();

    const badge = await screen.findByText("+15.0"); // grad. médio 30 → 45
    expect(badge.className).toContain("text-warning");
    expect(badge.className).not.toContain("text-success");
  });

  it("pinta como melhora uma área valvar que subiu", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());
    openComparativo();

    const badge = await screen.findByText("+0.3"); // área valvar 0.8 → 1.1
    expect(badge.className).toContain("text-success");
  });

  // O outro sentido da correção: um parâmetro que melhora quando cai. Antes,
  // um BNP despencando (compensação da insuficiência cardíaca) era pintado de
  // amarelo, como se fosse piora.
  it("pinta como melhora um BNP que caiu", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());
    openComparativo();

    const badge = await screen.findByText("-500.0"); // BNP 900 → 400
    expect(badge.className).toContain("text-success");
  });

  it("pinta como piora uma FE que caiu", async () => {
    renderComp();
    await waitFor(() => expect(screen.getByText("ECO controle")).toBeInTheDocument());
    openComparativo();

    const badge = await screen.findByText("-10.0");
    expect(badge.className).toContain("text-warning");
  });
});
