import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

interface Pergunta {
  id: string;
  tipo: "rating" | "texto";
  obrigatoria: boolean;
  titulo: string;
  descricao: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: any;
  onSaved: (form: any) => void;
  tituloDialog?: string;
}

export function EditarFormularioRHDialog({ open, onOpenChange, form, onSaved, tituloDialog = "Editar formulário de Avaliação RH" }: Props) {
  const [titulo, setTitulo] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && form) {
      setTitulo(form.titulo || "");
      setInstrucoes(form.instrucoes || "");
      setPerguntas(
        (form.perguntas || []).map((p: any) => ({
          id: p.id || `q${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          tipo: p.tipo === "texto" ? "texto" : "rating",
          obrigatoria: !!p.obrigatoria,
          titulo: p.titulo || "",
          descricao: p.descricao || "",
        }))
      );
    }
  }, [open, form]);

  const atualizar = (idx: number, patch: Partial<Pergunta>) => {
    setPerguntas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const mover = (idx: number, dir: -1 | 1) => {
    setPerguntas((prev) => {
      const novo = [...prev];
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= novo.length) return prev;
      [novo[idx], novo[alvo]] = [novo[alvo], novo[idx]];
      return novo;
    });
  };

  const remover = (idx: number) => {
    setPerguntas((prev) => prev.filter((_, i) => i !== idx));
  };

  const adicionar = () => {
    setPerguntas((prev) => [
      ...prev,
      {
        id: `q${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        tipo: "rating",
        obrigatoria: true,
        titulo: "",
        descricao: "",
      },
    ]);
  };

  const salvar = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título do formulário");
      return;
    }
    if (perguntas.length === 0) {
      toast.error("Adicione pelo menos uma pergunta");
      return;
    }
    for (const p of perguntas) {
      if (!p.titulo.trim()) {
        toast.error("Todas as perguntas precisam de título");
        return;
      }
    }
    setSaving(true);
    const { data, error } = await db
      .from("cs_avaliacao_formularios")
      .update({ titulo: titulo.trim(), instrucoes: instrucoes.trim(), perguntas })
      .eq("id", form.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success("Formulário atualizado");
    onSaved(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tituloDialog}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Instruções</Label>
            <Textarea value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} rows={2} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-base">Perguntas ({perguntas.length})</Label>
            <Button size="sm" onClick={adicionar} variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
            </Button>
          </div>

          <div className="space-y-3">
            {perguntas.map((p, idx) => (
              <Card key={p.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">#{idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => mover(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => mover(idx, 1)} disabled={idx === perguntas.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remover(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Título da pergunta"
                  value={p.titulo}
                  onChange={(e) => atualizar(idx, { titulo: e.target.value })}
                />
                <Textarea
                  placeholder="Descrição (opcional)"
                  value={p.descricao}
                  onChange={(e) => atualizar(idx, { descricao: e.target.value })}
                  rows={2}
                />
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={p.tipo} onValueChange={(v) => atualizar(idx, { tipo: v as any })}>
                      <SelectTrigger className="h-8 w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">Nota (1 a 5)</SelectItem>
                        <SelectItem value="texto">Texto livre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.obrigatoria} onCheckedChange={(v) => atualizar(idx, { obrigatoria: v })} />
                    <Label className="text-xs">Obrigatória</Label>
                  </div>
                </div>
              </Card>
            ))}
            {perguntas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pergunta. Clique em "Adicionar pergunta".</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
