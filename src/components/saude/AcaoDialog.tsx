import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaudeMutations, type SaudeAcao } from "@/hooks/useSaude";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AcaoDialog({
  open,
  onOpenChange,
  acao,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  acao?: SaudeAcao | null;
}) {
  const { upsertAcao } = useSaudeMutations();
  const [form, setForm] = useState<any>({
    empresa_id: "",
    data: new Date().toISOString().slice(0, 10),
    colaborador_nome: "",
    cpf: "",
    idade: "",
    sexo: "",
    peso: "",
    altura: "",
    pressao_arterial: "",
    glicemia: "",
    frequencia_cardiaca: "",
    saturacao: "",
    temperatura: "",
    observacao: "",
  });

  useEffect(() => {
    if (acao) {
      setForm({
        empresa_id: acao.empresa_id,
        data: acao.data,
        colaborador_nome: acao.colaborador_nome,
        cpf: acao.cpf ?? "",
        idade: acao.idade ?? "",
        sexo: acao.sexo ?? "",
        peso: acao.peso ?? "",
        altura: acao.altura ?? "",
        pressao_arterial: acao.pressao_arterial ?? "",
        glicemia: acao.glicemia ?? "",
        frequencia_cardiaca: acao.frequencia_cardiaca ?? "",
        saturacao: acao.saturacao ?? "",
        temperatura: acao.temperatura ?? "",
        observacao: acao.observacao ?? "",
      });
    } else {
      setForm((f: any) => ({
        ...f,
        empresa_id: "",
        colaborador_nome: "",
        cpf: "",
        idade: "",
        sexo: "",
        peso: "",
        altura: "",
        pressao_arterial: "",
        glicemia: "",
        frequencia_cardiaca: "",
        saturacao: "",
        temperatura: "",
        observacao: "",
      }));
    }
  }, [acao, open]);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-options-saude"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id,nome,codigo_contrato").order("nome");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const num = (v: any) => (v === "" || v == null ? null : Number(v));

  const imcCalc = (() => {
    const p = num(form.peso);
    const a = num(form.altura);
    if (!p || !a || a <= 0) return null;
    return Number((p / (a * a)).toFixed(2));
  })();

  const save = async () => {
    if (!form.empresa_id || !form.colaborador_nome) return;
    await upsertAcao.mutateAsync({
      ...(acao ? { id: acao.id } : {}),
      empresa_id: form.empresa_id,
      data: form.data,
      colaborador_nome: form.colaborador_nome,
      cpf: form.cpf || null,
      idade: num(form.idade),
      sexo: form.sexo || null,
      peso: num(form.peso),
      altura: num(form.altura),
      pressao_arterial: form.pressao_arterial || null,
      glicemia: num(form.glicemia),
      frequencia_cardiaca: num(form.frequencia_cardiaca),
      saturacao: num(form.saturacao),
      temperatura: num(form.temperatura),
      observacao: form.observacao || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{acao ? "Editar Ficha Biométrica" : "Nova Ficha Biométrica"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Empresa</Label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
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
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Colaborador</Label>
              <Input value={form.colaborador_nome} onChange={(e) => setForm({ ...form, colaborador_nome: e.target.value })} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Idade</Label>
              <Input type="number" value={form.idade} onChange={(e) => setForm({ ...form, idade: e.target.value })} />
            </div>
            <div>
              <Label>Sexo</Label>
              <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="O">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pressão Arterial</Label>
              <Input placeholder="120/80" value={form.pressao_arterial} onChange={(e) => setForm({ ...form, pressao_arterial: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.1" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} />
            </div>
            <div>
              <Label>Altura (m)</Label>
              <Input type="number" step="0.01" value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} />
            </div>
            <div>
              <Label>IMC</Label>
              <Input value={imcCalc ?? ""} readOnly className="bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label>Glicemia</Label>
              <Input type="number" step="0.1" value={form.glicemia} onChange={(e) => setForm({ ...form, glicemia: e.target.value })} />
            </div>
            <div>
              <Label>FC (bpm)</Label>
              <Input type="number" value={form.frequencia_cardiaca} onChange={(e) => setForm({ ...form, frequencia_cardiaca: e.target.value })} />
            </div>
            <div>
              <Label>SatO₂ (%)</Label>
              <Input type="number" value={form.saturacao} onChange={(e) => setForm({ ...form, saturacao: e.target.value })} />
            </div>
            <div>
              <Label>Temp (°C)</Label>
              <Input type="number" step="0.1" value={form.temperatura} onChange={(e) => setForm({ ...form, temperatura: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!form.empresa_id || !form.colaborador_nome || upsertAcao.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
