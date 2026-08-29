// Como as outras guardas, esta lê o disco e por isso puxa os tipos de Node aqui.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FONTE_EUROSCORE2, FONTE_EACVI_PROTESES, FONTE_DUBOIS, FONTE_LIMITE_PROJECAO } from "@/lib/fontes";

/**
 * Guardas das ferramentas clínicas livres.
 *
 * A aritmética já está protegida em `src/lib/euroscore2.test.ts` e
 * `src/lib/mismatch.test.ts` — os 25 coeficientes do EuroSCORE II e os 23
 * limiares e comparadores da EACVI foram validados por **teste de mutação**,
 * um a um, e nenhuma mutação escapou.
 *
 * O que sobra é o que uma suíte de cálculo não vê: a procedência dos dados, a
 * porta pública, e a promessa de que existe **uma** implementação servindo os
 * dois lugares. É por aí que este projeto já foi mordido três vezes.
 */

const ler = (p: string) => readFileSync(p, "utf8");
const MIGRATIONS = "supabase/migrations";

/** Só o que a pessoa lê. Comentário que explica um defeito antigo cita o defeito. */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function sqlDeTodasAsMigrations(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ler(join(MIGRATIONS, f)))
    .join("\n");
}

/** Os arquivos das ferramentas, para as varreduras de texto. */
const COMPONENTES = readdirSync("src/components/ferramentas")
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => ({ nome: f, fonte: ler(join("src/components/ferramentas", f)) }));

