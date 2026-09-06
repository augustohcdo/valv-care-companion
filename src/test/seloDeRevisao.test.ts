// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";

/**
 * Nada é carimbado como revisado por médico sem um médico por trás.
 *
 * ## De onde isto veio
 *
 * Em 06/09 o usuário pediu: "pode colocar meu nome como avaliador e gestor do
 * site" — e, perguntado pelo CRM, respondeu que não tem. Gestor é verdade e foi
 * para a página de referências. Avaliador, no vocabulário desta base, é outra
 * coisa: `review_status = 'reviewed'` faz a IA e a tela de administração
 * apresentarem o trecho como REVISADO POR MÉDICO.
 *
 * Um site que orienta conduta valvar exibindo esse selo sem médico por trás é a
 * pior versão do defeito que este projeto persegue a sessão inteira: o leitor
 * confia no selo exatamente quando não tem como conferir sozinho. E o dano não
 * seria meu nem do usuário — seria de quem lesse.
 *
 * ## Por que a guarda é sobre o SQL
 *
 * A tela de administração só LÊ o selo (`AdminConteudo.tsx` monta a string
 * `CRM x/UF` a partir de `content_review_status`). Não há caminho de interface
 * para carimbar: quem carimba é SQL rodando como `service_role`. Então é no SQL
 * do repositório que a exigência precisa morar.
 *
 * A regra: nenhum arquivo `.sql` marca conteúdo como `reviewed`, ou escreve em
 * `content_review_status`, sem trazer junto CRM e UF. Não é "não escreva a
 * palavra" — é a propriedade, que também pega a próxima forma de escrevê-la.
 */

const CRM = /reviewer_crm\b/;
const UF = /reviewer_crm_uf\b/;

