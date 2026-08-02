/**
 * Regras de upload de documento clínico.
 *
 * O `accept` do `<input type="file">` é dica de interface: uma chamada direta à
 * API do storage o ignora por completo. Quem de fato barra arquivo indevido é a
 * regra no bucket (`allowed_mime_types` e `file_size_limit`). O que este módulo
 * faz é (a) recusar cedo, com mensagem que explica o motivo, em vez de deixar o
 * servidor devolver um erro cru, e (b) resolver o tipo do arquivo pela
 * extensão.
 *
 * O (b) não é detalhe: para `.dcm` o navegador manda `file.type` vazio, então
 * confiar no que ele declara faria o bucket recusar justamente o formato de
 * imagem médica que o produto existe para receber.
 */

/** Extensão → tipo MIME. As chaves são o que os formulários aceitam. */
const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  dcm: "application/dicom",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Tetos por bucket, espelhando o que a migration configurou no servidor. */
export const LIMITE_MB = {
  "medical-documents": 50, // DICOM costuma ser grande
  "patient-documents": 25,
} as const;

export type BucketDeDocumento = keyof typeof LIMITE_MB;

/**
 * Tipo plano, não união discriminada: o `tsconfig.app.json` roda com
 * `strict: false`, e sem `strictNullChecks` o TypeScript não estreita a união
 * pelo booleano — os chamadores não compilariam.
 */
export type UploadCheck = { ok: boolean; contentType?: string; motivo?: string };

const extensaoDe = (nome: string) => nome.toLowerCase().split(".").pop() ?? "";

/** Lista para o atributo `accept` do input, derivada da mesma fonte. */
export const ACCEPT_DOCUMENTOS = Object.keys(TIPOS)
  .map((e) => `.${e}`)
  .join(",");

export function checarUpload(file: File, bucket: BucketDeDocumento): UploadCheck {
  const ext = extensaoDe(file.name);
  const contentType = TIPOS[ext];
  if (!contentType) {
    return {
      ok: false,
      motivo: `Formato .${ext || "desconhecido"} não aceito. Envie ${Object.keys(TIPOS).join(", ")}.`,
    };
  }

  const limite = LIMITE_MB[bucket] * 1024 * 1024;
  if (file.size > limite) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, motivo: `Arquivo de ${mb} MB excede o limite de ${LIMITE_MB[bucket]} MB.` };
  }

  return { ok: true, contentType };
}
