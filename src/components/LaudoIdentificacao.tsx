import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  camposDoLaudo,
  paraFormulario,
  type CampoIdentificado,
  type IdentificacaoDoLaudo,
} from "@/lib/laudoIdentificacao";

/**
 * O que o laudo diz sobre quem é o paciente — para o médico conferir antes de
 * entrar no prontuário.
 *
 * Nada aqui é aplicado sozinho, e a razão não é excesso de zelo: um laudo
 * imprime o nome do paciente e o do médico solicitante a duas linhas de
 * distância, e trocar os dois renomearia o prontuário inteiro. Então cada campo
 * aparece com o valor, de onde ele saiu, e — quando há motivo de desconfiança —
 * o motivo escrito e a caixa **desmarcada**.
 *
 * A regra de conflito é a mesma que o cartão de exame já usa: valor que o
 * médico digitou nunca é sobrescrito em silêncio. Ele aparece lado a lado com o
 * do laudo, desmarcado, e a troca é uma decisão explícita.
 */

const ROTULO_SEXO: Record<string, string> = { F: "Feminino", M: "Masculino" };

function mostrarAtual(key: CampoIdentificado["key"], valor: string): string {
  if (key === "patient_sex") return ROTULO_SEXO[valor] ?? valor;
  if (key === "patient_age") return `${valor} anos`;
  return valor;
}

export function LaudoIdentificacao({
  identificacao,
  nomeDoMedico,
  atual,
  onAplicar,
  onDispensar,
}: {
  identificacao: IdentificacaoDoLaudo;
  nomeDoMedico?: string | null;
  /** O que já está digitado no formulário, por campo. */
  atual: Record<string, string>;
  onAplicar: (valores: Record<string, string>) => void;
  onDispensar: () => void;
}) {
  const campos = camposDoLaudo(identificacao, { nomeDoMedico });
  const conflito = (c: CampoIdentificado) => {
    const agora = (atual[c.key] ?? "").trim();
    return agora && agora !== paraFormulario(c, identificacao) ? agora : null;
  };
  // Suspeito ou em conflito começa desmarcado; o resto, marcado. O conjunto
  // guarda só as inversões do médico, para o padrão continuar valendo para o
  // que ele não tocou.
  const ligadoPorPadrao = (c: CampoIdentificado) => !c.suspeita && !conflito(c);
  const [alternados, setAlternados] = useState<Set<string>>(new Set());
  const ligado = (c: CampoIdentificado) =>
    alternados.has(c.key) ? !ligadoPorPadrao(c) : ligadoPorPadrao(c);

  if (campos.length === 0) return null;

  const alternar = (key: string) =>
    setAlternados((s) => {
      const novo = new Set(s);
      if (novo.has(key)) novo.delete(key); else novo.add(key);
      return novo;
    });

  const marcados = campos.filter(ligado);

  return (
    <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <p className="text-xs font-semibold text-foreground mb-1">
        Identificação lida do laudo — confira antes de preencher
      </p>
      <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
        Transcrito do documento, não deduzido. O laudo também traz o nome do médico
        solicitante: confira se o nome abaixo é mesmo o do paciente.
      </p>

      <ul className="space-y-2">
        {campos.map((c) => {
          const jaTem = conflito(c);
          return (
            <li key={c.key} className="flex items-start gap-2">
              <Checkbox
                id={`ident-${c.key}`}
                checked={ligado(c)}
                onCheckedChange={() => alternar(c.key)}
                className="mt-0.5"
              />
              <label htmlFor={`ident-${c.key}`} className="min-w-0 text-xs leading-relaxed cursor-pointer">
                <span className="text-muted-foreground">{c.label}:</span>{" "}
                <span className="font-medium">{c.valor}</span>
                {c.derivacao && (
                  <span className="block text-[11px] text-muted-foreground">{c.derivacao}</span>
                )}
                {jaTem && (
                  <span className="block text-[11px] text-warning">
                    o formulário já tem {mostrarAtual(c.key, jaTem)} — marcar substitui
                  </span>
                )}
                {c.suspeita && (
                  <span className="flex items-start gap-1 text-[11px] text-warning">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    {c.suspeita}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 mt-3">
        <Button
          type="button" size="sm" className="h-7 px-2 text-[11px]"
          disabled={marcados.length === 0}
          onClick={() => {
            const valores: Record<string, string> = {};
            for (const c of marcados) valores[c.key] = paraFormulario(c, identificacao);
            onAplicar(valores);
          }}
        >
          <Check className="h-3.5 w-3.5" />
          Preencher {marcados.length} campo{marcados.length === 1 ? "" : "s"}
        </Button>
        <Button
          type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
          onClick={onDispensar}
        >
          <X className="h-3.5 w-3.5" />
          Dispensar
        </Button>
      </div>
    </div>
  );
}
