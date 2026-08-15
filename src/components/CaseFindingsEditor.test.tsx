import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * O caso que originou esta tela: FE, gradientes e área valvar vazios, sem
 * nenhuma forma de corrigir. O que os testes aqui protegem é menos o formulário
 * e mais as três regras que o cercam — recusa não vira sucesso, campo em branco
 * vira `null` e não zero, e a trilha registra o que mudou.
 */

const CASO = {
  id: "c1",
  patient_name: "João S.",
  patient_age: 68,
  patient_sex: "M",
  valve_type: "aortica",
  valve_disease: "estenose",
  severity: "importante",
  nyha: "II",
  symptoms: ["Fadiga"],
  comorbidities: null,
  ejection_fraction: 60,
  mean_gradient: null,
  peak_gradient: null,
  valve_area: null,
  regurgitation_grade: null,
  proposed_management: null,
};

const updateSpy = vi.fn();
let falhar = false;
/** O exame mais recente do caso, ou `null` quando não há nenhum. */
let ultimoExame: Record<string, unknown> | null = null;

function escrita(afetadas: number) {
  const p: any = Promise.resolve({ error: null });
  p.select = () => Promise.resolve({ data: Array.from({ length: afetadas }, () => ({ id: "c1" })), error: null });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: () => Promise.resolve({ data: ultimoExame, error: null }),
        };
        return chain;
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          updateSpy(values, col, val);
          // Zero linhas é como a RLS recusa um UPDATE: 200, sem erro, sem efeito.
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

import { CaseFindingsEditor, paraPayload, validar } from "./CaseFindingsEditor";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const form = (over: Record<string, unknown> = {}) => ({
  patient_name: "João S.",
  patient_age: "68",
  patient_sex: "M",
  valve_type: "aortica",
  valve_disease: "estenose",
  severity: "importante",
  nyha: "II",
  symptoms: [] as string[],
  comorbidities: [] as string[],
  ejection_fraction: "60",
  mean_gradient: "",
  peak_gradient: "",
  valve_area: "",
  regurgitation_grade: "",
  proposed_management: "",
  ...over,
}) as any;

describe("validar", () => {
  it("exige identificação, valva e tipo de lesão", () => {
    expect(validar(form({ patient_name: "  " }))).toMatch(/identificação/i);
    expect(validar(form({ valve_type: "" }))).toMatch(/valva/i);
    expect(validar(form({ valve_disease: "" }))).toMatch(/lesão/i);
  });

  it("recusa medida fora da faixa que o banco impõe, com mensagem legível", () => {
    expect(validar(form({ ejection_fraction: "150" }))).toMatch(/entre 0 e 100/);
  });

  it("aceita medida em branco — ausência é informação legítima", () => {
    expect(validar(form({ ejection_fraction: "" }))).toBeNull();
  });
});

describe("paraPayload", () => {
  it("campo em branco vira null, nunca zero", () => {
    // Foi a rodada do score de risco que estabeleceu isto: ausência tratada
    // como zero produz "perfil favorável" calculado sobre nada.
    const p = paraPayload(form({ mean_gradient: "", ejection_fraction: "" }));
    expect(p.mean_gradient).toBeNull();
    expect(p.ejection_fraction).toBeNull();
  });

  it("lista vazia vira null, como o cadastro grava", () => {
    const p = paraPayload(form({ symptoms: [], comorbidities: ["Tabagismo"] }));
    expect(p.symptoms).toBeNull();
    expect(p.comorbidities).toEqual(["Tabagismo"]);
  });

  it("aceita vírgula decimal e arredonda pela casa do campo", () => {
    const p = paraPayload(form({ valve_area: "0,825", patient_age: "68,4" }));
    // `toFixed` devolveria "0.82" aqui: em binário 0,825 é 0,8249…
    expect(p.valve_area).toBe(0.83);
    expect(p.patient_age).toBe(68);
  });
});

