import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { bloquearSeSenhaVazada } from "@/lib/hibp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

const schema = z
  .object({
    password: z
      .string()
      .min(8)
      .max(72)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Senhas não conferem", path: ["confirm"] });

/**
 * Quanto esperar pelo evento de recuperação antes de desistir.
 *
 * `detectSessionInUrl` processa o fragmento da URL de forma assíncrona na
 * inicialização do cliente, então o evento chega **depois** da montagem desta
 * tela. Sem essa espera, um link legítimo cairia direto em "sem-link".
 */
const ESPERA_MS = 2000;

type Estado = "verificando" | "recuperacao" | "sem-link";

/** O que o Supabase devolve no fragmento quando o link não vale mais. */
function erroDoFragmento(hash: string): string | null {
  if (!hash || !hash.includes("error")) return null;
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const codigo = p.get("error_code");
  if (codigo === "otp_expired") return "Este link expirou ou já foi usado.";
  const erro = p.get("error_description") || p.get("error");
  return erro ? decodeURIComponent(erro.replace(/\+/g, " ")) : null;
}

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [estado, setEstado] = useState<Estado>("verificando");
  /** De quem é a senha que vai mudar. Fica visível acima dos campos. */
  const [conta, setConta] = useState<string | null>(null);
  /** Quem está logado quando o link **não** vale — só para explicar a recusa. */
  const [sessaoAtual, setSessaoAtual] = useState<string | null>(null);
  // Melhor esforço: se o GoTrue já limpou a URL, o caminho de "sem-link" cobre
  // o mesmo caso, só com um texto menos específico.
  const [erroLink] = useState(() =>
    typeof window === "undefined" ? null : erroDoFragmento(window.location.hash),
  );

  /**
   * O porteiro.
   *
   * Antes, esta tela chamava `updateUser({ password })` direto, sem perguntar de
   * onde vinha a sessão — e o `supabase-js` usa a que estiver no `localStorage`.
   * Resultado real, em produção: o link de recuperação do admin foi consumido no
   * servidor enquanto a rota devolvia 404, e quando a tela finalmente abriu não
   * havia sessão de recuperação nenhuma. A troca caiu na sessão de médico que o
   * navegador ainda guardava — outra conta, outro dono —, e a tela respondeu
   * "Senha atualizada".
   *
   * `PASSWORD_RECOVERY` só é emitido quando a URL trouxe `type=recovery`. É ele,
   * e só ele, que libera o formulário.
   */
  useEffect(() => {
    let vivo = true;

    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!vivo || evento !== "PASSWORD_RECOVERY") return;
      setConta(sessao?.user?.email ?? null);
      setEstado("recuperacao");
    });

    const prazo = setTimeout(async () => {
      if (!vivo) return;
      setEstado((atual) => (atual === "recuperacao" ? atual : "sem-link"));
      // Só para nomear a recusa: "você está conectado como X, e esta página não
      // vai mexer nessa conta" é muito mais útil que um erro genérico.
      const { data: sessao } = await supabase.auth.getSession();
      if (vivo) setSessaoAtual(sessao.session?.user?.email ?? null);
    }, ESPERA_MS);

    return () => {
      vivo = false;
      clearTimeout(prazo);
      data.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Cinto e suspensório: o formulário nem é renderizado fora do estado de
    // recuperação, mas esta é a linha que impede a escrita de fato.
    if (estado !== "recuperacao") return;

    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Verifique os campos");
      return;
    }
    setSubmitting(true);

    // Redefinir senha é o outro ponto em que uma senha nasce — não adiantaria
    // barrar senha vazada só no cadastro.
    if (await bloquearSeSenhaVazada(password)) {
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      toast.error("Falha ao atualizar", { description: error.message });
      return;
    }
    // A sessão de recuperação não pode ficar viva na aba depois da troca: ela
    // dá acesso à conta sem que ninguém tenha digitado a senha nova.
    await supabase.auth.signOut();
    setSubmitting(false);
    toast.success("Senha atualizada");
    navigate("/auth/login", { replace: true });
  };

  const moldura = (conteudo: React.ReactNode) => (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10 bg-gradient-to-b from-background to-secondary/40">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo />
          <h1 className="font-serif text-3xl text-primary">Nova senha</h1>
        </div>
        {conteudo}
      </div>
    </div>
  );

  if (estado === "verificando") {
    return moldura(
      <Card className="shadow-md-soft border-border/70">
        <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verificando o link...
        </CardContent>
      </Card>,
    );
  }

  if (estado === "sem-link") {
    return moldura(
      <Card className="shadow-md-soft border-border/70">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" /> Link não validado
          </CardTitle>
          <CardDescription>
            {erroLink ??
              "Esta página só abre a partir de um link de recuperação válido, vindo do seu e-mail."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessaoAtual && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-[13px] leading-relaxed">
              Você está conectado como <strong>{sessaoAtual}</strong>. Esta página{" "}
              <strong>não</strong> vai alterar a senha dessa conta. Para trocar a senha de quem
              está conectado, use{" "}
              <Link to="/app/privacidade" className="text-primary hover:underline">
                Segurança e privacidade
              </Link>
              .
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Cada link vale uma vez só e expira em 1 hora. Peça um novo e abra-o no mesmo
            navegador.
          </p>
          <Button asChild variant="hero" className="w-full h-11">
            <Link to="/auth/recuperar">Pedir um link novo</Link>
          </Button>
        </CardContent>
      </Card>,
    );
  }

  return moldura(
    <Card className="shadow-md-soft border-border/70">
      <CardHeader>
        <CardTitle className="text-xl">Definir nova senha</CardTitle>
        <CardDescription>Escolha uma senha forte: 8+ caracteres, com maiúscula, minúscula e número.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Dizer de quem é a conta é a proteção mais barata que existe contra
            trocar a senha errada — e a que teria evitado o incidente. */}
        {conta && (
          <p className="mb-4 text-sm p-3 rounded-lg bg-secondary/60 border border-border">
            Alterando a senha de <strong className="break-all">{conta}</strong>
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" variant="hero" className="w-full h-11" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Atualizar senha
          </Button>
        </form>
      </CardContent>
    </Card>,
  );
}