/** Comentário fora: um `--` explicando a regra não pode disparar a regra. */
function sqlSemComentario(texto: string): string {
  return texto
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

/**
 * As ESCRITAS que põem `review_status` em `'reviewed'`. Leitura não conta.
 *
 * Dois formatos, e só eles:
 *
 *  · `UPDATE ... SET ... review_status = 'reviewed' ...` — a cláusula SET é
 *    recortada até o `WHERE`, senão `set content='x' where review_status =
 *    'reviewed'` seria acusado, e ali o valor está na condição, não no carimbo;
 *  · `INSERT INTO ... review_status ... 'reviewed'` dentro da mesma instrução.
 *
 * `CHECK (... in ('pending','reviewed'))` é definição de tipo e não casa com
 * nenhum dos dois.
 */
export function escritasDeStatus(sql: string): string[] {
  const achados: string[] = [];

  for (const m of sql.matchAll(/\bupdate\b[\s\S]*?\bset\b([\s\S]*?)(?=\bwhere\b|;|$)/gi)) {
    if (/review_status\s*=\s*'reviewed'/i.test(m[1])) {
      achados.push(m[1].trim().replace(/\s+/g, " ").slice(0, 90));
    }
  }

  for (const m of sql.matchAll(/\binsert\s+into\b[\s\S]*?(?=;|$)/gi)) {
    const bloco = m[0];
    if (/\breview_status\b/i.test(bloco) && /'reviewed'/.test(bloco)) {
      achados.push(bloco.trim().replace(/\s+/g, " ").slice(0, 90));
    }
  }

  return achados;
}

function arquivosSql(): string[] {
  const achados: string[] = [];
  for (const dir of ["supabase/migrations", "scripts/catalogo"]) {
    if (!existsSync(dir)) continue;
    for (const nome of readdirSync(dir)) {
      if (nome.endsWith(".sql")) achados.push(`${dir}/${nome}`);
    }
  }
  return achados;
}

describe("o selo de revisão médica exige um médico", () => {
  const arquivos = arquivosSql().map((caminho) => ({
    caminho,
    sql: sqlSemComentario(readFileSync(caminho, "utf8")),
  }));

  it("a varredura enxerga os arquivos SQL do projeto", () => {
    // Contraprova: uma varredura vazia aprovaria qualquer carimbo.
    expect(arquivos.length).toBeGreaterThan(80);
    expect(arquivos.map((a) => a.caminho)).toContain(
      "supabase/migrations/20260906160000_sbc_2020_confirmada_com_doi.sql",
    );
  });

  it("nenhum SQL marca conteúdo como 'reviewed' sem CRM e UF na mesma instrução", () => {
    const culpados: string[] = [];
    for (const { caminho, sql } of arquivos) {
      for (const trecho of escritasDeStatus(sql)) {
        if (!CRM.test(sql) || !UF.test(sql)) culpados.push(`${caminho}: ${trecho}`);
      }
    }
    expect(
      culpados.join("\n"),
      "SQL carimbando conteúdo como revisado sem nomear CRM e UF — o selo diz ao " +
        "médico e ao paciente que um profissional registrado conferiu aquilo",
    ).toBe("");
  });

  it("o detector separa ESCRITA de leitura", () => {
    // A primeira versão desta guarda casava com a palavra `'reviewed'` em
    // qualquer lugar, e acusou três migrations que apenas LEEM: um `WHERE`, uma
    // política de RLS e um filtro `IN`. Guarda que casa com o vocabulário pune
    // quem usa o valor corretamente — é o mesmo erro que já cometi duas vezes
    // hoje, na varredura da diretriz e na dos refs de projeto Supabase. Então o
    // detector tem teste próprio.
    const leituras = [
      "select 1 from c where c.review_status = 'reviewed';",
      "create policy p on t using (review_status = 'reviewed' or is_admin());",
      "select 1 from c where c.review_status in ('reviewed', 'ai_generated');",
      "alter table t add constraint ck check (review_status in ('pending','reviewed'));",
      "update t set content = 'x' where review_status = 'reviewed';",
    ];
    for (const l of leituras) {
      expect(escritasDeStatus(l), `leitura tratada como carimbo: ${l}`).toEqual([]);
    }

    const escritas = [
      "update public.knowledge_chunks set review_status = 'reviewed' where id = 1;",
      "insert into public.knowledge_chunks (content, review_status) values ('x', 'reviewed');",
      "update c set review_status='reviewed', reviewed_by='alguém' where topic = 'ea';",
    ];
    for (const e of escritas) {
      expect(escritasDeStatus(e).length, `carimbo não detectado: ${e}`).toBeGreaterThan(0);
    }
  });

  it("nenhum SQL escreve em content_review_status sem CRM e UF", () => {
    const culpados: string[] = [];
    for (const { caminho, sql } of arquivos) {
      const escreve = /(insert\s+into|update)\s+[^\s;]*content_review_status/is.test(sql);
      if (!escreve) continue;
      if (!CRM.test(sql) || !UF.test(sql)) culpados.push(caminho);
    }
    expect(
      culpados.join("\n"),
      "gravação em content_review_status sem CRM e UF",
    ).toBe("");
  });

  it("a página pública diz que o conteúdo ainda não passou por revisão médica", () => {
    // Enquanto não houver revisão de fato, o site precisa dizer isso onde
    // alguém procura procedência. Sem esta frase, o silêncio é lido como
    // "revisado" — que é o mesmo engano do selo, só que por omissão.
    const pagina = readFileSync("src/pages/public/Referencias.tsx", "utf8");
    expect(pagina, "sumiu o bloco de responsável pelo site").toMatch(/Responsável pelo site/);
    expect(
      pagina,
      "a página não diz mais que o conteúdo não passou por revisão de médico com CRM",
    ).toMatch(/não passou por revisão de médico[\s\S]{0,40}CRM/);
  });

  it("a tela de administração só mostra o selo com CRM ao lado do nome", () => {
    // O nome sozinho já parece aval. O CRM é o que torna a afirmação
    // conferível por quem lê.
    const admin = readFileSync("src/pages/app/AdminConteudo.tsx", "utf8");
    const linhaDoSelo = admin.split("\n").find((l) => l.includes("reviewer_name"));
    expect(linhaDoSelo, "não achei onde o selo é montado").toBeTruthy();
    expect(
      admin,
      "o nome do revisor aparece sem o CRM junto",
    ).toMatch(/reviewer_name\}[^\n]*CRM \$\{[^\n]*reviewer_crm/);
  });
});
