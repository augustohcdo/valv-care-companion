#!/usr/bin/env node
/**
 * A conferência que só faz sentido DEPOIS do deploy.
 *
 * ## Por que existe um script só para isto
 *
 * As mudanças de catálogo desta rodada vão por migration versionada, e migration
 * não roda aqui: não há Postgres nem Docker neste ambiente, e a CI também não as
 * aplica — quem aplica é o pipeline de publicação. Isso cria uma janela em que o
 * código já fala de 36 famílias e o banco ainda serve 45, e nessa janela o
 * `ferramentas:verificar` reprova **com razão**.
 *
 * O risco de uma janela assim é o de sempre: alguém roda a conferência cedo
 * demais, vê vermelho, conclui "quebrou" e reverte; ou roda e vê verde por
 * acidente e conclui "publicou". Este script responde a uma pergunta anterior a
 * todas as outras — **a migration chegou?** — e só então diz o resto.
 *
 * ## Como ele sabe que a migration chegou
 *
 * Não pela data, não pelo commit: pelo **efeito**. Três marcas que só existem
 * depois desta rodada, e que nenhuma delas pode ser falsificada por cache:
 *
 *   1. a função `referencia_historica()` responde;
 *   2. o catálogo devolve a coluna `image_kind`;
 *   3. não há nenhuma linha `tavi` no catálogo.
 *
 * Se as três falharem juntas, a migration não rodou — e isso é dito com todas as
 * letras, em vez de virar uma lista de conferências vermelhas que parecem
 * defeitos do código.
 *
 * Uso: node scripts/conferir-publicacao.mjs
 * Precisa de `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente.
 */

const SUPABASE = "https://qwiojyfxzvdcfbbexyxg.supabase.co";
const CHAVE = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
if (!CHAVE) {
  console.error("Falta VITE_SUPABASE_PUBLISHABLE_KEY no ambiente. NÃO CONFERIDO.");
  process.exit(2);
}

