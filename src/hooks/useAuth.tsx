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
  /**
   * Devolve `{ error }` como o SDK, em vez de `void`.
   *
   * Era `Promise<void>` sobre um `await supabase.auth.signOut()` com o
   * resultado descartado — e `signOut` devolve `{ error }` em vez de lançar.
   * Falhando, o `AppLayout` limpava o estado local e navegava para a home: a
   * pessoa lia que saiu com a sessão de pé no servidor. O `SecurityCenter` já
   * tinha aprendido isso no "sair de todos os dispositivos", com o comentário
   * escrito lá; o botão "Sair" comum ficou de fora.
   */
  signOut: () => Promise<{ error: { message: string } | null }>;
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
    supabase.auth.getSession().then(({ data: { session: existing }, error }) => {
      // "Não consegui ler a sessão" e "não há sessão" são estados diferentes, e
      // tratá-los igual manda para o login quem estava logado. O erro é raro
      // aqui (a sessão vem do armazenamento local), mas descartá-lo é a mesma
      // confusão que esta base já fechou nos hooks de registro clínico.
      if (error) console.error("falha ao ler a sessão", error);
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
    const { error } = await supabase.auth.signOut();
    // O estado local é limpo dos dois jeitos: manter a interface dizendo
    // "logado" sobre uma sessão que já pode ter caído no servidor não ajuda
    // ninguém. Quem decide o que dizer é quem chamou — com o erro na mão.
    setProfile(null);
    return { error: error ? { message: error.message } : null };
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
