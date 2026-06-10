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
    to: "/executivas",
    label: "Executivas",
    icon: UserCheck,
    show: ({ isFinanceiro }) => !isFinanceiro,
  },
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
        <nav className="flex flex-wrap gap-1 border-b">
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
                  "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
