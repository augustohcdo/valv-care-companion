import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { superficieCorporal, imc as calcularImc } from "@/lib/bsa";
import { IMC_OBESIDADE } from "@/lib/mismatch";

/**
 * Altura e peso, uma vez só, valendo para as três ferramentas.
 *
 * ## O defeito que isto conserta
 *
 * Antes, altura e peso viviam **dentro** da calculadora de mismatch, e o
 * EuroSCORE tinha um `peso` próprio, para o clearance de creatinina. O médico
 * digitava o mesmo paciente duas vezes, e as duas telas podiam discordar sobre
 * ele: 72 kg numa aba, 78 kg na outra, dois números clínicos calculados sobre
 * pesos diferentes, sem nada na tela denunciando.
 *
 * Um paciente, um peso. A superfície corporal e o IMC saem daqui uma vez e
 * descem para quem precisar.
 *
 * ## Por que os derivados aparecem sempre
 *
 * A superfície corporal é o denominador da EOA indexada e o IMC decide qual
 * coluna da Tabela 12 vale. São os dois números que mudam o resultado sem
 * aparecer nele — deixá-los à vista é o que permite ao médico perceber que
 * digitou 17,0 em vez de 170.
 */

export interface Paciente {
  altura: string;
  peso: string;
}

export interface DerivadosDoPaciente {
  bsa: number | null;
  imc: number | null;
}

export function derivar(p: Paciente): DerivadosDoPaciente {
  const alt = Number(p.altura.replace(",", ".")) || 0;
  const pes = Number(p.peso.replace(",", ".")) || 0;
  return { bsa: superficieCorporal(alt, pes), imc: calcularImc(alt, pes) };
}

const duas = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BarraDoPaciente({
  paciente, aoMudar,
}: {
  paciente: Paciente;
  aoMudar: (p: Paciente) => void;
}) {
  const { bsa, imc } = useMemo(() => derivar(paciente), [paciente]);
  const faixaObeso = imc != null && imc >= IMC_OBESIDADE;

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-secondary/25 shadow-sm-soft">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 p-4">
        <div className="flex items-center gap-2 text-primary shrink-0">
          <span className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
            <User className="h-4 w-4" />
          </span>
          <span className="text-sm font-display font-semibold text-foreground">Paciente</span>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pac-altura" className="text-xs font-medium text-muted-foreground">
            Altura (cm)
          </Label>
          <Input
            id="pac-altura" inputMode="decimal" className="h-9 w-24 tabular-nums"
            value={paciente.altura}
            onChange={(e) => aoMudar({ ...paciente, altura: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="pac-peso" className="text-xs font-medium text-muted-foreground">
            Peso (kg)
          </Label>
          <Input
            id="pac-peso" inputMode="decimal" className="h-9 w-24 tabular-nums"
            value={paciente.peso}
            onChange={(e) => aoMudar({ ...paciente, peso: e.target.value })}
          />
        </div>

        {/* Os derivados, sempre à vista. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Derivado rotulo="Superfície corporal" valor={bsa != null ? `${duas(bsa)} m²` : null} />
          <Derivado
            rotulo="IMC"
            valor={imc != null ? `${duas(imc)} kg/m²` : null}
            nota={faixaObeso ? "coluna de IMC ≥ 30" : undefined}
          />
        </div>
      </div>

      <p className="px-4 pb-3 text-[11px] text-muted-foreground leading-relaxed">
        Vale para as três ferramentas. O EuroSCORE usa o peso no clearance de creatinina; o mismatch
        usa a superfície corporal para indexar a EOA e o IMC para escolher a coluna do limiar.{" "}
        <strong className="text-foreground">Nada disto sai do seu navegador.</strong>
      </p>
    </div>
  );
}

function Derivado({ rotulo, valor, nota }: { rotulo: string; valor: string | null; nota?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{rotulo}</span>
      {valor ? (
        <>
          <strong className="text-foreground tabular-nums">{valor}</strong>
          {nota && <span className="text-[10px] text-warning">({nota})</span>}
        </>
      ) : (
        <span className="text-muted-foreground/60">—</span>
      )}
    </span>
  );
}