const cab = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" };
const chamar = async (fn) => {
  const r = await fetch(`${SUPABASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: cab, body: "{}" });
  return { status: r.status, corpo: r.ok ? await r.json() : null };
};

const casos = [];
const falhas = [];
function conferir(nome, obtido, esperado) {
  const ok = typeof esperado === "number" ? obtido === esperado : esperado.test(String(obtido));
  casos.push(nome);
  if (!ok) falhas.push(nome);
  console.log(`${ok ? "✓" : "✗"} ${nome}\n     obtido: ${obtido}   esperado: ${esperado}`);
}

// ---------------------------------------------------------------------------
// Pergunta zero: a migration chegou?
// ---------------------------------------------------------------------------

const cat = await chamar("catalogo_proteses");
if (cat.status !== 200) {
  console.error(`O RPC do catálogo respondeu ${cat.status}. Nada mais pode ser afirmado daqui.`);
  process.exit(2);
}
const linhas = cat.corpo;
const hist = await chamar("referencia_historica");

const temFuncao = hist.status === 200;
const temColuna = linhas.length > 0 && "image_kind" in linhas[0];
const semTavi = linhas.every((l) => l.type !== "tavi");

if (!temFuncao && !temColuna && !semTavi) {
  console.error(
    "\nA MIGRATION AINDA NÃO RODOU.\n" +
    "  · referencia_historica() não existe\n" +
    "  · o catálogo não devolve image_kind\n" +
    "  · ainda há linhas transcateter\n\n" +
    "Isto NÃO é defeito do código publicado: é o banco ainda no estado anterior.\n" +
    "Espere o pipeline de publicação aplicar as migrations e rode de novo.",
  );
  process.exit(3);
}
if (!temFuncao || !temColuna || !semTavi) {
  console.error(
    "\nMIGRATION APLICADA PELA METADE — o pior estado possível, e por isso tem código próprio:\n" +
    `  · referencia_historica(): ${temFuncao ? "existe" : "NÃO existe"}\n` +
    `  · image_kind no catálogo: ${temColuna ? "existe" : "NÃO existe"}\n` +
    `  · sem transcateter: ${semTavi ? "sim" : "NÃO — ainda há linhas tavi"}\n`,
  );
  process.exit(3);
}

console.log("Migration aplicada. Conferindo o que ela devia ter produzido.\n");

// ---------------------------------------------------------------------------
// O que a rodada prometeu
// ---------------------------------------------------------------------------

const familias = new Map();
for (const l of linhas) {
  const k = `${l.manufacturer}|${l.model_name}`;
  const f = familias.get(k) ?? { imagem: null, tipoDeImagem: null };
  f.imagem = f.imagem || l.image_url;
  f.tipoDeImagem = f.tipoDeImagem || l.image_kind;
  familias.set(k, f);
}
const semImagem = [...familias].filter(([, f]) => !f.imagem).map(([k]) => k);

conferir("catálogo: nenhuma prótese transcateter", linhas.filter((l) => l.type === "tavi").length, 0);
conferir(
  `catálogo: toda família tem imagem oficial${semImagem.length ? ` — sem: ${semImagem.join(", ")}` : ""}`,
  semImagem.length,
  0,
);
conferir(
  "catálogo: toda imagem declara se é foto ou ilustração",
  [...familias].filter(([, f]) => f.imagem && !f.tipoDeImagem).length,
  0,
);
conferir("catálogo: nenhuma linha ativa sob alerta regulatório", linhas.filter((l) => l.advisory).length, 0);

// A nomenclatura que o usuário apontou: um nome comercial, uma família.
conferir(
  "nomes: a Abbott não tem mais uma família 'Epic' cobrindo aórtica e mitral",
  linhas.filter((l) => l.manufacturer === "Abbott" && l.model_name === "Epic").length,
  0,
);
for (const nome of ["Epic Plus Supra", "Epic Plus", "Epic Max"]) {
  conferir(`nomes: Abbott ${nome} está no catálogo`, linhas.filter((l) => l.model_name === nome).length, /^[1-9]/);
}
for (const nome of ["Avalus Ultra", "Mosaic"]) {
  conferir(`novas: Medtronic ${nome} está no catálogo`, linhas.filter((l) => l.model_name === nome).length, /^[1-9]/);
}

// ---------------------------------------------------------------------------
// A referência histórica — e a separação, que é o ponto
// ---------------------------------------------------------------------------

const fora = hist.corpo;
conferir("fora de linha: a Perimount continua acessível", fora.filter((l) => l.model_name === "Perimount").length, /^[1-9]/);
conferir("fora de linha: a Trifecta GT continua acessível", fora.filter((l) => l.model_name === "Trifecta GT").length, /^[1-9]/);
conferir(
  "fora de linha: toda linha diz quando saiu e com que fonte",
  fora.filter((l) => !l.discontinued_at || !l.discontinued_source_url).length,
  0,
);
conferir(
  // A separação é o que impede que "referência histórica" vire oferta disfarçada.
  "fora de linha: nenhuma delas voltou para o catálogo",
  fora.filter((h) => linhas.some((l) => l.manufacturer === h.manufacturer && l.model_name === h.model_name)).length,
  0,
);
conferir(
  "fora de linha: a EOA delas continua gravada, que é a razão de não terem sido apagadas",
  fora.filter((l) => l.effective_orifice_area != null).length,
  /^[1-9]/,
);

// ---------------------------------------------------------------------------
// A Edwards, que foi o pedido explícito
// ---------------------------------------------------------------------------

const magna = linhas.filter(
  (l) => l.model_name === "Magna Ease" && l.effective_orifice_area != null,
);
conferir("Edwards: a Magna Ease tem 5 tamanhos com EOA (era 2)", magna.length, 5);
conferir(
  "Edwards: o 19 mm da Magna Ease segue sem valor — n = 9, abaixo do piso",
  linhas.filter((l) => l.model_name === "Magna Ease" && l.size === 19 && l.effective_orifice_area != null).length,
  0,
);

console.log(`\n${casos.length - falhas.length} de ${casos.length} conferências passaram.`);
if (falhas.length) {
  console.log("\nFALHOU:");
  for (const f of falhas) console.log("  · " + f);
  process.exit(1);
}
