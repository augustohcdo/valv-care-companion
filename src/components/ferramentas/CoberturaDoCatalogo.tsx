import { useCatalogoProteses } from "@/hooks/useCatalogoProteses";

/**
 * Os números do catálogo, contados ao vivo.
 *
 * Ficam na página porque a cobertura é parcial e isso é informação clínica, não
 * constrangimento: um médico que vê "74 de 246 tamanhos com EOA de referência
 * publicada" sabe de saída que pode não achar o modelo dele — e não conclui, de
 * um campo vazio, que aquela prótese não tem mismatch.
 *
 * São contados do dado que a página acabou de receber, nunca escritos à mão:
 * número cravado no código envelhece longe do que descreve, que é o defeito que
 * este projeto passou a sessão inteira desmontando.
 */
export function CoberturaDoCatalogo() {
  const { data, isLoading } = useCatalogoProteses();

  // Nada é afirmado antes de o catálogo chegar.
  if (isLoading || !data || data.length === 0) return null;

  const modelos = new Set(data.map((p) => `${p.manufacturer}|${p.model_name}|${p.valve_position}`));
  const fabricantes = new Set(data.map((p) => p.manufacturer));
  const comEoa = data.filter((p) => p.effective_orifice_area != null).length;
  const comFoto = new Set(
    data.filter((p) => p.image_url).map((p) => `${p.manufacturer}|${p.model_name}`),
  );

  const itens: [string, string, string][] = [
    [String(data.length), "tamanhos", `${modelos.size} modelos de ${fabricantes.size} fabricantes`],
    [String(comEoa), "com EOA de referência", "cada um com a publicação de origem"],
    [String(comFoto.size), "modelos com foto oficial", "colhida na página do fabricante"],
  ];

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl overflow-hidden bg-border ring-1 ring-border">
      {itens.map(([valor, rotulo, detalhe]) => (
        <div key={rotulo} className="bg-card p-4">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {rotulo}
          </dt>
          <dd className="font-serif text-3xl text-primary tabular-nums mt-0.5">{valor}</dd>
          <dd className="text-xs text-muted-foreground mt-0.5">{detalhe}</dd>
        </div>
      ))}
    </dl>
  );
}
