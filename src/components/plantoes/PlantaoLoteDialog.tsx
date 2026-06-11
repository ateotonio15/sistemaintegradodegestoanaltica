import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const sb = supabase as any;

export function PlantaoLoteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_select_plantao"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("empresas")
        .select("id,nome,codigo_contrato")
        .eq("status_empresa", "Ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const [empresaId, setEmpresaId] = useState("");
  const [executiva, setExecutiva] = useState("");
  const [data, setData] = useState(today);
  const [tipo, setTipo] = useState("presencial");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile_me_lote", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data } = await sb.from("profiles").select("display_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (open && !executiva && profile?.display_name) setExecutiva(profile.display_name);
  }, [open, profile, executiva]);

  useEffect(() => {
    if (!open) {
      setEmpresaId(""); setExecutiva(""); setData(today); setTipo("presencial"); setObservacao("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!empresaId || !executiva || !data) return;
    setSaving(true);
    try {
      const payload = {
        empresa_id: empresaId,
        data,
        turno: tipo,
        plantonista: executiva,
        observacao: observacao || null,
      };
      const { data: inserted, error } = await sb.from("plantoes").insert(payload).select("id").single();
      if (error) throw error;
      toast.success("Plantão criado");
      onOpenChange(false);
      navigate(`/plantoes/${inserted.id}/atendimentos`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar plantão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo lote de plantão</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
              <SelectContent>
                {empresas.filter((e) => e.ativo).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Executiva responsável *</Label>
            <Input value={executiva} onChange={(e) => setExecutiva(e.target.value)} placeholder="Nome da executiva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do plantão *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!empresaId || !executiva || !data || saving} onClick={handleSubmit}>
            {saving ? "Criando..." : "Criar e registrar atendimentos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
