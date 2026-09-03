import { useState } from "react";
import { EsquemaProtese, familiaDe, NOME_DA_FAMILIA } from "./EsquemaProtese";

/**
 * A foto do fabricante, com o esquema construtivo como rede de segurança — e
 * com o rótulo, que é a parte que não pode ficar de fora.
 *
 * ## Por que existe
 *
 * O catálogo aponta para imagens hospedadas no site de cada fabricante. Elas
 * saem do ar sem aviso: nesta rodada, a Abbott aposentou as páginas da Portico e
 * da Trifecta e as fotos foram junto — as URLs viraram redirecionamento para a
 * home. Um `<img>` cru nessa situação mostra o ícone de imagem quebrada, que no
 * cartão de uma prótese é pior do que não mostrar nada: parece defeito da
 * ferramenta bem onde o médico está conferindo procedência.
 *
 * ## Por que o rótulo mora aqui dentro
 *
 * Porque separar os dois cria uma mentira silenciosa. Antes, a legenda dizia
 * "foto do fabricante" sempre que `image_url` existisse — inclusive quando a
 * imagem falhasse ao carregar e a tela caísse no esquema. O médico veria um
 * desenho de família construtiva legendado como fotografia do produto, e leria
 * geometria onde não há. Só o componente que sabe se a imagem carregou pode
 * escrever a legenda certa, então ele escreve as duas coisas.
 *
 * É também o que torna seguro gravar URLs que este ambiente não consegue
 * baixar: se estiverem vivas, o navegador do médico as carrega; se tiverem
 * morrido, ele cai no esquema, e a legenda acompanha.
 *
 * ## Foto não é a mesma coisa que desenho
 *
 * `imagemE` diz qual das duas é. Nem toda imagem oficial é fotografia: a
 * Medtronic e a Abbott publicam foto de estúdio, a Corcym publica renderização
 * 3D do produto. As duas são do fabricante e as duas servem — mas legendar as
 * duas como "foto do fabricante" diria ao médico que aquilo é o objeto
 * retratado, quando é o objeto desenhado, e desenho tem geometria escolhida por
 * quem desenhou.
 */
export function FotoDaProtese({
  imagem, imagemE, fabricante, modelo, tipo, tamanhoQuadro, tamanhoEsquema, semLegenda,
}: {
  imagem: string | null;
  /** `foto` ou `ilustracao`. Sem isto, a legenda diz "imagem do fabricante". */
  imagemE?: "foto" | "ilustracao" | null;
  fabricante: string;
  modelo: string;
  tipo: string;
  /** Classe do quadro externo. */
  tamanhoQuadro: string;
  /** Classe do SVG quando cai no esquema. */
  tamanhoEsquema: string;
  /** Nas listas apertadas o quadro vai sem legenda. */
  semLegenda?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const mostrandoFoto = Boolean(imagem) && !falhou;

  return (
    <div>
      <div className={tamanhoQuadro}>
        {mostrandoFoto ? (
          <img
            src={imagem!}
            alt={`${fabricante} ${modelo}`}
            className="w-full h-full object-contain p-1"
            loading="lazy"
            onError={() => setFalhou(true)}
          />
        ) : (
          <EsquemaProtese tipo={tipo} fabricante={fabricante} modelo={modelo} className={tamanhoEsquema} />
        )}
      </div>
      {!semLegenda && (
        <p className="mt-1.5 text-[10px] leading-tight text-center text-muted-foreground">
          {mostrandoFoto
            ? imagemE === "ilustracao"
              ? "ilustração do fabricante"
              : imagemE === "foto"
                ? "foto do fabricante"
                : "imagem do fabricante"
            // Sem foto, a legenda precisa dizer que o desenho NÃO é o produto.
            //
            // Antes ela mostrava só o nome da família construtiva, e o cartão
            // compensava com uma linha explicando por que faltava a foto. Essa
            // linha saiu — era registro do processo, não informação clínica —,
            // mas a ambiguidade que ela tapava é real: desenho rotulado com o
            // nome da família passa por geometria do modelo. Duas palavras
            // resolvem, e cabem no lugar do texto que saiu.
            : `esquema · ${NOME_DA_FAMILIA[familiaDe(tipo, fabricante, modelo)]}`}
        </p>
      )}
    </div>
  );
}
