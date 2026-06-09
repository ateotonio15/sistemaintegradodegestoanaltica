import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

export function AlertaReajustesParaConfirmar() {
  const { user, isDiretora, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["alertas-reajuste-list", user?.id, isDiretora, isAdmin],
    queryFn: async () => {
      if (!user?.id) return [] as Array<{ reajuste_id: string | null; empresa_id: string | null }>;
      if (!isDiretora && !isAdmin) return [];
      const { data } = await supabase
        .from("alertas_reajuste")
        .select("reajuste_id,empresa_id")
        .eq("status", "Pendente")
        .eq("destinatario_role", "diretora");
      return (data || []) as Array<{ reajuste_id: string | null; empresa_id: string | null }>;
    },
    enabled: !!user?.id,
  });
  const count = rows.length;

  useEffect(() => {
    const ch = supabase
      .channel("alertas-reajuste-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_reajuste" }, () => {
        qc.invalidateQueries({ queryKey: ["alertas-reajuste-list"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (!count) return null;

  const first = rows[0];
  const to = count === 1 && first?.empresa_id
    ? `/reajustes?empresa=${first.empresa_id}`
    : "/reajustes";

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 mb-4 hover:bg-yellow-500/15 transition-colors"
    >
      <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold text-yellow-700 dark:text-yellow-300">
          Reajustes rejeitados para correção
        </span>
        <span className="text-muted-foreground ml-2">
          — {count} {count === 1 ? "pendência" : "pendências"} para a Diretoria revisar
        </span>
      </div>
      <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Ver detalhes →</span>
    </Link>
  );
}
