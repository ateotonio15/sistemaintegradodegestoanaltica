import { CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotificacoesCirurgia } from "@/hooks/useNotificacoesCirurgia";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function CirurgiaCardBadge({ demandas = false }: { demandas?: boolean }) {
  const { user, role } = useAuth();
  const { enabled, avisos } = useNotificacoesCirurgia();
  const { data: abertas = 0 } = useQuery({ queryKey: ["demandas-abertas-card", user?.id, role], enabled: enabled && demandas,
    queryFn: async () => {
      const { count, error } = await supabase.from("demandas").select("id", { head: true, count: "exact" }).eq("resolvido_setor",false).eq("resolvido_executiva",false);
      if (error) throw error;
      return count ?? 0;
    }, refetchInterval: 60000,
  });
  if (!enabled) return null;
  const novos = new Set(avisos.map(n => n.demanda_id)).size;
  return <span className="flex shrink-0 items-center gap-1">
    {demandas && <Badge variant="secondary" title={`${abertas} demandas pendentes`}>{abertas}</Badge>}
    {novos > 0 && <Tooltip><TooltipTrigger asChild><Badge className="gap-1 bg-success text-success-foreground hover:bg-success"><CalendarCheck className="h-3 w-3 motion-safe:animate-pulse" />{novos}</Badge></TooltipTrigger><TooltipContent>{novos} reclamações com novo agendamento</TooltipContent></Tooltip>}
  </span>;
}