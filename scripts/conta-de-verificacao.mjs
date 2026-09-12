#!/usr/bin/env node
/**
 * A conta temporária que permite abrir as 39 telas protegidas num navegador.
 *
 * ## Por que ela precisa existir
 *
 * 39 das 61 rotas ficam sob `/app/`, e sem sessão todas param no login. Quer
 * dizer que hoje dá para quebrar qualquer uma delas com a CI verde: os testes
 * cobrem componentes isolados, o `smoke` confere o shell (que é o mesmo HTML
 * para as 61) e o `rotas-renderizam` sem sessão relata honestamente 39
 * redirecionamentos. Nenhuma dessas telas é aberta por nada automático.
 *
 * ## Por que ela é perigosa, e o que se faz a respeito
 *
 * Uma conta que consegue entrar é uma porta para a base de PRODUÇÃO. O
 * `demo-seed.mjs` cria os três médicos fictícios **banidos até 2099**, com o
 * comentário "sem isso seriam três portas de entrada a mais" — e está certo.
 * Aqui a conta precisa entrar, então a porta existe. O que dá para fazer é
 * reduzi-la ao mínimo:
 *
 *   · **senha aleatória de 32 bytes por execução**, gerada aqui, nunca impressa,
 *     nunca escrita no repositório, nunca repetida;
 *   · **vida de minutos**: criada e apagada dentro da mesma execução do
 *     workflow, com a remoção num passo `if: always()`;
 *   · **sem papel privilegiado**. Nenhum `admin`. O próprio vigia deste projeto
 *     dispara alerta por concessão de papel privilegiado nas últimas 24h, e com
 *     razão: quem tem esse papel lê o backup inteiro e edita a base que a IA
 *     cita como diretriz. As rotas de `/app/admin/*` ficam sem cobertura, e isso
 *     está dito no relatório em vez de resolvido por um atalho;
 *   · **sem dado nenhum**. Conta recém-criada não tem vínculo com paciente
 *     algum, e a RLS faz o resto. As telas abrem em estado vazio — que é
 *     exatamente o que se quer medir: elas MONTAM?
 *
 * ## O captcha não é contornado
 *
 * O formulário de login exige Turnstile, e o botão fica desabilitado sem o
 * token. Não se burla proteção contra robô, nem a do próprio dono. A sessão vem
 * da API de administração, que é o caminho previsto para isto: ou o
 * `grant_type=password`, ou um `magiclink` gerado pelo administrador e trocado
 * por sessão. Nos dois casos quem assina o token é o servidor de autenticação
 * de verdade — é por isso que o cliente a aceita, e era exatamente o que faltava
 * na tentativa anterior com sessão inventada.
 *
 * ## A remoção é CONFERIDA, não relatada
 *
 * `--apagar` não confia no 200 do DELETE. Ele volta a perguntar pelo usuário e
 * pelo perfil, e só diz que apagou quando os dois somem. Uma conta que continua
 * de pé porque "o DELETE respondeu OK" é a forma mais cara possível do defeito
 * que esta sessão inteira persegue — sobra uma porta aberta na produção.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/conta-de-verificacao.mjs \
 *       --criar --tipo medico --saida /tmp/sessao.json
 *   SUPABASE_ACCESS_TOKEN=... node scripts/conta-de-verificacao.mjs \
 *       --apagar --id <uuid>
 *
 * Saídas: 0 certo · 1 errado · 2 NÃO CONFERIDO (não deu para saber).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("NÃO CONFERIDO: falta SUPABASE_ACCESS_TOKEN no ambiente.");
  process.exit(2);
}

const config = readFileSync(resolve(raiz, "supabase/config.toml"), "utf8");
const REF = config.match(/project_id\s*=\s*"([^"]+)"/)?.[1];
if (!REF) {
  console.error("NÃO CONFERIDO: não achei project_id em supabase/config.toml.");
  process.exit(2);
}
const URL_BASE = `https://${REF}.supabase.co`;

const args = process.argv.slice(2);
const temFlag = (n) => args.includes(n);
const valorFlag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

// ---------------------------------------------------------------- infra

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`SQL falhou (${r.status}): ${texto.slice(0, 300)}`);
  return JSON.parse(texto);
}

/**
 * A chave `service_role`, necessária só para CRIAR e APAGAR a conta.
 *
 * Ela pode vir de duas origens, nesta ordem:
 *
 *   1. `SUPABASE_SERVICE_ROLE_KEY` no ambiente, quando alguém a cadastrou;
 *   2. a API de gestão, com `reveal=true`, quando o token tem essa permissão.
 *
 * O caminho 2 é o que o `demo-seed.mjs` usa e funciona com um token pessoal.
 * O token cadastrado na CI deste repositório respondeu **403** — ele executa
 * SQL, mas não revela chave. Daí o caminho 1 existir: é o que permite rodar
 * sem alargar um token que é root sobre a conta inteira do Supabase.
 *
 * `--env-do-build` NÃO passa por aqui: a chave pública se lê sem `reveal`.
 */
