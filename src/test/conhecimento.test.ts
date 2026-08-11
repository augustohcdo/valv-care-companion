// tsconfig.app.json restringe `types` a vitest/globals; como as outras guardas,
// esta lê o disco e por isso puxa os tipos de Node só aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guardas da base de conhecimento clínico.
 *
 * A base alimenta o que a IA cita para um cardiologista decidir conduta. Duas
 * coisas não podem escorregar, e as duas já quase escorregaram:
 *
 * 1. **O selo de revisão médica.** Ele exibe nome e CRM de uma pessoa real
 *    afirmando ter conferido aquele texto. Marcar como revisado sem revisão
 *    seria atribuir a alguém um ato profissional que não houve. A porta
 *    legítima é `revisar_trecho`, que lê o revisor de um `doctors` verificado;
 *    o gatilho fecha o resto — inclusive para quem escreve o código.
 *
 * 2. **A citação.** O que se guarda é síntese própria mais a referência ao
 *    original, nunca a redação da obra. Sem citação, o médico não confere na
 *    fonte e referenciar deixa de se distinguir de reproduzir.
 *
 * Rodam sobre o código, sem credencial no CI — mesmo molde das outras nove.
 */

const MIGRATIONS = "supabase/migrations";
const INGEST = "supabase/functions/knowledge-ingest/index.ts";

const ler = (p: string) => readFileSync(p, "utf8");

function sqlDeTodasAsMigrations(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ler(join(MIGRATIONS, f)))
    .join("\n")
    .toLowerCase();
}

describe("base de conhecimento", () => {
  const sql = sqlDeTodasAsMigrations();

  it("o banco recusa 'reviewed' fora do RPC de revisão", () => {
    expect(sql).toContain("create trigger trg_impedir_revisao_sem_medico");
    expect(sql).toMatch(/trecho só vira "reviewed" pelo rpc revisar_trecho/);
    // A autorização é por marca de sessão, válida só dentro da transação do RPC.
    expect(sql).toMatch(/set_config\('valvepath\.revisao_autorizada'/);
  });

  it("a revisão continua exigindo médico com CRM verificado", () => {
    // O gatilho não pode ter virado a única defesa: o RPC precisa continuar
    // lendo o revisor de `doctors` com `verified = true`, e não de um campo
    // digitado por quem aprova.
    // `lastIndexOf("function public.revisar_trecho")` cairia na linha do
    // `revoke`, que vem depois do corpo — e o teste passaria a olhar para nada.
    const corpo = sql.slice(sql.lastIndexOf("create or replace function public.revisar_trecho"));
    expect(corpo).toMatch(/from public\.doctors d[\s\S]{0,200}?verified = true/);
    expect(corpo).toMatch(/exige registro de medico com crm verificado/);
  });

  it("a ingestão só grava conteúdo aguardando revisão", () => {
    const fonte = ler(INGEST);
    expect(fonte).toContain('review_status: "ai_generated"');
    expect(
      fonte.includes('review_status: "reviewed"'),
      "a ingestão não pode gravar 'reviewed': o selo é de um médico, não do importador.",
    ).toBe(false);
  });

  it("a ingestão recusa trecho sem citação ou grande demais", () => {
    const fonte = ler(INGEST);
    // Sem citação ninguém confere na fonte.
    expect(fonte).toMatch(/sem citação/);
    // E um "trecho" muito longo deixou de ser síntese e virou transcrição da
    // obra — que é justamente o que não pode ser guardado.
    expect(fonte).toMatch(/MAX_CONTEUDO\s*=\s*\d+/);
    expect(fonte).toMatch(/transcrição, não síntese/);
  });
});
