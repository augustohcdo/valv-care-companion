/**
 * O veredito da restauração: o que o manifesto diz que existia, contra o que
 * está no alvo.
 *
 * ## O defeito que isto conserta
 *
 * `restore.mjs` fechava assim:
 *
 *     console.log(divergentes === 0
 *       ? "\nTudo bateu com o manifesto."
 *       : `\n${divergentes} divergência(s) — investigue antes de considerar restaurado.`);
 *     exit(divergentes === 0 ? 0 : 1);
 *
 * e `divergentes` só contava as tabelas de `public` e as contas. O comentário
 * logo acima da conferência já dizia por que ela existe:
 *
 *   > "Sem comparar com o manifesto, este script 'funciona' do mesmo jeito que
 *   >  o backup 'funcionava': relatando sucesso sem responder quanto voltou."
 *
 * Três artefatos ficavam fora dessa conta:
 *
 * 1. **Os anexos dos exames.** Com `--com-arquivos`, o script copia os bytes de
 *    cada documento da origem para o alvo e conta `copiados` e `faltando`.
 *    `faltando` era impresso e **não entrava no veredito nem no código de
 *    saída**. Basta esquecer `ALVO_SERVICE_KEY` — que o próprio script não
 *    exige — para todo `POST` de upload voltar 401, nenhum exame chegar, e a
 *    última linha ser "Tudo bateu com o manifesto." com saída 0. O RECOVERY.md
 *    manda o operador rodar exatamente com `--com-arquivos` e diz, em negrito:
 *    "Se ele disser 'Tudo bateu', bateu de verdade."
 *
 * 2. **Os vínculos de login.** `auth.identities` era carregado e nunca
 *    conferido. Sem ele, quem entra com Google não entra — e o veredito não
 *    falava do assunto.
 *
 * 3. **As contas, que eram comparadas com elas mesmas.** A linha era
 *    `contas === usuarios.length`, e `usuarios` é o arquivo que o script acabou
 *    de baixar. Um `auth_users.ndjson` ausente ou vazio dá `0 === 0`: bateu. O
 *    número que vale é o do manifesto, que foi escrito no dia do export.
 *
 * ## Módulo próprio, e não mais trinta linhas no script
 *
 * `restore.mjs` decide tudo no topo do módulo — argumentos, variáveis de
 * ambiente, `exit(1)` — e chama `main()` no fim. Importá-lo num teste encerra o
 * processo antes do primeiro caso. É a quarta vez nesta sessão que a mesma
 * separação aparece (`lib/relatar.mjs`, `tabelasVivasDeSql`, o `principal()` do
 * `conferir-fontes.mjs`), e a lição é a mesma das outras três: **o que não se
 * consegue executar num teste não se consegue conferir** — e este é o script do
 * dia do desastre, que roda uma vez na vida, sob pressão.
 *
 * ## Os estados, e por que não são dois
 *
 *   · `ok`         — o manifesto diz N e o alvo tem N;
 *   · `divergente` — o alvo tem outra coisa. **DIVERGE**, saída 1;
 *   · `nao-pedido` — o artefato não foi pedido nesta execução. Os anexos sem
 *                    `--com-arquivos` são o caso: não é falha, e não desaparece
 *                    do relatório;
 *   · `sem-backup` — o manifesto registra erro naquele arquivo. O export não
 *                    gravou aquilo, então não há o que restaurar e o zero no
 *                    alvo não prova nada. **NÃO CONFERIDO**, saída 2;
 *   · `nao-medido` — ninguém contou no alvo. **NÃO CONFERIDO**, saída 2.
 *
 * Os dois últimos existem porque "0 esperado, 0 no alvo" é a cara de um acerto
 * e pode ser a cara de uma perda total. Esta base já fixou a convenção nos
 * conferidores: 0 é ok, 1 é DIVERGE, 2 é NÃO CONFERIDO — "não sei" não é "está
 * tudo bem", e também não é "está quebrado".
 */

/**
 * Arquivos do manifesto que NÃO são tabela de `public`.
 *
 * Mora aqui porque o `restore.mjs` precisa da mesma lista para montar a ordem
 * de carga, e duas cópias de uma decisão já é onde ela começa a divergir.
 */
export const NAO_SAO_TABELAS = new Set(["auth_users", "auth_identities", "storage_inventory"]);

