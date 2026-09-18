// Este teste lê o disco; tsconfig.app.json restringe `types`, daí a referência.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * "Não tem registro" e "não consegui ler" são coisas diferentes na tela.
 *
 * ## Os hooks estavam certos. As dezesseis chamadas, não.
 *
 * `usePatient()` e `useDoctor()` separam os dois estados, e escrevem isso no
 * próprio JSDoc:
 *
 *     if (error) throw error;   // falhou
 *     return data;              // null = não tem registro
 *
 *   > "Retorna `null` (não erro) quando o usuário não tem registro de paciente
 *   >  — é o caso legítimo de quem ainda não completou o perfil."
 *
 * Nenhuma das telas que os chamavam lia o `error`. Todas pegavam só `data`. Em
 * falha de leitura, `data` é `undefined`, cai no MESMO `!patient` do caso
 * legítimo, e os dois estados viram um.
 *
 * ## O que o usuário lia
 *
 * Medido renderizando as 38 telas de `/app/` com o cliente do Supabase falhando
 * em tudo — 13 reconheciam a falha, 25 calavam:
 *
 *   · `PacienteMedicacoes` — "Complete seu perfil para gerenciar medicações.";
 *   · `PacienteDiario` — "Complete seu perfil para começar a registrar sintomas.";
 *   · `PacienteMedico` — "Você ainda não está vinculado(a) a um cardiologista.".
 *
 * As três mandam o paciente fazer algo que ele JÁ FEZ, e escondem a medicação
 * dele enquanto isso. Em valvopatia, o que o paciente toma e o que ele sente
 * são as duas coisas que a consulta seguinte vai perguntar.
 *
 * E no `AppLayout` estava a versão mais nítida, no nome da variável:
 *
 *     const registroConhecido = isDoctor ? !carregandoMedico : !carregandoPaciente;
 *
 * Depois de uma falha, `isLoading` é `false` — então `registroConhecido` ficava
 * **`true` sem nada ter sido conhecido**.
 *
 * ## Por que a varredura descobre o hook por PROPRIEDADE, e não por nome
 *
 * A lista aqui não é `["usePatient", "useDoctor"]`. É: todo hook de
 * `src/hooks/` cujo `queryFn` faz `throw error` E resolve com
 * `maybeSingle`/`single` — a forma exata que promete "null significa ausente".
 * Um hook novo com essa forma entra na varredura sozinho.
 *
 * É a correção do erro que esta sessão cometeu três vezes: regra certa amarrada
 * ao arquivo onde o defeito apareceu.
 *
 * ## O que esta guarda NÃO prova
 *
 * Que a tela faça a coisa certa com o erro. Ela cobra que o `error` seja
 * OBSERVADO — é o piso. O teto é `telasComLeituraFalhando.test.tsx`, que
 * renderiza a tela com a leitura falhando e cobra o que o usuário lê.
 */

const HOOKS = "src/hooks";
const RAIZ = "src";

/** Pastas que não são tela nem hook nosso. */
const IGNORAR = new Set(["node_modules", "dist", "coverage"]);

function varrer(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) varrer(full, out);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
}

/**
 * Os hooks que prometem a distinção — achados pela forma, não pelo nome.
 */
export function hooksComTresEstados(dir = HOOKS): string[] {
  return readdirSync(dir)
    .filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n))
    .filter((n) => {
      const texto = readFileSync(join(dir, n), "utf8");
      return /throw error/.test(texto) && /\.(maybeSingle|single)\(/.test(texto);
    })
    .map((n) => n.replace(/\.tsx?$/, ""));
}

/**
 * As chamadas de `hook()` neste arquivo que NÃO observam o erro.
 *
 * Três formas contam como observar, porque as três existem em código correto e
 * reprovar qualquer uma seria falso vermelho:
 *
 *   · `const { error } = useX()` — e com apelido, `{ error: erroX }`;
 *   · `const q = useX()` seguido de `q.error` em algum lugar do arquivo;
 *   · `const { isError } = useX()`, que é o mesmo dado noutro formato.
 */
export function chamadasQueIgnoramErro(texto: string, hook: string): string[] {
  const achadas: string[] = [];
  const re = new RegExp(`(const|let)\\s+(\\{[^}]*\\}|\\w+)\\s*=\\s*${hook}\\s*\\(`, "g");
  for (const m of texto.matchAll(re)) {
    const alvo = m[2];
    if (alvo.startsWith("{")) {
      if (!/\berror\b|\bisError\b/.test(alvo)) achadas.push(m[0].replace(/\s+/g, " "));
      continue;
    }
    // Sem desestruturar: vale se o arquivo usa `<var>.error` ou `<var>.isError`.
    const usa = new RegExp(`\\b${alvo}\\.(error|isError)\\b`).test(texto);
    if (!usa) achadas.push(m[0].replace(/\s+/g, " "));
  }
  return achadas;
}

const hooks = hooksComTresEstados();
const arquivos = varrer(RAIZ).filter((f) => !f.startsWith(`${HOOKS}/`));

