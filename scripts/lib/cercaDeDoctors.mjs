/**
 * A cerca de `doctors`, decidida a partir do que foi medido.
 *
 * ## O que esta cerca promete
 *
 * `MedicoPerfil` oferece a caixa "Aparecer no diretório" e diz que desmarcar
 * "tira você da lista". O código a enquadra como consentimento revogável: LGPD
 * art. 8º §5º ("consentimento que não pode ser retirado não é consentimento") e
 * a anuência de publicidade médica da Resolução CFM nº 2.336/2023.
 *
 * Até setembro a política era `using (true)`: qualquer conta autenticada lia a
 * tabela inteira — inclusive quem desmarcou a caixa, inclusive médicos não
 * verificados, com CRM, RQE, cidade, instituição e biografia. A promessa não
 * tinha como ser cumprida.
 *
 * ## Por que decidir aqui, e não no script
 *
 * O script faz HTTP e `process.exit`. Importá-lo num teste rodaria as duas
 * coisas. Mesmo desenho de `scripts/lib/chromium.mjs` e
 * `scripts/lib/chavesPublicas.mjs`: o que não se consegue executar num teste
 * não se consegue conferir.
 *
 * ## O buraco que o terceiro estado tapa
 *
 * "O paciente leu 0 linhas de `doctors`" parece prova de cerca e não é: lê 0
 * também quem consulta uma tabela VAZIA. Por isso a decisão exige, como
 * evidência independente, que o `diretorio_medicos()` — que é
 * `security definer` e portanto passa pela cerca — tenha devolvido pelo menos
 * um médico. Sem isso o veredito é 2, NÃO CONFERIDO: não deu para distinguir
 * "cercado" de "não tem o que ler".
 */

/**
 * O paciente sem médico vinculado NÃO pode ler a tabela `doctors`.
 *
 * `noDiretorio` é quantos médicos o `diretorio_medicos()` devolveu para esta
 * mesma sessão; `lidasNaTabela`, quantas linhas o `select` direto devolveu.
 */
export function vereditoDoPaciente({ noDiretorio, lidasNaTabela }) {
  if (noDiretorio === 0) {
    return {
      estado: 2,
      mensagem:
        "NÃO CONFERIDO: o diretório devolveu 0 médicos verificados e listados.\n" +
        "Sem nenhuma linha existindo, ler 0 em `doctors` não prova cerca — prova\n" +
        "tabela vazia. São coisas diferentes e o veredito não vai fingir que não.",
    };
  }
  if (lidasNaTabela > 0) {
    return {
      estado: 1,
      mensagem:
        `DIVERGE: este paciente não tem médico vinculado e leu ${lidasNaTabela} ` +
        "linha(s) de `doctors`.\n" +
        "A cerca de `pode_ver_medico` não está no lugar: a caixa \"Aparecer no\n" +
        "diretório\" promete que desmarcar tira o médico da lista, e a leitura\n" +
        "direta da tabela passa por cima da promessa.",
    };
  }
  return {
    estado: 0,
    mensagem:
      `a cerca está no lugar: ${noDiretorio} médico(s) existem e aparecem pelo ` +
      "diretório, e a leitura direta de `doctors` devolveu 0 para um paciente sem vínculo.",
  };
}

/**
 * O médico PRECISA ler a própria linha — a porta 1 da cerca.
 *
 * O outro lado da moeda, e a razão de ele existir: falso vermelho custa igual
 * ao falso verde. Uma cerca apertada além da conta deixa o médico sem o próprio
 * registro profissional, e `MedicoPerfil` abriria o formulário em branco sobre
 * um cadastro que existe.
 *
 * O NÚMERO de linhas que ele lê não é afirmado aqui de propósito. Hoje a porta
 * 5 ("quem é médico vê qualquer médico") ainda está aberta em produção, e ela
 * sai na etapa 2 de `20261005121000`. Cravar um número faria este veredito
 * reprovar no dia em que a cerca melhorar.
 */
export function vereditoDoMedico({ lidasNaTabela, meuUserId, userIdsLidos }) {
  if (!meuUserId) {
    return {
      estado: 2,
      mensagem:
        "NÃO CONFERIDO: não achei o `user_id` da sessão, então não dá para dizer\n" +
        "se a linha que o médico leu é a dele.",
    };
  }
  if (!userIdsLidos.includes(meuUserId)) {
    return {
      estado: 1,
      mensagem:
        `DIVERGE: o médico leu ${lidasNaTabela} linha(s) de \`doctors\` e a dele ` +
        "não está entre elas.\n" +
        "É a porta 1 da cerca — \"a própria linha\" — e sem ela o `MedicoPerfil`\n" +
        "abre o formulário em branco sobre um cadastro que existe, convidando o\n" +
        "médico a reescrever o próprio CRM.",
    };
  }
  return {
    estado: 0,
    mensagem:
      `a porta 1 está aberta: o médico lê a própria linha (${lidasNaTabela} ` +
      "linha(s) no total — o número não é afirmado aqui, porque a porta 5 sai na etapa 2).",
  };
}

/** O `user_id` de uma sessão: do objeto `user`, ou do `sub` do token. */
export function userIdDaSessao(sessao) {
  if (sessao?.user?.id) return sessao.user.id;
  const token = sessao?.access_token;
  if (typeof token !== "string") return null;
  const corpo = token.split(".")[1];
  if (!corpo) return null;
  try {
    // Decodificar não é validar, e aqui não precisa ser: o token é o que ESTE
    // processo acabou de cunhar, e o que se quer dele é só o `sub` para
    // comparar com o que o banco devolveu.
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    return typeof dados?.sub === "string" ? dados.sub : null;
  } catch {
    return null;
  }
}