/** O artefato do manifesto que guarda o inventário dos anexos. */
export const INVENTARIO = "storage_inventory";

/** Estados que dizem "não deu para concluir" — saída 2, não 1. */
const NAO_CONCLUSIVOS = new Set(["sem-backup", "nao-medido"]);

/**
 * Compara o manifesto do export com o que foi medido no alvo.
 *
 * @param {object} args
 * @param {{tables: Record<string, {rows?: number, error?: string}>}} args.manifesto
 *        O `_manifest.json` do dia, como o `weekly-export` o gravou.
 * @param {Record<string, number>} args.medido
 *        Artefato do manifesto → quantidade contada NO ALVO. Para os anexos, a
 *        quantidade de arquivos que de fato chegaram.
 * @param {boolean} [args.pediuArquivos]
 *        Se esta execução pediu `--com-arquivos`.
 * @returns {{linhas: Array<{nome: string, esperado: number, obtido: number|null, estado: string, detalhe?: string}>, divergentes: number, naoConferidos: number, codigo: number}}
 */
export function vereditoDaRestauracao({ manifesto, medido, pediuArquivos = false }) {
  const tabelas = manifesto?.tables;
  if (!tabelas || typeof tabelas !== "object") {
    // Sem o bloco do manifesto não há com o que comparar, e devolver "zero
    // divergências" seria dizer que bateu. Parar é a única resposta honesta.
    throw new Error(
      "manifesto sem o bloco `tables` — sem ele não há com o que comparar, " +
      "e um veredito sem base é pior que nenhum",
    );
  }

  const linhas = [];
  for (const nome of Object.keys(tabelas).sort()) {
    const entrada = tabelas[nome] ?? {};
    const esperado = Number(entrada.rows ?? 0);
    const obtido = medido?.[nome];

    // Anexo sem `--com-arquivos` é decisão de quem rodou, não falha: o
    // RECOVERY.md diz que "sem a flag, só os dados voltam". Aparece no
    // relatório para ninguém confundir "não pedi" com "veio".
    if (nome === INVENTARIO && !pediuArquivos) {
      linhas.push({ nome, esperado, obtido: null, estado: "nao-pedido" });
      continue;
    }

    // Erro registrado no manifesto: o backup não exportou isto. A comparação
    // fica sem sentido — e é a pior notícia da lista, porque não é falha da
    // restauração, é dado que não existe em lugar nenhum.
    if (entrada.error) {
      linhas.push({
        nome, esperado, obtido: typeof obtido === "number" ? obtido : null,
        estado: "sem-backup", detalhe: `o export falhou neste arquivo: ${String(entrada.error).slice(0, 120)}`,
      });
      continue;
    }

    if (typeof obtido !== "number" || !Number.isFinite(obtido)) {
      linhas.push({ nome, esperado, obtido: null, estado: "nao-medido" });
      continue;
    }

    linhas.push({ nome, esperado, obtido, estado: obtido === esperado ? "ok" : "divergente" });
  }

  // Pediram os anexos e o manifesto não tem inventário: sem ele o script copia
  // zero arquivos e não teria linha nenhuma para mostrar — que é a mesma
  // omissão silenciosa, por outra porta.
  if (pediuArquivos && !(INVENTARIO in tabelas)) {
    linhas.push({
      nome: INVENTARIO, esperado: 0, obtido: null, estado: "sem-backup",
      detalhe: "pediram --com-arquivos e o manifesto não tem inventário dos anexos",
    });
  }

  const divergentes = linhas.filter((l) => l.estado === "divergente").length;
  const naoConferidos = linhas.filter((l) => NAO_CONCLUSIVOS.has(l.estado)).length;

  return {
    linhas, divergentes, naoConferidos,
    // A ordem é a dos conferidores desta base: o código de saída diz a pior
    // coisa que aconteceu, e DIVERGE é mais forte que NÃO CONFERIDO.
    codigo: divergentes > 0 ? 1 : naoConferidos > 0 ? 2 : 0,
  };
}

/** Marca de uma linha do relatório. Nenhum estado sai sem marca. */
export function marcaDoEstado(estado) {
  switch (estado) {
    case "ok": return " ";
    case "divergente": return "!";
    case "nao-pedido": return "·";
    case "sem-backup": return "?";
    case "nao-medido": return "?";
    default: return "?";
  }
}
