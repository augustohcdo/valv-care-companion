/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  encontrarStorageCegas,
  clientesCriadosNoArquivo,
  walk,
} from "./detectorDeChamadasCegas";

/**
 * As chamadas à API de `storage` que descartam o erro — a quarta família.
 *
 * ## O mesmo buraco estrutural da terceira
 *
 * As duas varreduras de PostgREST selecionam o statement por `.select(`,
 * `.rpc(`, `.insert(`, `.update(`, `.upsert(` ou `.delete(`. O Storage não
 * passa por ali: `upload`, `remove`, `download`, `list` e `createSignedUrl`
 * falam com outro serviço. A varredura de `auth` casa `\.auth\.`, que não é
 * isto. Nenhuma das três podia ver esta família, e quando a quarta rodou:
 * **11 chamadas cegas** — 6 em `src`, 5 nas edge functions.
 *
 * ## As três que mais doem
 *
 * · `PacienteDocumentos` apagava a linha, mandava `remove` no bucket sem olhar
 *   o resultado e gravava `patient_document_deleted` na trilha. O comentário
 *   ali em cima dizia, com todas as letras: "documento do paciente é dele, e a
 *   LGPD lhe dá o direito de apagar **de verdade**". O titular lia "Documento
 *   removido", a trilha afirmava a exclusão, e o arquivo podia continuar no
 *   bucket. É o art. 18 sendo prometido em vez de cumprido;
 *
 * · `offsite-copy` gravava o manifesto da cópia externa — nos DOIS destinos —
 *   sem olhar. É o arquivo que diz a uma restauração futura o que deveria
 *   estar ali, **sem depender do Supabase**, que no cenário que justifica a
 *   função inteira é justamente o que não existe mais. Uma cópia sem manifesto
 *   era relatada igual a uma com, e a diferença só apareceria na hora de
 *   restaurar;
 *
 * · a rotação do `weekly-export` alimentava a lista `retencao_removidas`
 *   **incondicionalmente**: a resposta afirmava ter apagado pastas sem ninguém
 *   ter olhado se apagou. E a listagem falhando devolve `data: null`, que
 *   virava "não há pasta antiga" — a rotação relatando calmaria sobre o que
 *   não conseguiu ler, que é o vigia do `job-watchdog` de novo, num bucket.
 *
 * ## Descartar conta como cegueira, pela mesma razão da família de `auth`
 *
 * Nos três casos acima o resultado descartado ERA o defeito. `encontrarCegas`
 * absolve o descarte porque para uma LEITURA ele se defende; para `storage`
 * não se defende, e a linha seguinte costuma ser um `logAudit("…_removed")`.
 */

const FUNCTIONS = "supabase/functions";
const SRC = "src";

/**
 * Em `src` ninguém chama `createClient`: todos importam o singleton, sempre
 * com o nome `supabase`. Usar o seletor de `createClient` aqui faria a
 * varredura pular todo arquivo e devolver zero sem ter olhado — engano que eu
 * cometi na guarda de `auth` e que está documentado lá.
 */
const CLIENTES_DE_SRC = () => ["supabase"];

