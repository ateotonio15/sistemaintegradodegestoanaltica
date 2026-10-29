import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export interface ArquivoEditavel {
  id: string;
  nome_original: string;
  competencia: string;
  categoria: string;
  observacao: string | null;
}

interface Props {
  arquivo: ArquivoEditavel | null;
  categorias: readonly string[];
  onOpenChange: (open: boolean) => void;
}

export function EditarArquivoDialog({ arquivo, categorias, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!arquivo) return;
    setNome(arquivo.nome_original ?? "");
    setCompetencia((arquivo.competencia ?? "").slice(0, 7));
    setCategoria(arquivo.categoria ?? "");
    setObservacao(arquivo.observacao ?? "");
  }, [arquivo]);

  async function salvar() {
    if (!arquivo) return;
    if (!nome.trim()) return toast.error("Informe o nome do arquivo.");
    if (!/^\d{4}-\d{2}$/.test(competencia)) return toast.error("Informe a competência.");
    if (!categoria) return toast.error("Escolha a categoria.");
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("financeiro_arquivos")
        .update({
          nome_original: nome.trim(),
          competencia,
          categoria,
          observacao: observacao.trim() || null,
        })
        .eq("id", arquivo.id);
      if (error) throw error;
      toast.success("Informações do arquivo atualizadas.");
      qc.invalidateQueries({ queryKey: ["financeiro-arquivos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-aportes"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSalvando(false);
    }
  }

  const opcoes = categoria && !categorias.includes(categoria) ? [categoria, ...categorias] : categorias;

  return (
    <Dialog open={!!arquivo} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar arquivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do arquivo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
