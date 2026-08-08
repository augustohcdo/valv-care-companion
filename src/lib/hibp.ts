/**
 * Verificação de senha vazada contra a base pública Pwned Passwords.
 *
 * O site prometia isso em cinco lugares — Termos, Política de Privacidade,
 * página de Segurança ("bloqueamos senhas que apareceram em vazamentos"), um
 * selo de confiança dizendo "Checagem HIBP ativa", e o Centro de Segurança da
 * área logada — e não existia: `password_hibp_enabled` estava `false` no
 * projeto, porque essa verificação nativa do Supabase é recurso de plano pago.
 *
 * A API pública Pwned Passwords é gratuita e não pede chave, então a promessa
 * pôde virar verdade em vez de ser apagada.
 *
 * **A senha nunca sai do navegador.** O protocolo é de k-anonimato: calcula-se
 * o SHA-1 localmente e envia-se apenas os **5 primeiros caracteres** do hash. O
 * servidor devolve todos os sufixos que começam com aquele prefixo — centenas
 * deles — e a comparação final acontece aqui. O outro lado nunca sabe qual
 * senha foi consultada, nem sequer se houve acerto.
 */

const API = "https://api.pwnedpasswords.com/range/";

export type ResultadoHibp =
  | { estado: "vazada"; ocorrencias: number }
  | { estado: "limpa" }
  /**
   * Não deu para verificar (sem rede, API fora do ar, contexto inseguro).
   *
   * Quem chama **não deve bloquear** o cadastro nesse caso: travar a criação de
   * conta porque um serviço de terceiro caiu seria pior que o risco evitado. É
   * por isso que o texto publicado diz "verificamos", e não "garantimos".
   */
  | { estado: "indisponivel"; motivo: string };

/** SHA-1 em hexadecimal maiúsculo, que é o formato que a API usa. */
async function sha1(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function verificarSenhaVazada(senha: string): Promise<ResultadoHibp> {
  // `crypto.subtle` só existe em contexto seguro (https ou localhost). Sem ele
  // não há como calcular o hash, e o certo é dizer que não deu — não fingir
  // que a senha está limpa.
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return { estado: "indisponivel", motivo: "contexto sem WebCrypto" };
  }

  try {
    const hash = await sha1(senha);
    const prefixo = hash.slice(0, 5);
    const sufixo = hash.slice(5);

    const resposta = await fetch(API + prefixo, {
      // A HIBP preenche a resposta com sufixos falsos quando este cabeçalho
      // está presente, para que o tamanho do tráfego não denuncie quantos
      // acertos reais existem naquele prefixo.
      headers: { "Add-Padding": "true" },
    });
    if (!resposta.ok) {
      return { estado: "indisponivel", motivo: `HTTP ${resposta.status}` };
    }

    const corpo = await resposta.text();
    for (const linha of corpo.split("\n")) {
      const [suf, contagem] = linha.trim().split(":");
      if (suf !== sufixo) continue;
      const n = Number(contagem);
      // O padding da HIBP vem com contagem 0 — é sufixo inventado, não acerto.
      return n > 0 ? { estado: "vazada", ocorrencias: n } : { estado: "limpa" };
    }
    return { estado: "limpa" };
  } catch (e) {
    return {
      estado: "indisponivel",
      motivo: e instanceof Error ? e.message : String(e),
    };
  }
}

/** O texto que o usuário lê quando a senha escolhida já vazou. */
export function mensagemSenhaVazada(ocorrencias: number): string {
  return (
    `Esta senha já apareceu em ${ocorrencias.toLocaleString("pt-BR")} vazamentos ` +
    "públicos de dados. Escolha outra — senhas conhecidas são as primeiras que " +
    "um invasor tenta."
  );
}

/**
 * Verifica e avisa. Devolve `true` quando o fluxo deve parar.
 *
 * A regra de falha aberta vive aqui, num lugar só, para os três pontos que
 * criam senha (cadastro de médico, de paciente e redefinição) não terem cada um
 * a sua interpretação: **só bloqueia quando a senha comprovadamente vazou.**
 * "Não consegui verificar" nunca vira "reprovado" — nem vira silêncio: o
 * usuário segue, e o texto publicado promete verificação, não garantia.
 */
export async function bloquearSeSenhaVazada(senha: string): Promise<boolean> {
  const r = await verificarSenhaVazada(senha);
  if (r.estado !== "vazada") return false;

  const { toast } = await import("sonner");
  toast.error("Senha exposta em vazamento público", {
    description: mensagemSenhaVazada(r.ocorrencias),
  });
  return true;
}
