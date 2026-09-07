import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolverHome } from "@/lib/homeDoUsuario";

export default function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/auth/login", { replace: true });
      // Este caminho é o do login com Google, e ele ignorava o papel de
      // administrador: quem entrasse por aqui caía na área clínica mesmo sendo
      // admin, enquanto o login por senha já desviava. Mesma regra para os dois.
      //
      // Se `resolverHome` não conseguir ler perfil ou permissões, ela recusa em
      // vez de adivinhar. Aqui não há tela para ficar — esta rota é só um
      // pátio de passagem —, então o destino é o login com o motivo à vista.
      try {
        navigate(await resolverHome(user.id), { replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível carregar sua conta.");
        navigate("/auth/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
