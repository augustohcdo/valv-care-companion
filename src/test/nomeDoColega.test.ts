import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Guarda: nenhuma tela inventa o nome de uma pessoa.
 *
 * O defeito que originou este arquivo era invisível de dentro do código: as
 * telas liam `public.profiles` de outra pessoa, as policies (`auth.uid() =
 * user_id` e `has_role(admin)`) devolviam **vazio sem erro**, e o `||` de
 * reserva preenchia o buraco com um texto que parecia um nome. Toda opinião de
 * uma discussão clínica ficava assinada por "Dr(a). Médico"; todo colaborador,
 * por "Dr(a). —"; e o paciente lia "Dr(a). Médico(a)" no cartão do próprio
 * médico assistente.
 *
 * Num prontuário isso não é cosmético: é registro que não dá para auditar, pois
 * não se sabe quem recomendou o quê. E os testes de componente **passavam**,
 * porque simulavam uma consulta que na RLS real nunca funciona.
 *
 * Duas frentes, então: nenhuma tela volta a ler `profiles` de terceiro, e
 * nenhuma volta a preencher nome ausente com texto que se parece com nome.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");

function arquivosDe(dir: string): string[] {
  return readdirSync(resolve(raiz, dir)).flatMap((nome) => {
    const rel = join(dir, nome);
    try {
      const filhos = readdirSync(resolve(raiz, rel));
      return filhos.length ? arquivosDe(rel) : [];
    } catch {
      return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [rel] : [];
    }
  });
}

/** O que chega à tela, sem os comentários que explicam o código. */
const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TELAS = arquivosDe("src").filter((f) => f.startsWith("src/pages") || f.startsWith("src/components"));

describe("nenhuma tela lê o perfil de outra pessoa", () => {
  it("ninguém consulta profiles por lista de user_id", () => {
    // `.in("user_id", ...)` sobre `profiles` é o padrão exato que volta vazio
    // pela RLS. Quem precisa de nome de terceiro usa RPC.
    const vazando = TELAS.filter((f) => {
      const t = semComentarios(ler(f));
      return /from\("profiles"\)[\s\S]{0,200}?\.in\("user_id"/.test(t);
    });
    expect(vazando, "telas lendo profiles de terceiros por lista").toEqual([]);
  });

  it("ninguém consulta o perfil de um médico pelo user_id dele", () => {
    // A outra forma do mesmo erro: `.eq("user_id", doc.user_id)`, que também
    // volta vazio — foi assim que o paciente perdeu o nome do próprio médico.
    const vazando = TELAS.filter((f) => {
      const t = semComentarios(ler(f));
      return /from\("profiles"\)[\s\S]{0,200}?\.eq\("user_id",\s*(doc|d|medico)\b/.test(t);
    });
    expect(vazando, "telas lendo o perfil de um médico direto").toEqual([]);
  });
});

describe("nome ausente não vira nome inventado", () => {
  it("nenhum dado é montado com nome literal de reserva", () => {
    // Duas versões desta guarda erraram antes desta, e as duas só apareceram
    // invertendo:
    //
    // 1. a primeira listava as palavras ruins conhecidas (`Médico`, `Dr`,
    //    `—`) e **não pegava** `full_name || "Paciente"`, que era um dos
    //    defeitos reais da rodada. Lista de palavras erradas nunca fecha.
    // 2. a segunda proibia qualquer literal perto de `full_name` e acusava a
    //    **tela** dizendo que o nome está ausente — que é justamente o
    //    comportamento desejado.
    //
    // O alvo certo é a **montagem do dado**: `full_name: algo || "texto"`
    // grava um nome falso na estrutura, e daí para a frente ninguém consegue
    // distinguir ausência de nome. Decidir o que exibir quando é nulo é
    // trabalho da tela, e continua permitido.
    const proibido = /full_name\s*[:=]\s*[^,;\n]*(\|\||\?\?)\s*["'`][^"'`]/;
    const errados = TELAS.filter((f) => proibido.test(semComentarios(ler(f))));
    expect(errados, "dados montados com nome de reserva literal").toEqual([]);
  });

  it("as duas telas do caso dizem quando não identificaram", () => {
    expect(semComentarios(ler("src/components/CaseDiscussion.tsx"))).toContain("autor não identificado");
    expect(semComentarios(ler("src/components/CaseCollaborators.tsx"))).toContain("colega não identificado");
  });
});

describe("a cerca do RPC dos participantes", () => {
  function migration(): string {
    const dir = resolve(raiz, "supabase/migrations");
    const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const com = arquivos.filter((f) =>
      /function public\.participantes_do_caso/i.test(readFileSync(resolve(dir, f), "utf8")));
    expect(com.length, "nenhuma migration define participantes_do_caso").toBeGreaterThan(0);
    return readFileSync(resolve(dir, com[com.length - 1]), "utf8");
  }

  it("NÃO usa can_access_case — ele inclui o paciente", () => {
    // Foi medido contra o banco: com `can_access_case`, o paciente do caso
    // recebia os 4 nomes e CRMs de uma discussão que a policy de
    // `case_comments` fecha para ele. O helper conveniente era o vazamento.
    const sql = migration();
    const corpo = sql.slice(sql.indexOf("function public.participantes_do_caso"), sql.indexOf("revoke all on function public.participantes_do_caso"));
    expect(corpo, "voltou a usar a cerca larga").not.toMatch(/can_access_case/);
    // A cerca certa espelha a policy de SELECT de `case_comments`.
    expect(corpo).toMatch(/is_case_owner\(_case_id, auth\.uid\(\)\)/);
    expect(corpo).toMatch(/cc\.status\s*=\s*'aceito'/);
  });

  it("não é executável por visitante anônimo", () => {
    const sql = migration();
    expect(sql).toMatch(/revoke all on function public\.participantes_do_caso[^;]*from public, anon/);
    expect(sql).toMatch(/grant execute on function public\.participantes_do_caso[^;]*to authenticated/);
  });

  it("o RPC do paciente devolve só os médicos dele, e não a discussão", () => {
    const sql = migration();
    const corpo = sql.slice(sql.indexOf("function public.meus_medicos"), sql.indexOf("revoke all on function public.meus_medicos"));
    expect(corpo).toMatch(/linked_doctor_id/);
    // Se `meus_medicos` passasse a olhar `case_comments`, o paciente saberia
    // quem discutiu o caso dele — a decisão foi manter isso fechado.
    expect(corpo, "meus_medicos passou a expor quem comentou").not.toMatch(/case_comments|case_collaborators/);
  });
});
