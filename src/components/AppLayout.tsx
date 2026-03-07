import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, ArrowLeftRight, LayoutDashboard, Bell, Sun, Moon, LogOut, Users } from "lucide-react";
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

const allNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { signOut, user, isAdmin, isExecutivo, role } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Executivo only sees Dashboard and Movimentações
  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      return true;
    });
  }, [isAdmin]);

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

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/" || location.pathname === "/dashboard";
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
              <Building2 className="h-5 w-5 text-icon" />
              Fechamento
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive(item.to)
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 text-icon" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-icon" />
              ) : (
                <Moon className="h-5 w-5 text-icon" />
              )}
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
                  <Bell className="h-5 w-5 text-icon" />
                  {foraDosPrazos.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {foraDosPrazos.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b">
                  <h4 className="font-semibold text-sm">Notificações</h4>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {foraDosPrazos.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum contrato fora do período ✅
                    </div>
                  ) : (
                    foraDosPrazos.map((m) => (
                      <div key={m.id} className="p-3 border-b last:border-0 hover:bg-accent/50">
                        <p className="text-sm font-medium">{m.empresas?.nome ?? "—"}</p>
                        <p className="text-xs text-destructive mt-0.5">
                          Contrato fora do período de movimentação
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Período: {m.periodo} · Cód: {m.empresas?.codigo_contrato || "—"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={signOut}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              title="Sair"
            >
              <LogOut className="h-5 w-5 text-icon" />
            </button>
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
