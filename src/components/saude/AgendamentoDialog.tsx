import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaudeMutations, type SaudeAgendamento, type SaudeCategoria } from "@/hooks/useSaude";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AgendamentoDialog({
  open,
  onOpenChange,
  agendamento,
  categoria,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agendamento?: SaudeAgendamento | null;
  categoria: SaudeCategoria;
}) {
  const { upsertAgendamento } = useSaudeMutations();
  const [form, setForm] = useState({
    empresa_id: "",
    data: new Date().toISOString().slice(0, 10),
    hora_inicio: "08:00",
    hora_fim: "10:00",
    tipo_palestra: "",
    endereco_empresa: "",
    observacao: "",
    status: "agendado",
  });

  useEffect(() => {
    if (agendamento) {
      setForm({
        empresa_id: agendamento.empresa_id,
        data: agendamento.data,
        hora_inicio: agendamento.hora_inicio,
        hora_fim: agendamento.hora_fim,
        tipo_palestra: agendamento.tipo_palestra ?? "",
        endereco_empresa: agendamento.endereco_empresa ?? "",
        observacao: agendamento.observacao ?? "",
        status: agendamento.status ?? "agendado",
      });
    } else {
      setForm((f) => ({ ...f, empresa_id: "", tipo_palestra: "", observacao: "", endereco_empresa: "" }));
    }
  }, [agendamento, open]);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-options-saude"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome,codigo_contrato,endereco")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const save = async () => {
    if (!form.empresa_id) return;
    await upsertAgendamento.mutateAsync({
      ...(agendamento ? { id: agendamento.id } : {}),
      empresa_id: form.empresa_id,
      data: form.data,
      hora_inicio: form.hora_inicio,
      hora_fim: form.hora_fim,
      tipo_palestra: form.tipo_palestra || (categoria === "palestra" ? "Palestra" : "Ação Preventiva"),
      categoria,
      endereco_empresa: form.endereco_empresa || null,
      observacao: form.observacao || null,
      status: form.status,
    });
    onOpenChange(false);
  };

  const titulo = categoria === "palestra" ? "Palestra" : "Ação Preventiva";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{agendamento ? `Editar ${titulo}` : `Nova ${titulo}`}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Empresa</Label>
            <Select value={form.empresa_id} onValueChange={(v) => {
              const e = empresas.find((x) => x.id === v);
              setForm((f) => ({ ...f, empresa_id: v, endereco_empresa: f.endereco_empresa || e?.endereco || "" }));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} {e.codigo_contrato ? `(${e.codigo_contrato})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Tema / Tipo</Label>
            <Input
              placeholder={categoria === "palestra" ? "Ex: Saúde da Mulher" : "Ex: Vacinação H1N1"}
              value={form.tipo_palestra}
              onChange={(e) => setForm({ ...form, tipo_palestra: e.target.value })}
            />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.endereco_empresa} onChange={(e) => setForm({ ...form, endereco_empresa: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!form.empresa_id || upsertAgendamento.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
