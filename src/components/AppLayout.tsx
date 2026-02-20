import { Link, useLocation } from "react-router-dom";
import { Building2, ArrowLeftRight, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
            <Building2 className="h-5 w-5 text-primary" />
            Fechamento
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  location.pathname.startsWith(item.to)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
