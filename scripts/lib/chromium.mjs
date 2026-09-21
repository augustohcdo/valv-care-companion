import { existsSync } from "node:fs";

/**
 * Como subir o Chromium em qualquer um dos lugares onde estes scripts rodam.
 *
 * ## O defeito que isto fecha
 *
 * Três scripts sobem navegador: `rotas-renderizam.mjs`, `ferramentas-verificar.mjs`
 * e `mobile.mjs`. Dois deles faziam:
 *
 *     executablePath: process.env["PW_CHROMIUM"] || "/opt/pw-browsers/chromium"
 *
 * `/opt/pw-browsers` é o caminho do contêiner de desenvolvimento. Num executor
 * de CI o Playwright guarda o que o `playwright install` baixou em outro lugar
 * — e cravar o caminho fazia o script funcionar aqui e falhar lá, com
 * `Failed to launch chromium because executable doesn't exist`, que não diz
 * nada sobre a ferramenta que ele deveria estar conferindo.
 *
 * O `rotas-renderizam.mjs` **já fazia certo**, e o comentário dele descrevia
 * este defeito com todas as letras. A lição foi aprendida neste repositório,
 * escrita, aplicada a um script, e os outros dois ficaram sem — e a agenda
 * diária que teria pego isso não rodava (ver
 * `.github/workflows/verificacoes-periodicas.yml`).
 *
 * Agora a decisão mora num lugar só. Três cópias de uma regra garantem que uma
 * delas divirja; esta base já pagou esse preço com as catorze cópias do
 * `escrita()` nos testes.
 *
 * ## A regra
 *
 * Passa `executablePath` **só quando o arquivo existe**. Sem ele, o Playwright
 * resolve o próprio binário — que é o comportamento certo em toda máquina que
 * rodou `playwright install`.
 */

/** O caminho do Chromium deste ambiente, ou `null` se não houver um fixado. */
export function caminhoDoChromium(
  { env = process.env, existe = existsSync } = {},
) {
  // `PW_CHROMIUM` é a saída de escape explícita, e vence. Mas mesmo ela é
  // conferida: um caminho digitado errado deve virar "deixa o Playwright
  // resolver", e não um erro de lançamento que fala de executável quando o
  // assunto era a calculadora de risco.
  const candidatos = [env["PW_CHROMIUM"], "/opt/pw-browsers/chromium"].filter(Boolean);
  for (const c of candidatos) {
    if (existe(c)) return c;
  }
  return null;
}

/**
 * As opções de `chromium.launch()` para este ambiente.
 *
 * `proxy` entra porque o navegador do contêiner de desenvolvimento só alcança
 * a internet pelo proxy da sessão: sem ele o Supabase não responde, a tela fica
 * vazia, e a conferência passa a medir uma página em branco — que é uma forma
 * de reprovar (ou aprovar) sobre nada.
 */
export function opcoesDoChromium({ env = process.env, existe = existsSync } = {}) {
  const caminho = caminhoDoChromium({ env, existe });
  const proxy = env["HTTPS_PROXY"] || env["https_proxy"];
  return {
    ...(caminho ? { executablePath: caminho } : {}),
    ...(proxy ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } } : {}),
  };
}

/**
 * Uma página em branco nunca reprova — e é justamente o pior estado.
 *
 * ## O defeito que isto fecha
 *
 * Numa execução da agenda diária, o build da CI saiu sem `VITE_SUPABASE_URL`
 * (a variável ainda não está configurada no repositório). O cliente do Supabase
 * estoura `supabaseUrl is required` na carga do módulo, o React nunca monta, o
 * `#root` fica com ZERO elementos — e o `ferramentas-verificar.mjs` esperou 15 s
 * por um campo de formulário, estourou com `TimeoutError` não tratado e saiu
 * **1 — DIVERGE**.
 *
 * Quer dizer: anunciou que a calculadora está errada quando nada foi medido, e
 * mandou o próximo leitor investigar o EuroSCORE em vez da variável que falta.
 * Errado no veredito e errado no lugar para onde aponta.
 *
 * Página vazia não é página sem defeito: é página NÃO MEDIDA — saída 2.
 *
 * ## Por que o limiar mora aqui
 *
 * O `mobile.mjs` já fazia esta conferência, com o motivo escrito ("num build
 * local costuma ser variável de ambiente faltando"), e o irmão não fazia. Pela
 * terceira vez nesta dupla de arquivos, a lição estava aprendida num e ausente
 * no outro. Duas cópias de um limiar são duas cópias que divergem; esta base já
 * pagou esse preço com o caminho do Chromium, logo acima, e com as catorze
 * cópias do `escrita()` nos testes.
 *
 * Os números não são escolhidos a esmo: qualquer tela do app monta muito mais
 * de 10 elementos e mostra muito mais de 50 caracteres. O que fica abaixo disso
 * é o shell do HTML sem app nenhum.
 */
export function pareceVazia({ elementos = 0, texto = 0 } = {}) {
  return elementos < 10 || texto < 50;
}

/** O diagnóstico de uma tela vazia, com a causa mais provável nomeada. */
export function motivoDeTelaVazia({ elementos = 0, texto = 0, erros = [] } = {}) {
  return (
    `#root tem ${elementos} elemento(s) e ${texto} caractere(s) de texto visível\n` +
    (erros.length ? `  erros da página: ${erros.slice(0, 3).join(" | ")}\n` : "") +
    "\nNenhuma conferência rodou — isto é ausência de medida, não divergência.\n" +
    "A causa mais comum é o build ter saído sem as chaves PÚBLICAS: sem\n" +
    "`VITE_SUPABASE_URL` o cliente do Supabase estoura `supabaseUrl is\n" +
    "required` antes de o React montar, e a tela fica em branco.\n\n" +
    "Na CI elas vêm das *Variables* do repositório (são públicas — vão em todo\n" +
    "bundle; nunca em *Secrets*). Localmente, do `.env`."
  );
}

/** O que há na tela agora: quanto o app montou, e quanto texto ele mostra. */
export async function medirRenderizacao(pagina) {
  return await pagina.evaluate(() => ({
    elementos: document.getElementById("root")?.querySelectorAll("*").length ?? 0,
    texto: (document.body.innerText || "").trim().length,
  }));
}
