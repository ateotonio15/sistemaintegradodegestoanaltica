import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ColetaDetalheSheet } from "./ColetaDetalheSheet";
import type { ColetaAgendamento } from "../hooks/useColeta";
import type { AcaoPreventiva } from "../hooks/useAcoesPreventivas";

const sb = supabase as any;
const SELECT = "*, empresa:empresas(id,nome,email_empresa), inscricoes:coleta_inscricoes(status)";

/** Vincula o agendamento de Coleta de Preventivo ao link público de inscrição (coleta_agendamentos). */
export function PreventivaColetaVinculo({ acao }: { acao: AcaoPreventiva }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = ["coleta_por_preventiva", acao.id];

  const { data: ag } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await sb.from("coleta_agendamentos").select(SELECT).eq("acao_preventiva_id", acao.id).maybeSingle();
      if (error) throw error;
      return (data ?? null) as ColetaAgendamento | null;
    },
  });

  const abrir = async () => {
    if (ag) { setOpen(true); return; }
    setBusy(true);
    const a: any = acao;
    const { error } = await sb.from("coleta_agendamentos").insert({
      acao_preventiva_id: acao.id,
      empresa_id: a.empresa_id,
      data: a.data,
      horario_inicio: a.horario_inicio ?? null,
      horario_fim: a.horario_fim ?? null,
      responsavel: a.responsavel ?? a.executiva_nome ?? null,
      local: a.endereco ?? null,
      observacoes: a.observacao ?? null,
      status: a.status === "concluido" ? "concluida" : a.status === "cancelado" ? "cancelada" : a.status === "a_confirmar" ? "pendente" : "agendada",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["coleta_agendamentos"] });
    setOpen(true);
  };

  const total = ag?.inscricoes?.length ?? 0;
  const realizadas = ag?.inscricoes?.filter((i) => i.status === "realizada").length ?? 0;

  return (
    <div className="rounded-lg border p-3 flex items-center justify-between gap-2 flex-wrap">
      <div className="text-sm">
        <div className="font-medium flex items-center gap-1.5"><Users className="h-4 w-4" /> Inscrições da coleta</div>
        <div className="text-xs text-muted-foreground">
          {ag ? `${total} inscrita(s) · ${realizadas} coleta(s) realizada(s)` : "Gere o link de inscrição e o QR Code para esta ação."}
        </div>
      </div>
      <Button size="sm" onClick={abrir} disabled={busy}>
        <Link2 className="h-4 w-4 mr-1" />{ag ? "Abrir inscrições / link" : "Gerar link de inscrição"}
      </Button>
      {open && ag && <ColetaDetalheSheet ag={ag} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: key }); }} onEdit={() => {}} />}
    </div>
  );
}
