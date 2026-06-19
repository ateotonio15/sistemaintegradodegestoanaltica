import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const db = supabase as any;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ConfigAvaliacoesDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await db.from("avaliacoes_config").select("*").limit(1).maybeSingle();
      setCfg(data || { envio_mensal_ativo: true, dia_envio: 1, dias_para_lembrete: 7, lembrete_ativo: true });
      setLoading(false);
    })();
  }, [open]);

  const salvar = async () => {
    if (!cfg) return;
    setSaving(true);
    const payload: any = {
      envio_mensal_ativo: cfg.envio_mensal_ativo,
      dia_envio: Math.max(1, Math.min(28, Number(cfg.dia_envio) || 1)),
      dias_para_lembrete: Math.max(1, Math.min(60, Number(cfg.dias_para_lembrete) || 7)),
      lembrete_ativo: cfg.lembrete_ativo,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (cfg.id) {
      ({ error } = await db.from("avaliacoes_config").update(payload).eq("id", cfg.id));
    } else {
      ({ error } = await db.from("avaliacoes_config").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Configuração salva");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações de envio</DialogTitle>
        </DialogHeader>
        {loading || !cfg ? (
          <div className="py-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Envio mensal automático</Label>
                <p className="text-xs text-muted-foreground">Gera 1 link por empresa elegível todo mês</p>
              </div>
              <Switch checked={cfg.envio_mensal_ativo} onCheckedChange={(v) => setCfg({ ...cfg, envio_mensal_ativo: v })} />
            </div>

            <div className="space-y-1.5">
              <Label>Dia do mês para envio</Label>
              <Input type="number" min={1} max={28} value={cfg.dia_envio} onChange={(e) => setCfg({ ...cfg, dia_envio: e.target.value })} />
              <p className="text-xs text-muted-foreground">A automação roda diariamente e cria os envios a partir deste dia.</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Lembrete automático</Label>
                <p className="text-xs text-muted-foreground">Marca empresas sem resposta para receber lembrete</p>
              </div>
              <Switch checked={cfg.lembrete_ativo} onCheckedChange={(v) => setCfg({ ...cfg, lembrete_ativo: v })} />
            </div>

            <div className="space-y-1.5">
              <Label>Dias até o lembrete</Label>
              <Input type="number" min={1} max={60} value={cfg.dias_para_lembrete} onChange={(e) => setCfg({ ...cfg, dias_para_lembrete: e.target.value })} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || loading}>{saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
