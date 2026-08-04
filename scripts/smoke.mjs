#!/usr/bin/env node
/**
 * Pede cada rota do app à URL publicada e falha listando as que não voltam o
 * shell da aplicação.
 *
 * Por que isto existe: o preset de Vite da Vercel não adiciona o fallback de
 * SPA sozinho. Sem o rewrite do `vercel.json`, toda rota que não seja `/`
 * devolve o 404 da Vercel — e isso é invisível de duas maneiras. Navegando pelo
 * site funciona (o React Router troca a rota sem passar pelo servidor), e
 * `npm run dev` **tem** o fallback embutido, então o defeito nunca reproduz
 * localmente. Foi assim que o link de redefinir senha, o retorno do login com
 * Google e a confirmação de cadastro ficaram caindo em 404 sem ninguém saber.
 *
 * Uso:
 *   npm run smoke                          # produção
 *   npm run smoke -- http://localhost:4173 # um preview local
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const BASE = (process.argv[2] || process.env["SMOKE_BASE_URL"] || "https://valvepath.com.br")
  .replace(/\/$/, "");

/** O marcador de que veio o shell do app, e não outro arquivo qualquer. */
const MARCADOR = '<div id="root">';

/**
 * As rotas saem do próprio `App.tsx`, não de uma lista à parte.
 *
 * Uma lista paralela envelheceria em silêncio — foi exatamente assim que a
 * lista de tabelas do backup ficou cobrindo 22 de 37. Rotas com `:param` ou
 * `*` ficam de fora porque não têm um caminho concreto para pedir; o catch-all
 * é exercitado pelo teste de rota inexistente abaixo.
 */
function rotasDoApp() {
  const fonte = readFileSync(join(raiz, "src/App.tsx"), "utf8");
  const achadas = [...fonte.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  const concretas = achadas.filter((p) => p.startsWith("/") && !p.includes(":") && !p.includes("*"));
  return [...new Set(concretas)].sort();
}

async function sondar(caminho) {
  try {
    const resposta = await fetch(BASE + caminho, { redirect: "follow" });
    const corpo = await resposta.text();
    if (resposta.status !== 200) {
      return { caminho, ok: false, motivo: `HTTP ${resposta.status}` };
    }
    // Só o status seria a versão fraca da checagem: um rewrite apontando para o
    // arquivo errado também devolveria 200.
    if (!corpo.includes(MARCADOR)) {
      return { caminho, ok: false, motivo: "200, mas o corpo não é o shell do app" };
    }
    return { caminho, ok: true };
  } catch (erro) {
    return { caminho, ok: false, motivo: erro instanceof Error ? erro.message : String(erro) };
  }
}

/** Pequenos lotes: são dezenas de rotas, e não há por que martelar o host. */
async function emLotes(itens, tamanho, tarefa) {
  const saida = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(tarefa))));
  }
  return saida;
}

const rotas = rotasDoApp();
if (rotas.length === 0) {
  console.error("Nenhuma rota encontrada em src/App.tsx — o parser quebrou, não o site.");
  process.exit(2);
}

// Uma rota que não existe também tem que devolver o shell: quem decide que é
// 404 é o app (a rota catch-all), não a Vercel.
const inexistente = "/__smoke_rota_inexistente";

console.log(`Sondando ${rotas.length + 1} rotas em ${BASE}\n`);
const resultados = await emLotes([...rotas, inexistente], 6, sondar);
const quebradas = resultados.filter((r) => !r.ok);

for (const r of quebradas) console.log(`  ✗ ${r.caminho} — ${r.motivo}`);

if (quebradas.length > 0) {
  console.error(`\n${quebradas.length} de ${resultados.length} rotas não devolvem o app.`);
  console.error("Se forem todas menos `/`, o rewrite de SPA do vercel.json não está valendo.");
  process.exit(1);
}

console.log(`✓ as ${resultados.length} rotas devolvem o shell do app.`);
