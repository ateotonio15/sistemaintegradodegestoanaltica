import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

export function AlertaReajustesParaAprovar() {
  const { isComum, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["reajustes-aprovar-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reajustes_anuais")
        .select("id,empresa_id")
        .eq("status_reajuste", "aguardando_aprovacao");
      return (data || []) as Array<{ id: string; empresa_id: string }>;
    },
    enabled: isComum || isAdmin,
  });

  useEffect(() => {
    const ch = supabase
      .channel("reajustes-aprovar-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "reajustes_anuais" }, () => {
        qc.invalidateQueries({ queryKey: ["reajustes-aprovar-list"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const count = rows.length;
  if (!(isComum || isAdmin) || !count) return null;

  const to = count === 1
    ? `/reajustes?empresa=${rows[0].empresa_id}`
    : `/reajustes?fluxo=aguardando_aprovacao`;

  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 mb-4 hover:bg-orange-500/15 transition-colors">
      <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold text-orange-700 dark:text-orange-300">Reajustes aguardando aprovação</span>
        <span className="text-muted-foreground ml-2">— {count} {count === 1 ? "pedido" : "pedidos"} para análise do Cadastro</span>
      </div>
      <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">Analisar →</span>
    </Link>
  );
}
