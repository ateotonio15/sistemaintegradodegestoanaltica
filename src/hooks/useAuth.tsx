import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionNamespace } from "@/hooks/useSessionState";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "comum" | "executivo" | "executivo_externo" | "visualizacao" | "diretora" | "enfermeira" | "tec_enfermagem" | "financeiro" | "vendas" | "administradoras" | "admin_interno" | null;

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
  isTecEnfermagem: boolean;
  isFinanceiro: boolean;
  isComum: boolean;
  isVendas: boolean;
  isDiretora: boolean;
  isAdministradoras: boolean;
  isAdminInterno: boolean;
  isAdminEmpresa: boolean;
  isCorretora: boolean;
  corretoraId: string | null;
  corretoraNome: string | null;
  corretoraPortalSecoes: Record<string, boolean> | null;
  corretoraEmpresas: { id: string; nome: string }[];
  activeEmpresaId: string | null;
  setActiveEmpresaId: (id: string | null) => void;
  empresaVinculadaId: string | null;
  mustChangePassword: boolean;
  canEditFinanceiro: boolean;
  realRole: UserRole;
  simulatedRole: UserRole;
  isSimulating: boolean;
  canSimulate: boolean;
  setSimulatedRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
  refreshAuthFlags: () => Promise<void>;
}

export const SIMULACAO_STORAGE_KEY = "siga:simular-perfil";

