import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A faixa que aparece quando uma leitura falhou — e a frase que impede a
 * conclusão errada.
 *
 * ## Por que isto é um componente, e não markup repetido
 *
 * A mensagem tem duas partes, e só a segunda é que faz o trabalho:
 *
 *   1. "não foi possível carregar" — todo mundo escreve;
 *   2. "isto NÃO significa que não haja X" — quase ninguém escreve.
 *
 * Sem a 2, a tela mostra a faixa de falha E o estado vazio logo abaixo, e o
 * olho lê a frase categórica ignorando o aviso. Foi exatamente o defeito que
 * esta base corrigiu à mão em algumas telas, com o texto duplicado em cada uma.
 *
 * Texto de segurança duplicado envelhece em versões diferentes: a próxima tela
 * copia a mais curta, que é sempre a que perdeu a parte 2. Aqui a parte 2 é
 * `naoSignifica`, e é OBRIGATÓRIA — o tipo não deixa escrever a faixa sem ela.
 *
 * ## Onde isto importa mais
 *
 * Na área do paciente. `usePatient()` devolve `null` quando a pessoa não tem
 * registro e LANÇA quando a leitura falha; as telas liam só o `data`, os dois
 * viravam `undefined`, e o paciente lia "Complete seu perfil para gerenciar
 * medicações" — com o perfil completo e a medicação dele escondida atrás da
 * frase.
 */
interface Props {
  /** O que não carregou, em minúscula e sem artigo: "suas medicações". */
  oQue: string;
  /**
   * A conclusão errada que a tela precisa negar, começando por verbo:
   * "não haja medicações registradas".
   *
   * Obrigatória de propósito. É a metade que o usuário precisa ler.
   */
  naoSignifica: string;
  /** Quem avisar. O paciente tem o médico; quem administra, não. */
  aQuemAvisar?: string;
}

export function FalhaDeLeitura({ oQue, naoSignifica, aQuemAvisar = "o suporte" }: Props) {
  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="py-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/85 leading-relaxed">
          <strong className="text-foreground">Não foi possível carregar {oQue} agora.</strong>{" "}
          Isto é uma falha de conexão — <strong>não significa que {naoSignifica}</strong>. Nada foi
          apagado. Recarregue a página; se continuar, avise {aQuemAvisar}.
        </p>
      </CardContent>
    </Card>
  );
}
