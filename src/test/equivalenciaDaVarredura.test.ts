/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  chamadasDescartadas, contagemPorNome, totalDeChamadas, varreduraDeChamadas, varrerFontes,
} from "./resultadoDescartado";

/**
 * A refatoração de desempenho não mudou o veredito — medido, não afirmado.
 *
 * `varreduraDeChamadas` e `contagemPorNome` nasceram para tirar passadas de
 * `ts.createSourceFile` de duas guardas que estavam encostando no limite de 5s
 * do vitest (uma já reprovava por tempo). O comentário delas diz "mesma
 * garantia, um terço do trabalho" — e *mesma garantia* é exatamente o tipo de
 * frase que esta sessão inteira aprendeu a desconfiar: é uma promessa escrita
 * ao lado do código que deveria prová-la.
 *
 * Então aqui a promessa é medida, sobre o corpus de verdade: os dois caminhos
 * têm de devolver o MESMO total e a MESMA lista de linhas, arquivo por arquivo.
 * Uma otimização que perde um achado é um falso verde — a guarda continua
 * passando, e passa a passar por não olhar.
 *
 * Roda sobre uma amostra de arquivos para não pagar o custo que a refatoração
 * acabou de tirar; a amostra é tomada no fim da lista também, porque pegar só o
 * começo olharia um único diretório.
 */

const NOMES = ["fetch", "sendEmail", "sendAlert"];

/**
 * Código PLANTADO com achado — e por que ele é indispensável aqui.
 *
 * A primeira versão desta guarda comparava os dois caminhos só sobre o corpus
 * real, com piso no total de chamadas. A inversão que faz a passada única
 * devolver `descartadas: []` passou por ela: o corpus não tem chamada
 * descartada hoje — é justamente o que a guarda principal garante —, então a
 * igualdade era entre dois vazios. Piso no total não cobre a lista; cobertura
 * é garantia só sobre o que a guarda olha, e eu havia olhado o número errado.
 *
 * São as três assinaturas reais da história deste detector, mais as formas
 * corretas, para a igualdade valer nos dois sentidos: o que os dois caminhos
 * acusam e o que os dois absolvem.
 */
const PLANTADOS: Array<{ nome: string; codigo: string }> = [
  {
    nome: "descarta-o-fetch.mjs",
    codigo: [
      "const url = 'https://exemplo.invalid/x';",
      "await fetch(url, { method: 'PATCH', body: '{}' });",
      "console.log('+ Inovare Alpha: foto e página do fabricante');",
    ].join("\n"),
  },
  {
    nome: "conta-antes-de-mandar.mjs",
    codigo: [
      "let desativadas = 0;",
      "for (const linha of linhas) {",
      "  desativadas++;",
      "  await fetch(linha.url, { method: 'PATCH' });",
      "}",
      "console.log(`Desativadas: ${desativadas}`);",
    ].join("\n"),
  },
  {
    nome: "batimento-sem-olhar.mjs",
    codigo: [
      "try {",
      "  await fetch(VIGIA, { method: 'POST' });",
      "} catch (e) {",
      "  console.error(e);",
      "}",
    ].join("\n"),
  },
  {
    nome: "confere-o-ok.mjs",
    codigo: [
      "const r = await fetch(url);",
      "if (!r.ok) throw new Error(`falhou: ${r.status}`);",
    ].join("\n"),
  },
  {
    nome: "dispensa-declarada.mjs",
    codigo: [
      "// resultado descartado: ping de aquecimento, o efeito é o próprio pedido",
      "await fetch(url);",
    ].join("\n"),
  },
];

describe("a varredura de uma passada vê o mesmo que a de duas", () => {
  const todos = ["supabase/functions", "scripts", "src"].flatMap((r) => varrerFontes(r));
  // Amostra: 40 do começo, 40 do fim, e os que de fato têm achado hoje.
  const amostra = [...new Set([...todos.slice(0, 40), ...todos.slice(-40)])];

  it("o total e a lista de descartadas batem, arquivo por arquivo", () => {
    expect(amostra.length, "a amostra ficou vazia — a varredura não achou arquivos")
      .toBeGreaterThan(50);

    let somaNova = 0;
    for (const arquivo of amostra) {
      const texto = readFileSync(arquivo, "utf8");
      const nova = varreduraDeChamadas(texto, NOMES, arquivo);
      somaNova += nova.total;
      expect(nova.total, `o total divergiu em ${arquivo}`)
        .toBe(totalDeChamadas(texto, NOMES, arquivo));
      expect(nova.descartadas, `a lista de descartadas divergiu em ${arquivo}`)
        .toEqual(chamadasDescartadas(texto, NOMES, arquivo));
    }
    // Piso: a amostra tem de conter chamadas, senão a igualdade acima é entre
    // dois vazios. Era o defeito de três guardas desta sessão.
    expect(somaNova, "a amostra não contém chamada nenhuma — a igualdade seria vácuo")
      .toBeGreaterThan(10);
  });

  it("os dois caminhos concordam sobre código que TEM achado", () => {
    /**
     * A parte com conteúdo. No corpus limpo a comparação de listas é vazio
     * contra vazio — e foi assim que a inversão "a passada única devolve
     * `descartadas: []`" passou pela primeira versão desta guarda.
     */
    let achados = 0;
    for (const { nome, codigo } of PLANTADOS) {
      const nova = varreduraDeChamadas(codigo, NOMES, nome);
      achados += nova.descartadas.length;
      expect(nova.descartadas, `a lista divergiu em ${nome}`)
        .toEqual(chamadasDescartadas(codigo, NOMES, nome));
      expect(nova.total, `o total divergiu em ${nome}`)
        .toBe(totalDeChamadas(codigo, NOMES, nome));
    }
    // O piso que faltava: a comparação acima tem de ter visto achado de
    // verdade. Três dos cinco plantados são defeito; dois são forma correta.
    expect(achados, "nenhum plantado produziu achado — a igualdade voltou a ser vácuo")
      .toBeGreaterThanOrEqual(3);
  });

  it("a contagem por nome soma o mesmo que a contagem por nome avulsa", () => {
    for (const arquivo of amostra) {
      const texto = readFileSync(arquivo, "utf8");
      const juntas = contagemPorNome(texto, NOMES, arquivo);
      for (const nome of NOMES) {
        expect(juntas[nome], `a contagem de \`${nome}\` divergiu em ${arquivo}`)
          .toBe(totalDeChamadas(texto, [nome], arquivo));
      }
    }
  });
});
