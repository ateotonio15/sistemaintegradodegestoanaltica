import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  calcularValorReajustadoCentavos, reaisToCentavos, formatCentavosBRL,
  getMesReajuste, nomeMes, calcularMesesRetroativos, calcularRetroativoCentavos, calcularValorFinalCentavos,
} from "@/lib/reajuste-utils";

interface Empresa { id: string; nome: string; codigo_contrato?: string | null; data_implantacao?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: Empresa | null;
}

export function SolicitarReajusteDialog({ open, onOpenChange, empresa }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [valorAtual, setValorAtual] = useState("");
  const [percentual, setPercentual] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    setValorAtual("");
    setPercentual("");
    setDataAplicacao(new Date().toISOString().slice(0, 10));
    setObservacao("");
  }, [open]);

  const valorAntigoCent = useMemo(() => reaisToCentavos(valorAtual), [valorAtual]);
  const pctNum = useMemo(() => {
    const n = parseFloat(String(percentual).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [percentual]);
  const valorReajustadoCent = useMemo(
    () => calcularValorReajustadoCentavos(valorAntigoCent, pctNum),
    [valorAntigoCent, pctNum],
  );
  const mesReajuste = useMemo(() => getMesReajuste(empresa?.data_implantacao || null), [empresa]);
  const mesesRetro = useMemo(() => calcularMesesRetroativos(mesReajuste, dataAplicacao), [mesReajuste, dataAplicacao]);
  const retroativoCent = useMemo(
    () => calcularRetroativoCentavos(valorAntigoCent, valorReajustadoCent, mesesRetro),
    [valorAntigoCent, valorReajustadoCent, mesesRetro],
  );
  const valorFinalCent = useMemo(
    () => calcularValorFinalCentavos(valorReajustadoCent, retroativoCent),
    [valorReajustadoCent, retroativoCent],
  );

  const podeEnviar = valorAntigoCent > 0 && pctNum > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!empresa) throw new Error("Empresa não selecionada");
      if (valorAntigoCent <= 0) throw new Error("Preencha o valor atual.");
      if (pctNum <= 0) throw new Error("Preencha o percentual de reajuste.");

      const { data: novoId, error: rpcErr } = await supabase.rpc("solicitar_reajuste", {
        p_empresa_id: empresa.id,
      } as any);
      if (rpcErr) throw rpcErr;

      const { error: upErr } = await supabase
        .from("reajustes_anuais")
        .update({
          valor_antigo_centavos: valorAntigoCent,
          percentual: pctNum,
          data_aplicacao: dataAplicacao || null,
          observacao: observacao || null,
        } as any)
        .eq("id", novoId as unknown as string);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast({ title: "Solicitação enviada", description: "Cadastro responsável foi notificado." });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-list"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-count"] });
      qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e?.message || "Erro ao solicitar", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (valorAntigoCent <= 0) {
      toast({ title: "Campo obrigatório", description: "Preencha o valor atual.", variant: "destructive" });
      return;
    }
    if (pctNum <= 0) {
      toast({ title: "Campo obrigatório", description: "Preencha o percentual de reajuste.", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Reajuste</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-semibold">{empresa?.nome || "—"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {empresa?.codigo_contrato || "Sem contrato"} · Mês oficial:{" "}
              {mesReajuste ? `${nomeMes(mesReajuste)} (${String(mesReajuste).padStart(2, "0")})` : "—"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>
                Valor Atual (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={valorAtual}
                onChange={(e) => setValorAtual(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>
                Percentual (%) <span className="text-destructive">*</span>
              </Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Previsão de aplicação</Label>
            <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Valor Reajustado</div>
                <div className="font-semibold text-primary">{formatCentavosBRL(valorReajustadoCent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Meses retroativos</div>
                <div className="font-medium">{mesesRetro}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Retroativo</div>
                <div className="font-semibold">{formatCentavosBRL(retroativoCent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor Final</div>
                <div className="text-lg font-bold text-primary">{formatCentavosBRL(valorFinalCent)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!podeEnviar || mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Enviar para Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