describe("CaseFindingsEditor", () => {
  beforeEach(() => {
    falhar = false;
    ultimoExame = null;
    updateSpy.mockClear();
    vi.clearAllMocks();
  });

  it("mostra os achados em leitura e o botão de editar para o responsável", () => {
    render(<CaseFindingsEditor caso={CASO} />, { wrapper });
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar/i })).toBeInTheDocument();
  });

  it("em readOnly não oferece edição", () => {
    render(<CaseFindingsEditor caso={CASO} readOnly />, { wrapper });
    expect(screen.queryByRole("button", { name: /Editar/i })).not.toBeInTheDocument();
  });

  it("salva o campo corrigido e registra na trilha o antes e o depois", async () => {
    const onSaved = vi.fn();
    render(<CaseFindingsEditor caso={CASO} onSaved={onSaved} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar achados/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [values, col, val] = updateSpy.mock.calls[0];
    expect(values.ejection_fraction).toBe(42);
    expect(col).toBe("id");
    expect(val).toBe("c1");

    expect(logAudit).toHaveBeenCalledWith(
      "case_findings_updated", "clinical_cases", "c1",
      { campos: { ejection_fraction: { de: 60, para: 42 } } },
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("recusa do banco não vira sucesso nem entra na trilha", async () => {
    // Zero linhas afetadas é como a RLS nega: sem este caso, o médico que não é
    // dono do caso leria "Achados atualizados" e a auditoria registraria uma
    // alteração que nunca aconteceu.
    falhar = true;
    const onSaved = vi.fn();
    render(<CaseFindingsEditor caso={CASO} onSaved={onSaved} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar achados/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(logAudit).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("valor fora da faixa nem chega ao banco", async () => {
    render(<CaseFindingsEditor caso={CASO} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar achados/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Revise antes de salvar",
        expect.objectContaining({ description: expect.stringMatching(/entre 0 e 100/) }),
      ),
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  /**
   * `case_exams` guarda exatamente as medidas que o caso exibe, e as duas telas
   * conviviam sem se falarem — o médico digitava o mesmo número duas vezes.
   */
  it("preenche as medidas a partir do exame e não salva nada sozinho", async () => {
    ultimoExame = {
      id: "x1", exam_type: "eco", exam_date: "2026-08-01",
      ejection_fraction: 42, mean_gradient: 48, peak_gradient: null,
      valve_area: 0.8, regurgitation_grade: null,
    };
    render(<CaseFindingsEditor caso={CASO} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));

    const botao = await screen.findByRole("button", { name: /Preencher com o exame mais recente/i });
    // A consulta do exame resolve depois da montagem; o botão nasce desabilitado.
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);

    await waitFor(() => expect(screen.getByDisplayValue("42")).toBeInTheDocument());
    expect(screen.getByDisplayValue("48")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.8")).toBeInTheDocument();
    // O ponto da rodada: preencher é uma coisa, gravar é outra.
    expect(updateSpy).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "3 medida(s) trazidas do exame",
      expect.objectContaining({ description: expect.stringContaining("01/08/2026") }),
    );
  });

  it("sem exame no caso, o botão não fica clicável", async () => {
    ultimoExame = null;
    render(<CaseFindingsEditor caso={CASO} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    const botao = await screen.findByRole("button", { name: /Preencher com o exame mais recente/i });
    await waitFor(() => expect(botao).toBeDisabled());
    expect(screen.getByText(/Nenhum exame registrado neste caso ainda/i)).toBeInTheDocument();
  });

  it("nome pseudonimizado não volta a ser editável", () => {
    // Um campo de texto aberto desfaria, com uma digitação, a eliminação que o
    // titular pediu.
    render(<CaseFindingsEditor caso={{ ...CASO, patient_name: "Titular removido · 4F2A" }} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    expect(screen.getByDisplayValue("Titular removido · 4F2A")).toBeDisabled();
  });
});
