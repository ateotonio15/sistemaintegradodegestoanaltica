import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ban } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/date-utils";

export function SuspensaoBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: suspensas = [] } = useQuery({
    queryKey: ["empresas-suspensas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, motivo_suspensao, data_suspensao, status_empresa, data_rescisao")
        .eq("contrato_suspenso", true)
        .order("data_suspensao", { ascending: false });
      if (error) throw error;
      // Contratos cancelados (com rescisão ou inativos) saem da lista de suspensos
      return (data ?? []).filter((e) => !e.data_rescisao && e.status_empresa !== "Inativa");
    },
    enabled: !!user,
  });

  if (suspensas.length === 0) return null;

  const label =
    suspensas.length === 1
      ? `⛔ Contrato suspenso: ${suspensas[0].nome}`
      : `⛔ ${suspensas.length} contratos suspensos`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex max-w-full items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/15 transition-colors">
          <Ban className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label.replace("⛔ ", "")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contratos suspensos
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {suspensas.map((s) => (
            <div key={s.id} className="p-3 space-y-0.5 text-sm">
              <p className="font-medium">{s.nome}</p>
              <p className="text-xs text-muted-foreground">Contrato {s.codigo_contrato || "—"}</p>
              <p className="text-xs text-muted-foreground">Suspenso desde: {formatDateBR(s.data_suspensao)}</p>
              <p className="text-xs text-muted-foreground">Motivo: {s.motivo_suspensao || "—"}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-7 text-xs"
                onClick={() => navigate(`/empresas?ver=${s.id}`)}
              >
                Ver empresa
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
