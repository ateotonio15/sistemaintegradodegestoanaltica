import { AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { getMesReajuste } from "@/lib/reajuste-utils";

export function AlertaReajustesPendentes() {
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const { data } = useQuery({
    queryKey: ["reajustes-pendentes-count", ano, mesAtual],
    queryFn: async () => {
      const { data: empresas } = await supabase
        .from("empresas")
        .select("id,data_implantacao")
        .eq("status_empresa", "Ativa");
      const { data: reaj } = await supabase
        .from("reajustes_anuais")
        .select("empresa_id,meses_retroativos,status_reajuste")
        .eq("ano", ano);

      const reajByEmp: Record<string, any> = {};
      for (const r of reaj || []) reajByEmp[(r as any).empresa_id] = r;

      let pendentes = 0;
      let retroPendentes = 0;
      for (const e of empresas || []) {
        const mesReaj = getMesReajuste((e as any).data_implantacao);
        const r = reajByEmp[(e as any).id];
        if (!r) {
          // Pendente apenas quando já passou (ou está no) mês oficial
          if (mesReaj && mesAtual >= mesReaj) pendentes++;
        } else if ((r.meses_retroativos || 0) > 0 && r.status_reajuste !== "retroativo_aplicado" && r.status_reajuste !== "liberado") {
          retroPendentes++;
        }
      }
      return { pendentes, retroPendentes };
    },
    refetchInterval: 60000,
  });

  const pendentes = data?.pendentes || 0;
  const retro = data?.retroPendentes || 0;
  if (pendentes === 0 && retro === 0) return null;

  return (
    <Link
      to="/reajustes"
      className="flex items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 mb-4 hover:bg-yellow-500/15 transition-colors"
    >
      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <div className="flex-1 text-sm">
        {pendentes > 0 && (
          <span className="font-semibold text-yellow-700 dark:text-yellow-300">
            {pendentes} {pendentes === 1 ? "contrato pendente" : "contratos pendentes"} de reajuste anual
          </span>
        )}
        {retro > 0 && (
          <span className="ml-3 font-semibold text-orange-700 dark:text-orange-300">
            {retro} retroativo{retro === 1 ? "" : "s"} pendente{retro === 1 ? "" : "s"} de liberação
          </span>
        )}
        <span className="text-muted-foreground ml-2">— ano {ano}</span>
      </div>
      <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Ver detalhes →</span>
    </Link>
  );
}
