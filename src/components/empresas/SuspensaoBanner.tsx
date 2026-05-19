import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ban } from "lucide-react";

export function SuspensaoBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: suspensas = [] } = useQuery({
    queryKey: ["empresas-suspensas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, motivo_suspensao, data_suspensao")
        .eq("contrato_suspenso", true)
        .order("data_suspensao", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (suspensas.length === 0) return null;

  const first = suspensas[0];
  const more = suspensas.length - 1;

  return (
    <button
      onClick={() => navigate("/empresas")}
      className="w-full text-left rounded-xl border border-muted-foreground/30 bg-muted/60 hover:bg-muted transition-colors p-3 flex items-center gap-3"
    >
      <div className="h-9 w-9 rounded-lg bg-muted-foreground/20 flex items-center justify-center shrink-0">
        <Ban className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          ⛔ Contrato suspenso: {first.nome}
          {more > 0 && (
            <span className="ml-1 text-muted-foreground font-normal">
              (+{more} {more === 1 ? "outra" : "outras"})
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Motivo: {first.motivo_suspensao || "—"}
        </p>
      </div>
    </button>
  );
}
