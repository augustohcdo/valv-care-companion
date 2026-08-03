// Este teste lê as migrations do disco.
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Guarda contra o papel do usuário voltar a depender do que o cliente mandou.
 *
 * `handle_new_user` converte `raw_user_meta_data->>'account_type'` — campo
 * preenchido pelo navegador no `signUp` — para o enum `app_role`, que contém
 * `admin` e `hospital_admin`. O que impede alguém de se cadastrar como
 * administrador é uma lista fechada no início da função.
 *
 * Antes dessa lista existir, a proteção era acidental: o `CHECK` de
 * `profiles.account_type` abortava a transação porque o INSERT do perfil vinha
 * primeiro. Funcionava, mas por causa da ordem dos inserts e de uma restrição
 * em outra coluna — nada que alguém abrindo o cadastro de clínica e hospital
 * fosse notar antes de afrouxar.
 *
 * Este teste falha se uma migration futura redefinir a função sem a lista, ou
 * com a lista depois do ponto onde o valor já foi usado.
 */

const DIR = "supabase/migrations";
const FUNCAO = "handle_new_user";

/** A definição vigente é a do arquivo mais recente que redefine a função. */
function definicaoVigente(): { arquivo: string; corpo: string } {
  const arquivos = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const nome of [...arquivos].reverse()) {
    const texto = readFileSync(join(DIR, nome), "utf8");
    const i = texto.toLowerCase().indexOf(`function public.${FUNCAO}`);
    if (i === -1) continue;
    // Do início da definição até o fechamento do corpo (`$$;`).
    const fim = texto.indexOf("$$;", i);
    return { arquivo: nome, corpo: texto.slice(i, fim === -1 ? undefined : fim) };
  }
  throw new Error(`nenhuma migration define ${FUNCAO}`);
}

describe("papel do usuário no cadastro", () => {
  const { arquivo, corpo } = definicaoVigente();

  it("a definição vigente restringe account_type a uma lista fechada", () => {
    const lista = /NOT IN \(\s*'medico',\s*'paciente'\s*\)/i.test(corpo);
    expect(lista, `${arquivo} redefine ${FUNCAO} sem a lista fechada de account_type`).toBe(true);
  });

  it("a lista vem antes de qualquer uso do valor", () => {
    const posLista = corpo.search(/NOT IN \(\s*'medico',\s*'paciente'\s*\)/i);
    const posPerfil = corpo.indexOf("INSERT INTO public.profiles");
    const posPapel = corpo.indexOf("::public.app_role");

    // Uma lista depois do INSERT não protege nada: a linha já entrou.
    expect(posLista, arquivo).toBeGreaterThan(-1);
    expect(posPerfil, `${arquivo}: lista depois do INSERT no perfil`).toBeGreaterThan(posLista);
    expect(posPapel, `${arquivo}: lista depois da conversão para app_role`).toBeGreaterThan(posLista);
  });

  it("nenhum valor privilegiado aparece na lista de account_type aceitos", () => {
    // O enum `app_role` tem `admin` e `hospital_admin`. Se um deles virar
    // account_type aceito, a conversão passa a conceder o papel.
    const trecho = corpo.match(/NOT IN \(([^)]*)\)/i)?.[1] ?? "";
    for (const proibido of ["admin", "hospital_admin"]) {
      expect(trecho, `${arquivo}: '${proibido}' não pode ser account_type`).not.toContain(
        `'${proibido}'`,
      );
    }
  });
});
