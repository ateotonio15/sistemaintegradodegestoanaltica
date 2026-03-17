import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ArrowLeftRight, LayoutDashboard, Bell, Sun, Moon, LogOut, Users, Check, CheckCheck, PanelLeftClose, PanelLeft, UserCheck, Lock } from "lucide-react";
import logoImg from "@/assets/logo-cs-control.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calcularStatus } from "@/lib/movimentacao-utils";
import type { Tables } from "@/integrations/supabase/types";
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

const allNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/executivas", label: "Executivas", icon: UserCheck },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isAdmin, isExecutivo, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => isMobile);

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  const storageKey = user ? `dismissed-notifs-${user.id}` : "dismissed-notifs";
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(dismissed));
  }, [dismissed, storageKey]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      return true;
    });
  }, [isAdmin]);

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

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["movimentacoes-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, empresas(nome, codigo_contrato, tipo_movimentacao, periodo_movimentacao)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Tables<"movimentacoes"> & { empresas?: { nome: string; codigo_contrato: string | null } | null })[];
    },
    refetchInterval: 60000,
  });

  const foraDosPrazos = useMemo(() => {
    return movimentacoes
      .filter((m) => calcularStatus(m) === "Fora do prazo")
      .slice(0, 20);
  }, [movimentacoes]);

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const allIds = foraDosPrazos.map((m) => m.id);
      return [...new Set([...prev, ...allIds])];
    });
  }, [foraDosPrazos]);

  const pendingNotifs = useMemo(() => foraDosPrazos.filter((m) => !dismissed.includes(m.id)), [foraDosPrazos, dismissed]);

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
        {/* Sidebar Header */}
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

        {/* Nav Items */}
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

        {/* Sidebar Footer - User */}
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
            {/* Left: Mobile menu button */}
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

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Notifications */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative p-2.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                    <Bell className="h-4 w-4" />
                    {pendingNotifs.length > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-scale-in">
                        {pendingNotifs.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 rounded-xl shadow-lg" align="end">
                  <div className="p-3.5 border-b flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Notificações</h4>
                    {pendingNotifs.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={dismissAll}>
                        <CheckCheck className="h-3.5 w-3.5" />
                        Concluir todas
                      </Button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {foraDosPrazos.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Nenhum contrato fora do período ✅
                      </div>
                    ) : pendingNotifs.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Todas as notificações foram concluídas ✅
                      </div>
                    ) : (
                      pendingNotifs.map((m) => (
                        <div key={m.id} className="p-3 border-b last:border-0 hover:bg-accent/50 flex items-start gap-2.5 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{m.empresas?.nome ?? "—"}</p>
                            <p className="text-xs text-destructive mt-0.5">
                              Contrato fora do período de movimentação
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Período: {m.periodo} · Cód: {m.empresas?.codigo_contrato || "—"}
                            </p>
                          </div>
                          <button
                            onClick={() => dismiss(m.id)}
                            className="shrink-0 mt-0.5 p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                            title="Marcar como concluída"
                          >
                            <Check className="h-4 w-4 text-primary" />
                          </button>
                        </div>
                      ))
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
        <main className="flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
