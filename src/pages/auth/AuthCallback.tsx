import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
      navigate(await resolverHome(user.id), { replace: true });
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
