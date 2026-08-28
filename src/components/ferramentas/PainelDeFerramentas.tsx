import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalculadoraEuroscore, type PreenchimentoInicial } from "./CalculadoraEuroscore";
import { CalculadoraMismatch, type PreenchimentoMismatch } from "./CalculadoraMismatch";
import { CatalogoProteses } from "./CatalogoProteses";

/**
 * As três ferramentas, montadas do mesmo jeito na página pública e dentro da
 * conta.
 *
 * `base` é a única diferença entre os dois lugares: `/ferramentas` para quem
 * chega sem cadastro, `/app/medico/ferramentas` para quem tem conta. Duas
 * cópias da mesma tela divergiriam na primeira correção — é a lição que este
 * projeto já pagou três vezes (nomes de modo da IA, lista de tabelas do backup,
 * texto do consentimento em duas redações).
 *
 * A aba fica no caminho, e não só no estado do componente, para que o médico
 * possa mandar `/ferramentas/mismatch` para um colega.
 */

export const ABAS = [
  { chave: "euroscore-ii", rotulo: "EuroSCORE II" },
  { chave: "mismatch", rotulo: "Gradiente e mismatch" },
  { chave: "proteses", rotulo: "Catálogo de próteses" },
] as const;

export type AbaDeFerramenta = (typeof ABAS)[number]["chave"];

export const PADRAO: AbaDeFerramenta = "euroscore-ii";

export function abaDoCaminho(pathname: string, base: string): AbaDeFerramenta {
  const resto = pathname.slice(base.length).replace(/^\//, "");
  return ABAS.some((a) => a.chave === resto) ? (resto as AbaDeFerramenta) : PADRAO;
}

interface Props {
  base: string;
  euroscore?: PreenchimentoInicial;
  mismatch?: PreenchimentoMismatch;
}

export function PainelDeFerramentas({ base, euroscore, mismatch }: Props) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const aba = abaDoCaminho(pathname, base);

  return (
    <Tabs
      value={aba}
      onValueChange={(v) => navigate(`${base}/${v}${search}`, { replace: true })}
    >
      <TabsList className="mb-6 flex-wrap h-auto">
        {ABAS.map((a) => (
          <TabsTrigger key={a.chave} value={a.chave}>{a.rotulo}</TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="euroscore-ii"><CalculadoraEuroscore inicial={euroscore} /></TabsContent>
      <TabsContent value="mismatch"><CalculadoraMismatch inicial={mismatch} /></TabsContent>
      <TabsContent value="proteses"><CatalogoProteses /></TabsContent>
    </Tabs>
  );
}
