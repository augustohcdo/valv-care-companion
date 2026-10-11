/**
 * O veredito do consentimento de IA — do lado do servidor.
 *
 * ## O defeito que isto conserta
 *
 * `clinical-ai` lia a linha de `user_consents` assim:
 *
 *     .select("granted, revoked_at")
 *
 * e decidia com `!consentimento || granted !== true || revoked_at`. A coluna
 * `document_version` existe na tabela desde a primeira migration, é gravada em
 * todo registro e **não era lida por ninguém**.
 *
 * O catálogo do cliente tem a regra escrita, e o teste dela também:
 *
 *   > "quando o texto de um consentimento muda de significado ele precisa andar
 *   >  por conta: subir a global re-versionaria Termos e Política que não
 *   >  mudaram, e o registro diria que a pessoa aceitou uma revisão que nunca
 *   >  existiu."
 *
 * A versão própria do `ai_processing` foi criada **para o registro não afirmar
 * um aceite que não houve** — e o portão que age sobre o consentimento ignorava
 * a versão. O registro ficou honesto; a decisão, não.
 *
 * ## Por que importa neste consentimento em particular
 *
 * O texto do `ai_processing` mudou de sentido. Ele dizia que os dados iam ao
 * Google "— sem meu nome", e isso era **falso** para um dos dois caminhos:
 * quando o médico anexa o laudo para leitura automática, o arquivo vai inteiro,
 * com nome, data de nascimento e número de registro impressos nele. O texto
 * novo (2.3) diz as duas coisas separadas.
 *
 * Quem aceitou o texto antigo concordou com um envio que não é o que acontece.
 * Tratar aquele aceite como consentimento vigente é o controlador afirmando um
 * consentimento que não tem — e a LGPD, art. 8º §2º, põe o ônus de provar o
 * consentimento sobre ele.
 *
 * ## O que foi descartado, e por quê
 *
 * Dava para exigir a revalidação só no caminho do arquivo — é dele que o texto
 * mudou; os outros modos mandam só os campos minimizados, que o texto antigo já
 * descrevia certo. Ficaria mais proporcional e ficaria errado de forma mais
 * difícil de ver: `ai_processing` é **um** consentimento, com **um** texto. Um
 * portão que vale por modo faz o registro deixar de corresponder a uma decisão,
 * e aí não há como dizer a que a pessoa consentiu.
 */

/** O estado do consentimento. `ok` é o único que libera. */
export type EstadoDoConsentimento =
  /** Concedido, não revogado, e na versão vigente do texto. */
  | "ok"
  /** Nenhuma linha: a pessoa nunca decidiu. */
  | "ausente"
  /** Houve consentimento e foi retirado (LGPD art. 8º §5º). */
  | "revogado"
  /**
   * Concedido contra um texto que não é o vigente.
   *
   * Cobre também a versão ilegível: se não dá para estabelecer que o aceite
   * cobre o texto de hoje, não dá para afirmar o consentimento.
   */
  | "versao_antiga"
  /**
   * A leitura falhou. **Não é ausência de consentimento.**
   *
   * A distinção já estava feita no servidor, com o motivo escrito: "sem
   * observar o erro, quem consentiu era informado de que não consentiu, e o
   * médico ia procurar na tela de privacidade do paciente uma revogação que
   * nunca houve."
   */
  | "nao_conferido";

export interface LinhaDeConsentimento {
  granted: boolean | null;
  revoked_at: string | null;
  document_version: string | null;
}

/**
 * `aceita` cobre `vigente`?
 *
 * Comparação NUMÉRICA, campo a campo, e não de texto: `"2.10"` é posterior a
 * `"2.9"` e menor em ordem alfabética. E a pergunta é "cobre", não "é igual":
 * com `!==`, um frontend publicado antes das functions registraria `2.4`, a
 * função ainda esperaria `2.3`, e quem consentiu com o texto MAIS completo
 * seria recusado. Falso vermelho num portão de conformidade é o jeito mais
 * rápido de alguém desligar o portão.
 *
 * Versão vazia, nula ou que não seja número devolve `false`: não é posterior,
 * não é igual, e não dá para afirmar que cobre.
 */
export function versaoCobre(aceita: string | null | undefined, vigente: string): boolean {
  const partes = (v: string) => v.trim().split(".").map((p) => Number(p));
  if (typeof aceita !== "string" || !aceita.trim()) return false;
  const a = partes(aceita);
  const b = partes(vigente);
  if (a.some((n) => !Number.isFinite(n)) || b.some((n) => !Number.isFinite(n))) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/**
 * O estado, a partir do que foi lido. Puro, e é o ponto: o caminho de verdade
 * passa por PostgREST, RLS e uma sessão autenticada — nada disso se exercita
 * num teste. A decisão, sim.
 */
export function estadoDoConsentimento(args: {
  linha: LinhaDeConsentimento | null | undefined;
  erro?: unknown;
  versaoVigente: string;
}): { estado: EstadoDoConsentimento; versaoAceita: string | null } {
  const { linha, erro, versaoVigente } = args;
  // A ordem é a dos fatos. "Não consegui ler" vem primeiro porque, sem ele, uma
  // falha de leitura cai em "ausente" — e aí o sistema informa que a pessoa não
  // consentiu, o que é uma afirmação sobre a decisão dela.
  if (erro) return { estado: "nao_conferido", versaoAceita: null };
  if (!linha) return { estado: "ausente", versaoAceita: null };
  const versaoAceita = linha.document_version ?? null;
  if (linha.revoked_at) return { estado: "revogado", versaoAceita };
  if (linha.granted !== true) return { estado: "ausente", versaoAceita };
  if (!versaoCobre(versaoAceita, versaoVigente)) {
    return { estado: "versao_antiga", versaoAceita };
  }
  return { estado: "ok", versaoAceita };
}

/**
 * Versão vigente do texto do consentimento de IA.
 *
 * Segunda cópia de um valor que mora em `src/lib/consent.ts`, e isso é
 * estrutural: as duas bases não compilam juntas, como os nomes de modo da IA.
 * Quem impede a divergência é `src/test/consentimentoIA.test.ts`, que lê as
 * duas e roda **a mesma tabela de casos contra as duas implementações**.
 */
export const VERSAO_CONSENTIMENTO_IA = "2.3";