describe("quem lê registro clínico separa 'não tem' de 'não consegui ler'", () => {
  it("a varredura acha os hooks que prometem a distinção", () => {
    // Sem isto, renomear os hooks deixaria a varredura com zero alvos e o teste
    // abaixo passaria por não ter olhado nada — verde de graça, que é o defeito
    // que este arquivo inteiro persegue.
    expect(
      hooks.length,
      `nenhum hook de ${HOOKS} tem a forma "throw error + maybeSingle"`,
    ).toBeGreaterThan(0);
  });

  /**
   * E `> 0` não basta — foi a inversão que me mostrou.
   *
   * Tirando o `throw error` do `usePatient`, a lista de alvos encolhia de dois
   * para um, o `> 0` continuava verdadeiro, e a varredura passava a conferir
   * METADE das telas sem reprovar nada. Guarda que encolhe em silêncio é verde
   * por ter olhado menos — a mesma coisa que ela existe para achar.
   *
   * Então a regra vira o outro lado: hook que resolve UM registro (`maybeSingle`
   * / `single`) tem de distinguir "não existe" de "não consegui ler". Quem
   * perder a distinção reprova aqui, em vez de sumir da varredura.
   */
  it("todo hook que resolve um registro distingue ausência de falha", () => {
    const semDistincao: string[] = [];

    for (const nome of readdirSync(HOOKS)) {
      if (!/\.tsx?$/.test(nome) || /\.test\./.test(nome)) continue;
      const texto = readFileSync(join(HOOKS, nome), "utf8");
      if (!/\.(maybeSingle|single)\(/.test(texto)) continue;

      if (/useQuery/.test(texto)) {
        // Forma react-query: só `throw` faz o `error` chegar a quem chama.
        if (!/throw error/.test(texto)) {
          semDistincao.push(`${nome} (useQuery sem \`throw error\`)`);
        }
        continue;
      }

      // Forma contexto/estado — o `useAuth` é assim. Aqui o que se cobra é não
      // CAIR NO CAMINHO DE SUCESSO: o ramo do erro tem de sair (`return`) ou
      // lançar. Ele expõe a falha por uma flag própria (`profileError`), que é
      // uma distinção tão boa quanto a do react-query.
      const ramo = texto.slice(texto.indexOf("if (error)"), texto.indexOf("if (error)") + 400);
      if (!/if \(error\)/.test(texto) || !/\breturn\b|\bthrow\b/.test(ramo)) {
        semDistincao.push(`${nome} (o ramo do erro segue para o caminho de sucesso)`);
      }
    }

    expect(
      semDistincao,
      `${semDistincao.join(", ")} — resolve um registro sem separar os dois estados.\n\n` +
        "A falha chega às telas indistinguível de \"não tem registro\", e a tela\n" +
        "afirma ausência sobre leitura que não aconteceu.\n\n" +
        "Esta regra existe porque a anterior era `hooks.length > 0`, e a inversão\n" +
        "mostrou o buraco: tirando a forma de UM hook, a varredura encolhia de dois\n" +
        "alvos para um, o `> 0` continuava verdadeiro, e metade das telas deixava\n" +
        "de ser conferida sem nada reprovar.\n\n" +
        "E a primeira versão DESTA regra exigia a palavra `throw error` — reprovou\n" +
        "o `useAuth`, que faz a distinção certinha por uma flag própria. Guarda tem\n" +
        "de cobrar a garantia, não o vocabulário; por isso são duas formas aqui.",
    ).toEqual([]);
  });

  it("nenhuma tela lê só o `data`", () => {
    const cegas: string[] = [];
    for (const arquivo of arquivos) {
      const texto = readFileSync(arquivo, "utf8");
      for (const hook of hooks) {
        for (const chamada of chamadasQueIgnoramErro(texto, hook)) {
          cegas.push(`  · ${arquivo} — ${chamada}`);
        }
      }
    }

    expect(
      cegas,
      `\n${cegas.join("\n")}\n\n` +
        "Estes hooks devolvem `null` quando NÃO HÁ registro e lançam quando a\n" +
        "leitura FALHA. Lendo só o `data`, os dois viram `undefined` e a tela\n" +
        "afirma ausência sobre uma leitura que não aconteceu — foi assim que o\n" +
        "paciente passou a ler \"Complete seu perfil\" tendo o perfil completo, com\n" +
        "a medicação dele escondida atrás da frase.\n\n" +
        "Observe o `error` e diga na tela que não foi possível ler.",
    ).toEqual([]);
  });

  it("o detector acusa a chamada cega e poupa a que observa", () => {
    // Contraprova nos dois sentidos. Com a lista em zero, o teste de cima passa
    // tanto com as telas corretas quanto com o detector quebrado.
    const cega = 'const { data: patient, isLoading } = usePatient();';
    const comErro = 'const { data: patient, error: erroPaciente } = usePatient();';
    const comIsError = 'const { data: patient, isError } = usePatient();';
    const semDesestruturar = 'const q = usePatient();\nif (q.error) return <Falha />;';
    const semDesestruturarCego = 'const q = usePatient();\nreturn <div>{q.data?.id}</div>;';

    expect(chamadasQueIgnoramErro(cega, "usePatient"), "não viu a chamada cega").toHaveLength(1);
    expect(chamadasQueIgnoramErro(comErro, "usePatient"), "acusou quem observa o erro").toEqual([]);
    expect(chamadasQueIgnoramErro(comIsError, "usePatient"), "acusou quem usa isError").toEqual([]);
    expect(
      chamadasQueIgnoramErro(semDesestruturar, "usePatient"),
      "acusou quem lê q.error sem desestruturar",
    ).toEqual([]);
    expect(
      chamadasQueIgnoramErro(semDesestruturarCego, "usePatient"),
      "não viu a chamada cega sem desestruturação",
    ).toHaveLength(1);
  });
});
