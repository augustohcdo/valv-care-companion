import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * O caso real que originou a rodada: exame com cinco medidas, achados em
 * branco. O que os testes protegem é o pedido literal — "garantir que não vá
 * nenhum dado errado": nada é gravado sem clique, valor suspeito não entra por
 * inércia, valor fora da faixa não é sequer oferecido, e divergência aparece
 * sem ser trocada sozinha.
 */

const EXAME = {
  id: "e1", exam_type: "eco", exam_date: "2026-08-15",
  ejection_fraction: 45, mean_gradient: 42, peak_gradient: 75,
  valve_area: 0.8, regurgitation_grade: "3+4+",
};

let exame: Record<string, unknown> | null = { ...EXAME };
const updateSpy = vi.fn();
let falhar = false;

function escrita(afetadas: number) {
  const p: any = Promise.resolve({ error: null });
  p.select = () => Promise.resolve({
    data: Array.from({ length: afetadas }, () => ({ id: "c1" })), error: null,
  });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain: any = {};
        chain.eq = () => chain;
        chain.is = () => chain;
        chain.order = () => chain;
        chain.limit = () => chain;
        chain.maybeSingle = () => Promise.resolve({ data: exame, error: null });
        return chain;
      },
      update: (values: any) => ({
        eq: (_c: string, id: string) => {
          updateSpy(values, id);
          return escrita(falhar ? 0 : 1);
        },
      }),
    }),
  },
}));

vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { CaseExamGap } from "./CaseExamGap";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const vazio = { id: "c1" };

describe("CaseExamGap", () => {
  beforeEach(() => {
    exame = { ...EXAME };
    falhar = false;
    vi.clearAllMocks();
  });

  it("acha as cinco lacunas do caso do print e mostra a origem", async () => {
    render(<CaseExamGap caseId="c1" caso={vazio} />, { wrapper });
    expect(await screen.findByText(/5 medida\(s\) do exame não estão nos achados/i)).toBeInTheDocument();
    expect(screen.getByText(/Ecocardiograma de 15\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText("45 %")).toBeInTheDocument();
    expect(screen.getByText("3+4+")).toBeInTheDocument();
  });

  it("some quando o caso já tem tudo", async () => {
    const { container } = render(
      <CaseExamGap caseId="c1" caso={{
        ejection_fraction: 45, mean_gradient: 42, peak_gradient: 75,
        valve_area: 0.8, regurgitation_grade: "3+4+",
      }} />, { wrapper },
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("some quando o caso não tem exame", async () => {
    exame = null;
    const { container } = render(<CaseExamGap caseId="c1" caso={vazio} />, { wrapper });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("nada é gravado antes do clique", async () => {
    render(<CaseExamGap caseId="c1" caso={vazio} />, { wrapper });
    await screen.findByText(/5 medida\(s\)/i);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("preencher grava exatamente os valores do exame e audita a origem", async () => {
    const onAplicado = vi.fn();
    render(<CaseExamGap caseId="c1" caso={vazio} onAplicado={onAplicado} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Preencher 5 campo/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [valores, id] = updateSpy.mock.calls[0];
    expect(valores).toEqual({
      ejection_fraction: 45, mean_gradient: 42, peak_gradient: 75,
      valve_area: 0.8, regurgitation_grade: "3+4+",
    });
    expect(id).toBe("c1");
    expect(logAudit).toHaveBeenCalledWith(
      "case_findings_filled_from_exam", "clinical_cases", "c1",
      expect.objectContaining({ origem: "exame", exame_id: "e1" }),
    );
    expect(onAplicado).toHaveBeenCalled();
  });

  it("desmarcar um campo o deixa de fora da gravação", async () => {
    render(<CaseExamGap caseId="c1" caso={vazio} />, { wrapper });
    await screen.findByText(/5 medida\(s\)/i);

    fireEvent.click(screen.getByLabelText(/Fração de ejeção/i));
    fireEvent.click(screen.getByRole("button", { name: /Preencher 4 campo/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("ejection_fraction");
  });

  /**
   * FE 0,45 passa no `CHECK` do banco (0 a 100) e é quase certamente a fração
   * escrita onde se espera a porcentagem. Entrar junto com os outros por
   * inércia seria exatamente o "dado errado" que a rodada existe para impedir.
   */
  it("valor suspeito vem desmarcado, com o motivo à vista", async () => {
    exame = { ...EXAME, ejection_fraction: 0.45 };
    render(<CaseExamGap caseId="c1" caso={vazio} />, { wrapper });

    expect(await screen.findByText(/parece a fração/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Preencher 4 campo/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("ejection_fraction");
  });

  it("valor fora da faixa do banco não é oferecido, e o motivo aparece", async () => {
    exame = { ...EXAME, ejection_fraction: 150 };
    render(<CaseExamGap caseId="c1" caso={vazio} />, { wrapper });

    expect(await screen.findByText(/fora da faixa aceita/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Preencher 4 campo/i }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("ejection_fraction");
  });

  it("divergência aparece em bloco próprio e não entra no preenchimento", async () => {
    render(<CaseExamGap caseId="c1" caso={{ ejection_fraction: 60 }} />, { wrapper });

    expect(await screen.findByText(/1 medida\(s\) diferem do exame mais recente/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Preencher 4 campo/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("ejection_fraction");
  });

  it("atualizar divergência grava o valor do exame e registra o anterior", async () => {
    render(<CaseExamGap caseId="c1" caso={{ ejection_fraction: 60 }} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Atualizar com o valor do exame/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][0]).toEqual({ ejection_fraction: 45 });
    expect(logAudit).toHaveBeenCalledWith(
      "case_findings_updated", "clinical_cases", "c1",
      expect.objectContaining({ anteriores: { ejection_fraction: 60 } }),
    );
  });

  it("recusa do banco não vira sucesso nem entra na trilha", async () => {
    falhar = true;
    render(<CaseExamGap caseId="c1" caso={vazio} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: /Preencher 5 campo/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(logAudit).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("colaborador em somente leitura não vê o cartão", async () => {
    const { container } = render(<CaseExamGap caseId="c1" caso={vazio} readOnly />, { wrapper });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
