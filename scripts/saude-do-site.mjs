#!/usr/bin/env node
/**
 * A porta de entrada do site está de pé?
 *
 * ## Por que esta pergunta merece um script
 *
 * O login ficou fechado para todo mundo porque a edge function
 * `turnstile-config` não subia: `BOOT_ERROR` / HTTP 503. Sem a site key, o
 * `TurnstileWidget` não renderiza o desafio, o `Login` mantém
 * `disabled={… || !captchaToken}`, e ninguém entra com e-mail e senha.
 *
 * Nada no projeto olhava para isso. A CI ficava verde (ela confere o código, não
 * o que está no ar), o `smoke` confere que as rotas devolvem o shell do app — e
 * devolviam, a tela carregava perfeitamente, só não dava para entrar. O defeito
 * foi descoberto por uma pessoa tentando usar o site.
 *
 * ## Por que SÓ esta função, e não uma varredura
 *
 * Porque eu já fiz a varredura e ela me ensinou o preço. Disparei `POST {}` nas
 * dezoito functions em produção para conferir boot; dez das onze públicas
 * rejeitam na porta (segredo de cron, chave de API, captcha), mas a
 * `report-error` não tem porta — é o canal de erro do navegador, pública por
 * construção — e gravou uma linha de lixo em `client_errors`.
 *
 * Conferir saúde não pode custar efeito colateral. A `turnstile-config` é a
 * única que dá para chamar à vontade: ela lê uma variável de ambiente e devolve
 * uma chave que já viaja no HTML de toda visita. Não escreve, não manda e-mail,
 * não cobra API paga. E é justamente a que fecha o site quando cai.
 *
 * ## Os três estados
 *
 *   0 — a função respondeu com uma site key. A porta está aberta.
 *   1 — ela está NO AR e quebrada: BOOT_ERROR, 503, corpo sem `siteKey`, ou
 *       `missing_site_key` (o segredo não está cadastrado). Login fechado.
 *   2 — NÃO CONFERIDO: não consegui falar com o Supabase. Rede, DNS, proxy.
 *       Distinto do 1 de propósito: "não sei" não é "está quebrado", e nenhum
 *       dos dois é "está tudo bem".
 *
 * Uso:
 *   node scripts/saude-do-site.mjs
 *
 * Lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do ambiente e, se não
 * houver, do `.env` do repositório — que é versionado, porque as duas são
 * públicas por construção (a chave vai embutida em todo bundle que qualquer
 * visitante baixa; quem protege os dados é a RLS).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Lê uma variável do ambiente ou, na falta, do `.env` versionado. */
function config(nome) {
  const doAmbiente = process.env[nome];
  if (doAmbiente) return doAmbiente.trim();
  const env = join(raiz, ".env");
  if (!existsSync(env)) return null;
  const linha = readFileSync(env, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${nome}=`));
  if (!linha) return null;
  return linha.slice(nome.length + 1).trim().replace(/^["']|["']$/g, "");
}

const URL_SUPABASE = config("VITE_SUPABASE_URL");
const CHAVE = config("VITE_SUPABASE_PUBLISHABLE_KEY");

if (!URL_SUPABASE || !CHAVE) {
  console.error(
    "NÃO CONFERIDO: faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY.\n" +
      "Nem no ambiente, nem no .env do repositório.",
  );
  process.exit(2);
}

const alvo = `${URL_SUPABASE.replace(/\/$/, "")}/functions/v1/turnstile-config`;

let resposta;
try {
  resposta = await fetch(alvo, {
    method: "POST",
    headers: { apikey: CHAVE, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(25_000),
  });
} catch (e) {
  // Rede caiu, DNS não resolveu, proxy barrou. Não dá para dizer nada sobre a
  // função — e dizer "ok" aqui seria a mentira exata que este script existe
  // para impedir.
  console.error(`NÃO CONFERIDO: não consegui falar com ${alvo}\n  ${String(e)}`);
  process.exit(2);
}

const texto = await resposta.text();
let corpo = null;
try {
  corpo = JSON.parse(texto);
} catch {
  // corpo não-JSON: fica null e o diagnóstico abaixo usa o texto cru
}

if (corpo?.code === "BOOT_ERROR") {
  console.error(
    `LOGIN FECHADO: a turnstile-config não sobe (HTTP ${resposta.status}, BOOT_ERROR).\n\n` +
      "Sem a site key, o widget do captcha não renderiza e o botão Entrar fica\n" +
      "DESABILITADO para todo mundo. Ninguém entra com e-mail e senha.\n\n" +
      "Causa mais provável: import que não resolve no runtime das edge functions.\n" +
      "`deno check` fica verde sobre isso; quem pega é `npm run functions:carregam`.",
  );
  process.exit(1);
}

if (corpo?.error === "missing_site_key") {
  console.error(
    `LOGIN FECHADO: a turnstile-config subiu, mas TURNSTILE_SITE_KEY não está\n` +
      `cadastrada nos segredos das edge functions (HTTP ${resposta.status}).\n\n` +
      "Sem ela o widget não renderiza e o botão Entrar fica desabilitado.\n" +
      "Cadastre em Supabase → Edge Functions → Secrets.",
  );
  process.exit(1);
}

if (!resposta.ok) {
  console.error(
    `LOGIN FECHADO: a turnstile-config respondeu HTTP ${resposta.status}.\n` +
      `  ${texto.slice(0, 300)}`,
  );
  process.exit(1);
}

if (typeof corpo?.siteKey !== "string" || corpo.siteKey.length === 0) {
  // 200 com corpo vazio é o caso mais traiçoeiro: parece sucesso para qualquer
  // verificação que olhe só o código HTTP, e fecha o login do mesmo jeito.
  console.error(
    "LOGIN FECHADO: a turnstile-config respondeu 200 SEM site key.\n" +
      `  corpo: ${texto.slice(0, 300)}\n\n` +
      "Status 200 não é a garantia; a chave é. O widget trata os dois casos igual.",
  );
  process.exit(1);
}

console.log(
  `✓ a porta de entrada está aberta: turnstile-config devolveu a site key ` +
    `(${corpo.siteKey.length} caracteres, prefixo ${corpo.siteKey.slice(0, 4)}…).`,
);
