// As rotas que o vigia diário pede ao site publicado.
//
// Por que isto existe: o site ficou uma semana devolvendo o 404 da Vercel em
// **toda** rota que não fosse `/` — faltava o rewrite de SPA. Isso quebrou o
// link de redefinir senha, o retorno do login com Google e a confirmação de
// cadastro, e ninguém soube até alguém tropeçar. Navegar pelo site não
// reproduz (o React Router troca a rota no navegador, sem passar pelo
// servidor) e `npm run dev` tem o fallback embutido, então o defeito era
// invisível dos dois lados.
//
// Lista curta e escolhida, não a varredura completa: o vigia roda todo dia
// contra o site de produção, e o que interessa é detectar a queda da entrega,
// não medir cada página. `scripts/smoke.mjs` faz a varredura ampla, sob demanda.
//
// `src/test/siteRoutes.test.ts` falha se alguma destas deixar de existir no
// `App.tsx` — senão um rename silencioso deixaria o vigia sondando um caminho
// que não existe mais, e alertando sobre nada.
export const ROTAS_CRITICAS = [
  "/",
  "/auth/login",
  "/auth/cadastro",
  "/auth/redefinir",
  "/auth/callback",
  "/app/medico",
  "/app/paciente",
  "/dpo",
] as const;

/** O marcador de que veio o shell do app, e não outra coisa qualquer. */
const MARCADOR = '<div id="root">';

export type RotaQuebrada = { rota: string; motivo: string };

/**
 * Pede cada rota e devolve as que não voltam o app.
 *
 * Duas asserções por rota, não uma: status 200 **e** o shell no corpo. Só o
 * status seria a versão fraca — um rewrite apontando para o arquivo errado
 * também devolveria 200.
 */
export async function sondarRotas(base: string): Promise<RotaQuebrada[]> {
  const raiz = base.replace(/\/$/, "");
  const quebradas: RotaQuebrada[] = [];

  for (const rota of ROTAS_CRITICAS) {
    try {
      const resposta = await fetch(raiz + rota, { redirect: "follow" });
      const corpo = await resposta.text();
      if (resposta.status !== 200) {
        quebradas.push({ rota, motivo: `HTTP ${resposta.status}` });
      } else if (!corpo.includes(MARCADOR)) {
        quebradas.push({ rota, motivo: "200, mas o corpo não é o shell do app" });
      }
    } catch (e) {
      quebradas.push({ rota, motivo: e instanceof Error ? e.message : String(e) });
    }
  }

  return quebradas;
}
