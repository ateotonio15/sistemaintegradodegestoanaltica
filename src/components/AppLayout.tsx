import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ArrowLeftRight, LayoutDashboard, Bell, Sun, Moon, LogOut, Users, Check, CheckCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calcularStatus } from "@/lib/movimentacao-utils";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
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

const allNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isAdmin, isExecutivo, role } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-foreground hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="hidden sm:inline">Fechamento</span>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive(item.to)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <Bell className="h-4.5 w-4.5" />
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
      <main className="container py-8 animate-fade-in">{children}</main>
    </div>
  );
}
