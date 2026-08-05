import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
  MessageSquareWarning,
  KeyRound,
  Phone,
  CalendarDays,
  Car,
  Stethoscope,
  Mic,
  ShieldPlus,
  Gift,
  BarChart3,
  Sparkles,
  type LucideIcon,
  Star,
} from "lucide-react";

type InteligenciaItem = {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Rota real (opcional). Quando ausente, usa /inteligencia/:slug (placeholder "Em construção"). */
  to?: string;
};

type InteligenciaSection = {
  title: string;
  description: string;
  icon: LucideIcon;
  items: InteligenciaItem[];
};

const INTELIGENCIA_SECTIONS: InteligenciaSection[] = [
  {
    title: "Demandas",
    description: "Reclamações e demandas com SLA",
    icon: MessageSquareWarning,
    items: [
      {
        slug: "registro-reclamacoes",
        label: "Registro de Reclamações",
        description: "Abertura e acompanhamento de demandas com SLA",
        icon: MessageSquareWarning,
        to: "/demandas",
      },
      {
        slug: "dashboard-reclamacoes",
        label: "Dashboard Executivo",
        description: "KPIs, SLA, backlog e insights de reclamações",
        icon: MessageSquareWarning,
        to: "/demandas/dashboard",
      },
    ],
  },
  {
    title: "Plantões",
    description: "Atendimentos e escala 24h",
    icon: Phone,
    items: [
      {
        slug: "plantoes-atendimentos",
        label: "Plantões de atendimentos",
        description: "Registro de atendimentos do plantão 24h",
        icon: Phone,
        to: "/plantoes",
      },
      {
        slug: "calendario-plantoes",
        label: "Calendário de plantões",
        description: "Escala visual de plantões por executiva",
        icon: CalendarDays,
        to: "/plantoes/calendario",
      },
    ],
  },
  {
    title: "Uber Corporativo",
    description: "Corridas e centro de custo",
    icon: Car,
    items: [
      {
        slug: "uber-corporativo",
        label: "Corridas Uber",
        description: "Lista, importação Excel e CRUD de corridas",
        icon: Car,
        to: "/uber",
      },
      {
        slug: "uber-dashboard",
        label: "Dashboard Uber",
        description: "KPIs, gastos por empresa e ranking de uso",
        icon: BarChart3,
        to: "/uber/dashboard",
      },
    ],
  },
  {
    title: "Saúde nas Empresas",
    description: "Ações, triagens e bioimpedância",
    icon: Stethoscope,
    items: [
      {
        slug: "saude-empresas",
        label: "Analise dos Dados",
        description: "Empresas, ações, triagens e fichas de bioimpedância",
        icon: Stethoscope,
        to: "/saude-empresas",
      },
      {
        slug: "saude-empresas-visao",
        label: "Visão Geral · Saúde",
        description: "KPIs e indicadores clínicos consolidados",
        icon: Mic,
        to: "/saude-empresas/visao-geral",
      },
      {
        slug: "saude-empresas-palestras",
        label: "Calendário de Palestras",
        description: "Agenda anual de palestras de saúde nas empresas",
        icon: CalendarDays,
        to: "/saude-empresas/palestras",
      },
      {
        slug: "saude-empresas-preventivas",
        label: "Calendário de Ações",
        description: "Sinais vitais, coleta de preventivo e PSA nas empresas",
        icon: ShieldPlus,
        to: "/saude-empresas/preventivas",
      },
      {
        slug: "saude-empresas-pesquisas",
        label: "Pesquisa de Satisfação",
        description: "Avaliação pós-palestra por QR Code e resultados",
        icon: Star,
        to: "/saude-empresas/pesquisas",
      },

    ],
  },
  {
    title: "Mailing de Brindes",
    description: "Cestas natalinas e brindes corporativos",
    icon: Gift,
    items: [
      {
        slug: "mailing-brindes",
        label: "Mailing de Brindes",
        description: "Cestas natalinas e brindes corporativos",
        icon: Gift,
        to: "/mailing-brindes",
      },
    ],
  },
];

type Ctx = {
  isAdmin: boolean;
  isExecutivo: boolean;
  isExecutivoExterno: boolean;
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
    label: "Contratos",
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
    to: "/implantacao",
    label: "Implantação",
    description: "Novos contratos e onboarding",
    icon: FileSignature,
    show: (c) =>
      c.isAdmin || ["comum", "administradoras", "visualizacao", "diretora"].includes(c.role as string),
  },
  {
    to: "/contratos-recem-implantados",
    label: "Primeira Vigencia",
    description: "Acompanhar primeiros fechamentos",
    icon: ClockAlert,
    show: (c) =>
      c.isAdmin || c.isFinanceiro || ["comum", "administradoras", "diretora"].includes(c.role as string),
  },
  {
    to: "/vidas",
    label: "Vidas",
    description: "Gestão e conciliação com a operadora",
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
    label: "Financeiro",
    description: "Painel de notas, prazos e cobranças",
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
    label: "Contratos",
    description: "Cadastro e gestão de contratos",
    icon: Building2,
    group: "funcoes",
    show: () => true,
  },
  {
    to: "/financeiro",
    label: "Faturamento",
    description: "Faturamento, análises e DDA",
    icon: Wallet,
    group: "funcoes",
    show: (c) =>
      c.isAdmin || c.isFinanceiro || c.role === "comum" || c.role === "administradoras" || c.role === "visualizacao",
  },
  {
    to: "/financeiro/painel-tv",
    label: "Painel TV Financeiro",
    description: "Monitoramento em tempo real do faturamento",
    icon: Activity,
    group: "utilitarios",
    show: (c) => c.isAdmin || c.isFinanceiro,
  },
  {
    to: "/reajustes",
    label: "Reajustes",
    description: "\n\n\n",
    icon: TrendingUp,
    group: "funcoes",
    show: (c) => !c.isExecutivoExterno,
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
  {
    to: "/admin/empresas-acesso",
    label: "Acessos das Empresas",
    description: "Usuários, senhas e visibilidade do portal",
    icon: KeyRound,
    group: "utilitarios",
    show: (c) => c.isAdmin,
  },
  {
    to: "/admin/fila-atendimento",
    label: "Fila de Atendimento",
    description: "Atendimentos recebidos das empresas por setor",
    icon: MessageSquareWarning,
    group: "utilitarios",
    show: () => true,
  },
];

