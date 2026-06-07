import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

export function AlertaReajustesParaAprovar() {
  const { isDiretora, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["reajustes-aprovar-count"],
    queryFn: async () => {
      const { count: c } = await supabase
        .from("reajustes_anuais")
        .select("id", { count: "exact", head: true })
        .eq("status_reajuste", "aguardando_aprovacao");
      return c || 0;
    },
    enabled: isDiretora || isAdmin,
  });

  useEffect(() => {
    const ch = supabase
      .channel("reajustes-aprovar-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "reajustes_anuais" }, () => {
        qc.invalidateQueries({ queryKey: ["reajustes-aprovar-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (!(isDiretora || isAdmin) || !count) return null;

  return (
    <Link to="/reajustes" className="flex items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 mb-4 hover:bg-orange-500/15 transition-colors">
      <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold text-orange-700 dark:text-orange-300">Reajustes aguardando aprovação</span>
        <span className="text-muted-foreground ml-2">— {count} {count === 1 ? "pedido" : "pedidos"} para análise da Diretoria</span>
      </div>
      <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">Analisar →</span>
    </Link>
  );
}
