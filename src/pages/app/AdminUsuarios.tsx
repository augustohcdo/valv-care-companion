import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Loader2, ShieldCheck, ShieldOff, BadgeCheck, BadgeX, Search, Mail,
} from "lucide-react";
import { toast } from "sonner";

type Conta = {
  user_id: string;
  email: string;
  full_name: string | null;
  account_type: string;
  papeis: string[];
  criado_em: string;
  ultimo_acesso: string | null;
  email_confirmado: boolean;
  doctor_id: string | null;
  crm: string | null;
  crm_uf: string | null;
  verificado: boolean;
  eh_paciente: boolean;
};

export const adminUsuariosKey = () => ["admin-usuarios"] as const;

const PAPEL_META: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  medico: "bg-accent/10 text-accent-foreground border-accent/30",
  paciente: "bg-secondary text-secondary-foreground border-border",
  hospital_admin: "bg-warning/10 text-warning border-warning/30",
};

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default function AdminUsuarios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [emAcao, setEmAcao] = useState<string | null>(null);

  const { data: contas = [], isLoading } = useQuery({
    queryKey: adminUsuariosKey(),
    queryFn: async (): Promise<Conta[]> => {
      const { data, error } = await supabase.rpc("admin_listar_usuarios");
      if (error) throw error;
      return (data as Conta[]) ?? [];
    },
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: adminUsuariosKey() });

  /**
   * As escritas passam por RPC `security definer`, não por `update` direto: as
   * regras (só admin, e ninguém remove o próprio papel) vivem no banco, onde
   * uma chamada pela API também esbarra nelas.
   *
   * O `error` é conferido sempre. Um RPC que levanta exceção devolve `error`
   * preenchido, e emendar direto no `toast.success` diria "papel concedido"
   * sobre uma operação recusada — o defeito que `src/lib/mutate.ts` existe para
   * impedir nas escritas de tabela.
   */
  const executar = async (
    chave: string,
    chamada: PromiseLike<{ error: { message: string } | null }>,
    mensagens: { sucesso: string; falha: string },
  ) => {
    setEmAcao(chave);
    const { error } = await chamada;
    setEmAcao(null);
    if (error) {
      toast.error(mensagens.falha, { description: error.message });
      return;
    }
    toast.success(mensagens.sucesso);
    recarregar();
  };

  const definirPapel = (conta: Conta, conceder: boolean) =>
    executar(
      `papel-${conta.user_id}`,
      supabase.rpc("admin_definir_papel", {
        _user_id: conta.user_id,
        _role: "admin",
        _conceder: conceder,
      }),
      {
        sucesso: conceder ? "Papel de administrador concedido" : "Papel de administrador removido",
        falha: conceder ? "Não foi possível conceder" : "Não foi possível remover",
      },
    );

  const verificar = (conta: Conta, verificado: boolean) =>
    executar(
      `crm-${conta.user_id}`,
      supabase.rpc("admin_verificar_medico", {
        _doctor_id: conta.doctor_id!,
        _verificado: verificado,
      }),
      {
        sucesso: verificado ? "CRM verificado" : "Verificação removida",
        falha: "Não foi possível atualizar a verificação",
      },
    );

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? contas.filter((c) =>
        [c.email, c.full_name, c.crm].some((v) => v?.toLowerCase().includes(termo)),
      )
    : contas;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Usuários e papéis
        </h1>
        <p className="text-muted-foreground">
          Contas da plataforma, permissão de administrador e verificação de CRM.
        </p>
      </header>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, e-mail ou CRM"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma conta encontrada.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtradas.map((c) => {
            const ehAdmin = c.papeis.includes("admin");
            const souEu = c.user_id === user?.id;
            return (
              <li key={c.user_id}>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {c.full_name || "Sem nome"}
                          {souEu && (
                            <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {c.email}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.papeis.map((p) => (
                          <Badge key={p} variant="outline" className={PAPEL_META[p] ?? ""}>
                            {p}
                          </Badge>
                        ))}
                        {!c.email_confirmado && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                            e-mail não confirmado
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Criada em {data(c.criado_em)}</span>
                      <span>Último acesso: {data(c.ultimo_acesso)}</span>
                      {c.crm && (
                        <span>
                          CRM {c.crm}/{c.crm_uf} —{" "}
                          {c.verificado ? "verificado" : "não verificado"}
                        </span>
                      )}
                      {c.eh_paciente && <span>Registro de paciente</span>}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {/* Remover o próprio papel trancaria a pessoa para fora, e
                          só SQL direto desfaz. O banco recusa de qualquer jeito;
                          o botão desabilitado só evita a viagem. */}
                      <Button
                        variant={ehAdmin ? "outline" : "default"}
                        size="sm"
                        disabled={(ehAdmin && souEu) || emAcao === `papel-${c.user_id}`}
                        onClick={() => definirPapel(c, !ehAdmin)}
                      >
                        {emAcao === `papel-${c.user_id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : ehAdmin ? (
                          <ShieldOff className="h-4 w-4 mr-1.5" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 mr-1.5" />
                        )}
                        {ehAdmin ? "Remover administrador" : "Tornar administrador"}
                      </Button>

                      {c.doctor_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={emAcao === `crm-${c.user_id}`}
                          onClick={() => verificar(c, !c.verificado)}
                        >
                          {emAcao === `crm-${c.user_id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          ) : c.verificado ? (
                            <BadgeX className="h-4 w-4 mr-1.5" />
                          ) : (
                            <BadgeCheck className="h-4 w-4 mr-1.5" />
                          )}
                          {c.verificado ? "Remover verificação" : "Verificar CRM"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Conceder ou remover papel e verificar CRM ficam registrados na trilha de auditoria,
        com quem fez e quando.
      </p>
    </div>
  );
}
