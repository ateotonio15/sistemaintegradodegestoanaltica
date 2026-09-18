import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import {
  useExcluirDependenteUea,
  useSalvarDependenteUea,
  type DependenteInput,
} from "@/hooks/useDependentesUea";
import {
  faixaDaIdade,
  formatBRL,
  formatCPF,
  formatDataBR,
  idadeEm,
  proximaMudancaFaixa,
  soDigitos,
  type DependenteUea,
  type TitularCalculado,
} from "@/lib/dependentes-uea";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titular: TitularCalculado | null;
}

const vazio = (titularId: string): DependenteInput => ({
  titular_id: titularId,
  nome_completo: "",
  cpf: "",
  data_nascimento: "",
  parentesco: "",
  faixa_etaria: "",
  valor_mensal: 0,
  status: "ativo",
  motivo_desligamento: "",
  data_desligamento: "",
  observacao: "",
});

export function DependentesUeaDialog({ open, onOpenChange, titular }: Props) {
  const salvar = useSalvarDependenteUea();
  const excluir = useExcluirDependenteUea();
  const [editando, setEditando] = useState<DependenteInput | null>(null);
  const [valorTexto, setValorTexto] = useState("");

  const deps = useMemo(
    () =>
      [...(titular?.dependentes ?? [])].sort((a, b) =>
        a.status === b.status ? a.nome_completo.localeCompare(b.nome_completo) : a.status === "ativo" ? -1 : 1,
      ),
    [titular],
  );

  const abrirNovo = () => {
    if (!titular) return;
    setEditando(vazio(titular.id));
    setValorTexto("");
  };

  const abrirEdicao = (d: DependenteUea) => {
    setEditando({
      id: d.id,
      titular_id: d.titular_id,
      nome_completo: d.nome_completo,
      cpf: d.cpf ?? "",
      data_nascimento: d.data_nascimento ?? "",
      parentesco: d.parentesco ?? "",
      faixa_etaria: d.faixa_etaria ?? "",
      valor_mensal: d.valor_mensal,
      status: d.status,
      motivo_desligamento: d.motivo_desligamento ?? "",
      data_desligamento: d.data_desligamento ?? "",
      observacao: d.observacao ?? "",
    });
    setValorTexto(String(d.valor_mensal));
  };

  const submit = async () => {
    if (!editando || !editando.nome_completo.trim()) return;
    const faixaAuto = editando.data_nascimento
      ? faixaDaIdade(idadeEm(editando.data_nascimento))
      : editando.faixa_etaria;
    await salvar.mutateAsync({
      ...editando,
      cpf: editando.cpf ? soDigitos(editando.cpf) : null,
      faixa_etaria: faixaAuto || null,
      valor_mensal: Number(String(valorTexto).replace(",", ".")) || 0,
    });
    setEditando(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Dependentes · {titular?.nome_completo ?? "—"}
            {titular && (
              <Badge variant="outline">
                Margem {formatBRL(titular.valor_margem)} · Restante {formatBRL(titular.margem_restante)}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {!editando ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={abrirNovo}>
                <UserPlus className="mr-1.5 h-4 w-4" /> Novo dependente
              </Button>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dependente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Faixa</TableHead>
                    <TableHead className="text-right">Valor mensal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Próx. faixa</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum dependente cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {deps.map((d) => {
                    const prox = proximaMudancaFaixa(d);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.nome_completo}</TableCell>
                        <TableCell>{formatCPF(d.cpf)}</TableCell>
                        <TableCell>{formatDataBR(d.data_nascimento)}</TableCell>
                        <TableCell>
                          {d.data_nascimento ? faixaDaIdade(idadeEm(d.data_nascimento)) : d.faixa_etaria ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatBRL(d.valor_mensal)}</TableCell>
                        <TableCell>
                          <Badge variant={d.status === "ativo" ? "default" : "secondary"}>
                            {d.status === "ativo" ? "Ativo" : "Desligado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {prox ? `${formatDataBR(prox.data)} · ${prox.proxima_faixa}` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => abrirEdicao(d)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => excluir.mutate(d.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Nome completo *</Label>
              <Input
                value={editando.nome_completo}
                onChange={(e) => setEditando((d) => d && { ...d, nome_completo: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>CPF</Label>
                <Input
                  value={editando.cpf ?? ""}
                  onChange={(e) => setEditando((d) => d && { ...d, cpf: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={editando.data_nascimento ?? ""}
                  onChange={(e) => setEditando((d) => d && { ...d, data_nascimento: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Parentesco</Label>
                <Input
                  value={editando.parentesco ?? ""}
                  onChange={(e) => setEditando((d) => d && { ...d, parentesco: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Valor mensal (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={valorTexto}
                  onChange={(e) => setValorTexto(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={editando.status}
                  onValueChange={(v) =>
                    setEditando((d) => d && { ...d, status: v as "ativo" | "desligado" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="desligado">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Faixa etária</Label>
                <Input
                  readOnly
                  value={
                    editando.data_nascimento
                      ? faixaDaIdade(idadeEm(editando.data_nascimento))
                      : editando.faixa_etaria ?? ""
                  }
                  placeholder="Calculada pela data de nascimento"
                />
              </div>
            </div>
            {editando.status === "desligado" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Motivo do desligamento</Label>
                  <Input
                    value={editando.motivo_desligamento ?? ""}
                    onChange={(e) =>
                      setEditando((d) => d && { ...d, motivo_desligamento: e.target.value })
                    }
                    placeholder="Ex.: Falta de margem"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Data do desligamento</Label>
                  <Input
                    type="date"
                    value={editando.data_desligamento ?? ""}
                    onChange={(e) =>
                      setEditando((d) => d && { ...d, data_desligamento: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Observação</Label>
              <Textarea
                rows={2}
                value={editando.observacao ?? ""}
                onChange={(e) => setEditando((d) => d && { ...d, observacao: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditando(null)}>
                Voltar
              </Button>
              <Button onClick={submit} disabled={salvar.isPending}>
                <Plus className="mr-1.5 h-4 w-4" /> Salvar dependente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
