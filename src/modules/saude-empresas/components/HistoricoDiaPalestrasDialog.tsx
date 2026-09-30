import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, CalendarCheck, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Palestra } from "../hooks/usePalestras";

const STATUS_LABEL: Record<string, string> = {
  a_confirmar: "A confirmar", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado",
};

interface HistRow {
  id: string; palestra_id: string; acao: string; dados: any; usuario_nome: string | null; created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dia: Date | null;
  palestras: Palestra[];
  podeCriar: boolean;
  onNova: () => void;
  onAbrir: (p: Palestra) => void;
}

const hora = (h?: string | null) => (h ? h.slice(0, 5) : "--:--");
const dt = (s: string) => format(new Date(s), "dd/MM/yyyy HH:mm");

export function HistoricoDiaPalestrasDialog({ open, onOpenChange, dia, palestras, podeCriar, onNova, onAbrir }: Props) {
  const iso = dia ? format(dia, "yyyy-MM-dd") : "";
  const { data: hist = [], isLoading } = useQuery({
    queryKey: ["palestras-historico", iso],
    enabled: open && !!iso,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("palestras_saude_historico")
        .select("*")
        .eq("data", iso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistRow[];
    },
  });

  const doDia = palestras
    .filter((p) => p.data === iso)
    .sort((a, b) => (a.horario_inicio ?? "").localeCompare(b.horario_inicio ?? ""));
  const agendadas = doDia.filter((p) => p.status !== "cancelado");
  const canceladas = doDia.filter((p) => p.status === "cancelado");
  const excluidas = hist.filter((h) => h.acao === "excluida");

  const Card = ({ p, children }: { p: any; children?: React.ReactNode }) => (
    <div className="rounded-md border p-3 text-sm space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{hora(p.horario_inicio)} – {hora(p.horario_fim)}</span>
        <Badge variant="outline">{STATUS_LABEL[p.status] ?? p.status}</Badge>
      </div>
      <div className="font-semibold">{p.empresa}</div>
      <div className="text-xs text-muted-foreground">{p.executiva}{p.tema ? ` · ${p.tema}` : ""}</div>
      {p.motivo_cancelamento && <div className="text-xs text-destructive">Motivo: {p.motivo_cancelamento}</div>}
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {dia ? format(dia, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
          </DialogTitle>
        </DialogHeader>

        {podeCriar && (
          <Button onClick={onNova} className="w-fit"><Plus className="h-4 w-4 mr-1" /> Nova palestra neste dia</Button>
        )}

        <Tabs defaultValue="agendadas">
          <TabsList>
            <TabsTrigger value="agendadas"><CalendarCheck className="h-4 w-4 mr-1" /> Agendadas ({agendadas.length})</TabsTrigger>
            <TabsTrigger value="canceladas"><Ban className="h-4 w-4 mr-1" /> Canceladas ({canceladas.length})</TabsTrigger>
            <TabsTrigger value="excluidas"><Trash2 className="h-4 w-4 mr-1" /> Excluídas ({excluidas.length})</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({hist.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="agendadas" className="space-y-2">
            {agendadas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma palestra agendada.</p>}
            {agendadas.map((p) => (
              <button key={p.id} className="block w-full text-left hover:opacity-80" onClick={() => onAbrir(p)}>
                <Card p={p} />
              </button>
            ))}
          </TabsContent>

          <TabsContent value="canceladas" className="space-y-2">
            {canceladas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma palestra cancelada.</p>}
            {canceladas.map((p) => (
              <button key={p.id} className="block w-full text-left hover:opacity-80" onClick={() => onAbrir(p)}>
                <Card p={p} />
              </button>
            ))}
          </TabsContent>

          <TabsContent value="excluidas" className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && excluidas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma palestra excluída.</p>}
            {excluidas.map((h) => (
              <Card key={h.id} p={h.dados}>
                <div className="text-xs text-muted-foreground">Excluída em {dt(h.created_at)}{h.usuario_nome ? ` por ${h.usuario_nome}` : ""}</div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="historico" className="space-y-2">
            {!isLoading && hist.length === 0 && <p className="text-sm text-muted-foreground">Sem registros ainda. O histórico começa a partir de agora.</p>}
            {hist.map((h) => {
              const p = h.acao === "editada" ? h.dados?.depois : h.dados;
              const antes = h.acao === "editada" ? h.dados?.antes : null;
              return (
                <div key={h.id} className="rounded-md border p-2 text-xs flex flex-wrap gap-x-2">
                  <Badge variant={h.acao === "excluida" ? "destructive" : "secondary"} className="capitalize">{h.acao}</Badge>
                  <span className="font-medium">{p?.empresa}</span>
                  <span className="text-muted-foreground">{hora(p?.horario_inicio)}</span>
                  {antes && antes.status !== p?.status && (
                    <span>status: {STATUS_LABEL[antes.status]} → {STATUS_LABEL[p.status]}</span>
                  )}
                  <span className="text-muted-foreground ml-auto">{dt(h.created_at)}{h.usuario_nome ? ` · ${h.usuario_nome}` : ""}</span>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
