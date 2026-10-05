#!/usr/bin/env node
/**
 * As duas chaves PÚBLICAS, tiradas de onde elas já são públicas: o bundle no ar.
 *
 * ## O problema que isto fecha
 *
 * A agenda diária (`verificacoes-periodicas.yml`) reprova desde 2026-10-02 —
 * e, na hora em que escrevo, há dezenove comentários na issue #3 sobre isso.
 * A causa é sempre a mesma: três das seis conferências precisam de
 * `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para montar um preview,
 * e nenhuma das duas está cadastrada nas *Variables* do repositório.
 *
 * O cabeçalho daquele workflow diz que as chaves "saem do `.env` versionado".
 * **Não existe `.env` versionado**: o `.gitignore` o exclui na linha 16. A
 * frase descreve um desenho que nunca chegou ao repositório, e é por isso que o
 * terceiro caminho do passo cai sempre no aviso.
 *
 * ## Por que não pela API de gestão
 *
 * O `rotas-autenticadas.yml` resolve isso com `SUPABASE_ACCESS_TOKEN`. Aqui
 * não serve, e o motivo está escrito no cabeçalho da agenda:
 *
 *   > "Este workflow não toca em `SUPABASE_ACCESS_TOKEN` nem em
 *   >  `SUPABASE_SERVICE_ROLE_KEY`, e não deve passar a tocar: ele roda
 *   >  sozinho, todo dia, sem ninguém olhando."
 *
 * Aquele token é root sobre a conta inteira. Um workflow diário e desassistido
 * carregando-o é posição pior do que três conferências em NÃO CONFERIDO.
 *
 * ## O caminho que não precisa de segredo nenhum
 *
 * A chave publishable vai embutida em todo bundle que qualquer visitante baixa
 * — é isso que "pública por construção" significa, e quem protege os dados é a
 * RLS. Então ela pode vir do próprio site publicado, por HTTP sem credencial.
 *
 * ## A objeção, e a mitigação que a remove
 *
 * Um verificador tirando configuração do artefato que ele verifica tem um ponto
 * cego: se o site no ar apontasse para OUTRO projeto, as conferências usariam
 * aquele projeto e passariam.
 *
 * Por isso este script confere o `project_id` de `supabase/config.toml` contra
 * o host extraído, e **reprova com saída 1** se não baterem. Com isso o
 * caminho é estritamente melhor que o de hoje nos dois sentidos: fecha os três
 * NÃO CONFERIDO e acrescenta uma conferência que não existia — "o site no ar
 * fala com o projeto que o repositório espera".
 *
 * ## Três estados, como todo script desta base
 *
 *   0 — achou as duas chaves e o projeto bate;
 *   1 — achou, e o projeto NÃO é o do repositório (DIVERGE);
 *   2 — não deu para olhar: site fora do ar, ou bundle sem as chaves. É
 *       ausência de medida, não divergência, e "não sei" não é "está tudo bem".
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  candidatosDeBundle, chavesDoTexto, refDoConfig, conferirProjeto,
} from "./lib/chavesPublicas.mjs";

const argumentos = process.argv.slice(2);
const valorDe = (nome, padrao = null) => {
  const i = argumentos.indexOf(nome);
  return i >= 0 && argumentos[i + 1] ? argumentos[i + 1] : padrao;
};

const BASE = (valorDe("--base", "https://valvepath.com.br")).replace(/\/$/, "");
const SAIDA = valorDe("--saida");
const CONFIG = valorDe("--config", "supabase/config.toml");

/** Sai com 2 e o motivo nomeado: ausência de medida, não divergência. */
function naoConferido(motivo) {
  console.error(`NÃO CONFERIDO: ${motivo}`);
  console.error("\nIsto não quer dizer que as chaves estejam erradas — quer dizer que");
  console.error("não deu para olhar. As conferências que dependem delas sairão 2.");
  process.exit(2);
}

async function texto(url) {
  const resposta = await fetch(url, { redirect: "follow" });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return await resposta.text();
}

let html;
try {
  html = await texto(`${BASE}/`);
} catch (e) {
  naoConferido(`o site não respondeu (${BASE}): ${String(e?.message ?? e).slice(0, 100)}`);
}

const candidatos = candidatosDeBundle(html);
if (candidatos.length === 0) {
  naoConferido(`o index.html de ${BASE} não referencia nenhum .js — o site está servindo outra coisa`);
}

let achado = { url: null, chave: null };
let onde = null;
for (const caminho of candidatos) {
  let corpo;
  try {
    corpo = await texto(`${BASE}${caminho}`);
  } catch {
    continue; // um arquivo que não baixa não é o fim: os outros podem ter
  }
  const c = chavesDoTexto(corpo);
  if (c.url && c.chave) { achado = c; onde = caminho; break; }
}

if (!achado.url || !achado.chave) {
  naoConferido(
    `nenhum dos ${candidatos.length} arquivos de ${BASE} tem a URL e a chave publishable`,
  );
}

let refEsperada = null;
try {
  refEsperada = refDoConfig(readFileSync(CONFIG, "utf8"));
} catch {
  naoConferido(`não consegui ler ${CONFIG} para saber qual projeto o repositório espera`);
}

const projeto = conferirProjeto(achado.url, refEsperada);
if (!projeto.ok) {
  // DIVERGE, e não NÃO CONFERIDO: aqui a medida existe e não bate.
  console.error(`DIVERGE: ${projeto.motivo}`);
  console.error("\nO site publicado conversa com um projeto Supabase diferente do que este");
  console.error("repositório declara em supabase/config.toml. Nenhuma conferência que use");
  console.error("estas chaves diria a verdade sobre o projeto certo.");
  process.exit(1);
}

const linhas = [
  `VITE_SUPABASE_URL=${achado.url}`,
  `VITE_SUPABASE_PUBLISHABLE_KEY=${achado.chave}`,
  `VITE_SUPABASE_PROJECT_ID=${projeto.ref}`,
];

if (SAIDA) appendFileSync(SAIDA, `${linhas.join("\n")}\n`);
else console.log(linhas.join("\n"));

// O que vai para o log NÃO inclui a chave inteira. Ela é pública, mas log é
// onde as coisas são copiadas sem contexto, e um prefixo basta para conferir.
console.error(
  `chaves públicas lidas de ${BASE}${onde} — projeto ${projeto.ref}, ` +
  `chave ${achado.chave.slice(0, 14)}… (${achado.chave.startsWith("sb_") ? "publishable" : "JWT legado"})`,
);
