import { Bell, Check, CheckCheck, Trash2, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const NotificationsBell = () => {
  const { items, unread, markAsRead, markAllAsRead, remove } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            {unread > 0 && <Badge variant="secondary" className="text-[10px]">{unread} novas</Badge>}
          </div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllAsRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma notificação ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Wrapper: any = n.link ? Link : "div";
                const wrapperProps = n.link ? { to: n.link } : {};
                return (
                  <li
                    key={n.id}
                    className={`group p-3 hover:bg-secondary/60 transition-colors ${
                      !n.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <Wrapper
                      {...wrapperProps}
                      onClick={() => !n.read && markAsRead(n.id)}
                      className="block"
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground leading-tight">
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.created_at), {
                              locale: ptBR,
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    </Wrapper>
                    <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" /> Lida
                        </button>
                      )}
                      <button
                        onClick={() => remove(n.id)}
                        className="text-[10px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1 ml-2"
                      >
                        <Trash2 className="h-3 w-3" /> Remover
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
