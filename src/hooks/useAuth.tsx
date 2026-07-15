import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionNamespace } from "@/hooks/useSessionState";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "comum" | "executivo" | "executivo_externo" | "visualizacao" | "diretora" | "enfermeira" | "financeiro" | "vendas" | "administradoras" | "admin_interno" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  isAdmin: boolean;
  isExecutivo: boolean;
  isExecutivoExterno: boolean;
  isViewOnly: boolean;
  isEnfermeira: boolean;
  isFinanceiro: boolean;
  isComum: boolean;
  isVendas: boolean;
  isDiretora: boolean;
  isAdministradoras: boolean;
  isAdminInterno: boolean;
  isAdminEmpresa: boolean;
  empresaVinculadaId: string | null;
  mustChangePassword: boolean;
  canEditFinanceiro: boolean;
  signOut: () => Promise<void>;
  refreshAuthFlags: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isAdmin: false,
  isExecutivo: false,
  isExecutivoExterno: false,
  isViewOnly: false,
  isEnfermeira: false,
  isFinanceiro: false,
  isComum: false,
  isVendas: false,
  isDiretora: false,
  isAdministradoras: false,
  isAdminInterno: false,
  isAdminEmpresa: false,
  empresaVinculadaId: null,
  mustChangePassword: false,
  canEditFinanceiro: false,
  signOut: async () => {},
  refreshAuthFlags: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);
  const [isAdminInterno, setIsAdminInterno] = useState(false);
  const [isAdminEmpresa, setIsAdminEmpresa] = useState(false);
  const [empresaVinculadaId, setEmpresaVinculadaId] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const roleRef = useRef<UserRole>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const roleRequestRef = useRef(0);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const loadFlags = useCallback(async (userId: string) => {
    const requestId = ++roleRequestRef.current;
    const [rolesRes, profileRes, empresaRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("must_change_password").eq("user_id", userId).maybeSingle(),
      supabase.from("empresa_usuarios").select("empresa_id, papel").eq("user_id", userId).limit(1).maybeSingle(),
    ]);
    if (requestId !== roleRequestRef.current) return;

    const roles = (rolesRes.data ?? []).map((r: any) => r.role as string);
    const primaryRole = (roles.find((r) => r !== "admin_interno") ?? roles[0] ?? "comum") as UserRole;
    const papel = ((empresaRes.data as any)?.papel ?? null) as string | null;
    setRole(primaryRole);
    setIsAdminInterno(roles.includes("admin_interno"));
    // Usuário do portal da empresa: apenas quando o papel for admin_empresa.
    // "colaborador" também é usado para vincular usuários internos (Cadastro/Executivo)
    // a empresas, então não deve forçar o redirecionamento para o portal.
    setIsAdminEmpresa(papel === "admin_empresa");
    setEmpresaVinculadaId(((empresaRes.data as any)?.empresa_id as string) ?? null);
    setMustChangePassword(Boolean((profileRes.data as any)?.must_change_password));
    setLoading(false);
  }, []);

  const refreshAuthFlags = useCallback(async () => {
    if (user?.id) await loadFlags(user.id);
  }, [user?.id, loadFlags]);

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
        setIsAdminInterno(false);
        setIsAdminEmpresa(false);
        setEmpresaVinculadaId(null);
        setMustChangePassword(false);
        setLoading(false);
        return;
      }

      if (lastUserIdRef.current === nextUserId && roleRef.current) {
        setLoading(false);
        return;
      }

      lastUserIdRef.current = nextUserId;
      if (!roleRef.current) setLoading(true);
      void loadFlags(nextUserId);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearSessionNamespace("financeiro");
      }
      setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
    });

    return () => subscription.unsubscribe();
  }, [loadFlags]);

  const signOut = async () => {
    clearSessionNamespace("financeiro");
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, role,
      isAdmin: role === "admin",
      isExecutivo: role === "executivo",
      isExecutivoExterno: role === "executivo_externo",
      isViewOnly: role === "visualizacao" || role === "diretora",
      isEnfermeira: role === "enfermeira",
      isFinanceiro: role === "financeiro",
      isComum: role === "comum" || role === "administradoras",
      isVendas: role === "vendas",
      isDiretora: role === "diretora",
      isAdministradoras: role === "administradoras",
      isAdminInterno,
      isAdminEmpresa,
      empresaVinculadaId,
      mustChangePassword,
      canEditFinanceiro: role === "admin" || role === "financeiro",
      signOut,
      refreshAuthFlags,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
