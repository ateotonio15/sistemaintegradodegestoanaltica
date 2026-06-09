import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

export function AlertaRetroativosParaCobrar() {
  const { isFinanceiro, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["reajustes-retroativo-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reajustes_anuais")
        .select("id,empresa_id")
        .eq("status_reajuste", "liberado_financeiro");
      return (data || []) as Array<{ id: string; empresa_id: string }>;
    },
    enabled: isFinanceiro || isAdmin,
  });

  useEffect(() => {
    const ch = supabase
      .channel("retroativos-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "reajustes_anuais" }, () => {
        qc.invalidateQueries({ queryKey: ["reajustes-retroativo-list"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const count = rows.length;
  if (!(isFinanceiro || isAdmin) || !count) return null;

  const to = count === 1
    ? `/reajustes?empresa=${rows[0].empresa_id}`
    : `/reajustes?fluxo=liberado_financeiro`;

  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 mb-4 hover:bg-purple-500/15 transition-colors">
      <Bell className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold text-purple-700 dark:text-purple-300">Retroativos para cobrança</span>
        <span className="text-muted-foreground ml-2">— {count} {count === 1 ? "reajuste liberado" : "reajustes liberados"} pela Diretoria</span>
      </div>
      <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">Aplicar →</span>
    </Link>
  );
}
