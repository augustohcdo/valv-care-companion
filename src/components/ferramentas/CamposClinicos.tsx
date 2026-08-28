import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Campos de entrada com **três estados**, e não dois.
 *
 * O valor inicial é "sem resposta", nunca "não". É a regra que atravessa este
 * projeto inteiro — `riskScore.ts`, `guidelines.ts`, `euroscore2.ts` — e aqui
 * ela precisa começar na interface: um `Switch` desligado por padrão já é uma
 * resposta, e o médico não teria como distinguir o que ele respondeu do que ele
 * apenas não tocou. Toda calculadora de internet erra exatamente aqui, e o erro
 * é sempre na direção de fazer o paciente parecer mais saudável.
 */

const SEM_RESPOSTA = "__sem_resposta__";

interface SimNaoProps {
  id: string;
  rotulo: string;
  ajuda?: string;
  valor: boolean | null | undefined;
  aoMudar: (v: boolean | null) => void;
}

export function CampoSimNao({ id, rotulo, ajuda, valor, aoMudar }: SimNaoProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium leading-snug">{rotulo}</Label>
      {ajuda && <p className="text-xs text-muted-foreground leading-snug">{ajuda}</p>}
      <Select
        value={valor == null ? SEM_RESPOSTA : valor ? "sim" : "nao"}
        onValueChange={(v) => aoMudar(v === SEM_RESPOSTA ? null : v === "sim")}
      >
        <SelectTrigger id={id} className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_RESPOSTA}>— não informado —</SelectItem>
          <SelectItem value="nao">Não</SelectItem>
          <SelectItem value="sim">Sim</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

interface OpcoesProps<T extends string> {
  id: string;
  rotulo: string;
  ajuda?: string;
  valor: T | null | undefined;
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (v: T | null) => void;
}

export function CampoOpcoes<T extends string>({ id, rotulo, ajuda, valor, opcoes, aoMudar }: OpcoesProps<T>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium leading-snug">{rotulo}</Label>
      {ajuda && <p className="text-xs text-muted-foreground leading-snug">{ajuda}</p>}
      <Select
        value={valor ?? SEM_RESPOSTA}
        onValueChange={(v) => aoMudar(v === SEM_RESPOSTA ? null : (v as T))}
      >
        <SelectTrigger id={id} className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_RESPOSTA}>— não informado —</SelectItem>
          {opcoes.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
