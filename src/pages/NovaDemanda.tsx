import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DemandaFormDialog from "@/components/demandas/DemandaFormDialog";
import type { Demanda } from "@/lib/demandas-utils";

type NavState = {
  initial?: Partial<Demanda>;
  plantao_id?: string;
  empresa_id?: string;
  returnTo?: string;
};

export default function NovaDemanda() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as NavState;
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-display", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const initialValues = useMemo<Partial<Demanda>>(() => {
    const base: Partial<Demanda> = {
      data_reclamacao: format(new Date(), "yyyy-MM-dd"),
      tipo_reclamacao: "Reclamação",
    };
    if (profile?.display_name && !state.initial?.executiva) {
      base.executiva = profile.display_name;
    }
    return { ...base, ...(state.initial || {}) };
  }, [state.initial, profile?.display_name]);

  const [open, setOpen] = useState(true);

  // Quando fecha o dialog, volta para a origem
  useEffect(() => {
    if (!open) {
      navigate(state.returnTo || "/demandas", { replace: true });
    }
  }, [open]);

  const plantaoContext = state.plantao_id
    ? { plantao_id: state.plantao_id, empresa_id: state.empresa_id }
    : null;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto">
      <DemandaFormDialog
        open={open}
        onOpenChange={setOpen}
        initialValues={initialValues}
        plantaoContext={plantaoContext}
      />
    </div>
  );
}