let SERVICE_ROLE;
async function chaves() {
  const doAmbiente = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (doAmbiente) {
    SERVICE_ROLE = doAmbiente;
    console.log("Chave service_role: veio do ambiente (não pedi à API de gestão).");
    return;
  }

  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) {
    throw new Error(
      `não consegui obter a chave service_role (a API de gestão respondeu ${r.status}).\n` +
      "  Duas saídas, e a primeira é a menor:\n" +
      "  · cadastre SUPABASE_SERVICE_ROLE_KEY nos segredos do repositório; ou\n" +
      "  · use um token da API de gestão com permissão de leitura de chaves.\n" +
      "  Alargar o token é o caminho maior: ele é root sobre a conta inteira.",
    );
  }
  const achada = (await r.json()).find((k) => k.name === "service_role");
  if (!achada?.api_key) throw new Error("o projeto não expôs uma chave service_role com valor");
  SERVICE_ROLE = achada.api_key;
}


const cabecalhos = () => ({
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
});

/**
 * O e-mail da conta. O prefixo é lido por humano em `auth.users` e diz o que é,
 * quem criou e que é para apagar — uma conta anônima numa lista de usuários de
 * produção é um susto desnecessário para quem for auditar depois.
 *
 * O domínio `.invalid` é reservado pela RFC 2606 justamente para isto: não
 * existe, não resolve, ninguém recebe nada. Não dá para transformar esta conta
 * numa caixa de entrada.
 */
const emailDaVez = () => `verificacao-de-rotas-apagar+${randomUUID().slice(0, 8)}@valvepath.invalid`;

// ------------------------------------------------- chaves públicas do build

/**
 * O `.env` do build, montado a partir do que a API de gestão já sabe.
 *
 * A CI constrói sem `.env` (ele é ignorado pelo git), e para os testes de
 * unidade isso não faz diferença — nenhum deles sobe o cliente de verdade. Mas
 * um app SERVIDO sem a URL do projeto não resolve sessão nenhuma, e a varredura
 * autenticada morreria com uma mensagem obscura.
 *
 * Buscar aqui evita cadastrar dois segredos novos para guardar valores que são
 * públicos por construção — a chave `anon`/`publishable` vai embutida em todo
 * bundle que qualquer visitante baixa. Quem protege os dados é a RLS, não o
 * sigilo dela.
 */
async function envDoBuild(saida) {
  if (!saida) {
    console.error("NÃO CONFERIDO: falta --saida <arquivo> para o .env do build.");
    process.exit(2);
  }
  // SEM `reveal=true` primeiro, de propósito.
  //
  // O `reveal` existe para expor as chaves SECRETAS, e exige permissão que um
  // token estreito não tem — na primeira execução deste workflow a API
  // respondeu 403 por causa dele. Mas a chave que o build precisa é a PÚBLICA,
  // e para ela o `reveal` não é necessário. Pedir mais permissão do que se usa
  // é o erro que transforma "não consegui montar o .env" numa conversa sobre
  // token root.
  let todas = null;
  for (const sufixo of ["", "?reveal=true"]) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys${sufixo}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (r.ok) { todas = await r.json(); break; }
    if (sufixo === "?reveal=true") {
      throw new Error(
        `não consegui ler as chaves do projeto (${r.status}). O token da API de gestão ` +
        "provavelmente não tem permissão de leitura das chaves deste projeto.",
      );
    }
  }
  // Projetos novos chamam de `publishable`; os antigos, de `anon`. Aceitar os
  // dois nomes, e falhar dizendo o que existe — em vez de gravar `undefined` e
  // deixar o erro aparecer três passos adiante, no navegador.
  const publica = todas.find((k) => k.name === "publishable") ?? todas.find((k) => k.name === "anon");
  if (!publica) {
    throw new Error(
      `o projeto não expôs chave publishable nem anon (achei: ${todas.map((k) => k.name).join(", ")})`,
    );
  }
  if (!publica.api_key) {
    throw new Error(
      `a chave ${publica.name} veio sem valor — a API listou a chave mas não o conteúdo dela. ` +
      "Isso acontece quando o token não tem permissão para ler o valor.",
    );
  }
  writeFileSync(saida, [
    `VITE_SUPABASE_PROJECT_ID=${REF}`,
    `VITE_SUPABASE_URL=${URL_BASE}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${publica.api_key}`,
    "",
  ].join("\n"), { mode: 0o600 });
  console.log(`.env do build gravado em ${saida} (chave ${publica.name}, projeto ${REF}).`);
}

