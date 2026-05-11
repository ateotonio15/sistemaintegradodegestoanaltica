import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  calcularValorReajustadoCentavos, reaisToCentavos, centavosToReais, formatCentavosBRL,
  getMesReajuste, nomeMes, calcularMesesRetroativos, calcularRetroativoCentavos, calcularValorFinalCentavos,
} from "@/lib/reajuste-utils";

interface Empresa { id: string; nome: string; codigo_contrato: string | null; data_implantacao?: string | null }

interface ReajusteRow {
  id: string;
  empresa_id: string;
  ano: number;
  valor_antigo_centavos: number;
  percentual: number;
  data_aplicacao: string;
  observacao: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: Empresa[];
  editing?: ReajusteRow | null;
  defaultEmpresaId?: string;
}

export function ReajusteDialog({ open, onOpenChange, empresas, editing, defaultEmpresaId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const anoAtual = new Date().getFullYear();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [ano, setAno] = useState<string>(String(anoAtual));
  const [valorAtual, setValorAtual] = useState<string>("");
  const [percentual, setPercentual] = useState<string>("");
  const [dataAplicacao, setDataAplicacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpresaId(editing.empresa_id);
      setAno(String(editing.ano));
      setValorAtual(String(centavosToReais(editing.valor_antigo_centavos).toFixed(2)).replace(".", ","));
      setPercentual(String(editing.percentual).replace(".", ","));
      setDataAplicacao(editing.data_aplicacao);
      setObservacao(editing.observacao || "");
    } else {
      setEmpresaId(defaultEmpresaId || "");
      setAno(String(anoAtual));
      setValorAtual("");
      setPercentual("");
      setDataAplicacao(new Date().toISOString().slice(0, 10));
      setObservacao("");
    }
  }, [open, editing, defaultEmpresaId, anoAtual]);

  const valorAntigoCent = useMemo(() => reaisToCentavos(valorAtual), [valorAtual]);
  const pctNum = useMemo(() => {
    const n = parseFloat(String(percentual).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [percentual]);
  const valorReajustadoCent = useMemo(
    () => calcularValorReajustadoCentavos(valorAntigoCent, pctNum),
    [valorAntigoCent, pctNum],
  );

  const empresaSel = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  const mesReajuste = useMemo(() => getMesReajuste(empresaSel?.data_implantacao || null), [empresaSel]);
  const mesesRetro = useMemo(() => calcularMesesRetroativos(mesReajuste, dataAplicacao), [mesReajuste, dataAplicacao]);
  const retroativoCent = useMemo(
    () => calcularRetroativoCentavos(valorAntigoCent, valorReajustadoCent, mesesRetro),
    [valorAntigoCent, valorReajustadoCent, mesesRetro],
  );
  const valorFinalCent = useMemo(
    () => calcularValorFinalCentavos(valorReajustadoCent, retroativoCent),
    [valorReajustadoCent, retroativoCent],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione um contrato");
      if (!ano) throw new Error("Informe o ano");
      if (valorAntigoCent <= 0) throw new Error("Informe o valor atual");
      if (!dataAplicacao) throw new Error("Informe a data de aplicação");

      // Buscar nome do usuário
      let usuario_nome: string | null = null;
      if (user?.id) {
        const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
        usuario_nome = data?.display_name || null;
      }

      const basePayload: any = {
        empresa_id: empresaId,
        ano: parseInt(ano, 10),
        valor_antigo_centavos: valorAntigoCent,
        percentual: pctNum,
        valor_reajustado_centavos: valorReajustadoCent,
        data_aplicacao: dataAplicacao,
        observacao: observacao || null,
        status: "Reajustado",
        usuario_id: user?.id || null,
        usuario_nome,
      };

      if (editing) {
        const { error } = await supabase.from("reajustes_anuais").update(basePayload).eq("id", editing.id);
        if (error) throw error;
      } else {
        // Novo reajuste sempre nasce aguardando confirmação do Cadastro
        const { error } = await supabase.from("reajustes_anuais").insert({
          ...basePayload,
          status_reajuste: "pendente_confirmacao",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editing ? "Reajuste atualizado" : "Reajuste criado",
        description: editing ? undefined : "Cadastro foi notificado para confirmar.",
      });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-count"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.message?.includes("duplicate") ? "Já existe um reajuste para este contrato neste ano" : (e?.message || "Erro ao salvar");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Reajuste" : "Novo Reajuste"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Contrato</Label>
            <Select value={empresaId} onValueChange={setEmpresaId} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}{e.codigo_contrato ? ` — ${e.codigo_contrato}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Ano do Reajuste</Label>
              <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} disabled={!!editing} />
            </div>
            <div className="grid gap-2">
              <Label>Data de Aplicação</Label>
              <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Valor Atual (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Percentual (%)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Mês oficial de reajuste</div>
                <div className="font-medium">{mesReajuste ? `${nomeMes(mesReajuste)} (mês ${String(mesReajuste).padStart(2, "0")})` : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Meses retroativos</div>
                <div className="font-medium">{mesesRetro}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor reajustado</div>
                <div className="font-semibold text-primary">{formatCentavosBRL(valorReajustadoCent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor retroativo</div>
                <div className="font-semibold">{formatCentavosBRL(retroativoCent)}</div>
              </div>
            </div>
            <div className="border-t pt-2">
              <div className="text-xs text-muted-foreground">Valor final cobrança</div>
              <div className="text-2xl font-bold text-primary">{formatCentavosBRL(valorFinalCent)}</div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
