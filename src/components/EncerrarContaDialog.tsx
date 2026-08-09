import { useState } from "react";
import { Loader2, UserX } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * O encerramento é irreversível, e por isso a tela mostra a conta inteira do
 * que acontece **antes** de confirmar — não depois, num toast.
 *
 * A lista existe porque "eliminação" não significa a mesma coisa para todo
 * dado: o prontuário fica por obrigação legal (Lei 13.787/2018, Art. 6º, e
 * LGPD Art. 16, I) e a autoria do médico também (Resolução CFM nº 1.821/2007).
 * Prometer apagar tudo seria mentir; apagar tudo seria ilegal.
 */
const APAGADO = [
  "Nome, telefone e data de nascimento do cadastro",
  "Cidade e estado do perfil",
  "Acesso à conta: o login deixa de funcionar e as sessões abertas caem",
  "Filtros salvos, notificações e autorizações de compartilhamento com hospitais",
  "O nome deixa de aparecer no prontuário, substituído por um código",
];

const MANTIDO = [
  "O prontuário em si — a lei obriga a guardá-lo por 20 anos",
  "CRM e UF, quando a conta é de médico: é a assinatura do registro clínico",
  "A trilha de auditoria e de consentimentos, como prova do que aconteceu",
  "A correspondência entre o código e o nome, em base restrita, acessível só pelo DPO",
];

interface Props {
  /** Quem será encerrado. Ausente = a conta de quem está usando a tela. */
  userId?: string;
  /**
   * Quando o próprio titular encerra, exigimos que ele digite o e-mail. Um
   * clique só é fácil demais para uma ação que não se desfaz.
   */
  confirmarComEmail?: string;
  rotulo?: string;
  onEncerrada?: (relatorio: unknown) => void;
}

export function EncerrarContaDialog({
  userId,
  confirmarComEmail,
  rotulo = "Encerrar conta",
  onEncerrada,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [enviando, setEnviando] = useState(false);

  const podeConfirmar =
    !confirmarComEmail || digitado.trim().toLowerCase() === confirmarComEmail.toLowerCase();

  const encerrar = async () => {
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("account-close", {
      body: userId ? { user_id: userId } : {},
    });
    setEnviando(false);

    // A função devolve `{ error }` no corpo em recusas de regra (única conta de
    // administrador, por exemplo) — sem olhar isso, uma recusa viraria sucesso.
    if (error || (data && (data as { error?: string }).error)) {
      const detalhe = (data as { detail?: string; error?: string } | null)?.detail
        ?? (data as { error?: string } | null)?.error
        ?? error?.message;
      toast.error("Não foi possível encerrar a conta", { description: detalhe });
      return;
    }

    setAberto(false);
    toast.success("Conta encerrada");
    onEncerrada?.((data as { relatorio?: unknown } | null)?.relatorio);
  };

  return (
    <AlertDialog open={aberto} onOpenChange={setAberto}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <UserX className="h-4 w-4" /> {rotulo}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar a conta é definitivo</AlertDialogTitle>
          <AlertDialogDescription>
            Nada disto pode ser desfeito depois. Leia o que sai e o que fica.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 text-[13px] leading-relaxed">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="font-medium mb-1.5">O que é apagado</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              {APAGADO.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="font-medium mb-1.5">O que é mantido, e por quê</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              {MANTIDO.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </div>

        {confirmarComEmail && (
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-email" className="text-xs">
              Para confirmar, digite <strong className="break-all">{confirmarComEmail}</strong>
            </Label>
            <Input
              id="confirmar-email"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // O AlertDialogAction fecha o diálogo por padrão; aqui ele só pode
              // fechar quando a chamada der certo, senão o erro aparece com a
              // tela já fechada e ninguém entende o que houve.
              e.preventDefault();
              void encerrar();
            }}
            disabled={!podeConfirmar || enviando}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Encerrar definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
