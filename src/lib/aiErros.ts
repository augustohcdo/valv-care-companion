import { AVISO_CONSENTIMENTO_IA } from "@/lib/consent";

/**
 * A tradução de uma falha da IA clínica para o que a pessoa lê — num lugar só.
 *
 * Nasceu de uma divergência medida: três telas chamam `clinical-ai`, e **só uma
 * tratava o 429**. O médico gerava alguns documentos, batia no limite de uso por
 * hora e recebia "não foi possível gerar o documento" — uma mensagem que não diz
 * o que aconteceu nem o que fazer, para uma situação que se resolve sozinha em
 * minutos. `CaseLaudoReader` tinha o mesmo buraco.
 *
 * Enquanto o mapeamento viver copiado em cada tela, ele volta a divergir — foi
 * o que aconteceu com os nomes de modo (ver `aiModes.ts`) e com a lista de
 * tabelas do backup. Aqui é um só, e `src/test/iaErros.test.ts` cobra que as
 * telas o usem em vez de reimplementar.
 */

export interface FalhaIA {
  titulo: string;
  descricao?: string;
  /** `true` quando a causa é o consentimento — a tela precisa trazer a parede de volta. */
  consentimento?: boolean;
  /** `true` quando basta esperar: não é defeito, e dizer isso evita chamado desnecessário. */
  temporario?: boolean;
}

/**
 * @param status  o HTTP devolvido pela function (de `error.context.status`)
 * @param fallback o que dizer quando o status não é conhecido — cada tela tem
 *                 o seu, porque "não foi possível gerar o documento" e "falha na
 *                 leitura do laudo" não são intercambiáveis.
 */
export function traduzirFalhaIA(status: number | undefined, fallback: string, detalhe?: string): FalhaIA {
  switch (status) {
    case 429:
      return {
        titulo: "Limite de uso da IA atingido",
        descricao: "São 30 chamadas por hora, por médico. Tente de novo em alguns minutos — nada foi perdido.",
        temporario: true,
      };
    case 402:
      return {
        titulo: "Créditos de IA esgotados",
        descricao: "A conta do provedor de IA precisa ser recarregada para as sugestões voltarem.",
      };
    case 403:
      return {
        titulo: AVISO_CONSENTIMENTO_IA.titulo,
        descricao: AVISO_CONSENTIMENTO_IA.descricao,
        consentimento: true,
      };
    case 422:
      return {
        titulo: "A IA não pôde processar este caso",
        descricao: "O modelo recusou a solicitação. Se repetir, o caso pode ter um dado que o bloqueia.",
      };
    case 504:
    case 503:
      return {
        titulo: "O provedor de IA está indisponível",
        descricao: "É do lado deles, e costuma ser passageiro. Tente de novo em instantes.",
        temporario: true,
      };
    default:
      return { titulo: fallback, descricao: detalhe };
  }
}