export default function Home() {
  const { isAdmin, isExecutivo, isExecutivoExterno, isViewOnly, isEnfermeira, isFinanceiro, isVendas, role, user } = useAuth();
  const { data: canHonda } = useCanAccessHonda();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"funcoes" | "utilitarios">("funcoes");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openInteligencia, setOpenInteligencia] = useState<string | null>(null);

  const ctx: Ctx = {
    isAdmin,
    isExecutivo,
    isExecutivoExterno,
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
      <Card className="p-4 flex items-start gap-4 rounded-2xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-[0_10px_30px_-12px_hsl(var(--primary)/0.25)] transition-all duration-200 h-full min-h-[104px]">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{s.label}</div>
          <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">{s.description}</div>
        </div>
      </Card>
    );
    if (opts?.asGroup) {
      const g = s as GroupShortcut;
      return (
        <button
          key={g.groupKey}
          onClick={() => setOpenGroup(g.groupKey)}
          className="group text-left h-full w-full"
        >
          {inner}
        </button>
      );
    }
    const leaf = s as LeafShortcut;
    return (
      <Link key={leaf.to} to={leaf.to} className="group h-full block">
        {inner}
      </Link>
    );

  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 py-10 md:py-16">
      <div className="w-full max-w-5xl flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Bem-vindo{greetingDisplay ? (
              <>, <span className="text-primary">{greetingDisplay}</span></>
            ) : ""}!
          </h1>
          <p className="text-sm md:text-base text-muted-foreground font-medium">
            O que você deseja gerenciar hoje no SIGA?
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full max-w-2xl group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulo, função ou atalho..."
            className="h-14 pl-14 pr-6 rounded-2xl border-border/70 bg-card shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
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
          <div className="inline-flex items-center gap-1 p-1 bg-muted/60 rounded-xl">
            {(["funcoes", "utilitarios"] as const).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-6 md:px-8 py-2 text-sm rounded-lg transition-all",
                    active
                      ? "bg-card text-primary font-semibold shadow-sm border border-border/60"
                      : "text-muted-foreground hover:text-foreground font-medium",
                  )}
                >
                  {t === "funcoes" ? "Funções" : "Utilitários"}
                </button>
              );
            })}
          </div>
        )}

        {/* Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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


        {/* Inteligência de Relacionamento — oculto para Cadastro (Comum) e Financeiro */}
        {!query && !activeGroup && !isFinanceiro && role !== "comum" && (
          <div className="w-full flex flex-col gap-5 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Inteligência de Relacionamento
              </h2>
              <div className="flex-1 h-px bg-border/60" />
              {openInteligencia && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenInteligencia(null)}
                  className="gap-1 h-7 px-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </Button>
              )}
            </div>

            {(() => {
              const activeSection = openInteligencia
                ? INTELIGENCIA_SECTIONS.find((s) => s.title === openInteligencia)
                : null;

              if (activeSection) {
                return (
                  <div className="flex flex-col gap-3">
                    <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                      {activeSection.title}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {activeSection.items.filter((item) => {
                        if (!isExecutivoExterno) return true;
                        return ["/demandas", "/plantoes", "/mailing-brindes"].includes(item.to || "");
                      }).map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.slug}
                            to={item.to || `/inteligencia/${item.slug}`}
                            className="group"
                          >
                            <Card className="p-4 flex items-start gap-3 rounded-xl border-border/60 bg-card hover:bg-accent/40 hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md h-full">
                              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/15 group-hover:bg-primary/15 transition-colors">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">
                                  {item.label}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {item.description}
                                </div>
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {INTELIGENCIA_SECTIONS.filter((section) => {
                    if (!isExecutivoExterno) return true;
                    return ["Demandas", "Plantões", "Mailing de Brindes"].includes(section.title);
                  }).map((section) => {
                    const Icon = section.icon;
                    const visibleItems = isExecutivoExterno
                      ? section.items.filter((i) => ["/demandas", "/plantoes", "/mailing-brindes"].includes(i.to || ""))
                      : section.items;
                    const isGroup = visibleItems.length > 1;
                    const onlyItem = visibleItems[0];
                    if (!onlyItem) return null;

                    const cardInner = (
                      <Card className="p-4 flex items-start gap-3 rounded-xl border-border/60 bg-card hover:bg-accent/40 hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md h-full">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/15 group-hover:bg-primary/15 transition-colors">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold text-foreground truncate">
                              {isGroup ? section.title : onlyItem.label}
                            </div>
                            {isGroup && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                {visibleItems.length}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {isGroup ? section.description : onlyItem.description}
                          </div>
                        </div>
                      </Card>
                    );

                    if (isGroup) {
                      return (
                        <button
                          key={section.title}
                          onClick={() => setOpenInteligencia(section.title)}
                          className="group text-left"
                        >
                          {cardInner}
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={section.title}
                        to={onlyItem.to || `/inteligencia/${onlyItem.slug}`}
                        className="group"
                      >
                        {cardInner}
                      </Link>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
