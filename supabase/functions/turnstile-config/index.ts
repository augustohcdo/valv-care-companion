// Devolve a SITE KEY pública do Turnstile para o front renderizar o widget sem
// cravá-la no repositório. Site key é pública por construção — quem protege é a
// secret key, que fica no servidor e nunca sai daqui.
//
// ## Esta função derrubou o login inteiro, e a CI ficou verde o tempo todo
//
// Ela importava `npm:@supabase/supabase-js@2/cors`. Esse subcaminho NÃO EXISTE
// na versão que o `deno.lock` destas functions trava: o lock resolve
// `npm:@supabase/supabase-js@2` para **2.45.0**, e o `package.json` da 2.45.0
// não tem mapa `exports` nenhum — logo, não tem `./cors`. (A 2.112.4, publicada
// depois, passou a ter. Por isso o mesmo import RESOLVE quando alguém roda fora
// do lock, e é assim que isto passa despercebido.)
//
// O efeito em produção era total:
//
//   BOOT_ERROR → 503 → `supabase.functions.invoke("turnstile-config")` falha →
//   `TurnstileWidget` mostra "Não foi possível carregar a verificação de
//   segurança" → o botão Entrar fica DESABILITADO (`disabled={… || !captchaToken}`)
//   → ninguém entra com e-mail e senha.
//
// E o `deno check` — que a CI roda em todas as functions — passava. Conferido:
// `deno check turnstile-config/index.ts` sai 0 sobre o arquivo quebrado,
// enquanto importar o módulo de verdade, sob o mesmo lock, devolve
// ERR_MODULE_NOT_FOUND. Para especificador `npm:`, checar tipo não é resolver
// módulo: o tipo vira `any` e a checagem segue em frente.
//
// É a mesma armadilha que a nota do `dpo-export` já descrevia sobre o
// `getClaims`: chamada que só quebra em tempo de execução, com a checagem
// estática verde. A diferença é que ali quebrava um caminho pouco usado; aqui
// quebrava a porta de entrada.
//
// A guarda que fecha isso é `scripts/functions-carregam.ts`, que RESOLVE o grafo
// de módulos de cada function — sob o config e o lock destas functions, que é o
// detalhe que faz a guarda valer alguma coisa.

// `*` aqui é deliberado, e é o que a função sempre fez. A resposta é uma chave
// pública, sem dado de paciente e sem cookie: restringir a origem só criaria uma
// forma nova de o login quebrar (preview, domínio novo) sem proteger nada. O
// `_shared/cors.ts`, com allowlist, é para as functions que devolvem dado.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") ?? "";

  // Segredo ausente e função quebrada davam a MESMA tela ao usuário: o widget
  // não distingue `siteKey: ""` de erro de rede, e nos dois casos escreve "não
  // foi possível carregar". Com o 503 e o código, quem for investigar sabe se
  // falta cadastrar o segredo ou se a função caiu.
  if (!siteKey) {
    return new Response(
      JSON.stringify({
        error: "missing_site_key",
        detail: "TURNSTILE_SITE_KEY não está configurada nos segredos das edge functions.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ siteKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