// --------------------------------------------------------------- criar

/**
 * Troca as credenciais por uma sessão real, sem passar pelo formulário.
 *
 * Dois caminhos, nesta ordem, e o script diz qual funcionou — porque "obtive
 * sessão" sem dizer como esconde a única informação que importa se um dia
 * parar de funcionar.
 */
async function cunharSessao(email, senha) {
  // 1) Senha. É o caminho curto. Se o projeto exigir captcha no servidor, ele
  //    recusa aqui — e recusar é o certo, não há o que contornar.
  const porSenha = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: cabecalhos(), body: JSON.stringify({ email, password: senha }),
  });
  if (porSenha.ok) {
    const s = await porSenha.json();
    if (s?.access_token) return { sessao: s, via: "grant_type=password" };
  }
  const motivoSenha = (await porSenha.text().catch(() => "")).slice(0, 160);

  // 2) Link mágico gerado pelo administrador e trocado por sessão. É o fluxo de
  //    login por e-mail do próprio produto, só que sem o e-mail no meio.
  const link = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
    method: "POST", headers: cabecalhos(),
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!link.ok) {
    throw new Error(
      `nenhum caminho deu sessão.\n  senha: ${motivoSenha}\n  magiclink: ${(await link.text()).slice(0, 160)}`,
    );
  }
  const { hashed_token } = await link.json();
  if (!hashed_token) throw new Error("generate_link respondeu sem hashed_token");

  const verificado = await fetch(`${URL_BASE}/auth/v1/verify`, {
    method: "POST", headers: cabecalhos(),
    body: JSON.stringify({ type: "magiclink", token_hash: hashed_token }),
  });
  if (!verificado.ok) {
    throw new Error(`verify recusou o token do magiclink: ${(await verificado.text()).slice(0, 160)}`);
  }
  const s = await verificado.json();
  if (!s?.access_token) throw new Error("verify respondeu sem access_token");
  return { sessao: s, via: "magiclink de administrador" };
}

async function criar(tipo, saida) {
  if (!["medico", "paciente"].includes(tipo)) {
    console.error(`NÃO CONFERIDO: --tipo precisa ser medico ou paciente (veio "${tipo}").`);
    process.exit(2);
  }
  if (!saida) {
    console.error("NÃO CONFERIDO: falta --saida <arquivo> para gravar a sessão.");
    process.exit(2);
  }

  const email = emailDaVez();
  // 32 bytes de aleatoriedade criptográfica. Nunca sai daqui: não é impressa,
  // não é gravada, e a conta some antes de o processo terminar.
  const senha = randomBytes(32).toString("base64url");

  const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST", headers: cabecalhos(),
    body: JSON.stringify({
      email, password: senha, email_confirm: true,
      user_metadata: {
        full_name: "Verificação automática de rotas",
        account_type: tipo,
      },
    }),
  });
  const criado = await r.json();
  if (!criado?.id) {
    console.error(`NÃO CONFERIDO: falha ao criar a conta — ${JSON.stringify(criado).slice(0, 300)}`);
    process.exit(2);
  }
  // O id vai para o disco AGORA, antes de qualquer conferência.
  //
  // Se uma das checagens abaixo reprovar, a conta já existe — e é o passo de
  // remoção do workflow, que roda com `if: always()`, que vai apagá-la. Ele
  // encontra a conta por este arquivo. Gravá-lo só no fim deixaria uma conta
  // com acesso à produção de pé exatamente nos casos em que algo deu errado,
  // que são os piores para deixar ponta solta.
  writeFileSync(`${saida}.id`, criado.id, { mode: 0o600 });
  console.log(`Conta criada: ${email} (${criado.id}), tipo ${tipo}.`);

  /**
   * O `ProtectedRoute` decide por `profile.account_type`, e o perfil é criado
   * por gatilho a partir do `user_metadata`. Conferir aqui, e não lá: se o
   * gatilho não rodou, a varredura devolveria 39 redirecionamentos e uma causa
   * difícil de achar. Aqui o erro é uma frase.
   */
  let perfil = null;
  for (let tentativa = 0; tentativa < 10 && !perfil; tentativa++) {
    await new Promise((r) => setTimeout(r, 400));
    const linhas = await sql(
      `select account_type from public.profiles where user_id = '${criado.id}'`,
    );
    perfil = linhas[0] ?? null;
  }
  if (!perfil) {
    console.error(
      "NÃO CONFERIDO: a conta foi criada mas o perfil não apareceu em public.profiles\n" +
      "  em 4 s. Sem perfil o ProtectedRoute não libera as rotas por tipo.\n" +
      `  APAGUE A CONTA: --apagar --id ${criado.id}`,
    );
    process.exit(2);
  }
  if (perfil.account_type !== tipo) {
    console.error(
      `NÃO CONFERIDO: o perfil saiu como "${perfil.account_type}", e não "${tipo}".\n` +
      `  APAGUE A CONTA: --apagar --id ${criado.id}`,
    );
    process.exit(2);
  }
  console.log(`Perfil confirmado em public.profiles: account_type = ${perfil.account_type}.`);

  let sessao, via;
  try {
    ({ sessao, via } = await cunharSessao(email, senha));
  } catch (e) {
    console.error(
      `NÃO CONFERIDO: não consegui cunhar sessão — ${String(e.message).slice(0, 400)}\n` +
      `  APAGUE A CONTA: --apagar --id ${criado.id}`,
    );
    process.exit(2);
  }
  console.log(`Sessão obtida via ${via}.`);

  // O arquivo carrega um token de acesso válido. Fica só no disco efêmero do
  // executor, com permissão restrita, e é o workflow que garante que ele não vai
  // para log nem para artefato.
  writeFileSync(saida, JSON.stringify(sessao), { mode: 0o600 });
  console.log(`Sessão gravada em ${saida} (o id da conta em ${saida}.id).`);
}

