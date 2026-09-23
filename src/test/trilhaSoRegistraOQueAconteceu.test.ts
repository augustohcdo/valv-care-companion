/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Função do banco que grava na trilha grava só o que aconteceu.
 *
 * ## O defeito, provado rodando
 *
 * Um Postgres 16 subiu nesta máquina, com o esquema mínimo que as funções
 * tocam, e as duas foram carregadas **exatamente como estavam no repositório**:
 *
 *   · `desvincular_medico()` de um paciente SEM médico vinculado devolvia
 *     `{"ok": true}` e gravava `doctor_patient_unlinked` com `doctor_id: null`;
 *   · `admin_definir_papel(u, 'medico', false)` sobre quem NUNCA teve o papel
 *     apagava zero linhas e gravava `role_revoked`;
 *   · conceder o mesmo papel duas vezes gravava DOIS `role_granted` — o
 *     `on conflict do nothing` engolia a segunda inserção, o registro não.
 *
 * Quatro linhas na trilha, três afirmando o que não ocorreu. E as duas telas
 * anunciavam sucesso, porque `error` vinha nulo: recusa levanta exceção, mas
 * **não ter o que fazer, não**.
 *
 * ## Por que isto é pior do que uma trilha incompleta
 *
 * A trilha é o documento que responde "quem tirou o papel de administrador
 * daquele usuário, e quando". Uma trilha incompleta faz quem a lê procurar em
 * outro lugar. Uma que AFIRMA o que não houve faz quem a lê parar de procurar —
 * e num caso de papel revogado, esconde quem de fato revogou por outro caminho.
 *
 * `writeErrors.test.ts` já dizia isto para o lado de `src/`, com estas palavras:
 * "uma trilha que afirma o que não aconteceu é pior que uma incompleta". A regra
 * estava escrita há meses. Faltava no banco.
 *
 * ## A medição, antes da regra
 *
 * Oito funções fazem DML e gravam trilha. **Seis condicionavam, duas não** — e
 * `desvincular_medico` está no MESMO ARQUIVO que `responder_vinculo`, que
 * condiciona. A mesma forma de todas as famílias desta sessão: a lição
 * aprendida, escrita, aplicada ao vizinho, ausente aqui.
 */

const MIGRATIONS = "supabase/migrations";

/** As tabelas de trilha deste banco. */
const TRILHAS = /insert\s+into\s+public\.(audit_logs|consent_audit_log|integration_audit_log)/i;

/** Escrita que pode não achar linha nenhuma. */
const DML = /\b(update\s+public\.\w|delete\s+from\s+public\.\w|insert\s+into\s+public\.\w)/i;

/**
 * Como se reconhece que a função condicionou o registro.
 *
 * Deliberadamente amplo, e por experiência: os seis acertos desta base usam
 * idiomas diferentes — `if not found then raise`, `get diagnostics ... ROW_COUNT`,
 * `returning ... into`, e a recusa por precondição (`if status <> 'pendente'`).
 * Exigir UM idioma reprovaria cinco funções corretas, que é a guarda que pune
 * quem fez certo — e essa alguém desliga.
 */
const CONDICIONA = /\bROW_COUNT\b|\bFOUND\b|\breturning\b|\braise\s+exception\b/i;

export interface FuncaoDoBanco {
  nome: string;
  arquivo: string;
  /** O corpo SEM comentários — ver `semComentarios`. */
  corpo: string;
  /** O corpo cru, para quando a asserção é sobre o texto escrito. */
  cru: string;
}

/**
 * O corpo sem comentários, com as linhas preservadas.
 *
 * Não é detalhe: a primeira versão desta guarda lia o corpo cru, e a inversão
 * mostrou o preço. Mutei `admin_definir_papel` para não conferir nada — tirei o
 * `get diagnostics ... ROW_COUNT`, tirei as exceções — e a regra de classe
 * **aprovou**, porque o comentário logo acima da linha removida ainda dizia a
 * palavra `ROW_COUNT`.
 *
 * Quer dizer: a guarda estava passando por causa da documentação do conserto,
 * não do conserto. É a forma exata do defeito que ela existe para pegar, dentro
 * dela mesma — e só apareceu porque a inversão foi feita, e refeita quando a
 * própria asserção da mutação acusou a mesma coisa.
 */
function semComentarios(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, "");
}

/**
 * As funções do banco, na definição que VALE.
 *
 * Migrations posteriores redefinem funções anteriores com `create or replace`:
 * ler a primeira definição mediria código que não existe mais. A varredura
 * percorre os arquivos em ordem e a última definição de cada nome vence — que é
 * a ordem em que o Postgres as aplica.
 */
export function funcoesDoBanco(dir = MIGRATIONS): FuncaoDoBanco[] {
  const porNome = new Map<string, FuncaoDoBanco>();
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\([\s\S]*?\$\$([\s\S]*?)\$\$/gi;

  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const texto = readFileSync(join(dir, arquivo), "utf8");
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      porNome.set(m[1], {
        nome: m[1], arquivo, corpo: semComentarios(m[2]), cru: m[2],
      });
    }
  }
  return [...porNome.values()];
}

