import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Guarda: a IA não pode relatar sucesso sobre trabalho que não fez.
 *
 * Dois defeitos medidos exercitando os dez modos contra produção, ambos da
 * mesma família e ambos no lugar mais caro que existe neste produto — um
 * documento clínico que alguém vai assinar:
 *
 * 1. **Resposta vazia devolvida como 200.** A extração era
 *    `parts?.find(...)?.text ?? ""`. Se o candidato viesse sem parte de texto,
 *    a função respondia sucesso com `content: ""`, e a tela faz
 *    `setText(data.content ?? "")` — o médico via uma caixa em branco com cara
 *    de documento gerado, sem nenhum aviso de que nada foi produzido.
 *
 * 2. **`MAX_TOKENS` aceito junto com `STOP`.** Um sumário de alta cortado no
 *    meio de uma posologia chega à tela idêntico a um documento inteiro. É pior
 *    que não ter documento, porque parece completo.
 *
 * A terceira parte é a tradução de erro: três telas chamam `clinical-ai` e só
 * uma tratava o 429. As outras duas mostravam "falha ao gerar" para uma
 * situação que se resolve esperando cinco minutos.
 */

const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
const FUNCAO = "supabase/functions/clinical-ai/index.ts";

describe("resposta sem conteúdo é erro, não sucesso", () => {
  const fonte = ler(FUNCAO);

  it("recusa quando o modelo devolve texto vazio", () => {
    // O `?? ""` pode continuar existindo; o que não pode é ele seguir para a
    // resposta de sucesso sem ninguém olhar.
    expect(fonte, "não há verificação de conteúdo vazio").toMatch(/if \(!content\.trim\(\)\)/);
    const bloco = fonte.slice(fonte.indexOf("if (!content.trim())"));
    expect(bloco.slice(0, 500), "conteúdo vazio não devolve status de erro").toMatch(/status: 5\d\d/);
  });

  it("a checagem vem ANTES da resposta de sucesso", () => {
    // Se ficasse depois, seria decorativa.
    const check = fonte.indexOf("if (!content.trim())");
    const sucesso = fonte.indexOf("return new Response(JSON.stringify({\n      content,");
    expect(check).toBeGreaterThan(0);
    expect(sucesso).toBeGreaterThan(0);
    expect(check, "a verificação está depois do retorno de sucesso").toBeLessThan(sucesso);
  });
});

describe("documento cortado é sinalizado", () => {
  it("a função informa quando parou por limite de tamanho", () => {
    const fonte = ler(FUNCAO);
    expect(fonte, "MAX_TOKENS não é distinguido de STOP na resposta")
      .toMatch(/truncado:\s*candidate\.finishReason === "MAX_TOKENS"/);
  });

  it("a tela do gerador de documentos mostra o aviso, e não só um toast", () => {
    // Toast some. Documento cortado precisa continuar avisando enquanto a
    // pessoa lê e revisa.
    const tela = ler("src/components/DocumentGenerator.tsx");
    expect(tela).toMatch(/data\?\.truncado/);
    expect(tela, "o aviso não aparece junto ao texto").toMatch(/truncado &&/);
    expect(tela).toMatch(/incompleto/i);
  });
});

describe("a tradução de erro da IA é uma só", () => {
  const TELAS = [
    "src/components/ClinicalAIPanel.tsx",
    "src/components/DocumentGenerator.tsx",
    "src/components/CaseLaudoReader.tsx",
  ];

  it("as três telas que chamam a IA usam a mesma tradução", () => {
    for (const t of TELAS) {
      expect(ler(t), `${t} não usa traduzirFalhaIA`).toContain("traduzirFalhaIA");
    }
  });

  it("nenhuma tela reimplementa o mapeamento de status", () => {
    // Era assim que elas divergiam: cada uma com o seu `if (status === ...)`,
    // e só uma conhecendo o 429.
    for (const t of TELAS) {
      const fonte = ler(t).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(fonte, `${t} ainda testa status na mão`).not.toMatch(/status === (402|429|422|503)/);
    }
  });

  it("o limite de uso diz que é passageiro, e não só que falhou", () => {
    const mapa = ler("src/lib/aiErros.ts");
    const bloco = mapa.slice(mapa.indexOf("case 429:"), mapa.indexOf("case 402:"));
    expect(bloco).toMatch(/temporario: true/);
    expect(bloco, "não diz quantas chamadas cabem na hora").toMatch(/30/);
  });

  it("toda tela que chama clinical-ai está coberta por esta guarda", () => {
    // Uma tela nova que chamasse a IA sem tradução escaparia — e foi
    // exatamente assim que `DocumentGenerator` e `CaseLaudoReader` ficaram
    // para trás quando o 429 foi tratado só no painel.
    function arquivos(dir: string): string[] {
      return readdirSync(resolve(raiz, dir)).flatMap((n) => {
        const rel = join(dir, n);
        try {
          return readdirSync(resolve(raiz, rel)).length ? arquivos(rel) : [];
        } catch {
          return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [rel] : [];
        }
      });
    }
    const chamadoras = arquivos("src").filter((f) => ler(f).includes('invoke("clinical-ai"'));
    const semTraducao = chamadoras.filter((f) => !ler(f).includes("traduzirFalhaIA"));
    // `NovoCaso` chama a IA para extrair laudo no wizard; se entrar aqui, tem
    // que traduzir o erro como as outras.
    expect(semTraducao, "telas que chamam a IA sem traduzir o erro").toEqual([]);
  });
});
