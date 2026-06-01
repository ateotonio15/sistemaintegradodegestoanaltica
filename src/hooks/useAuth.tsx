import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionNamespace } from "@/hooks/useSessionState";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "comum" | "executivo" | "visualizacao" | "diretora" | "enfermeira" | "financeiro" | "vendas" | "administradoras" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  isExecutivo: boolean;
  isViewOnly: boolean;
  isEnfermeira: boolean;
  isFinanceiro: boolean;
  isComum: boolean;
  isVendas: boolean;
  isDiretora: boolean;
  isAdministradoras: boolean;
  canEditFinanceiro: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isAdmin: false,
  isExecutivo: false,
  isViewOnly: false,
  isEnfermeira: false,
  isFinanceiro: false,
  isComum: false,
  isVendas: false,
  isDiretora: false,
  isAdministradoras: false,
  canEditFinanceiro: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);
  const roleRef = useRef<UserRole>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const roleRequestRef = useRef(0);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const fetchRole = useCallback(async (userId: string) => {
    const requestId = ++roleRequestRef.current;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    // Se um pedido mais recente sobrescreveu este, abandone sem mexer em role/loading
    // (o pedido mais novo é quem vai finalizar o loading).
    if (requestId !== roleRequestRef.current) return;
    setRole((data?.role as UserRole) ?? "comum");
    setLoading(false);
  }, []);

  useEffect(() => {
    const applySession = async (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      setSession(nextSession);
      setUser(nextUser);

      if (!nextUserId) {
        lastUserIdRef.current = null;
        roleRequestRef.current += 1;
        setRole(null);
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED/SIGNED_IN ao voltar foco não deve derrubar o layout para "Carregando".
      if (lastUserIdRef.current === nextUserId && roleRef.current) {
        setLoading(false);
        return;
      }

      lastUserIdRef.current = nextUserId;
      if (!roleRef.current) setLoading(true);
      // Importante: não usar .finally(setLoading(false)) aqui — fetchRole só
      // libera o loading quando ele próprio é o pedido vencedor, evitando que
      // um pedido abortado deixe loading=false com role=null (o que faria as
      // rotas com `allow` redirecionarem indevidamente para /).
      void fetchRole(nextUserId);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
    });

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, role,
      isAdmin: role === "admin",
      isExecutivo: role === "executivo",
      isViewOnly: role === "visualizacao" || role === "diretora",
      isEnfermeira: role === "enfermeira",
      isFinanceiro: role === "financeiro",
      isComum: role === "comum" || role === "administradoras",
      isVendas: role === "vendas",
      isDiretora: role === "diretora",
      isAdministradoras: role === "administradoras",
      canEditFinanceiro: role === "admin" || role === "financeiro",
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
