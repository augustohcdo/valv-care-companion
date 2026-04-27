import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/auth/login", { replace: true });
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("user_id", user.id)
        .maybeSingle();
      navigate(profile?.account_type === "medico" ? "/app/medico" : "/app/paciente", { replace: true });
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
