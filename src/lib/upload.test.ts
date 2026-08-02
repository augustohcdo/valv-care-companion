import { describe, it, expect } from "vitest";
import { checarUpload, ACCEPT_DOCUMENTOS, LIMITE_MB } from "./upload";

/** File falso: só `name` e `size` importam para as regras. */
const arquivo = (name: string, bytes = 1024) =>
  ({ name, size: bytes, type: "" }) as File;

const MB = 1024 * 1024;

describe("regras de upload de documento", () => {
  it("aceita os formatos clínicos previstos", () => {
    for (const nome of ["laudo.pdf", "eco.JPG", "raio-x.png", "exame.docx"]) {
      expect(checarUpload(arquivo(nome), "medical-documents").ok, nome).toBe(true);
    }
  });

  // O caso que motiva resolver o tipo pela extensão: o navegador manda
  // `file.type` vazio para .dcm, então confiar nele faria o bucket recusar
  // justamente o formato de imagem médica que o produto existe para receber.
  it("dá a um .dcm o tipo application/dicom, que o navegador não informa", () => {
    const r = checarUpload(arquivo("angio.dcm"), "medical-documents");
    expect(r).toMatchObject({ ok: true, contentType: "application/dicom" });
  });

  it("recusa formato fora da lista, dizendo o motivo", () => {
    const r = checarUpload(arquivo("script.html"), "medical-documents");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/\.html não aceito/);
  });

  it("recusa arquivo sem extensão", () => {
    expect(checarUpload(arquivo("semextensao"), "medical-documents").ok).toBe(false);
  });

  it("recusa acima do teto e informa o tamanho", () => {
    const r = checarUpload(arquivo("gigante.pdf", 51 * MB), "medical-documents");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/51\.0 MB excede o limite de 50 MB/);
  });

  it("usa teto diferente por bucket", () => {
    const trinta = arquivo("laudo.pdf", 30 * MB);
    expect(checarUpload(trinta, "medical-documents").ok).toBe(true);
    expect(checarUpload(trinta, "patient-documents").ok).toBe(false);
    expect(LIMITE_MB["patient-documents"]).toBeLessThan(LIMITE_MB["medical-documents"]);
  });

  // O `accept` sai da mesma fonte das regras: se divergirem, a interface passa
  // a oferecer formato que o servidor recusa.
  it("o accept do formulário cobre exatamente os formatos aceitos", () => {
    for (const ext of ACCEPT_DOCUMENTOS.split(",")) {
      expect(checarUpload(arquivo(`teste${ext}`), "medical-documents").ok, ext).toBe(true);
    }
  });
});