export const PERFIS_SIMULAVEIS: { value: Exclude<UserRole, null>; label: string }[] = [
  { value: "vendas", label: "Vendas" },
  { value: "diretora", label: "Diretoria" },
  { value: "comum", label: "Cadastro" },
  { value: "financeiro", label: "Financeiro" },
  { value: "executivo", label: "Executivo" },
  { value: "executivo_externo", label: "Executivo externo" },
  { value: "enfermeira", label: "Enfermeira" },
  { value: "tec_enfermagem", label: "Téc. Enfermagem" },
  { value: "visualizacao", label: "Visualização" },
  { value: "administradoras", label: "Administradoras" },
];

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
  isTecEnfermagem: false,
  isFinanceiro: false,
  isComum: false,
  isVendas: false,
  isDiretora: false,
  isAdministradoras: false,
  isAdminInterno: false,
  isAdminEmpresa: false,
  isCorretora: false,
  corretoraId: null,
  corretoraNome: null,
  corretoraPortalSecoes: null,
  corretoraEmpresas: [],
  activeEmpresaId: null,
  setActiveEmpresaId: () => {},
  empresaVinculadaId: null,
  mustChangePassword: false,
  canEditFinanceiro: false,
  realRole: null,
  simulatedRole: null,
  isSimulating: false,
  canSimulate: false,
  setSimulatedRole: () => {},
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
  const [corretoraId, setCorretoraId] = useState<string | null>(null);
  const [corretoraNome, setCorretoraNome] = useState<string | null>(null);
  const [corretoraPortalSecoes, setCorretoraPortalSecoes] = useState<Record<string, boolean> | null>(null);
  const [corretoraEmpresas, setCorretoraEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [activeEmpresaId, setActiveEmpresaId] = useState<string | null>(null);
  const [simulatedRoleState, setSimulatedRoleState] = useState<UserRole>(() => {
    try {
      const stored = localStorage.getItem(SIMULACAO_STORAGE_KEY);
      return (stored as UserRole) ?? null;
    } catch {
      return null;
    }
  });
  const roleRef = useRef<UserRole>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const roleRequestRef = useRef(0);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const loadFlags = useCallback(async (userId: string) => {
    const requestId = ++roleRequestRef.current;

    // Busca os papéis com retentativa: uma falha de rede/refresh não pode
    // rebaixar o perfil do usuário (ex.: financeiro virar "comum").
    const fetchRoles = async () => {
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const res = await supabase.from("user_roles").select("role").eq("user_id", userId);
        if (!res.error && res.data) return res.data as any[];
        await new Promise((r) => setTimeout(r, 400 * (tentativa + 1)));
      }
      return null;
    };

    const [rolesData, profileRes, empresaRes, corretoraRes] = await Promise.all([
      fetchRoles(),
      supabase.from("profiles").select("must_change_password").eq("user_id", userId).maybeSingle(),
      supabase.from("empresa_usuarios").select("empresa_id, papel").eq("user_id", userId).limit(1).maybeSingle(),
      (supabase as any).rpc("get_minha_corretora"),
    ]);
    if (requestId !== roleRequestRef.current) return;

    const ROLE_CACHE_KEY = `siga:role-cache:${userId}`;
    if (!rolesData) {
      // Sem resposta confiável: mantém o papel atual (ou o último conhecido)
      // em vez de assumir "comum" e esconder Financeiro/Arquivos.
      let cached: UserRole = roleRef.current;
      if (!cached) {
        try { cached = (localStorage.getItem(ROLE_CACHE_KEY) as UserRole) ?? null; } catch { /* ignore */ }
      }
      if (cached) setRole(cached);
      setLoading(false);
      return;
    }

    const roles = rolesData.map((r: any) => r.role as string);
    const primaryRole = (roles.find((r) => r !== "admin_interno") ?? roles[0] ?? "comum") as UserRole;
    try { if (primaryRole) localStorage.setItem(ROLE_CACHE_KEY, primaryRole); } catch { /* ignore */ }
    const papel = ((empresaRes.data as any)?.papel ?? null) as string | null;
    setRole(primaryRole);
    setIsAdminInterno(roles.includes("admin_interno"));
    setIsAdminEmpresa(papel === "admin_empresa");
    const empId = ((empresaRes.data as any)?.empresa_id as string) ?? null;
    setEmpresaVinculadaId(empId);
    setMustChangePassword(Boolean((profileRes.data as any)?.must_change_password));

    const cor = ((corretoraRes as any)?.data ?? [])[0] ?? null;
    if (cor?.corretora_id) {
      setCorretoraId(cor.corretora_id);
      setCorretoraNome(cor.nome);
      setCorretoraPortalSecoes(cor.portal_secoes ?? null);
      const { data: vincs } = await (supabase as any)
        .from("corretora_empresas")
        .select("empresa_id, empresas(id, nome)")
        .eq("corretora_id", cor.corretora_id);
      const list = ((vincs ?? []) as any[])
        .map((v) => ({ id: v.empresas?.id, nome: v.empresas?.nome }))
        .filter((v) => v.id)
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setCorretoraEmpresas(list);
      setActiveEmpresaId((prev) => prev ?? list[0]?.id ?? null);
    } else {
      setCorretoraId(null);
      setCorretoraNome(null);
      setCorretoraPortalSecoes(null);
      setCorretoraEmpresas([]);
      setActiveEmpresaId(empId);
    }
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
        setCorretoraId(null);
        setCorretoraNome(null);
        setCorretoraPortalSecoes(null);
        setCorretoraEmpresas([]);
        setActiveEmpresaId(null);
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
    try { localStorage.removeItem(SIMULACAO_STORAGE_KEY); } catch { /* ignore */ }
    setSimulatedRoleState(null);
    await supabase.auth.signOut();
  };

  const canSimulate = role === "admin";
  const simulatedRole = canSimulate ? simulatedRoleState : null;
  const effectiveRole: UserRole = simulatedRole ?? role;

  const setSimulatedRole = useCallback((next: UserRole) => {
    setSimulatedRoleState(next);
    try {
      if (next) localStorage.setItem(SIMULACAO_STORAGE_KEY, next);
      else localStorage.removeItem(SIMULACAO_STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, session, loading, role: effectiveRole,
      realRole: role,
      simulatedRole,
      isSimulating: !!simulatedRole,
      canSimulate,
      setSimulatedRole,
      isAdmin: effectiveRole === "admin",
      isExecutivo: effectiveRole === "executivo",
      isExecutivoExterno: effectiveRole === "executivo_externo",
      isViewOnly: effectiveRole === "visualizacao" || effectiveRole === "diretora",
      isEnfermeira: effectiveRole === "enfermeira" || effectiveRole === "tec_enfermagem",
      isTecEnfermagem: effectiveRole === "tec_enfermagem",
      isFinanceiro: effectiveRole === "financeiro",
      isComum: effectiveRole === "comum" || effectiveRole === "administradoras",
      isVendas: effectiveRole === "vendas",
      isDiretora: effectiveRole === "diretora",
      isAdministradoras: effectiveRole === "administradoras",
      isAdminInterno,
      isAdminEmpresa,
      isCorretora: !!corretoraId,
      corretoraId,
      corretoraNome,
      corretoraPortalSecoes,
      corretoraEmpresas,
      activeEmpresaId,
      setActiveEmpresaId,
      empresaVinculadaId,
      mustChangePassword,
      canEditFinanceiro: effectiveRole === "admin" || effectiveRole === "financeiro",
      signOut,
      refreshAuthFlags,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
