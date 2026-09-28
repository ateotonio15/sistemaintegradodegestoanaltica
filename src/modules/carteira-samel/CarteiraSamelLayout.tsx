import { Outlet, NavLink, useLocation } from "react-router-dom";
import { EmpresasProvider } from "./context/EmpresasContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, BarChart3, ShieldAlert, ClipboardList, Stethoscope } from "lucide-react";

const tabs = [
  { to: "/carteira-samel", label: "Visão Geral", icon: LayoutDashboard, end: true },
  { to: "/carteira-samel/carteira", label: "Carteira", icon: Users },
  { to: "/carteira-samel/sinistralidade", label: "Sinistralidade", icon: BarChart3 },
  { to: "/carteira-samel/score", label: "Score de Risco", icon: ShieldAlert },
  { to: "/carteira-samel/avaliacoes/rh", label: "Avaliações RH", icon: ClipboardList, Stethoscope },
];

export default function CarteiraSamelLayout() {
  const loc = useLocation();
  return (
    <EmpresasProvider>
      <div className="p-4 md:p-6 space-y-4 animate-in fade-in duration-300">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão da Carteira Samel</h1>
            <p className="text-sm text-muted-foreground">Inteligência aplicada à performance da carteira corporativa</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 border-b">
          {tabs.map((t) => {
            const active = t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="pt-2">
          <Outlet />
        </div>
      </div>
    </EmpresasProvider>
  );
}
