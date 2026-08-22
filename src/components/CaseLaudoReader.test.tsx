import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * O cenário do print: caso já criado, laudo anexado, "Informações do paciente"
 * em branco. A leitura do laudo só existia no cadastro — aqui ela passa a
 * existir onde o documento de fato está.
 *
 * O que os testes protegem: o arquivo **não** trafega pelo navegador (vai o id
 * do documento, e a autorização é a mesma da tela), nada é gravado sem clique,
 * e recusa do banco não vira sucesso nem entra na trilha.
 */

const invoke = vi.fn();
const updateSpy = vi.fn();
let afetadas = 1;

function escrita() {
  const p: any = Promise.resolve({ error: null });
  p.select = () => Promise.resolve({
    data: Array.from({ length: afetadas }, () => ({ id: "c1" })), error: null,
  });
  return p;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      update: (values: any) => ({
        eq: (_c: string, id: string) => { updateSpy(values, id); return escrita(); },
      }),
    }),
  },
}));

let temConsentimento = true;
vi.mock("@/lib/consent", () => ({
  hasActiveConsent: () => Promise.resolve(temConsentimento),
  AVISO_CONSENTIMENTO_IA: { titulo: "Consentimento necessário", descricao: "..." },
}));
vi.mock("@/lib/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { CaseLaudoReader, podeLerLaudo } from "./CaseLaudoReader";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";

const DOC = { id: "doc-1", file_name: "eco.pdf", mime_type: "application/pdf" };
const LAUDO_COMPLETO = {
  is_laudo: true,
  patient_name: "MARIA APARECIDA DOS SANTOS",
  patient_birth_date: "1958-03-12",
  patient_sex: "Feminino",
  patient_age: null,
  exam_date: "2026-08-15",
  lvef: 45, mean_gradient: 42, aortic_valve_area: 0.8,
};

function envolver(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function montar(caso: Record<string, unknown> = {}) {
  return render(envolver(
    <CaseLaudoReader caseId="c1" caso={caso} documento={DOC} nomeDoMedico="Dr. Teste" />,
  ));
}

const abrir = () => fireEvent.click(screen.getByRole("button", { name: /Ler o laudo/i }));

beforeEach(() => {
  invoke.mockReset();
  updateSpy.mockReset();
  vi.mocked(logAudit).mockClear();
  vi.mocked(toast.error).mockClear();
  afetadas = 1;
  temConsentimento = true;
  invoke.mockResolvedValue({ data: LAUDO_COMPLETO, error: null });
});

describe("quais documentos a leitura alcança", () => {
  it("aceita foto e PDF, recusa DICOM e Word", () => {
    expect(podeLerLaudo({ id: "1", file_name: "a.pdf", mime_type: "application/pdf" })).toBe(true);
    expect(podeLerLaudo({ id: "1", file_name: "a.jpg", mime_type: "image/jpeg" })).toBe(true);
    expect(podeLerLaudo({ id: "1", file_name: "a.dcm", mime_type: "application/dicom" })).toBe(false);
    expect(podeLerLaudo({ id: "1", file_name: "a.docx", mime_type: "" })).toBe(false);
  });

  it("tipo vazio não descarta: a extensão resolve", () => {
    // `mime_type` guarda o que o navegador declarou no upload, e às vezes vem
    // vazio — descartar por isso esconderia o laudo do próprio médico.
    expect(podeLerLaudo({ id: "1", file_name: "laudo.PDF", mime_type: null })).toBe(true);
  });
});

describe("ler o laudo já anexado", () => {
  it("manda o id do documento — o arquivo não trafega pelo navegador", async () => {
    montar();
    abrir();
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const corpo = invoke.mock.calls[0][1].body;
    expect(corpo).toEqual({ mode: "extract_echo", documentId: "doc-1" });
    expect(corpo).not.toHaveProperty("fileBase64");
  });

  it("sem consentimento de IA, o documento nem é enviado", async () => {
    temConsentimento = false;
    montar();
    abrir();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(invoke).not.toHaveBeenCalled();
  });

  it("mostra a identificação e as medidas que faltam no caso", async () => {
    montar({ patient_name: "", ejection_fraction: null, mean_gradient: null, valve_area: null });
    abrir();
    expect(await screen.findByText("MARIA APARECIDA DOS SANTOS")).toBeInTheDocument();
    // Idade não estava escrita: veio da conta entre nascimento e data do exame.
    expect(screen.getByText("68 anos")).toBeInTheDocument();
    expect(screen.getByText(/3 medida\(s\) do laudo/)).toBeInTheDocument();
  });

  it("gravar as medidas escreve no caso e registra a origem", async () => {
    montar({ ejection_fraction: null, mean_gradient: null, valve_area: null });
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: /Preencher 3 medida/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy.mock.calls[0][0])
      .toEqual({ ejection_fraction: 45, mean_gradient: 42, valve_area: 0.8 });
    expect(updateSpy.mock.calls[0][1]).toBe("c1");
    expect(vi.mocked(logAudit).mock.calls[0][3]).toMatchObject({
      origem: "laudo", documento_id: "doc-1",
    });
  });

  it("recusa do banco não vira sucesso nem entra na trilha", async () => {
    // Zero linhas afetadas com erro nulo é como a RLS recusa — para o
    // PostgREST, atualizar nada é sucesso.
    afetadas = 0;
    montar({ ejection_fraction: null, mean_gradient: null, valve_area: null });
    abrir();
    fireEvent.click(await screen.findByRole("button", { name: /Preencher 3 medida/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("medida que o caso já tem aparece como divergência, não como lacuna", async () => {
    montar({ ejection_fraction: 60, mean_gradient: null, valve_area: null });
    abrir();
    expect(await screen.findByText(/1 medida\(s\) diferem do laudo/)).toBeInTheDocument();
    expect(screen.getByText(/2 medida\(s\) do laudo/)).toBeInTheDocument();
    // O botão de lacunas não inclui a FE já preenchida.
    expect(screen.getByRole("button", { name: /Preencher 2 medida/i })).toBeInTheDocument();
  });

  it("imagem de exame sem laudo escrito não oferece nada", async () => {
    invoke.mockResolvedValue({ data: { is_laudo: false }, error: null });
    montar();
    abrir();
    expect(await screen.findByText(/não tem laudo escrito/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preencher/i })).not.toBeInTheDocument();
  });

  it("valor implausível vem desmarcado, com o motivo", async () => {
    invoke.mockResolvedValue({
      data: { ...LAUDO_COMPLETO, lvef: 0.45, mean_gradient: null, aortic_valve_area: null },
      error: null,
    });
    montar({ ejection_fraction: null });
    abrir();
    expect(await screen.findByText(/parece a fração/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preencher 0 medida/i })).toBeDisabled();
  });
});
