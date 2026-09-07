import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AccountType = "medico" | "paciente";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  account_type: AccountType;
  phone: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /**
   * `true` quando a leitura do perfil FALHOU — diferente de `profile: null`,
   * que quer dizer "não existe perfil para este usuário".
   *
   * A distinção não é acadêmica: com o perfil nulo por erro de rede, a interface
   * trata a pessoa como conta sem cadastro. Quem consome o contexto precisa
   * poder dizer "não consegui ler" em vez de agir como se não houvesse nada.
   */
  profileError: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      // O perfil anterior NÃO é descartado: se já havia um carregado, apagá-lo
      // por causa de uma releitura que falhou trocaria informação boa por
      // nenhuma. Marca-se a falha e mantém-se o que se tinha.
      console.error("falha ao ler o perfil", error);
      setProfileError(true);
      return;
    }
    setProfileError(false);
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    // 1) Listener primeiro
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer pra evitar deadlock
        setTimeout(() => loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    // 2) Sessão existente
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadProfile(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, profileError, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
