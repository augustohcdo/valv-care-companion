// Este teste lê o disco para conferir as rotas contra src/App.tsx.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  boasVindas,
  assuntoBoasVindas,
  type Publico,
} from "../../supabase/functions/_shared/welcome";

/**
 * A mensagem de boas-vindas é a primeira coisa que a pessoa recebe do sistema.
 * Se ela prometer uma tela que não existe, o primeiro clique dá 404 — e a
 * primeira impressão do produto é a de algo que não funciona.
 *
 * Este teste não julga o texto; ele checa o que dá para checar sozinho: que o
 * destino existe, que o aviso clínico está lá, e que o e-mail não sai com o
 * nome de outra pessoa.
 */

const PUBLICOS: Publico[] = ["medico", "paciente", "clinica", "hospital"];

/** Caminhos declarados em `<Route path="…">`, sem os parâmetros. */
function rotasDoApp(): string[] {
  const app = readFileSync("src/App.tsx", "utf8");
  return [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
}

describe("boas-vindas", () => {
  it("todo link aponta para uma rota que existe no app", () => {
    const rotas = new Set(rotasDoApp());
    for (const publico of PUBLICOS) {
      const { link } = boasVindas(publico);
      expect(rotas.has(link), `${publico}: ${link} não é rota do app`).toBe(true);
    }
  });

  it("todo público tem título, resumo e corpo de e-mail", () => {
    for (const publico of PUBLICOS) {
      const m = boasVindas(publico);
      expect(m.titulo.length, publico).toBeGreaterThan(0);
      expect(m.resumo.length, publico).toBeGreaterThan(0);
      // Um corpo curto demais seria sinal de texto truncado por engano.
      expect(m.email.length, publico).toBeGreaterThan(300);
    }
  });

  it("todo e-mail carrega o aviso de que não substitui avaliação médica", () => {
    // O produto é apoio à decisão. Uma boas-vindas entusiasmada sem esse
    // lembrete é exatamente onde a promessa exagerada costuma entrar.
    for (const publico of PUBLICOS) {
      // O texto é quebrado em linhas; normalizar evita que uma requebra futura
      // faça este teste falhar sem que nada de relevante tenha mudado.
      const corrido = boasVindas(publico).email.replace(/\s+/g, " ");
      expect(corrido, publico).toContain(
        "não faz diagnóstico nem substitui a avaliação médica",
      );
    }
  });

  it("usa o primeiro nome quando há nome, e não inventa quando não há", () => {
    expect(boasVindas("medico", "Ana Ribeiro Costa").email).toContain("Olá, Ana!");
    expect(boasVindas("medico", "  ").email).toContain("Olá!");
    expect(boasVindas("medico", null).email).toContain("Olá!");
    expect(boasVindas("medico").email).toContain("Olá!");
  });

  it("o assunto do paciente é diferente do dos profissionais", () => {
    // Quem recebe é leigo e a caixa de entrada dele não tem contexto nenhum.
    expect(assuntoBoasVindas("paciente")).not.toBe(assuntoBoasVindas("medico"));
    for (const publico of PUBLICOS) {
      expect(assuntoBoasVindas(publico).length, publico).toBeGreaterThan(0);
    }
  });

  it("a mensagem do paciente não promete interpretação do próprio caso", () => {
    // Quem interpreta exame é o médico dele. O conteúdo aqui é educativo.
    const email = boasVindas("paciente").email.toLowerCase();
    for (const promessa of ["seu diagnóstico", "interpretamos", "avaliamos seu exame"]) {
      expect(email, promessa).not.toContain(promessa);
    }
  });
});
