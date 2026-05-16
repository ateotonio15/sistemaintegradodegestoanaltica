import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, Activity } from "lucide-react";

interface WelcomeHeroProps {
  totalAtivas: number;
  totalNoPeriodo: number;
  pendentes: number;
  concluidas: number;
}

export function WelcomeHero({ totalAtivas, totalNoPeriodo, pendentes, concluidas }: WelcomeHeroProps) {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["user-profile-hero", user?.id],
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

  const { greeting, firstName, dateStr } = useMemo(() => {
    const h = new Date().getHours();
    const g = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const name = (profile?.display_name || user?.email || "").split(" ")[0] || "Usuário";
    const date = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    return { greeting: g, firstName: name, dateStr: date.charAt(0).toUpperCase() + date.slice(1) };
  }, [profile, user]);

  const taxa = totalNoPeriodo > 0 ? Math.round((concluidas / totalNoPeriodo) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 surface-premium animate-fade-in">
      {/* Decorative orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(160 60% 45% / 0.4), transparent 70%)" }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 p-6 md:p-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/20">
            <Sparkles className="h-3 w-3" />
            CS Control · Painel Executivo
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {greeting}, <span className="text-gradient">{firstName}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">{dateStr}</p>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Aqui está o resumo operacional do seu período. Mantenha o ritmo — sua taxa de conclusão atual é{" "}
            <span className="font-semibold text-foreground">{taxa}%</span>.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Ativas" value={totalAtivas} tone="primary" />
          <MiniStat label="No período" value={totalNoPeriodo} tone="info" />
          <MiniStat label="Concluídas" value={concluidas} tone="success" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* Bottom progress strip */}
      <div className="relative h-1 w-full bg-muted/40">
        <div
          className="h-full bg-gradient-primary transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(2, taxa))}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "primary" | "info" | "success";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary bg-primary/10 ring-primary/20"
      : tone === "info"
        ? "text-info bg-info/10 ring-info/20"
        : "text-success bg-success/10 ring-success/20";
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3.5 flex flex-col justify-between min-h-[88px]">
      <div className={`inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${toneClass}`}>
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground mt-1">{value}</div>
    </div>
  );
}
