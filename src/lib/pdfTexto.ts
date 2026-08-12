/**
 * Extração do texto de um PDF **no navegador**, sem enviar o arquivo.
 *
 * O motivo é aritmético: o teto de upload do projeto é 50 MB e não pode ser
 * levantado no plano gratuito, mas um livro tem 300 MB por causa de imagens e
 * fontes embutidas — o texto dele são poucos megabytes. E é o texto que
 * interessa para extrair conduta, limiar e classe de recomendação. Então o
 * binário não sai da máquina de quem envia; sobe só o que vai ser lido.
 *
 * Duas decisões que sustentam o resto do sistema:
 *
 * 1. **Página a página, com o número preservado.** A citação da base precisa
 *    chegar à página; um blocão de texto sem paginação inviabilizaria conferir
 *    na fonte, que é o que distingue referenciar de reproduzir.
 *
 * 2. **Obra escaneada é detectada e recusada, não enviada vazia.** PDF sem
 *    camada de texto devolve string vazia em toda página. Deixar isso subir em
 *    silêncio produziria um arquivo que parece certo e não tem nada dentro —
 *    exatamente a classe de defeito que este projeto passou a sessão inteira
 *    eliminando.
 */

export interface PaginaExtraida {
  n: number;
  texto: string;
}

export interface ResultadoExtracao {
  paginas: PaginaExtraida[];
  /**
   * Não há texto **aproveitável**: ou a obra é digitalização de imagem (nenhum
   * caractere), ou a camada de texto existe e é ilegível.
   */
  semTextoLegivel: boolean;
  totalPaginas: number;
  caracteres: number;
  /** 0 a 1. Quanto do que veio parece linguagem de verdade. */
  legibilidade: number;
}

/** Itens de texto do pdf.js; só o campo `str` interessa aqui. */
interface ItemTexto {
  str?: string;
}

/**
 * Junta os pedaços de uma página num texto legível.
 *
 * O pdf.js devolve fragmentos posicionados, não linhas: emendar sem separador
 * grudaria palavras ("gradientemédio"), e emendar tudo com espaço quebraria
 * hifenização. O meio-termo aqui é separar por espaço e normalizar o excesso,
 * que é o suficiente para leitura e busca.
 */
export function juntarItens(itens: ItemTexto[]): string {
  return itens
    .map((i) => i.str ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quanto do texto parece linguagem, de 0 a 1.
 *
 * Contar caracteres não basta, e isto foi descoberto testando: um PDF cuja
 * camada de texto está quebrada — fonte embutida sem mapa ToUnicode, OCR
 * antigo, digitalização malfeita — devolve milhares de caracteres de lixo
 * (`\ufffd:8\ufffdB\ufffd\ufffd\ufffdt~`). Pela contagem, passaria; e subiria um arquivo com a
 * cara certa e nada legível dentro.
 *
 * Texto de livro em português fica acima de 0,9. Lixo fica muito abaixo.
 */
export function proporcaoLegivel(texto: string): number {
  if (!texto.length) return 0;
  const legiveis = texto.match(/[\p{L}\p{N}\s.,;:!?()[\]{}'"«»\-—–/%°ºª+=<>*&#@$]/gu);
  return (legiveis?.length ?? 0) / texto.length;
}

export function resumirExtracao(paginas: PaginaExtraida[]): ResultadoExtracao {
  const caracteres = paginas.reduce((soma, p) => soma + p.texto.length, 0);
  const tudo = paginas.map((p) => p.texto).join(" ");
  const legibilidade = proporcaoLegivel(tudo);
  return {
    paginas,
    totalPaginas: paginas.length,
    caracteres,
    legibilidade,
    // Dois modos de falha, mesma consequência prática para quem envia:
    // (a) nada de texto — digitalização de imagem pura. O limiar baixo evita
    //     chamar de escaneado um livro cuja primeira página é só a capa;
    // (b) texto ilegível — a camada existe e não decodifica.
    semTextoLegivel: caracteres < 200 || legibilidade < 0.85,
  };
}

/**
 * Lê o PDF e devolve o texto de cada página.
 *
 * `aoProgredir` recebe (página atual, total) para a tela mostrar andamento — em
 * obra de 900 páginas isso leva minutos, e barra parada faz qualquer um achar
 * que travou.
 */
export async function extrairTexto(
  arquivo: File,
  aoProgredir?: (pagina: number, total: number) => void,
): Promise<ResultadoExtracao> {
  // Carregado sob demanda: são ~1 MB de biblioteca que só esta tela usa, e não
  // faz sentido pesarem no primeiro carregamento de quem nunca vai abri-la.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;

  const buffer = await arquivo.arrayBuffer();
  // `getDocument` devolve a tarefa de carregamento, e é ela que sabe encerrar o
  // worker no fim — o documento em si só tem `cleanup()`. Sem guardar a tarefa,
  // o worker fica vivo depois da extração.
  const tarefa = pdfjs.getDocument({ data: buffer });
  const doc = await tarefa.promise;

  const paginas: PaginaExtraida[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    paginas.push({ n, texto: juntarItens(conteudo.items as ItemTexto[]) });
    // Libera a página assim que o texto sai: sem isto, obra grande acumula
    // tudo na memória e o navegador morre no meio.
    pagina.cleanup();
    aoProgredir?.(n, doc.numPages);
  }
  await tarefa.destroy();

  return resumirExtracao(paginas);
}
