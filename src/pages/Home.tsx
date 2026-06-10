import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCanAccessHonda } from "@/hooks/useHondaExclusoes";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  ArrowLeft,
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

type LeafShortcut = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  show: (ctx: Ctx) => boolean;
};

type GroupShortcut = {
  groupKey: string;
  label: string;
  description: string;
  icon: LucideIcon;
  show: (ctx: Ctx) => boolean;
  children: LeafShortcut[];
};

type Shortcut = (LeafShortcut | GroupShortcut) & { group: "funcoes" | "utilitarios" };

const isGroup = (s: Shortcut): s is GroupShortcut & { group: "funcoes" | "utilitarios" } =>
  (s as GroupShortcut).children !== undefined;

const EMPRESAS_CHILDREN: LeafShortcut[] = [
  {
    to: "/empresas",
    label: "Empresas",
    description: "Cadastro e gestão de contratos",
    icon: Building2,
    show: () => true,
  },
  {
    to: "/movimentacoes",
    label: "Movimentações",
    description: "Inclusões, exclusões e alterações",
    icon: ArrowLeftRight,
    show: () => true,
  },
  {
    to: "/executivas",
    label: "Executivas",
    description: "Carteira e ranking das executivas",
    icon: UserCheck,
    show: (c) => !c.isFinanceiro,
  },
  {
    to: "/implantacao",
    label: "Implantação",
    description: "Novos contratos e onboarding",
    icon: FileSignature,
    show: (c) =>
      c.isAdmin || ["comum", "administradoras", "visualizacao", "diretora"].includes(c.role as string),
  },
  {
    to: "/contratos-recem-implantados",
    label: "Recém Implantados",
    description: "Acompanhar primeiros fechamentos",
    icon: ClockAlert,
    show: (c) =>
      c.isAdmin || c.isFinanceiro || ["comum", "administradoras", "diretora"].includes(c.role as string),
  },
  {
    to: "/gestao-vidas",
    label: "Gestão de Vidas",
    description: "Histórico analítico de vidas",
    icon: Activity,
    show: (c) => c.isAdmin || ["diretora", "comum", "administradoras"].includes(c.role as string),
  },
  {
    to: "/vidas-operadora",
    label: "Vidas na Operadora",
    description: "Conciliação com a operadora",
    icon: Activity,
    show: (c) =>
      c.isAdmin || ["diretora", "comum", "administradoras", "vendas"].includes(c.role as string),
  },
];

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
    groupKey: "empresas",
    label: "Empresas",
    description: "Cadastro, movimentações, implantação e vidas",
    icon: Building2,
    group: "funcoes",
    show: () => true,
    children: EMPRESAS_CHILDREN,
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
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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

  const visible = useMemo(() => {
    return SHORTCUTS.filter((s) => s.show(ctx)).map((s) => {
      if (isGroup(s)) {
        return { ...s, children: s.children.filter((c) => c.show(ctx)) };
      }
      return s;
    });
  }, [ctx]);

  const activeGroup = useMemo(
    () => (openGroup ? (visible.find((s) => isGroup(s) && s.groupKey === openGroup) as GroupShortcut | undefined) : null),
    [visible, openGroup],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (activeGroup) {
      const items = activeGroup.children;
      if (!q) return items;
      return items.filter(
        (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
      );
    }
    if (q) {
      // search across everything (groups + leaves + children)
      const flat: LeafShortcut[] = [];
      visible.forEach((s) => {
        if (isGroup(s)) flat.push(...s.children);
        else flat.push(s);
      });
      return flat.filter(
        (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
      );
    }
    return visible.filter((s) => s.group === tab);
  }, [visible, query, tab, activeGroup]);

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

  const greetingName = (profile?.display_name || user?.email?.split("@")[0] || "").split(" ")[0];
  const greetingDisplay = greetingName
    ? greetingName.charAt(0).toUpperCase() + greetingName.slice(1)
    : "";

  const renderCard = (s: LeafShortcut | (GroupShortcut & { group?: string }), opts?: { asGroup?: boolean }) => {
    const Icon = s.icon;
    const inner = (
      <Card className="p-4 flex items-start gap-3 rounded-xl border-border/60 bg-card hover:bg-accent/40 hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md h-full">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/15 group-hover:bg-primary/15 transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{s.label}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">{s.description}</div>
        </div>
      </Card>
    );
    if (opts?.asGroup) {
      const g = s as GroupShortcut;
      return (
        <button
          key={g.groupKey}
          onClick={() => setOpenGroup(g.groupKey)}
          className="group text-left"
        >
          {inner}
        </button>
      );
    }
    const leaf = s as LeafShortcut;
    return (
      <Link key={leaf.to} to={leaf.to} className="group">
        {inner}
      </Link>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 py-10 md:py-16">
      <div className="w-full max-w-5xl flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Bem-vindo{greetingDisplay ? `, ${greetingDisplay}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">Acesse rapidamente os módulos do CS Control</p>
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

        {/* Group header */}
        {activeGroup && !query && (
          <div className="w-full flex items-center justify-between gap-3 max-w-2xl">
            <Button variant="ghost" size="sm" onClick={() => setOpenGroup(null)} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="text-sm font-medium text-foreground">{activeGroup.label}</div>
            <div className="w-[72px]" />
          </div>
        )}

        {/* Tabs */}
        {!query && !activeGroup && (
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
            filtered.map((s: any) =>
              isGroup(s) ? renderCard(s, { asGroup: true }) : renderCard(s),
            )
          )}
        </div>
      </div>
    </div>
  );
}
