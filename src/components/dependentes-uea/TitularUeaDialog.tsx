import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSalvarTitularUea } from "@/hooks/useDependentesUea";
import { soDigitos, type TitularCalculado } from "@/lib/dependentes-uea";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titular?: TitularCalculado | null;
}

export function TitularUeaDialog({ open, onOpenChange, titular }: Props) {
  const salvar = useSalvarTitularUea();
  const [form, setForm] = useState({
    nome_completo: "",
    cpf: "",
    matricula: "",
    contrato: "",
    valor_margem: "",
    observacao: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      nome_completo: titular?.nome_completo ?? "",
      cpf: titular?.cpf ?? "",
      matricula: titular?.matricula ?? "",
      contrato: titular?.contrato ?? "",
      valor_margem: titular ? String(titular.valor_margem) : "",
      observacao: titular?.observacao ?? "",
    });
  }, [open, titular]);

  const submit = async () => {
    if (!form.nome_completo.trim() || soDigitos(form.cpf).length !== 11) return;
    await salvar.mutateAsync({
      id: titular?.id,
      nome_completo: form.nome_completo,
      cpf: soDigitos(form.cpf),
      matricula: form.matricula,
      contrato: form.contrato,
      valor_margem: parseValorBr(form.valor_margem),
      observacao: form.observacao,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titular ? "Editar titular" : "Novo titular"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Nome completo *</Label>
            <Input
              value={form.nome_completo}
              onChange={(e) => setForm((f) => ({ ...f, nome_completo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>CPF *</Label>
              <Input
                value={form.cpf}
                onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Matrícula</Label>
              <Input
                value={form.matricula}
                onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Contrato</Label>
              <Input
                value={form.contrato}
                onChange={(e) => setForm((f) => ({ ...f, contrato: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Valor da margem (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.valor_margem}
                onChange={(e) => setForm((f) => ({ ...f, valor_margem: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Observação</Label>
            <Textarea
              rows={3}
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={salvar.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
