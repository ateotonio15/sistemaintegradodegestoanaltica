import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import { cn } from "@/lib/utils";
import {
  Building2,
  ArrowLeftRight,
  UserCheck,
  FileSignature,
  ClockAlert,
  Activity,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  show: (ctx: { role?: string | null; isAdmin: boolean; isFinanceiro: boolean }) => boolean;
};

const TABS: Tab[] = [
  { to: "/empresas", label: "Empresas", icon: Building2, show: () => true },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight, show: () => true },
  {
    to: "/implantacao",
    label: "Implantação",
    icon: FileSignature,
    show: ({ isAdmin, role }) =>
      isAdmin || ["comum", "administradoras", "visualizacao", "diretora"].includes(role as string),
  },
  {
    to: "/contratos-recem-implantados",
    label: "Primeira Vigencia",
    icon: ClockAlert,
    show: ({ isAdmin, isFinanceiro, role }) =>
      isAdmin || isFinanceiro || ["comum", "administradoras", "diretora"].includes(role as string),
  },
  {
    to: "/vidas",
    label: "Vidas",
    icon: Activity,
    show: ({ isAdmin, role }) =>
      isAdmin || ["diretora", "comum", "administradoras", "vendas"].includes(role as string),
  },
];

export default function EmpresasGroupLayout() {
  const { role, isAdmin, isFinanceiro } = useAuth();
  const loc = useLocation();
  const visible = TABS.filter((t) => t.show({ role, isAdmin, isFinanceiro }));

  return (
    <div className="animate-in fade-in duration-300">
      <div className="px-4 md:px-6 pt-4">
        <nav className="flex flex-wrap items-center gap-1 border-b border-border px-1">
          {visible.map((t) => {
            const path = loc.pathname;
            const active =
              path === t.to ||
              path.startsWith(t.to + "/") ||
              (t.to === "/vidas" && (path === "/gestao-vidas" || path === "/vidas-operadora"));
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className={cn(
                  "group relative flex items-center gap-2.5 px-4 py-3 text-sm tracking-tight transition-all duration-200",
                  active
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-primary font-medium",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                    active
                      ? "bg-primary/10 text-primary group-hover:scale-110"
                      : "bg-transparent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                  )}
                >
                  <t.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
                </span>
                <span>{t.label}</span>
                {active && (
                  <span
                    className="absolute bottom-[-1px] left-0 right-0 h-1 rounded-t-full bg-primary"
                    style={{ boxShadow: "0 -2px 8px hsl(var(--primary) / 0.35)" }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
