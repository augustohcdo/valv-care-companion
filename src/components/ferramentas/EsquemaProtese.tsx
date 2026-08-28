/**
 * Desenho esquemático da prótese, por família construtiva.
 *
 * **Por que não a foto do fabricante.** As fotos de produto de Edwards,
 * Medtronic, Abbott, Corcym, Meril e Braile são obra protegida delas. Baixá-las
 * e servi-las do nosso domínio seria uso indevido — e num produto que fala com
 * médico, é o tipo de coisa que derruba uma parceria antes de começar.
 *
 * Então o catálogo mostra um desenho nosso, em vetor, que distingue as famílias
 * de relance (uma Perceval não se parece com uma Perimount nem com uma Sapien),
 * e **liga para a página oficial do produto**, onde a foto real está e onde ela
 * é lícita. A coluna `image_url` continua no banco e vazia: no dia em que houver
 * imagem licenciada, a tela usa a foto e o esquema some, sem trocar código.
 *
 * O esquema é ilustração de família construtiva, **não** a geometria do modelo.
 * Isso vai escrito na tela, porque um desenho que parecesse projeto técnico
 * seria a mesma família de defeito que esta rodada existe para fechar.
 */

export type FamiliaConstrutiva =
  | "bio_com_stent"
  | "bio_sem_stent"
  | "sutureless"
  | "conduto_valvado"
  | "mecanica_bivalvular"
  | "anel_rigido"
  | "anel_semirrigido"
  | "banda"
  | "tavi_balao"
  | "tavi_autoexpansivel";

export const NOME_DA_FAMILIA: Record<FamiliaConstrutiva, string> = {
  bio_com_stent: "Bioprótese com stent",
  bio_sem_stent: "Bioprótese sem stent",
  sutureless: "Sutureless / implante rápido",
  conduto_valvado: "Conduto valvado",
  mecanica_bivalvular: "Mecânica bivalvular",
  anel_rigido: "Anel rígido",
  anel_semirrigido: "Anel semirrígido",
  banda: "Banda de anuloplastia",
  tavi_balao: "TAVI balão-expansível",
  tavi_autoexpansivel: "TAVI autoexpansível",
};

/**
 * Modelos cuja construção **não** é a do seu tipo. A lista é explícita porque a
 * exceção é a informação: uma Freestyle não tem stent, uma Perceval não tem
 * sutura, e um desenho genérico apagaria justamente o que o médico procura.
 */
const EXCECOES: { teste: (fabricante: string, modelo: string) => boolean; familia: FamiliaConstrutiva }[] = [
  { teste: (f, m) => f === "Medtronic" && m === "Freestyle", familia: "bio_sem_stent" },
  { teste: (f, m) => f === "Corcym" && m === "Solo Smart", familia: "bio_sem_stent" },
  { teste: (f, m) => f === "Corcym" && m.startsWith("Perceval"), familia: "sutureless" },
  { teste: (f, m) => f === "Edwards" && m.startsWith("Intuity"), familia: "sutureless" },
  { teste: (f, m) => f === "Edwards" && m.startsWith("Konect"), familia: "conduto_valvado" },
];

/** As TAVI que expandem por balão. As demais do catálogo são autoexpansíveis. */
const TAVI_POR_BALAO = [
  { fabricante: "Edwards", prefixo: "Sapien" },
  { fabricante: "Meril", prefixo: "Myval" },
  { fabricante: "Braile", prefixo: "Inovare" },
];

export function familiaDe(tipo: string, fabricante: string, modelo: string): FamiliaConstrutiva {
  for (const e of EXCECOES) if (e.teste(fabricante, modelo)) return e.familia;

  switch (tipo) {
    case "mecanica":
      return "mecanica_bivalvular";
    case "tavi":
      return TAVI_POR_BALAO.some((t) => t.fabricante === fabricante && modelo.startsWith(t.prefixo))
        ? "tavi_balao"
        : "tavi_autoexpansivel";
    case "anel_anuloplastia":
      if (/banda|band\b/i.test(modelo)) return "banda";
      if (/rigid|mc3|contour/i.test(modelo)) return "anel_rigido";
      return "anel_semirrigido";
    default:
      return "bio_com_stent";
  }
}

/** Três cúspides em vista superior — comum às biológicas. */
const Cuspides = () => (
  <>
    <path d="M50 50 L50 14" />
    <path d="M50 50 L81 68" />
    <path d="M50 50 L19 68" />
    <path d="M50 22 A30 30 0 0 1 76 65" opacity="0.55" />
    <path d="M76 65 A30 30 0 0 1 24 65" opacity="0.55" />
    <path d="M24 65 A30 30 0 0 1 50 22" opacity="0.55" />
  </>
);

