import { AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export function AlertaReajustesPendentes() {
  const ano = new Date().getFullYear();
  const { data: count = 0 } = useQuery({
    queryKey: ["reajustes-pendentes-count", ano],
    queryFn: async () => {
      const { data: empresas } = await supabase
        .from("empresas")
        .select("id")
        .eq("status_empresa", "Ativa");
      const { data: reaj } = await supabase
        .from("reajustes_anuais")
        .select("empresa_id")
        .eq("ano", ano);
      const reajSet = new Set((reaj || []).map((r: any) => r.empresa_id));
      return (empresas || []).filter((e: any) => !reajSet.has(e.id)).length;
    },
    refetchInterval: 60000,
  });

  if (count === 0) return null;

  return (
    <Link
      to="/reajustes"
      className="flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 mb-4 hover:bg-yellow-500/15 transition-colors"
    >
      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-semibold text-yellow-700 dark:text-yellow-300">
          {count} {count === 1 ? "contrato pendente" : "contratos pendentes"} de reajuste anual
        </span>
        <span className="text-muted-foreground ml-2">— ano {ano}</span>
      </div>
      <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Ver detalhes →</span>
    </Link>
  );
}
