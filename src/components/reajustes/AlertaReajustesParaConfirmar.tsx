import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

export function AlertaReajustesParaConfirmar() {
  const { user, isComum, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["alertas-reajuste-count", user?.id, isComum, isAdmin],
    queryFn: async () => {
      if (!user?.id) return 0;
      let q = supabase
        .from("alertas_reajuste")
        .select("id", { count: "exact", head: true })
        .eq("status", "Pendente");
      if (isComum) q = q.eq("destinatario_user_id", user.id);
      else if (!isAdmin) return 0;
      const { count: c } = await q;
      return c || 0;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const ch = supabase
      .channel("alertas-reajuste-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_reajuste" }, () => {
        qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (!count) return null;

  return (
    <Link
      to="/reajustes"
      className="flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 mb-4 hover:bg-yellow-500/15 transition-colors"
    >
      <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold text-yellow-700 dark:text-yellow-300">
          Reajustes aguardando análise/liberação
        </span>
        <span className="text-muted-foreground ml-2">
          — {count} {count === 1 ? "pendência" : "pendências"} na aba Reajuste
        </span>
      </div>
      <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Ver detalhes →</span>
    </Link>
  );
}
