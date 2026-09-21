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
