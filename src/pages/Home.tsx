import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCanAccessHonda } from "@/hooks/useHondaExclusoes";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Search,
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  UserCheck,
  Wallet,
  FileSignature,
  ClockAlert,
  FolderArchive,
  TrendingUp,
  Users,
  HeartPulse,
  Activity,
  Bike,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

type Shortcut = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "funcoes" | "utilitarios";
  show: (ctx: Ctx) => boolean;
};

type Ctx = {
  isAdmin: boolean;
  isExecutivo: boolean;
  isViewOnly: boolean;
  isEnfermeira: boolean;
  isFinanceiro: boolean;
  isVendas: boolean;
  role: string | null | undefined;
  canHonda: boolean;
};

const SHORTCUTS: Shortcut[] = [
  {
    to: "/dashboard/geral",
    label: "Painel Operacional",
    description: "Movimentações e indicadores do mês",
    icon: LayoutDashboard,
    group: "funcoes",
    show: (c) => c.isAdmin,
  },
  {
    to: "/dashboard/financeiro",
    label: "Painel Financeiro",
    description: "Notas, prazos e cobranças",
    icon: Wallet,
    group: "funcoes",
    show: (c) => c.isAdmin || c.isFinanceiro,
  },
  {
    to: "/dashboard/vendas",
    label: "Painel Vendas",
    description: "Contratos em análise e prospecção",
    icon: TrendingUp,
    group: "funcoes",
    show: (c) => c.isAdmin || c.isVendas,
  },
  {
    to: "/dashboard/administradoras",
    label: "Painel Administradoras",
    description: "Visão consolidada por administradora",
    icon: Building2,
    group: "funcoes",
    show: (c) => c.isAdmin,
  },
  {
    to: "/empresas",
    label: "Empresas",
    description: "Cadastro e gestão de contratos",
    icon: Building2,
    group: "funcoes",
    show: () => true,
  },
  {
    to: "/movimentacoes",
    label: "Movimentações",
    description: "Inclusões, exclusões e alterações",
    icon: ArrowLeftRight,
    group: "funcoes",
    show: () => true,
  },
  {
    to: "/executivas",
    label: "Executivas",
    description: "Carteira e ranking das executivas",
    icon: UserCheck,
    group: "funcoes",
    show: (c) => !c.isFinanceiro,
  },
  {
    to: "/financeiro",
    label: "Financeiro",
    description: "Faturamento, análises e DDA",
    icon: Wallet,
    group: "funcoes",
    show: (c) =>
      c.isAdmin || c.isFinanceiro || c.role === "comum" || c.role === "administradoras" || c.role === "visualizacao",
  },
  {
    to: "/implantacao",
    label: "Implantação",
    description: "Novos contratos e onboarding",
    icon: FileSignature,
    group: "funcoes",
    show: (c) =>
      c.isAdmin || ["comum", "administradoras", "visualizacao", "diretora"].includes(c.role as string),
  },
  {
    to: "/contratos-recem-implantados",
    label: "Recém Implantados",
    description: "Acompanhar primeiros fechamentos",
    icon: ClockAlert,
    group: "funcoes",
    show: (c) =>
      c.isAdmin || c.isFinanceiro || ["comum", "administradoras", "diretora"].includes(c.role as string),
  },
  {
    to: "/reajustes",
    label: "Reajustes",
    description: "Aniversário e retroativos",
    icon: TrendingUp,
    group: "funcoes",
    show: () => true,
  },
  {
    to: "/carteira-samel",
    label: "Carteira Samel",
    description: "Risco, sinistralidade e avaliações",
    icon: Briefcase,
    group: "funcoes",
    show: (c) =>
      c.isAdmin || ["diretora", "comum", "executivo", "administradoras"].includes(c.role as string),
  },
  {
    to: "/gestao-vidas",
    label: "Gestão de Vidas",
    description: "Histórico analítico de vidas",
    icon: Activity,
    group: "funcoes",
    show: (c) =>
      c.isAdmin || ["diretora", "comum", "administradoras"].includes(c.role as string),
  },
  {
    to: "/vidas-operadora",
    label: "Vidas na Operadora",
    description: "Conciliação com a operadora",
    icon: Activity,
    group: "funcoes",
    show: (c) =>
      c.isAdmin || ["diretora", "comum", "administradoras", "vendas"].includes(c.role as string),
  },
  {
    to: "/vidas-samel",
    label: "Vidas Samel",
    description: "Base interna de vidas",
    icon: HeartPulse,
    group: "funcoes",
    show: () => true,
  },
  {
    to: "/arquivos",
    label: "Arquivos",
    description: "Documentos e anexos centralizados",
    icon: FolderArchive,
    group: "utilitarios",
    show: (c) => c.isAdmin || c.isFinanceiro,
  },
  {
    to: "/usuarios",
    label: "Usuários",
    description: "Permissões e perfis do sistema",
    icon: Users,
    group: "utilitarios",
    show: (c) => c.isAdmin,
  },
  {
    to: "/honda-exclusoes",
    label: "Honda Exclusões",
    description: "Controle de exclusões Moto Honda",
    icon: Bike,
    group: "utilitarios",
    show: (c) => c.canHonda,
  },
];

export default function Home() {
  const { isAdmin, isExecutivo, isViewOnly, isEnfermeira, isFinanceiro, isVendas, role, user } = useAuth();
  const { data: canHonda } = useCanAccessHonda();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"funcoes" | "utilitarios">("funcoes");

  const ctx: Ctx = {
    isAdmin,
    isExecutivo,
    isViewOnly,
    isEnfermeira,
    isFinanceiro,
    isVendas,
    role,
    canHonda: !!canHonda,
  };

  const visible = useMemo(() => SHORTCUTS.filter((s) => s.show(ctx)), [ctx]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? visible : visible.filter((s) => s.group === tab);
    if (!q) return base;
    return visible.filter(
      (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [visible, query, tab]);

  const { data: profile } = useQuery({
    queryKey: ["home-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const greetingName = (profile?.display_name || user?.email?.split("@")[0] || "")
    .split(" ")[0];
  const greetingDisplay = greetingName
    ? greetingName.charAt(0).toUpperCase() + greetingName.slice(1)
    : "";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 py-10 md:py-16">
      <div className="w-full max-w-5xl flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Bem-vindo{greetingName ? `, ${greetingName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Acesse rapidamente os módulos do CS Control
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulo, função ou atalho..."
            className="h-12 pl-11 pr-4 rounded-full border-border/60 bg-card shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>

        {/* Tabs */}
        {!query && (
          <div className="flex items-center gap-6 border-b border-border/60 w-full max-w-2xl justify-center">
            {(["funcoes", "utilitarios"] as const).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "relative pb-3 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "funcoes" ? "Funções" : "Utilitários"}
                  {active && (
                    <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12">
              Nenhum módulo encontrado.
            </div>
          ) : (
            filtered.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.to} to={s.to} className="group">
                  <Card className="p-4 flex items-start gap-3 rounded-xl border-border/60 bg-card hover:bg-accent/40 hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/15 group-hover:bg-primary/15 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {s.label}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {s.description}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
