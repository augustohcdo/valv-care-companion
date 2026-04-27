import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
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

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      return toast.error(parsed.error.errors[0]?.message || "Verifique os campos");
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) return toast.error("Falha ao atualizar", { description: error.message });
    toast.success("Senha atualizada");
    navigate("/auth/login", { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10 bg-gradient-to-b from-background to-secondary/40">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo />
          <h1 className="font-serif text-3xl text-primary">Nova senha</h1>
        </div>
        <Card className="shadow-md-soft border-border/70">
          <CardHeader>
            <CardTitle className="text-xl">Definir nova senha</CardTitle>
            <CardDescription>Escolha uma senha forte: 8+ caracteres, com maiúscula, minúscula e número.</CardDescription>
          </CardHeader>
          <CardContent>
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
        </Card>
      </div>
    </div>
  );
}