describe("a trilha de auditoria registra só o que aconteceu", () => {
  const funcoes = funcoesDoBanco();

  it("a varredura acha as funções — senão ela aprova sobre nada", () => {
    expect(funcoes.length, "nenhuma função encontrada nas migrations").toBeGreaterThanOrEqual(50);
    const comTrilha = funcoes.filter((f) => TRILHAS.test(f.corpo));
    expect(
      comTrilha.length,
      "nenhuma função grava trilha — o detector das tabelas de trilha parou de casar",
    ).toBeGreaterThanOrEqual(6);
  });

  it("toda função que escreve E registra condiciona o registro ao trabalho", () => {
    /**
     * A regra sobre a classe. A próxima função que gravar trilha depois de um
     * UPDATE entra sozinha — inclusive numa migration que ainda não existe.
     */
    const cegas: string[] = [];
    for (const f of funcoes) {
      if (!TRILHAS.test(f.corpo) || !DML.test(f.corpo)) continue;
      if (!CONDICIONA.test(f.corpo)) {
        cegas.push(`  · ${f.nome}  (${f.arquivo})`);
      }
    }
    expect(
      cegas,
      `\n${cegas.join("\n")}\n\n` +
        "Estas funções escrevem e gravam trilha sem conferir se a escrita achou\n" +
        "alguma linha. Zero linhas afetadas não levanta erro: a função devolve\n" +
        "sucesso, a tela anuncia a ação, e a trilha afirma um evento que não\n" +
        "houve — no registro que existe para provar o que houve.\n\n" +
        "Vale qualquer idioma que condicione: `if not found then raise`,\n" +
        "`get diagnostics ... ROW_COUNT`, `returning ... into`, ou recusar pela\n" +
        "precondição como `responder_vinculo` faz.",
    ).toEqual([]);
  });

  it("as duas consertadas continuam conferindo — e continuam fazendo o trabalho", () => {
    /**
     * A regra de classe acima passa com QUALQUER uma das palavras. Este bloco
     * ancora o conserto concreto, porque a regra ampla sozinha aceitaria um
     * `raise exception` de outro assunto no mesmo corpo.
     */
    const porNome = Object.fromEntries(funcoes.map((f) => [f.nome, f.corpo]));

    expect(
      porNome["desvincular_medico"],
      "desvincular_medico precisa sair antes de gravar quando não há vínculo",
    ).toMatch(/if\s+v_doctor\s+is\s+null\s+then[\s\S]{0,200}return/i);
    expect(
      porNome["desvincular_medico"],
      "e o retorno precisa dizer se desvinculou — `ok: true` sozinho não distingue",
    ).toMatch(/'desvinculado'/);

    expect(
      porNome["admin_definir_papel"],
      "admin_definir_papel precisa ler ROW_COUNT: `on conflict do nothing` não levanta erro",
    ).toMatch(/get\s+diagnostics\s+\w+\s*=\s*ROW_COUNT/i);
    expect(
      porNome["admin_definir_papel"],
      "e só gravar a trilha quando houve linha",
    ).toMatch(/if\s+v_linhas\s*>\s*0\s+then[\s\S]{0,400}insert\s+into\s+public\.audit_logs/i);

    // O outro lado: o trabalho não pode ter sumido junto com o registro falso.
    expect(porNome["desvincular_medico"]).toMatch(/update\s+public\.patients\s+set\s+linked_doctor_id\s*=\s*null/i);
    expect(porNome["admin_definir_papel"]).toMatch(/delete\s+from\s+public\.user_roles/i);
  });

  it("quem chama pelo TypeScript lê a resposta, e não só o `error`", () => {
    /**
     * A função passou a dizer a verdade; faltava a tela ouvir. As duas
     * descartavam `data` e anunciavam sucesso sobre `error === null` — e recusa
     * levanta exceção, mas não-ter-o-que-fazer não levanta nada.
     *
     * ## Os comentários saem antes, e por experiência própria
     *
     * A primeira versão deste bloco lia o arquivo cru. A inversão — tirar o
     * `alterado` do código de `AdminUsuarios` — **passou**, porque o comentário
     * que documenta o conserto escreve a palavra. A guarda estava sendo
     * satisfeita pela prosa sobre o conserto, e não pelo conserto.
     *
     * Terceira vez nesta rodada: aconteceu igual na regra do banco (o
     * `ROW_COUNT` sobrevivendo num comentário) e na asserção da própria
     * mutação. Guarda que lê comentário não confere código.
     */
    const semCom = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");

    const medico = semCom(readFileSync("src/pages/app/PacienteMedico.tsx", "utf8"));
    expect(
      medico,
      "PacienteMedico descarta o resultado de desvincular_medico",
    ).toMatch(/const\s*\{\s*data\s*,\s*error\s*\}\s*=\s*await\s+supabase\.rpc\("desvincular_medico"\)/);
    expect(medico, "e precisa olhar o campo que diz se desvinculou").toMatch(/desvinculado/);

    const admin = semCom(readFileSync("src/pages/app/AdminUsuarios.tsx", "utf8"));
    expect(admin, "AdminUsuarios precisa olhar `alterado`").toMatch(/alterado/);
    expect(
      admin,
      "e ter texto próprio para 'nada mudou' — reusar o de sucesso é o defeito de novo",
    ).toMatch(/semEfeito/);
  });
});
