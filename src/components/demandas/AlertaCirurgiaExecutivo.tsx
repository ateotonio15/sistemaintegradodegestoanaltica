import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { destinoCirurgia } from "@/lib/cirurgia-notificacao";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Aviso = { id: string; demanda_id: string; data_cirurgia: string; nome_paciente: string; nome_medico: string; empresa: string | null };

const fmt = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };

/** Aviso fixo na tela principal: só some quando o executivo registra a observação de lido. */
export function AlertaCirurgiaExecutivo() {
  const { user, role } = useAuth();
  const enabled = !!user && ["executivo", "executivo_externo", "admin"].includes(role ?? "");
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<Aviso | null>(null);
  const [obs, setObs] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["avisos-cirurgia-executivo", user?.id], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("avisos_cirurgia_pendentes_executivo");
      if (error) throw error;
      return (data ?? []) as Aviso[];
    }, refetchInterval: 60000, refetchOnWindowFocus: true,
  });
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("registrar_ciencia_cirurgia", { _notificacao_id: aberto!.id, _observacao: obs });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aviso marcado como lido"); setAberto(null); setObs(""); qc.invalidateQueries({ queryKey: ["avisos-cirurgia-executivo"] }); qc.invalidateQueries({ queryKey: ["avisos-cirurgia"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!enabled || data.length === 0) return null;
  return (
    <div className="w-full max-w-5xl mx-auto mt-4 rounded-2xl border-2 border-primary/60 bg-card shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-primary" /></span>
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-foreground">Cirurgia agendada — {data.length} {data.length === 1 ? "aviso pendente" : "avisos pendentes"}</h2>
      </div>
      <ul className="divide-y divide-border">
        {data.map(a => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-[220px]">
              <p className="font-medium text-foreground">{a.nome_paciente}</p>
              <p className="text-sm text-muted-foreground">{a.empresa ?? "—"}{a.nome_medico ? ` • Dr(a). ${a.nome_medico}` : ""}</p>
            </div>
            <span className="text-primary font-semibold">{fmt(a.data_cirurgia)}</span>
            <Button asChild variant="outline" size="sm"><Link to={destinoCirurgia(a.demanda_id)}>Ver reclamação</Link></Button>
            <Button size="sm" onClick={() => { setAberto(a); setObs(""); }}><CheckCircle2 className="h-4 w-4 mr-1" />Marcar como lido</Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!aberto} onOpenChange={o => !o && setAberto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como lido</DialogTitle>
            <DialogDescription>{aberto?.nome_paciente} — cirurgia em {aberto ? fmt(aberto.data_cirurgia) : ""}. Escreva uma observação para encerrar o aviso.</DialogDescription>
          </DialogHeader>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: Ciente, paciente e RH avisados." maxLength={1000} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(null)}>Cancelar</Button>
            <Button disabled={obs.trim().length < 3 || salvar.isPending} onClick={() => salvar.mutate()}>Confirmar leitura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