/** Malha de células do stent transcateter, em vista lateral. */
const Celulas = ({ y, altura, linhas }: { y: number; altura: number; linhas: number }) => (
  <>
    {Array.from({ length: linhas }, (_, i) => {
      const topo = y + (altura / linhas) * i;
      const base = topo + altura / linhas;
      return (
        <g key={i} opacity="0.7">
          <path d={`M24 ${topo} L37 ${base} L50 ${topo} L63 ${base} L76 ${topo}`} />
          <path d={`M24 ${base} L37 ${topo} L50 ${base} L63 ${topo} L76 ${base}`} />
        </g>
      );
    })}
  </>
);

const DESENHOS: Record<FamiliaConstrutiva, JSX.Element> = {
  bio_com_stent: (
    <>
      <circle cx="50" cy="50" r="38" />
      <circle cx="50" cy="50" r="30" opacity="0.5" />
      {/* Os três postes do stent, que é o que a diferencia da sem stent. */}
      <circle cx="50" cy="14" r="5" />
      <circle cx="81" cy="68" r="5" />
      <circle cx="19" cy="68" r="5" />
      <Cuspides />
    </>
  ),
  bio_sem_stent: (
    <>
      <circle cx="50" cy="50" r="36" strokeDasharray="1 0" />
      <Cuspides />
      {/* Sem postes e com parede aórtica preservada: contorno externo suave. */}
      <path d="M14 50 A36 36 0 0 1 86 50" opacity="0.35" />
    </>
  ),
  sutureless: (
    <>
      {/* Armação de nitinol que ancora sozinha — sem anel de sutura. */}
      <circle cx="50" cy="50" r="38" strokeDasharray="6 4" />
      <circle cx="50" cy="50" r="28" />
      <Cuspides />
    </>
  ),
  conduto_valvado: (
    <>
      {/* Vista lateral: prótese valvar já montada em tubo vascular. */}
      <path d="M28 88 L28 46 Q28 30 50 26 Q72 30 72 46 L72 88" />
      <path d="M28 62 L72 62" opacity="0.6" />
      <path d="M34 62 L50 46 L66 62" opacity="0.6" />
      <path d="M28 78 L72 78" opacity="0.35" />
      <path d="M28 70 L72 70" opacity="0.35" />
    </>
  ),
  mecanica_bivalvular: (
    <>
      <circle cx="50" cy="50" r="38" />
      <circle cx="50" cy="50" r="29" opacity="0.5" />
      {/* Dois folhetos retos, a assinatura visual da bivalvular. */}
      <path d="M32 24 L32 76" />
      <path d="M68 24 L68 76" />
      <path d="M32 24 A29 29 0 0 0 32 76" opacity="0.4" />
      <path d="M68 24 A29 29 0 0 1 68 76" opacity="0.4" />
    </>
  ),
  anel_rigido: (
    <>
      {/* Anel fechado em D, traço cheio e espesso. */}
      <path d="M18 44 Q50 12 82 44 Q82 76 50 84 Q18 76 18 44 Z" strokeWidth="7" />
    </>
  ),
  anel_semirrigido: (
    <>
      <path d="M18 44 Q50 12 82 44 Q82 76 50 84 Q18 76 18 44 Z" strokeWidth="5" />
      {/* O segmento flexível, que é o que o distingue do rígido. */}
      <path d="M22 62 Q50 88 78 62" strokeWidth="5" strokeDasharray="5 5" />
    </>
  ),
  banda: (
    <>
      {/* Aberta: cobre só a porção posterior do anel. */}
      <path d="M20 40 Q50 86 80 40" strokeWidth="7" strokeLinecap="round" />
      <circle cx="20" cy="40" r="3.5" />
      <circle cx="80" cy="40" r="3.5" />
    </>
  ),
  tavi_balao: (
    <>
      {/* Armação curta e cilíndrica. */}
      <path d="M24 30 L24 74" />
      <path d="M76 30 L76 74" />
      <path d="M24 30 L76 30" />
      <path d="M24 74 L76 74" />
      <Celulas y={30} altura={44} linhas={2} />
    </>
  ),
  tavi_autoexpansivel: (
    <>
      {/* Alta, com cintura — a silhueta que a distingue da balão-expansível. */}
      <path d="M22 16 L22 34 Q34 50 34 58 L34 84" />
      <path d="M78 16 L78 34 Q66 50 66 58 L66 84" />
      <path d="M22 16 L78 16" />
      <path d="M34 84 L66 84" />
      <Celulas y={18} altura={30} linhas={2} />
      <path d="M36 60 L50 72 L64 60" opacity="0.6" />
      <path d="M36 72 L50 60 L64 72" opacity="0.6" />
    </>
  ),
};

interface Props {
  tipo: string;
  fabricante: string;
  modelo: string;
  className?: string;
}

export function EsquemaProtese({ tipo, fabricante, modelo, className }: Props) {
  const familia = familiaDe(tipo, fabricante, modelo);
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`Esquema ilustrativo: ${NOME_DA_FAMILIA[familia]}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    >
      {DESENHOS[familia]}
    </svg>
  );
}
