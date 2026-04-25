import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ArrowLeftRight, LayoutDashboard, Bell, Sun, Moon, LogOut, Users, Check, CheckCheck, PanelLeftClose, PanelLeft, UserCheck, CalendarClock, Building, FileText, User, Calendar, Wallet } from "lucide-react";
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

const allNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/executivas", label: "Executivas", icon: UserCheck },
  { to: "/saude", label: "Saúde nas Empresas", icon: CalendarClock },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, adminOnly: true },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isAdmin, isExecutivo, isViewOnly, isEnfermeira, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [collapsed, setCollapsed] = useState(() => isMobile);

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      // Saúde: only admin, executivo, enfermeira
      if (item.to === "/saude" && !isAdmin && !isExecutivo && !isEnfermeira) return false;
      // Enfermeira: restricted access
      if (isEnfermeira) {
        const allowed = ["/empresas", "/executivas", "/saude"];
        return allowed.includes(item.to);
      }
      return true;
    });
  }, [isAdmin, isExecutivo, isEnfermeira]);

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
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
    refetchInterval: 30000,
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card/95 backdrop-blur-xl transition-all duration-300 ease-in-out",
          collapsed ? "w-[70px]" : "w-[240px]",
          isMobile && collapsed && "-translate-x-full"
        )}
      >
        <div className={cn(
          "flex h-16 items-center border-b px-3 shrink-0",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-foreground hover:opacity-80 transition-opacity">
              <img src={logoImg} alt="CS Control" className="h-9 w-9 rounded-xl object-contain shrink-0" />
              <span className="truncate">CS Control</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground",
              collapsed && "mx-auto"
            )}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.to);
            const linkContent = (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", collapsed && "h-5 w-5")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
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

        <div className={cn("border-t p-3 shrink-0", collapsed && "flex justify-center")}>
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
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">@{username}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

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
        !isMobile && (collapsed ? "ml-[70px]" : "ml-[240px]"),
        isMobile && "ml-0"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl shadow-sm">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  onClick={() => setCollapsed(false)}
                  className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
              )}
              {collapsed && !isMobile && (
                <Link to="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-foreground hover:opacity-80 transition-opacity">
                  <img src={logoImg} alt="CS Control" className="h-8 w-8 rounded-lg object-contain" />
                  <span>CS Control</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1.5">
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
                    {pendingNotifs.length > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-scale-in">
                        {pendingNotifs.length > 9 ? "9+" : pendingNotifs.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0 rounded-xl shadow-lg" align="end">
                  <div className="p-3.5 border-b flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Notificações</h4>
                    {pendingNotifs.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={markAllAsRead}>
                        <CheckCheck className="h-3.5 w-3.5" />
                        Marcar todas como lidas
                      </Button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {pendingNotifs.length === 0 ? (
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
        <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in space-y-4">
          <SuspensaoBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
