import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guarda: a identificação lida do laudo tem que sair da função — e não pode
 * entrar no prontuário sozinha.
 *
 * São dois defeitos de famílias diferentes, e os dois já apareceram nesta
 * sessão em outros lugares:
 *
 * 1. **Pedir e jogar fora.** O esquema pode declarar `patient_name`, o modelo
 *    pode respondê-lo, e a resposta ao cliente pode simplesmente não carregá-lo
 *    — a chamada "funciona", o custo é pago, e o dado nunca chega. É o mesmo
 *    formato do digest que respondia `ok: true, sent: 0`.
 * 2. **Preencher em silêncio.** Nome de paciente errado contamina o prontuário
 *    inteiro, e o laudo imprime o nome do médico solicitante a duas linhas de
 *    distância do dele. A tela mostra e o médico confirma; se alguém ligar isso
 *    direto no formulário, esta guarda quebra.
 */

const raiz = resolve(__dirname, "../..");
const funcao = readFileSync(
  resolve(raiz, "supabase/functions/clinical-ai/index.ts"), "utf8",
);
const novoCaso = readFileSync(resolve(raiz, "src/pages/app/NovoCaso.tsx"), "utf8");

const CAMPOS = [
  "patient_name", "patient_birth_date", "patient_sex", "patient_age", "exam_date",
];

/** O trecho do `extract_echo`, do início do modo até o `return` da resposta. */
function blocoExtracao(): string {
  const inicio = funcao.indexOf('if (mode === "extract_echo")');
  const fim = funcao.indexOf("ring_suggestions: ringSuggestions", inicio);
  expect(inicio, "modo extract_echo").toBeGreaterThan(0);
  expect(fim, "montagem da resposta do extract_echo").toBeGreaterThan(inicio);
  return funcao.slice(inicio, fim);
}

describe("o laudo devolve a identificação que foi pedida", () => {
  const bloco = blocoExtracao();

  it("o esquema pede os cinco campos, e todos são obrigatórios", () => {
    const esquema = bloco.slice(bloco.indexOf("functionDeclarations"), bloco.indexOf("toolConfig"));
    const ausentes = CAMPOS.filter((c) => !esquema.includes(c));
    expect(ausentes, "campos fora do esquema da ferramenta").toEqual([]);

    const obrigatorios = esquema.slice(esquema.indexOf("required:"));
    expect(CAMPOS.filter((c) => !obrigatorios.includes(`"${c}"`)),
      "campos que o modelo pode omitir sem responder null").toEqual([]);
  });

  it("os cinco campos chegam ao cliente — pedir e descartar seria pior que não pedir", () => {
    const fim = funcao.indexOf("ring_suggestions: ringSuggestions");
    const corpo = funcao.slice(
      funcao.lastIndexOf("return new Response(JSON.stringify({", fim), fim,
    );
    // Se a montagem da resposta mudar de forma, esta fatia vem vazia e o teste
    // passaria sem conferir nada — a âncora é a própria asserção.
    expect(corpo, "corpo da resposta do extract_echo").toContain("is_laudo,");
    expect(CAMPOS.filter((c) => !corpo.includes(c)),
      "campos pedidos ao modelo e ausentes da resposta").toEqual([]);
  });

  it("imagem de exame sem laudo não produz identificação nenhuma", () => {
    // `is_laudo === false` significa que não há texto para transcrever. Um nome
    // "lido" de uma imagem de ultrassom é a mesma invenção que a regra do
    // prompt proíbe para os números.
    for (const campo of CAMPOS) {
      expect(bloco, `${campo} sem guarda de is_laudo`)
        .toMatch(new RegExp(`const ${campo} = is_laudo \\?`));
    }
  });

  it("o prompt proíbe deduzir sexo pelo nome e calcular a idade", () => {
    const prompt = bloco.slice(bloco.indexOf("IDENTIFICAÇÃO DO PACIENTE"), bloco.indexOf("REGRA QUE MANDA"));
    expect(prompt).toMatch(/Não deduza sexo/i);
    expect(prompt).toMatch(/Não calcule a partir do\s+nascimento/i);
    expect(prompt).toMatch(/nunca deduza uma data/i);
  });
});

