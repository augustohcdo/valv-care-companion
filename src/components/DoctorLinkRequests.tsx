import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Pedidos de vínculo esperando o médico.
 *
 * Antes o paciente escrevia `linked_doctor_id` sozinho e o médico descobria
 * depois de já estar vinculado. Com o diretório aberto, isso deixaria qualquer
 * pessoa se pendurar em qualquer profissional — então a decisão passou a ser
 * dele, e a escrita da coluna saiu do cliente.
 */

export const pedidosVinculoKey = (doctorId?: string) => ["pedidos-vinculo", doctorId] as const;

export function DoctorLinkRequests({ doctorId }: { doctorId?: string }) {
  const queryClient = useQueryClient();
  const [emAcao, setEmAcao] = useState<string | null>(null);

  const { data: pedidos = [] } = useQuery({
    queryKey: pedidosVinculoKey(doctorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_link_requests")
        .select("id, patient_id, mensagem, created_at")
        .eq("doctor_id", doctorId!)
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!doctorId,
  });

  if (!doctorId || pedidos.length === 0) return null;

  const responder = async (id: string, aceitar: boolean) => {
    setEmAcao(id);
    const { error } = await supabase.rpc("responder_vinculo", {
      _request_id: id, _aceitar: aceitar,
    });
    setEmAcao(null);
    if (error) {
      toast.error("Não foi possível responder", { description: error.message });
      return;
    }
    toast.success(aceitar ? "Vínculo aceito" : "Pedido recusado");
    queryClient.invalidateQueries({ queryKey: pedidosVinculoKey(doctorId) });
    queryClient.invalidateQueries({ queryKey: ["doctor-patients"] });
  };

  return (
    <Card className="border-accent/40 bg-accent/5 shadow-sm-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-5 w-5 text-accent-foreground" />
          {pedidos.length} pedido(s) de vínculo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* O nome do paciente não aparece aqui de propósito: a policy de
            `profiles` não permite lê-lo, e inventar um rótulo seria pior que
            dizer o que se sabe. A mensagem do próprio paciente é o que
            identifica o pedido. */}
        <p className="text-xs text-muted-foreground">
          Aceitar cria o vínculo e dá a você acesso ao acompanhamento desse paciente.
        </p>
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-sm text-foreground/85 leading-relaxed">
                {p.mensagem || "Pedido sem mensagem."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Recebido em {new Date(p.created_at).toLocaleDateString("pt-BR")}
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={emAcao === p.id} onClick={() => responder(p.id, true)}>
                  {emAcao === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aceitar
                </Button>
                <Button size="sm" variant="outline" className="text-destructive"
                  disabled={emAcao === p.id} onClick={() => responder(p.id, false)}>
                  <X className="h-4 w-4" /> Recusar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