// -------------------------------------------------------------- apagar

async function apagar(id) {
  if (!id) {
    console.error("NÃO CONFERIDO: falta --id <uuid> da conta a apagar.");
    process.exit(2);
  }

  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: "DELETE", headers: cabecalhos(),
  });
  const respostaDoDelete = r.status;

  /**
   * A conferência, que é o motivo de esta função existir em vez de um `curl`.
   *
   * O DELETE respondendo 200 diz que a requisição foi aceita. Não diz que a
   * linha sumiu — e aqui a diferença entre as duas coisas é uma conta capaz de
   * entrar na produção, de pé, sem ninguém sabendo. É o mesmo defeito que esta
   * sessão vem perseguindo, com a consequência mais cara que ele já teve.
   */
  const [restou] = await sql(`select
      (select count(*) from auth.users where id = '${id}') usuario,
      (select count(*) from public.profiles where user_id = '${id}') perfil`);

  if (Number(restou.usuario) > 0 || Number(restou.perfil) > 0) {
    console.error(
      `A CONTA NÃO FOI APAGADA. O DELETE respondeu ${respostaDoDelete}, mas continuam:\n` +
      `  auth.users: ${restou.usuario} linha(s)\n` +
      `  public.profiles: ${restou.perfil} linha(s)\n\n` +
      "Isto é uma conta com acesso à produção que ficou de pé. Apague à mão:\n" +
      `  delete from auth.users where id = '${id}';`,
    );
    process.exit(1);
  }

  console.log(`Conta ${id} apagada e CONFERIDA: 0 linhas em auth.users e em public.profiles.`);
}

// ---------------------------------------------------------------- main

try {
  // `--env-do-build` precisa só da chave PÚBLICA, e ela se lê sem `reveal`.
  // Chamar `chaves()` aqui exigiria a `service_role` para montar um `.env` que
  // não a usa — foi exatamente assim que a primeira execução do workflow morreu.
  if (temFlag("--env-do-build")) {
    await envDoBuild(valorFlag("--saida"));
  } else if (temFlag("--criar")) {
    await chaves();
    await criar(valorFlag("--tipo") ?? "medico", valorFlag("--saida"));
  } else if (temFlag("--apagar")) {
    await chaves();
    await apagar(valorFlag("--id"));
  } else {
    console.error(
      "Use --criar --tipo <medico|paciente> --saida <arquivo>,\n" +
      "    --apagar --id <uuid>, ou\n" +
      "    --env-do-build --saida <arquivo>.",
    );
    process.exit(2);
  }
} catch (e) {
  console.error(`NÃO CONFERIDO: ${String(e?.message ?? e).slice(0, 400)}`);
  process.exit(2);
}
