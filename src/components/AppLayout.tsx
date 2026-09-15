import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, ArrowLeftRight, LayoutDashboard, Bell, Sun, Moon, LogOut, Users, Check, CheckCheck, PanelLeftClose, PanelLeft, UserCheck, CalendarClock, Building, FileText, User, Calendar, Wallet, TrendingUp, FolderArchive, FileSignature, HeartPulse, Activity, ChevronDown, ClockAlert, Bike, Briefcase, MessageSquareWarning, Phone, Car, Stethoscope, Mic, Star, ShieldPlus, Home as HomeIcon, Plus, ExternalLink } from "lucide-react";
import { useApplyUserTheme } from "@/hooks/useUserPreferences";
import { useCanAccessHonda } from "@/hooks/useHondaExclusoes";
import { useAtivarContratosPendentes } from "@/hooks/useAtivarContratosPendentes";
import logoImg from "@/assets/logo-cs-control.png";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { SuspensaoBanner } from "@/components/empresas/SuspensaoBanner";
import { CobrancaBanner } from "@/components/financeiro/CobrancaBanner";
import { HondaAlertasBanner } from "@/components/honda/HondaAlertasBanner";
import { HeaderTabs } from "@/components/HeaderTabs";
import { SimularPerfilSwitcher, SimularPerfilBanner } from "@/components/SimularPerfilSwitcher";
import { CadastroEmpresasPopover } from "@/components/CadastroEmpresasPopover";
import { FloatingFilaChat } from "@/components/atendimentos/FloatingFilaChat";


const allNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  
  { to: "/financeiro", label: "Faturamento", icon: Wallet },
  { to: "/implantacao", label: "Implantação", icon: FileSignature },
  { to: "/contratos-recem-implantados", label: "Primeira Vigencia", icon: ClockAlert },
  { to: "/arquivos", label: "Arquivos", icon: FolderArchive },
  { to: "/reajustes", label: "Reajuste", icon: TrendingUp },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  
  { to: "/vidas", label: "Vidas", icon: Activity },
  { to: "/demandas", label: "Registro de Reclamações", icon: MessageSquareWarning, adminOnly: true },
  { to: "/demandas/dashboard", label: "Dashboard Reclamações", icon: LayoutDashboard, adminOnly: true },
  { to: "/plantoes", label: "Plantão nas empresas", icon: Phone, adminOnly: true },
  { to: "/plantoes/calendario", label: "Calendário Plantões", icon: Calendar, adminOnly: true },
  { to: "/uber", label: "Uber Corporativo", icon: Car, adminOnly: true },
  { to: "/uber/dashboard", label: "Dashboard Uber", icon: LayoutDashboard, adminOnly: true },
  { to: "/saude-empresas", label: "Analise dos Dados", icon: Stethoscope },
  { to: "/saude-empresas/visao-geral", label: "Visão Geral · Saúde", icon: Activity },
  { to: "/saude-empresas/preventivas", label: "Calendário de Ações", icon: CalendarClock },
  { to: "/saude-empresas/palestras", label: "Calendário Palestras", icon: Mic },
  { to: "/saude-empresas/pesquisas", label: "Pesquisa de Satisfação", icon: Star },
];

interface Notificacao {
  id: string;
  tipo: string;
  empresa_id: string;
  nome_empresa: string;
  codigo_contrato: string | null;
  responsavel_contrato: string | null;
  data_implantacao: string | null;
  created_at: string;
}

