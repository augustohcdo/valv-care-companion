import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

const schema = z.object({ email: z.string().trim().email().max(255) });

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) return toast.error("E-mail inválido");
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/redefinir`,
    });
    setSubmitting(false);
    if (error) return toast.error("Falha ao enviar", { description: error.message });
    setSent(true);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10 bg-gradient-to-b from-background to-secondary/40">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo />
          <h1 className="font-serif text-3xl text-primary">Recuperar senha</h1>
        </div>
        <Card className="shadow-md-soft border-border/70">
          <CardHeader>
            <CardTitle className="text-xl">Enviar link de redefinição</CardTitle>
            <CardDescription>
              Você receberá um e-mail com instruções para criar uma nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-3 text-center py-6">
                <div className="h-12 w-12 rounded-full bg-accent/10 grid place-items-center text-accent mx-auto">
                  <Mail className="h-6 w-6" />
                </div>
                <p className="text-sm">Se houver uma conta com esse e-mail, o link foi enviado.</p>
                <Button asChild variant="outline"><Link to="/auth/login">Voltar ao login</Link></Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail cadastrado</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" variant="hero" className="w-full h-11" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar link
                </Button>
                <Link to="/auth/login" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