function varrerFixture(linhas: string[]): string[] {
  const dir = mkdtempSync(join(tmpdir(), "storagecegas-"));
  try {
    writeFileSync(join(dir, "index.ts"), linhas.join("\n"));
    return encontrarStorageCegas({ raiz: dir, nomesDoCliente: clientesCriadosNoArquivo });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CLIENTE = [
  'import { createClient } from "npm:@supabase/supabase-js@2.45.0";',
  "const admin = createClient(URL, SERVICE);",
];

describe("chamadas à API de storage que descartam o erro", () => {
  it("nas edge functions: zero", () => {
    const cegas = encontrarStorageCegas({
      raiz: FUNCTIONS,
      nomesDoCliente: clientesCriadosNoArquivo,
    });
    expect(
      cegas,
      `\n${cegas.map((c) => `  · ${c}`).join("\n")}\n\n` +
        "No servidor não há ninguém para notar o arquivo que não saiu:\n" +
        "  · `upload` falhando deixa um backup sem manifesto, relatado como completo;\n" +
        "  · `remove` falhando deixa o objeto lá com a resposta dizendo que apagou;\n" +
        "  · `list` falhando devolve `data: null`, que vira \"não há nada a fazer\".",
    ).toEqual([]);
  });

  it("em src: zero", () => {
    const cegas = encontrarStorageCegas({ raiz: SRC, nomesDoCliente: CLIENTES_DE_SRC });
    expect(
      cegas,
      `\n${cegas.map((c) => `  · ${c}`).join("\n")}\n\n` +
        "Um `remove` cego logo antes de um `logAudit(\"…_removed\")` é a trilha de\n" +
        "auditoria afirmando o que ninguém olhou se aconteceu. Use os helpers de\n" +
        "`@/lib/storage`, que olham o resultado e dizem ao usuário o que sobrou.",
    ).toEqual([]);
  });

  it("as duas varreduras de fato alcançam arquivos", () => {
    // Sem isto, um detector que parou de casar passa as duas asserções acima
    // com zero — e "zero" vira "não olhei" sem ninguém perceber. Foi
    // exatamente o que aconteceu comigo na guarda de `auth`.
    const falamComStorage = (raiz: string) =>
      walk(raiz)
        .filter((f) => !/\.test\.tsx?$/.test(f) && !/\/node_modules\//.test(f.replace(/\\/g, "/")))
        .filter((f) => /\bstorage\s*\n?\s*\./.test(readFileSync(f, "utf8"))).length;

    expect(falamComStorage(SRC), "nenhum arquivo de src fala com storage").toBeGreaterThanOrEqual(4);
    expect(falamComStorage(FUNCTIONS), "nenhuma function fala com storage").toBeGreaterThanOrEqual(3);
  });

  it("acusa o `remove` descartado — o caso do PacienteDocumentos", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      'await admin.storage.from("patient-documents").remove([doc.storage_path]);',
      'logAudit("patient_document_deleted", "patient_documents", doc.id, {});',
    ]);
    expect(cegas.length, "não viu o `remove` descartado").toBe(1);
    expect(cegas[0], "apontou a linha errada").toMatch(/:3$/);
  });

  it("acusa o `upload` descartado — o caso do manifesto do backup", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      "await admin.storage.from(BUCKET).upload(caminho, bytes, { upsert: true });",
      "return json({ ok: true });",
    ]);
    expect(cegas.length, "não viu o `upload` descartado").toBe(1);
  });

  it("acusa o `list` cujo erro some — o `data: null` que vira \"nada a fazer\"", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      'const { data: pastas } = await admin.storage.from(BUCKET).list("exports", { limit: 1000 });',
      "const datas = (pastas ?? []).map((p) => p.name);",
    ]);
    expect(cegas.length, "não viu o `error` faltando na desestruturação").toBe(1);
  });

  it("aprova quem observa o erro — não pune quem fez certo", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      "const { error: erroRemove } = await admin.storage.from(BUCKET).remove(caminhos);",
      "if (erroRemove) return json({ error: erroRemove.message }, 500);",
      "const r = await admin.storage.from(BUCKET).upload(caminho, bytes);",
      "if (r.error) console.error(r.error.message);",
      "const { data: pastas, error: erroLista } = await admin.storage",
      '  .from(BUCKET).list("exports", { limit: 1000 });',
      "if (erroLista) throw new Error(erroLista.message);",
    ]);
    expect(cegas, "reprovou formas corretas de observar o erro").toEqual([]);
  });

  it("não confunde menção em comentário com chamada", () => {
    const cegas = varrerFixture([
      ...CLIENTE,
      "// era `await admin.storage.from(B).remove([p])` sem olhar o resultado",
      "const { error } = await admin.storage.from(B).remove([p]);",
      "if (error) console.error(error.message);",
    ]);
    expect(cegas, "acusou a menção dentro do comentário").toEqual([]);
  });
});