interface NotifSaude {
  id: string;
  event_source: string;
  event_id: string;
  event_type: string;
  status_notif: "novo" | "atualizado" | "cancelado";
  nome_empresa: string;
  data_evento: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
  tema: string | null;
  campanha: string | null;
  responsavel: string | null;
  executiva: string | null;
  motivo_cancelamento: string | null;
  titulo: string;
  mensagem: string | null;
  created_at: string;
}

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }
}

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isAdmin, isExecutivo, isViewOnly, isEnfermeira, isFinanceiro, isExecutivoExterno, role, isAdminInterno } = useAuth();
  const { theme, toggleTheme } = useTheme();
  useApplyUserTheme();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  useAtivarContratosPendentes();
  const { data: canAccessHonda } = useCanAccessHonda();
  const hasLateralNavigation = isAdmin || role === "vendas";

  const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (window.innerWidth < 768) return true;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });

  // Só recolhe automaticamente ao ENTRAR em mobile; não sobrescreve preferência em desktop.
  const wasMobileRef = useRef(isMobile);
  useEffect(() => {
    if (!wasMobileRef.current && isMobile) setCollapsed(true);
    wasMobileRef.current = isMobile;
  }, [isMobile]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (!isMobile) {
        try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch {}
      }
      return next;
    });
  }, [isMobile]);

  const dashChildren = useMemo(() => ([
    { to: "/dashboard/geral", label: "Geral", icon: LayoutDashboard },
    { to: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
    { to: "/dashboard/vendas", label: "Vendas", icon: TrendingUp },
    { to: "/dashboard/administradoras", label: "Administradoras", icon: Building },
  ]), []);

  const navItems = useMemo(() => {
    const base: Array<typeof allNavItems[number] & { children?: typeof dashChildren }> = isAdmin
      ? [
          { to: "/", label: "Painéis", icon: LayoutDashboard, children: dashChildren },
          ...allNavItems.slice(1),
        ]
      : role === "vendas"
        ? [
            { to: "/dashboard/vendas", label: "Dashboard", icon: LayoutDashboard },
            { to: "/empresas", label: "Empresas", icon: Building2 },
            { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
            { to: "/implantacao", label: "Análise de Contratos", icon: FileSignature },
            { to: "/vidas", label: "Vidas", icon: Activity },
          ]
      : isFinanceiro
        ? [
            { to: "/dashboard/financeiro", label: "Financeiro", icon: Wallet },
            ...allNavItems,
          ]
      : allNavItems;
    const filtered = base.filter((item) => {
      if (isExecutivoExterno) {
        const allowed = ["/empresas", "/demandas", "/plantoes", "/mailing-brindes"];
        return allowed.includes(item.to);
      }
      if (isEnfermeira) {
        const saude = ["/saude-empresas", "/saude-empresas/visao-geral", "/saude-empresas/preventivas", "/saude-empresas/palestras", "/saude-empresas/pesquisas"];
        const allowed = role === "tec_enfermagem" ? saude : ["/uber", "/uber/dashboard", ...saude];
        return allowed.includes(item.to);
      }
      if (isFinanceiro) {
        const allowed = ["/", "/dashboard/financeiro", "/empresas", "/movimentacoes", "/financeiro", "/arquivos", "/reajustes", "/contratos-recem-implantados"];
        return allowed.includes(item.to);
      }
      if ((item.to === "/uber" || item.to === "/uber/dashboard") && !isAdmin && role !== "executivo") return false;
      if (item.adminOnly && !isAdmin) return false;
      if (item.to === "/financeiro" && !isAdmin && !isFinanceiro && role !== "comum" && role !== "administradoras" && role !== "visualizacao") return false;
      if (item.to === "/implantacao" && !isAdmin && role !== "comum" && role !== "administradoras" && role !== "visualizacao" && role !== "diretora" && role !== "vendas") return false;
      if (item.to === "/contratos-recem-implantados" && !isAdmin && !isFinanceiro && role !== "comum" && role !== "administradoras" && role !== "diretora") return false;
      if (item.to === "/arquivos" && !isAdmin && !isFinanceiro) return false;
      if (item.to === "/vidas" && !isAdmin && !["diretora","comum","administradoras","vendas"].includes(role as string)) return false;
      return true;
    });
    if (canAccessHonda) {
      filtered.push({ to: "/honda-exclusoes", label: "Honda Exclusões", icon: Bike });
    }
    if (isAdmin || role === "diretora" || role === "comum" || role === "executivo" || role === "administradoras") {
      filtered.push({ to: "/carteira-samel", label: "Carteira Samel", icon: Briefcase });
    }
    return filtered;
  }, [isAdmin, isExecutivo, isExecutivoExterno, isEnfermeira, isFinanceiro, isViewOnly, role, dashChildren, canAccessHonda]);

  const isDashChildActive = dashChildren.some((c) => location.pathname === c.to);
  const [dashOpen, setDashOpen] = useState<boolean>(isDashChildActive);
  useEffect(() => {
    if (isDashChildActive) setDashOpen(true);
  }, [isDashChildActive]);



  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      const { data: uname } = await supabase.rpc("get_my_username");
      return { display_name: p?.display_name ?? null, username: (uname as string) ?? null };
    },
    enabled: !!user?.id,
  });

  // Fetch notifications
  const { data: notificacoes = [] } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notificacao[];
    },
    enabled: !!user?.id,
  });

  // Fetch read notifications for current user
  const { data: lidasIds = [] } = useQuery({
    queryKey: ["notificacoes-lidas", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_lidas")
        .select("notificacao_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((d: any) => d.notificacao_id as string);
    },
    enabled: !!user?.id,
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notificacoes-realtime-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
        // Play sound
        try {
          const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Nk4x/cWBTTUlLTlRdaHV+hoyQkI2IgHZqXlRMR0VIS1FaZG94gYqQlJWTj4d+dGleVExHREZJT1hibnmCi5GVl5WRi4N6cGVbUkxIRkhMU11oc4CMlJmcm5iUjoZ8cWZcU01KSUxRWWRwfIiSmJ2fnpqWj4d9c2hfV1FOS01SWmRwfIiSmJ2fn5yYko2Ee3FoX1dRTk1OVFxndIGMlZufoJ+cmJKNhXxya2NcV1NRUlZcZXF9iZOanqCgn5yYk46Ge3JrY1xXU1FSVl1mdIGMlZufoKCfnJiTjoZ8c2tjXFdTUVJWXGVxfYmTmp6goJ+cmJOOhntya2NcV1NRUlZcZXF9iZOanqCgn5yYk46GfHNrY1xXU1FSVl1mcX2Jk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXGZxfYmTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Jk5qeoKCfnJiTjoZ8c2tjXFdTUVJWXGZxfYmTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ8c2tjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUVZXZ3F9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcH2Kk5qeoKCfnJiTjoZ7cmtiXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NSUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY11XU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7c2tjXFdTUVJWXWZxfYqTmp6goJ+cmJOOhntya2NcV1NRUlZdZnF9ipOanqCgn5yYk46Ge3JrY1xXU1FSVl1mcX2Kk5qeoKCfnJiTjoZ7cmtjXFdTUVJWXWZxfYqTmp6goJ+cmA==");
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {}
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const pendingNotifs = useMemo(() => {
    const lidasSet = new Set(lidasIds);
    return notificacoes.filter((n) => !lidasSet.has(n.id)).slice(0, 20);
  }, [notificacoes, lidasIds]);

  const markAsRead = useCallback(async (notifId: string) => {
    if (!user) return;
    await supabase.from("notificacoes_lidas").insert({ notificacao_id: notifId, user_id: user.id });
    queryClient.invalidateQueries({ queryKey: ["notificacoes-lidas", user.id] });
  }, [user, queryClient]);

  const markAllAsRead = useCallback(async () => {
    if (!user || pendingNotifs.length === 0) return;
    const rows = pendingNotifs.map((n) => ({ notificacao_id: n.id, user_id: user.id }));
    await supabase.from("notificacoes_lidas").insert(rows);
    queryClient.invalidateQueries({ queryKey: ["notificacoes-lidas", user.id] });
  }, [user, pendingNotifs, queryClient]);

  // ============================================================
  // Notificações de Saúde (Palestras + Ações Preventivas)
  // Visíveis para enfermeira e admin (Fase 1)
  // ============================================================
  const canSeeSaude = !!user && (isEnfermeira || isAdmin);

  const { data: notifSaude = [] } = useQuery({
    queryKey: ["notificacoes-saude"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_saude" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as NotifSaude[];
    },
    enabled: canSeeSaude,
  });

  const { data: lidasSaudeIds = [] } = useQuery({
    queryKey: ["notificacoes-saude-lidas", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_saude_lidas" as any)
        .select("notificacao_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((d: any) => d.notificacao_id as string);
    },
    enabled: canSeeSaude,
  });

  useEffect(() => {
    if (!canSeeSaude || !user) return;
    const channel = supabase
      .channel("notif-saude-rt-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes_saude" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notificacoes-saude"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, canSeeSaude, queryClient]);

  const pendingSaude = useMemo(() => {
    const lidasSet = new Set(lidasSaudeIds);
    return notifSaude.filter((n) => !lidasSet.has(n.id)).slice(0, 30);
  }, [notifSaude, lidasSaudeIds]);

  const markSaudeAsRead = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("notificacoes_saude_lidas" as any).insert({ notificacao_id: id, user_id: user.id });
    queryClient.invalidateQueries({ queryKey: ["notificacoes-saude-lidas", user.id] });
  }, [user, queryClient]);

  const markAllSaudeAsRead = useCallback(async () => {
    if (!user || pendingSaude.length === 0) return;
    const rows = pendingSaude.map((n) => ({ notificacao_id: n.id, user_id: user.id }));
    await supabase.from("notificacoes_saude_lidas" as any).insert(rows);
    queryClient.invalidateQueries({ queryKey: ["notificacoes-saude-lidas", user.id] });
  }, [user, pendingSaude, queryClient]);

  const totalPendentes = pendingNotifs.length + pendingSaude.length;

  // ============================================================
  // Fila de Atendimento — atalho visível quando há chamados abertos
  // ============================================================
  const { data: filaAbertos = 0 } = useQuery({
    queryKey: ["fila-atendimentos-abertos-count"],
    enabled: !!user && isAdminInterno,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("atendimentos")
        .select("id", { head: true, count: "exact" })
        .eq("status", "aberto");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user || !isAdminInterno) return;
    const channel = supabase
      .channel("fila-atendimentos-rt-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["fila-atendimentos-abertos-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdminInterno, queryClient]);

  const showFilaShortcut = isAdminInterno && filaAbertos > 0 && !location.pathname.startsWith("/admin/fila-atendimento");


  const displayName = profile?.display_name || user?.email || "Usuário";
  const username = profile?.username || "—";
  const email = user?.email || "—";
  const initials = useMemo(() => {
    const name = profile?.display_name || user?.email || "";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }, [profile, user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/" || location.pathname === "/dashboard";
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Ambient background glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-glow opacity-60" />
      <FloatingFilaChat />

      {/* Navegação lateral do administrador e do perfil Vendas */}
      {hasLateralNavigation && (
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out",
          collapsed ? "w-[72px]" : "w-[252px]",
          isMobile && collapsed && "-translate-x-full"
        )}
        style={{
          background: "linear-gradient(180deg, #0B1410 0%, #101A15 100%)",
          boxShadow: "0 0 24px rgba(34,197,94,0.06)",
        }}
      >
        <div className={cn(
          "flex h-16 items-center border-b border-sidebar-border/70 px-3 shrink-0",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2.5 font-bold text-[15px] tracking-tight text-sidebar-foreground hover:opacity-80 transition-opacity">
              <img src={logoImg} alt="SIGA" className="h-9 w-9 rounded-xl object-contain shrink-0 ring-1 ring-primary/20" />
              <span className="truncate">SIGA</span>
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className={cn(
              "p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-sidebar-foreground",
              collapsed && "mx-auto"
            )}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            // Grupo "Painéis" (admin) — colapsável com subitens
            if ("children" in item && item.children) {
              const groupActive = item.children.some((c) => isActive(c.to));
              if (collapsed) {
                return (
                  <Popover key={item.to}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "group relative flex items-center justify-center rounded-xl px-0 py-2.5 text-[13.5px] font-medium transition-all duration-200",
                          groupActive
                            ? "nav-pill-active text-primary"
                            : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
                        )}
                        title={item.label}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="w-56 p-1">
                      {item.children.map((c) => {
                        const cActive = isActive(c.to);
                        return (
                          <Link
                            key={c.to}
                            to={c.to}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                              cActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-foreground/80 hover:bg-accent"
                            )}
                          >
                            <c.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{c.label}</span>
                          </Link>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                );
              }
              return (
                <div key={item.to} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setDashOpen((v) => !v)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 w-full",
                      groupActive
                        ? "nav-pill-active text-primary"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-all duration-200",
                        groupActive
                          ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                          : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                      )}
                    />
                    <span className="truncate tracking-tight flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200",
                        dashOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {dashOpen && (
                    <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border/60 flex flex-col gap-0.5">
                      {item.children.map((c) => {
                        const cActive = isActive(c.to);
                        return (
                          <Link
                            key={c.to}
                            to={c.to}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
                              cActive
                                ? "bg-primary/10 text-primary"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                            )}
                          >
                            <c.icon className="h-[15px] w-[15px] shrink-0" />
                            <span className="truncate">{c.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = isActive(item.to);
            const linkContent = (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200",
                  active
                    ? "nav-pill-active text-primary"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/70",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-all duration-200",
                    active
                      ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                      : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground group-hover:scale-110"
                  )}
                />
                {!collapsed && <span className="truncate tracking-tight">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.to} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}

        </nav>

        <div className={cn("border-t border-sidebar-border/70 p-3 shrink-0", collapsed && "flex justify-center")}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Avatar className="h-9 w-9 shadow-sm cursor-pointer">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {displayName}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 px-1">
              <Avatar className="h-9 w-9 shadow-sm shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-sidebar-foreground">{displayName}</p>
                <p className="text-xs truncate text-sidebar-foreground/60">@{username}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Main area */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        !isMobile && hasLateralNavigation && (collapsed ? "ml-[72px]" : "ml-[252px]"),
        (isMobile || !hasLateralNavigation) && "ml-0"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <SimularPerfilBanner />
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <div className="flex items-center gap-3 shrink-0">
              {isMobile && hasLateralNavigation && (
                <button
                  onClick={() => setCollapsed(false)}
                  className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
              )}
              {((collapsed && !isMobile) || !hasLateralNavigation) && (
                <Link to="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-foreground hover:opacity-80 transition-opacity">
                  <img src={logoImg} alt="SIGA" className="h-8 w-8 rounded-lg object-contain" />
                  <span className="hidden sm:inline">SIGA</span>
                </Link>
              )}
            </div>

            {!hasLateralNavigation && (
              <HeaderTabs
                available={navItems
                  .filter((it) => !("children" in it) || !it.children)
                  .map((it) => ({ to: it.to, label: it.label, icon: it.icon }))}
              />
            )}

            <div className={cn("flex items-center gap-1.5 shrink-0", isAdmin && "ml-auto")}>

              <SimularPerfilSwitcher />

              <CadastroEmpresasPopover />

              {showFilaShortcut && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/admin/fila-atendimento"
                      className="relative flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors animate-pulse"
                    >
                      <MessageSquareWarning className="h-4 w-4" />
                      <span className="hidden sm:inline">Fila de Atendimento</span>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                        {filaAbertos > 99 ? "99+" : filaAbertos}
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    {filaAbertos} atendimento{filaAbertos > 1 ? "s" : ""} aberto{filaAbertos > 1 ? "s" : ""} na fila
                  </TooltipContent>
                </Tooltip>
              )}



              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Unified Notifications Bell */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative p-2.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                    <Bell className="h-4 w-4" />
                    {totalPendentes > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-scale-in">
                        {totalPendentes > 9 ? "9+" : totalPendentes}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0 rounded-xl shadow-lg" align="end">
                  <div className="p-3.5 border-b flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Notificações</h4>
                    {(pendingNotifs.length > 0 || pendingSaude.length > 0) && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => { markAllAsRead(); markAllSaudeAsRead(); }}>
                        <CheckCheck className="h-3.5 w-3.5" />
                        Marcar todas como lidas
                      </Button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {pendingSaude.map((n) => {
                      const statusColor =
                        n.status_notif === "cancelado" ? "text-rose-500"
                        : n.status_notif === "atualizado" ? "text-amber-500"
                        : "text-emerald-500";
                      const statusBg =
                        n.status_notif === "cancelado" ? "bg-rose-500/10"
                        : n.status_notif === "atualizado" ? "bg-amber-500/10"
                        : "bg-emerald-500/10";
                      const target = n.event_source === "palestra"
                        ? "/saude-empresas/palestras"
                        : "/saude-empresas/preventivas";
                      const horario = n.hora_inicio
                        ? `${n.hora_inicio.slice(0,5)}${n.hora_fim ? " às " + n.hora_fim.slice(0,5) : ""}`
                        : null;
                      return (
                        <div
                          key={n.id}
                          className="p-3.5 border-b last:border-0 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => { markSaudeAsRead(n.id); navigate(target); }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", statusBg)}>
                              {n.event_source === "palestra"
                                ? <Mic className={cn("h-4 w-4", statusColor)} />
                                : <HeartPulse className={cn("h-4 w-4", statusColor)} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-semibold mb-1", statusColor)}>{n.titulo}</p>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-medium truncate">{n.nome_empresa}</span>
                                </div>
                                {n.tema && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span className="truncate">Tema: {n.tema}</span>
                                  </div>
                                )}
                                {n.data_evento && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3 shrink-0" />
                                    <span>{formatDateBR(n.data_evento)}{horario ? ` · ${horario}` : ""}</span>
                                  </div>
                                )}
                                {n.local && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Building className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{n.local}</span>
                                  </div>
                                )}
                                {n.executiva && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate">Executiva: {n.executiva}</span>
                                  </div>
                                )}
                                {n.motivo_cancelamento && (
                                  <div className="flex items-center gap-1.5 text-xs text-rose-500">
                                    <MessageSquareWarning className="h-3 w-3 shrink-0" />
                                    <span className="truncate">Motivo: {n.motivo_cancelamento}</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1.5">
                                {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); markSaudeAsRead(n.id); }}
                              className="shrink-0 p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                              title="Confirmar ciência"
                            >
                              <Check className="h-4 w-4 text-primary" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {pendingNotifs.length === 0 && pendingSaude.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        Nenhuma notificação pendente ✅
                      </div>
                    ) : (
                      pendingNotifs.map((n) => {
                        const isNovaEmpresa = n.tipo === "nova_empresa";
                        const iconColor = isNovaEmpresa ? "text-blue-500" : "text-green-500";
                        const bgColor = isNovaEmpresa ? "bg-blue-500/10" : "bg-green-500/10";
                        const title = isNovaEmpresa ? "Nova empresa cadastrada" : "Implantação realizada";

                        return (
                          <div
                            key={n.id}
                            className="p-3.5 border-b last:border-0 hover:bg-accent/50 transition-colors cursor-pointer"
                            onClick={() => {
                              markAsRead(n.id);
                              navigate("/empresas");
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", bgColor)}>
                                {isNovaEmpresa
                                  ? <Building className={cn("h-4 w-4", iconColor)} />
                                  : <CalendarClock className={cn("h-4 w-4", iconColor)} />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-semibold mb-1", iconColor)}>{title}</p>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="font-medium truncate">{n.nome_empresa}</span>
                                  </div>
                                  {n.codigo_contrato && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <FileText className="h-3 w-3 shrink-0" />
                                      <span>Cód: {n.codigo_contrato}</span>
                                    </div>
                                  )}
                                  {n.responsavel_contrato && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <User className="h-3 w-3 shrink-0" />
                                      <span>{n.responsavel_contrato}</span>
                                    </div>
                                  )}
                                  {n.data_implantacao && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      <span>{formatDateBR(n.data_implantacao)}</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1.5">
                                  {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(n.id);
                                }}
                                className="shrink-0 p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                                title="Marcar como lida"
                              >
                                <Check className="h-4 w-4 text-primary" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 p-0.5 rounded-full hover:ring-2 hover:ring-primary/30 transition-all" title="Menu do usuário">
                    <Avatar className="h-9 w-9 shadow-sm">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 p-0 rounded-xl shadow-lg" align="end">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 shadow-sm">
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">@{username}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <div className="space-y-2.5">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Nome</p>
                        <p className="text-sm">{displayName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Usuário</p>
                        <p className="text-sm">{username}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Email</p>
                        <p className="text-sm">{email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {isAdminInterno && (
                      <>
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="w-full gap-2 rounded-lg"
                        >
                          <Link to="/admin/cadastrar-empresa">
                            <Plus className="h-4 w-4" />
                            Cadastrar Empresa (portal)
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="w-full gap-2 rounded-lg"
                        >
                          <Link to="/admin/fila-atendimento">
                            <Plus className="h-4 w-4" />
                            Fila de Atendimento
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2 rounded-lg"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                      Sair do Sistema
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 space-y-4">
          <SuspensaoBanner />
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
