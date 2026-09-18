import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/auditLog";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  metadata: any;
  created_at: string;
}

export const notificationsKey = (userId?: string) => ["notifications", userId] as const;

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data as Notification[]) ?? [];
}

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = notificationsKey(user?.id);

  const { data: items = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  // Realtime continua sendo a fonte de push; agora ele apenas invalida o
  // cache em vez de disparar um setState manual.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => queryClient.invalidateQueries({ queryKey: key }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // `key` é derivada de user.id, então user cobre as duas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, queryClient]);

  // Antes, estas três mutações escreviam no banco e não mexiam no estado
  // local — a tela só atualizava se/quando o realtime respondesse. Agora
  // cada uma invalida a query, então a UI reflete a ação mesmo se o
  // realtime estiver lento ou indisponível.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      // `.select` e a conferência das linhas: a RLS recusando devolve 200 com
      // `error: null` e ZERO linhas, e só o `if (error)` lê isso como sucesso —
      // o badge zerava na tela com as notificações ainda por ler no banco.
      //
      // Zero linhas aqui é ambíguo de propósito: pode ser recusa OU simplesmente
      // não haver nada por ler. Por isso este caso NÃO lança; o que ele impede é
      // a próxima linha afirmar o que não se sabe.
      const { data, error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .select("id");
      if (error) throw error;
      return { marcadas: data?.length ?? 0 };
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Aqui zero linhas NÃO é ambíguo: pediu-se para apagar UMA notificação por
      // id. Zero significa que ela não foi apagada — e sem isto o `logAudit`
      // abaixo gravava "notification_deleted" sobre o que continuava lá.
      const { data, error } = await supabase
        .from("notifications")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error("Nada foi alterado. Você pode não ter permissão sobre esta notificação.");
      }
      logAudit("notification_deleted", "notifications", id);
    },
    onSuccess: invalidate,
  });

  return {
    items,
    unread: items.filter((n) => !n.read).length,
    loading: isLoading,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    remove: (id: string) => removeMutation.mutate(id),
    reload: invalidate,
  };
};