describe("a identificação passa pela conferência do médico", () => {
  it("nenhum campo de identificação entra direto no formulário", () => {
    // O `patch` é o que vai para o formulário sem passar por ninguém. Os
    // números do eco podem: uma FE errada se corrige olhando o campo. Um nome
    // errado vira o paciente do prontuário.
    const patch = novoCaso.slice(
      novoCaso.indexOf("const patch: Partial<FormState> = {}"),
      novoCaso.indexOf("setForm((f) => ({ ...f, ...patch }))"),
    );
    expect(patch.length).toBeGreaterThan(0);
    const vazados = CAMPOS.filter((c) => patch.includes(c));
    expect(vazados, "identificação preenchida sem conferência").toEqual([]);
  });

  it("a tela de conferência é renderizada com o que veio do laudo", () => {
    expect(novoCaso).toContain("<LaudoIdentificacao");
    expect(novoCaso).toContain("setIdentificacao(");
    // Sem o nome de quem está logado, laudo emitido pelo próprio médico deixa
    // de ser reconhecido como suspeito — e é o caso mais comum de todos.
    expect(novoCaso).toMatch(/nomeDoMedico=\{profile\?\.full_name\}/);
  });
});

/**
 * Guarda: o laudo já anexado é buscado pelo servidor — e a autorização é a
 * mesma da tela.
 *
 * O `documentId` existe para o arquivo não trafegar duas vezes pela banda do
 * médico. O risco que ele cria é claro: um id de documento de outro caso
 * viraria um download com service_role, que ignora RLS. Por isso a linha é
 * resolvida pelo cliente com o JWT de quem pediu **antes** de o service_role
 * tocar no bucket — se a RLS não devolver a linha, o download nunca acontece.
 */
describe("laudo anexado ao caso: quem autoriza é a RLS", () => {
  const bloco = blocoExtracao();

  it("a linha do documento é buscada pelo cliente do usuário, não pelo admin", () => {
    const trecho = bloco.slice(bloco.indexOf("body.documentId"));
    // `supabase` é o cliente criado com o Authorization do chamador; `admin*`
    // são os de service_role. A consulta tem que sair do primeiro.
    expect(trecho).toMatch(/await supabase\s*\n?\s*\.from\("case_documents"\)/);
    expect(trecho).toContain('.is("deleted_at", null)');
  });

  it("o download com service_role só acontece depois da linha existir", () => {
    const trecho = bloco.slice(bloco.indexOf("body.documentId"));
    const consulta = trecho.indexOf('.from("case_documents")');
    const recusa = trecho.indexOf("documento não encontrado");
    const download = trecho.indexOf('.from("medical-documents").download');
    expect(consulta).toBeGreaterThan(-1);
    expect(recusa).toBeGreaterThan(consulta);
    expect(download, "download antes da checagem de autorização").toBeGreaterThan(recusa);
  });

  it("a tela manda só o id — o arquivo não passa pelo navegador", () => {
    const leitor = readFileSync(resolve(raiz, "src/components/CaseLaudoReader.tsx"), "utf8");
    expect(leitor).toContain("documentId: documento.id");
    expect(leitor).not.toContain("fileBase64");
    expect(leitor).not.toContain("readAsDataURL");
  });

  it("a leitura do laudo anexado também exige consentimento de IA", () => {
    // Mesmo caminho, mesmo envio: o documento inteiro vai ao provedor.
    const leitor = readFileSync(resolve(raiz, "src/components/CaseLaudoReader.tsx"), "utf8");
    const consentimento = leitor.indexOf('hasActiveConsent("ai_processing")');
    const chamada = leitor.indexOf('invoke("clinical-ai"');
    expect(consentimento).toBeGreaterThan(0);
    expect(consentimento).toBeLessThan(chamada);
  });
});
