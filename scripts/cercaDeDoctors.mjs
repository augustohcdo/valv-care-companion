#!/usr/bin/env node
/**
 * A cerca de `doctors` está no lugar EM PRODUÇÃO?
 *
 * ## O que faltava
 *
 * A migration `20260923140000_doctors_sem_leitura_aberta` trocou o
 * `using (true)` de `doctors` por uma cerca de cinco portas, e isso foi provado
 * numa bancada PostgreSQL 16 — réplica das tabelas, das políticas e dos dados.
 * Bancada é prova de que o SQL faz o que diz; não é prova de que o SQL que faz
 * isso é o que está rodando em produção.
 *
 * Este script fecha essa distância pelo caminho do usuário: uma sessão de
 * verdade, contra o PostgREST de produção, com a chave PÚBLICA — a mesma que
 * todo visitante baixa. Nenhum segredo entra aqui, e em particular nenhuma
 * `service_role`: ela ignora toda a RLS e tornaria a conferência sem sentido,
 * porque leria tudo por construção.
 *
 * ## O que ele mede, por tipo de conta
 *
 *   · **paciente** (sem médico vinculado) — o `diretorio_medicos()` devolve N
 *     médicos, e a leitura direta de `doctors` tem de devolver ZERO. O
 *     diretório é `security definer` e passa pela cerca: é ele que prova que as
 *     linhas EXISTEM, sem o que "zero" não distingue cerca de tabela vazia;
 *   · **médico** — tem de ler a PRÓPRIA linha (a porta 1). O número total que
 *     ele lê não é afirmado: a porta 5 ainda está aberta em produção e sai na
 *     etapa 2 de `20261005121000`.
 *
 * ## Três estados
 *
 *   0 — a cerca está no lugar;
 *   1 — DIVERGE: leitura aberta, ou o médico sem a própria linha;
 *   2 — NÃO CONFERIDO: sem sessão, sem chave, diretório vazio, HTTP falhou.
 *       "Não sei" não é "está tudo bem".
 */

import {
  vereditoDoPaciente, vereditoDoMedico, userIdDaSessao,
} from "./lib/cercaDeDoctors.mjs";

const argumentos = process.argv.slice(2);
const valorDe = (nome) => {
  const i = argumentos.indexOf(nome);
  return i >= 0 ? argumentos[i + 1] : undefined;
};

const TIPO = valorDe("--tipo");
const BASE = (process.env["ROTAS_SUPABASE_URL"] ?? "").replace(/\/$/, "");
const CHAVE = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";
const SESSAO_CRUA = process.env["ROTAS_SESSAO"] ?? "";

function naoConferido(motivo) {
  console.error(`NÃO CONFERIDO: ${motivo}`);
  process.exit(2);
}

if (!["medico", "paciente"].includes(TIPO ?? "")) {
  naoConferido(`--tipo precisa ser medico ou paciente (veio "${TIPO}")`);
}
if (!BASE) naoConferido("falta ROTAS_SUPABASE_URL");
if (!CHAVE) naoConferido("falta VITE_SUPABASE_PUBLISHABLE_KEY (a chave pública)");
if (!SESSAO_CRUA) naoConferido("falta ROTAS_SESSAO — sem sessão não há o que conferir");

let sessao;
try {
  sessao = JSON.parse(SESSAO_CRUA);
} catch {
  naoConferido("ROTAS_SESSAO não é JSON");
}
if (!sessao?.access_token) naoConferido("a sessão não tem `access_token`");

/**
 * Cabeçalhos de um usuário comum: a chave pública como `apikey` e o token da
 * sessão como portador. É exatamente o que o navegador manda — e é por isso que
 * o resultado vale: a cerca é aplicada do mesmo jeito.
 */
const cabecalhos = {
  apikey: CHAVE,
  Authorization: `Bearer ${sessao.access_token}`,
  "Content-Type": "application/json",
};

async function pedir(caminho, opcoes = {}) {
  const r = await fetch(`${BASE}${caminho}`, { ...opcoes, headers: cabecalhos });
  const texto = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} em ${caminho}: ${texto.slice(0, 200)}`);
  }
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`resposta de ${caminho} não é JSON: ${texto.slice(0, 120)}`);
  }
}

let linhas;
let diretorio = [];
try {
  // `select=id,user_id` e nada mais. Pedir `*` traria CRM, RQE, cidade e
  // biografia para o log de uma CI — e o que se quer saber é QUANTAS linhas a
  // cerca deixa passar, não o que há nelas.
  linhas = await pedir("/rest/v1/doctors?select=id,user_id");
  if (TIPO === "paciente") {
    diretorio = await pedir("/rest/v1/rpc/diretorio_medicos", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }
} catch (e) {
  naoConferido(String(e?.message ?? e).slice(0, 300));
}

const veredito = TIPO === "paciente"
  ? vereditoDoPaciente({
      noDiretorio: Array.isArray(diretorio) ? diretorio.length : 0,
      lidasNaTabela: Array.isArray(linhas) ? linhas.length : 0,
    })
  : vereditoDoMedico({
      lidasNaTabela: Array.isArray(linhas) ? linhas.length : 0,
      meuUserId: userIdDaSessao(sessao),
      userIdsLidos: (Array.isArray(linhas) ? linhas : []).map((l) => l.user_id),
    });

// Nenhum `id` nem `user_id` vai para a saída: eles identificam médicos reais, e
// log de CI é público neste repositório. O que sai é a CONTAGEM e o veredito.
if (veredito.estado === 0) console.log(`✓ ${TIPO}: ${veredito.mensagem}`);
else console.error(veredito.mensagem);

process.exit(veredito.estado);