describe("catálogo de próteses — a procedência que foi prometida", () => {
  const sql = sqlDeTodasAsMigrations();

  it("nenhuma EOA pode existir sem a fonte junto — e quem impõe isso é o banco", () => {
    // A regra: uma linha só recebe `effective_orifice_area` quando existe fonte
    // citável para AQUELE modelo e AQUELE tamanho. Sem interpolar entre
    // tamanhos, sem herdar de "modelo parecido", sem média de família.
    //
    // A primeira versão desta guarda varria o texto das migrations exigindo
    // `eoa_source_url` em toda instrução que escrevesse EOA — e ela achou um
    // caso real: a migration de 2026-07-21 semeia 12 linhas com EOA e nenhuma
    // fonte. No banco de hoje elas não existem (apagadas em 07-25; conferido
    // pelo RPC público: 29 com EOA, 0 sem fonte), mas voltariam num projeto
    // novo que replicasse o histórico.
    //
    // Varredura de texto era o lugar errado. Isto é invariante de dado, então
    // quem impõe é a restrição no banco — que vale para toda escrita futura,
    // venha de migration, de script ou de mão.
    expect(sql).toMatch(/prosthesis_catalog_eoa_com_fonte/);
    expect(sql).toMatch(
      /check \(effective_orifice_area is null or eoa_source_url is not null\)/i,
    );
    // E o histórico sem procedência é limpo antes da restrição entrar, senão a
    // replicação do histórico quebraria na própria migration.
    expect(sql).toMatch(
      /set effective_orifice_area = null[\s\S]{0,200}where effective_orifice_area is not null\s+and eoa_source_url is null/i,
    );
  });

  it("o banco recusa tamanho implausível — a trava do defeito ×10", () => {
    // Sete linhas da Meril estavam gravadas como 215, 245, 275 e 305 porque a
    // coluna era `integer` e os tamanhos intermediários têm meio milímetro. O
    // médico lia "Myval 305" na lista de próteses.
    expect(sql).toMatch(/prosthesis_catalog_size_plausivel/);
    expect(sql).toMatch(/size\s*<=\s*42/i);
  });

  it("o gradiente de referência tem coluna própria — não vive dentro da prosa", () => {
    // Enquanto o token da Management API esteve recusado, o gradiente foi
    // gravado numa frase dentro de `description`: dava para ler, mas o
    // recomendador não conseguia usá-lo e ninguém conseguia filtrar por ele.
    // Com a coluna criada, os scripts passaram a limpar essa sobra — e esta
    // guarda existe para o remendo não voltar.
    expect(sql).toMatch(/add column if not exists mean_gradient_ref numeric/i);
    for (const script of ["aplicar-eoa.mjs", "aplicar-estudos.mjs"]) {
      const fonte = ler(`scripts/catalogo/${script}`);
      expect(fonte, `${script} grava o gradiente na coluna?`).toMatch(/mean_gradient_ref:/);
      expect(
        /description:\s*\(limpa \+ frase\)/.test(fonte),
        `${script} voltou a enfiar o gradiente na descrição`,
      ).toBe(false);
    }
  });

  it("trocar o retorno da função exige DROP antes do CREATE", () => {
    // O Postgres recusa `CREATE OR REPLACE` quando o tipo de retorno muda, e a
    // migration do gradiente muda. Medido ao aplicar: a transação inteira
    // reverteu, inclusive as colunas.
    const gradiente = ler("supabase/migrations/20260828020000_catalogo_gradiente_de_referencia.sql");
    const drop = gradiente.indexOf("DROP FUNCTION IF EXISTS public.catalogo_proteses()");
    const create = gradiente.indexOf("CREATE FUNCTION public.catalogo_proteses()");
    expect(drop, "sem DROP, a migration não aplica").toBeGreaterThan(0);
    expect(create, "sem CREATE, a função some").toBeGreaterThan(drop);
  });

  it("a leitura pública é por função, não pela tabela aberta a anônimo", () => {
    expect(sql).toMatch(/create or replace function public\.catalogo_proteses\(\)/i);
    expect(sql).toMatch(/grant execute on function public\.catalogo_proteses\(\) to anon, authenticated/i);
    // Abrir SELECT da tabela para `anon` vazaria toda coluna futura junto.
    expect(sql).not.toMatch(/grant select on public\.prosthesis_catalog to [^;]*anon/i);
  });

  it("anônimo e autenticado não podem escrever no catálogo", () => {
    // Herança do `GRANT ALL` padrão do Supabase: `anon` tinha
    // INSERT/UPDATE/DELETE/TRUNCATE. A RLS segurava, mas era camada única — e o
    // DELETE voltava 204, não erro.
    expect(sql).toMatch(
      /revoke insert, update, delete, truncate, references\s+on public\.prosthesis_catalog from anon, authenticated/i,
    );
  });

  it("a tela de novo caso não voltou a consultar a tabela direto", () => {
    // Duas consultas ao mesmo catálogo divergem no primeiro campo novo — é a
    // lição da lista de tabelas do backup, que envelheceu quinze tabelas atrás.
    const novoCaso = ler("src/pages/app/NovoCaso.tsx");
    expect(novoCaso).not.toMatch(/from\(["']prosthesis_catalog["']\)/);
    // Com limite de palavra: sem ele, `useCatalogoProtesesXX` satisfazia a
    // busca — foi o que a inversão desta guarda mostrou.
    expect(novoCaso).toMatch(/\buseCatalogoProteses\b/);
  });
});

describe("uma implementação, dois lugares", () => {
  it("a página pública e a interna montam o mesmo painel", () => {
    for (const pagina of ["src/pages/public/Ferramentas.tsx", "src/pages/app/MedicoFerramentas.tsx"]) {
      const fonte = ler(pagina);
      expect(fonte, `${pagina} não usa o painel compartilhado`).toMatch(
        /from "@\/components\/ferramentas\/PainelDeFerramentas"/,
      );
      // Cópia própria de qualquer calculadora seria o começo da divergência.
      expect(fonte, `${pagina} monta uma calculadora por fora do painel`).not.toMatch(
        /<Calculadora(Euroscore|Mismatch)\b/,
      );
    }
  });

  it("as três abas existem como rota concreta — o smoke só sonda caminho concreto", () => {
    const app = ler("src/App.tsx");
    for (const rota of ["/ferramentas", "/ferramentas/euroscore-ii", "/ferramentas/mismatch", "/ferramentas/proteses"]) {
      expect(app, `rota ausente: ${rota}`).toMatch(new RegExp(`path="${rota}"`));
    }
  });

  it("o caminho das ferramentas está no cabeçalho público", () => {
    // É o que regride primeiro numa refatoração de layout, e sem ele a
    // ferramenta gratuita volta a depender de rolar a página do médico.
    expect(ler("src/components/PublicHeader.tsx")).toMatch(/href: "\/ferramentas"/);
  });
});

describe("o que as ferramentas não podem afirmar", () => {
  it("nenhuma tela carimba revisão médica nem classe de diretriz em número calculado", () => {
    // A regra que já vale para o conteúdo gerado por IA: só um médico com nome
    // e CRM assina revisão, e resultado de cálculo não recebe classe de
    // recomendação de diretriz.
    for (const { nome, fonte } of COMPONENTES) {
      expect(fonte, `${nome} afirma revisão médica`).not.toMatch(/revisad[oa] por médico|revisão médica/i);
      expect(fonte, `${nome} carimba classe de recomendação`).not.toMatch(
        /Classe I{1,3}[ab]?\b|Nível de evidência/,
      );
    }
  });

  it("a calculadora do EuroSCORE II diz que ele não é escore de TAVI", () => {
    // O modelo foi derivado e validado em cirurgia cardíaca. Usá-lo para
    // planejar transcateter é aplicá-lo fora da população de derivação, e quem
    // abre a tela precisa ler isso antes do número.
    expect(ler("src/components/ferramentas/CalculadoraEuroscore.tsx")).toMatch(/TAVI/);
  });

  it("a projeção de mismatch vem com o limite dela escrito", () => {
    // A EOA projetada por tabela superestima o mismatch em relação à medida.
    // Uma ferramenta que só cita o que a sustenta é propaganda.
    const fonte = ler("src/components/ferramentas/CalculadoraMismatch.tsx");
    expect(fonte).toMatch(/superestima/i);
    expect(fonte).toMatch(/FONTE_LIMITE_PROJECAO/);
  });

  it("o catálogo não classifica fabricante", () => {
    // Catálogo neutro: sem nota, sem estrela, sem ranking. A mesma disciplina
    // já aplicada ao diretório de profissionais.
    const fonte = ler("src/components/ferramentas/CatalogoProteses.tsx");
    for (const palavra of ["melhor", "ranking", "estrela", "recomendado", "avaliação"]) {
      const usoReal = new RegExp(`>[^<]*\\b${palavra}`, "i");
      expect(usoReal.test(fonte), `catálogo exibe "${palavra}"`).toBe(false);
    }
  });

  it("a tela distingue foto oficial de desenho esquemático", () => {
    // Esta guarda mudou junto com a realidade. Antes, nenhum cartão tinha foto e
    // ela cobrava a frase "não é a foto do produto". Agora 17 famílias têm a
    // imagem oficial do fabricante e as outras seguem com o esquema — o que
    // importa passou a ser **o médico saber qual das duas está vendo**, porque
    // um esquema tomado por foto vira geometria que ninguém desenhou.
    const cartao = ler("src/components/ferramentas/CatalogoProteses.tsx");
    expect(cartao, "o cartão não rotula a foto oficial").toMatch(/foto do fabricante/i);
    expect(cartao, "o cartão não rotula o esquema").toMatch(/NOME_DA_FAMILIA/);
    // Tolerante a quebra de linha: a guarda é sobre a nota explicar a diferença,
    // não sobre as palavras caírem na mesma linha do arquivo. Ela chegou a
    // reprovar só porque o JSX reflowou "esquema da família / construtiva".
    expect(cartao.replace(/\s+/g, " "), "a nota não explica a diferença")
      .toMatch(/esquema da família construtiva/i);
    // E o esquema continua dizendo que não é a geometria do modelo.
    expect(ler("src/components/ferramentas/EsquemaProtese.tsx"))
      .toMatch(/não\*{0,2} a geometria do modelo/i);
  });
});

describe("as fontes citadas", () => {
  const fontes = { FONTE_EUROSCORE2, FONTE_EACVI_PROTESES, FONTE_DUBOIS, FONTE_LIMITE_PROJECAO };

  it("toda fonte tem citação, link de PubMed e o que saiu dela", () => {
    // Os quatro PMIDs foram conferidos na API do PubMed — e um deles eu tinha
    // inventado de memória: apontava para "An endoscopist with a painful
    // finger". Esta guarda não confere o conteúdo (o CI não tem rede), mas
    // impede que uma fonte entre sem link ou sem dizer o que sustenta.
    for (const [nome, f] of Object.entries(fontes)) {
      expect(f.citacao.length, `${nome} sem citação`).toBeGreaterThan(40);
      expect(f.url, `${nome} sem link do PubMed`).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
      expect(f.usadoPara.length, `${nome} não diz o que saiu dela`).toBeGreaterThan(20);
    }
  });

  it("cada calculadora mostra a fonte do modelo que executa", () => {
    expect(ler("src/components/ferramentas/CalculadoraEuroscore.tsx")).toMatch(/CitacaoDaFonte[\s\S]*FONTE_EUROSCORE2|FONTE_EUROSCORE2[\s\S]*CitacaoDaFonte/);
    expect(ler("src/components/ferramentas/CalculadoraMismatch.tsx")).toMatch(/FONTE_EACVI_PROTESES/);
  });
});

describe("a IA sem parede por hora", () => {
  const fn = ler("supabase/functions/clinical-ai/index.ts");

  it("o limite por hora não existe mais no código da function", () => {
    // Medido antes de remover: o uso clínico real ficava entre 1 e 7 chamadas
    // por dia, e o teto de 30/hora só aparecia no meio de uma discussão de
    // Heart Team com vários casos abertos.
    expect(fn).not.toMatch(/RATE_LIMIT_PER_HOUR/);
    expect(fn).not.toMatch(/60 \* 60 \* 1000/);
    expect(fn).toMatch(/RAJADA_POR_MINUTO/);
  });

  it("a trava que sobrou é de um minuto, não de uma hora", () => {
    expect(fn).toMatch(/const umMinutoAtras = new Date\(Date\.now\(\) - 60 \* 1000\)/);
  });

  it("o texto que o médico lê não promete um limite que não existe", () => {
    // Manter "30 chamadas por hora" escrito depois de remover o limite criaria,
    // num lugar novo, exatamente o defeito que esta sessão persegue.
    //
    // Sem comentários: o comentário que explica a remoção cita a frase antiga,
    // e a primeira versão desta guarda reprovou por causa dele. O que importa é
    // o que o médico lê, não o que o código explica a si mesmo.
    const erros = semComentarios(ler("src/lib/aiErros.ts"));
    expect(erros).not.toMatch(/30 chamadas por hora/);
    expect(erros).toMatch(/Não há limite de uso por hora ou por dia/);
  });

  it("o registro em audit_logs continua — o que saiu foi a parede, não o rastro", () => {
    expect(fn).toMatch(/action: "clinical_ai_call"/);
  });
});

describe("o LaTeX que vazava para a tela do médico", () => {
  it("todo ponto que guarda prosa da IA limpa a notação na entrada", () => {
    // Achado medindo: o modo `trends` devolveu "$60\\% \\rightarrow 58\\%$", e
    // `react-markdown` sem plugin de matemática mostra isso cru.
    //
    // A guarda mira cada gravação, uma a uma, e não "o arquivo cita a função".
    // A inversão mostrou por quê: apagando a limpeza do `setResults`, a versão
    // anterior continuava passando porque o `setChatHistory` ainda a citava —
    // metade da tela suja e verde no CI.
    const gravacoes: [string, RegExp][] = [
      ["ClinicalAIPanel · resultado do modo", /setResults\(\(prev\) => \(\{ \.\.\.prev, \[m\]: limparNotacaoMatematica\(/],
      ["ClinicalAIPanel · resposta do chat", /content: limparNotacaoMatematica\(res\.content\)/],
      ["DocumentGenerator · texto do documento", /setText\(limparNotacaoMatematica\(/],
    ];
    const fontes = {
      "ClinicalAIPanel": ler("src/components/ClinicalAIPanel.tsx"),
      "DocumentGenerator": ler("src/components/DocumentGenerator.tsx"),
    };
    for (const [rotulo, padrao] of gravacoes) {
      const alvo = rotulo.startsWith("ClinicalAIPanel") ? fontes.ClinicalAIPanel : fontes.DocumentGenerator;
      expect(padrao.test(alvo), `${rotulo}: guarda prosa da IA sem limpar a notação`).toBe(true);
    }
  });

  it("a proibição também está no prompt — as duas camadas", () => {
    // Instrução a modelo reduz a frequência, não a possibilidade. Por isso ela
    // não substitui o sanitizador; as duas coisas existem juntas.
    expect(ler("supabase/functions/clinical-ai/index.ts")).toMatch(/SEM LaTeX/);
  });
});
