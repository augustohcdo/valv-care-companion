/**
 * As decisões puras da leitura das chaves públicas do site.
 *
 * Separadas do script porque o script tem efeito colateral no topo — ele busca
 * na rede e chama `process.exit`. Importá-lo num teste rodaria tudo isso. Mesmo
 * desenho de `scripts/lib/chromium.mjs`, e pelo mesmo motivo: o que não se
 * consegue executar num teste não se consegue conferir.
 */

/**
 * Os `.js` que o `index.html` referencia.
 *
 * Sem caminho fixo de propósito: os nomes têm hash e mudam a cada build.
 * Procurar `client-CwSRObAw.js` funcionaria hoje e quebraria no próximo deploy
 * — e quebraria em silêncio, voltando a NÃO CONFERIDO.
 */
export function candidatosDeBundle(html) {
  return [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]),
    ),
  ];
}

/** A URL do projeto e a chave publishable dentro de um texto, se estiverem lá. */
export function chavesDoTexto(texto) {
  const url = texto.match(/https:\/\/[a-z0-9]{10,}\.supabase\.co/)?.[0] ?? null;
  // As duas formas que este projeto já usou: a nova (`sb_publishable_…`) e o
  // JWT legado. Aceitar as duas porque trocar de formato não é defeito.
  const chave =
    texto.match(/sb_publishable_[A-Za-z0-9_-]{20,}/)?.[0]
    ?? texto.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/)?.[0]
    ?? null;
  return { url, chave };
}

/** O `project_id` que o repositório declara. */
export function refDoConfig(toml) {
  return /^\s*project_id\s*=\s*"([a-z0-9]+)"/m.exec(toml)?.[1] ?? null;
}

/** O host extraído pertence ao projeto que o repositório espera? */
export function conferirProjeto(url, refEsperada) {
  if (!url) return { ok: false, motivo: "sem url" };
  if (!refEsperada) return { ok: false, motivo: "sem project_id no config.toml" };
  const achada = url.replace("https://", "").split(".")[0];
  return achada === refEsperada
    ? { ok: true, ref: achada }
    : { ok: false, motivo: `o site fala com "${achada}", e o repositório espera "${refEsperada}"`, ref: achada };
}
