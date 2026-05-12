import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BedDouble, Hotel } from "lucide-react";
import { ModalidadesPicker } from "./ReajusteDialog";
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

  const [possuiEnf, setPossuiEnf] = useState(true);
  const [possuiApt, setPossuiApt] = useState(true);
  const [valorEnf, setValorEnf] = useState("");
  const [valorApt, setValorApt] = useState("");
  const [percentual, setPercentual] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    setPossuiEnf(true);
    setPossuiApt(true);
    setValorEnf("");
    setValorApt("");
    setPercentual("");
    setDataAplicacao(new Date().toISOString().slice(0, 10));
    setObservacao("");
  }, [open]);

  const enfCent = useMemo(() => (possuiEnf ? reaisToCentavos(valorEnf) : 0), [possuiEnf, valorEnf]);
  const aptCent = useMemo(() => (possuiApt ? reaisToCentavos(valorApt) : 0), [possuiApt, valorApt]);
  const valorAntigoCent = enfCent + aptCent;
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

  const podeEnviar =
    (possuiEnf || possuiApt) &&
    (!possuiEnf || enfCent > 0) &&
    (!possuiApt || aptCent > 0) &&
    pctNum > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!empresa) throw new Error("Empresa não selecionada");
      if (!possuiEnf && !possuiApt) throw new Error("Selecione ao menos uma modalidade");
      if (possuiEnf && enfCent <= 0) throw new Error("Informe o Valor Atual da Enfermaria");
      if (possuiApt && aptCent <= 0) throw new Error("Informe o Valor Atual do Apartamento");
      if (pctNum <= 0) throw new Error("Preencha o percentual de reajuste.");

      const { data: novoId, error: rpcErr } = await supabase.rpc("solicitar_reajuste", {
        p_empresa_id: empresa.id,
      } as any);
      if (rpcErr) throw rpcErr;

      const { error: upErr } = await supabase
        .from("reajustes_anuais")
        .update({
          possui_enfermaria: possuiEnf,
          possui_apartamento: possuiApt,
          valor_antigo_enfermaria_centavos: possuiEnf ? enfCent : 0,
          valor_antigo_apartamento_centavos: possuiApt ? aptCent : 0,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          <ModalidadesPicker
            possuiEnf={possuiEnf}
            possuiApt={possuiApt}
            onEnf={setPossuiEnf}
            onApt={setPossuiApt}
          />

          <div className="grid gap-3">
            {possuiEnf && (
              <div className="grid gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 animate-fade-in">
                <Label className="flex items-center gap-2 text-sm">
                  <BedDouble className="h-4 w-4 text-emerald-600" />
                  Valor Atual Enfermaria (R$) <span className="text-destructive">*</span>
                </Label>
                <Input inputMode="decimal" placeholder="0,00" value={valorEnf} onChange={(e) => setValorEnf(e.target.value)} />
              </div>
            )}
            {possuiApt && (
              <div className="grid gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 animate-fade-in">
                <Label className="flex items-center gap-2 text-sm">
                  <Hotel className="h-4 w-4 text-blue-600" />
                  Valor Atual Apartamento (R$) <span className="text-destructive">*</span>
                </Label>
                <Input inputMode="decimal" placeholder="0,00" value={valorApt} onChange={(e) => setValorApt(e.target.value)} />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Percentual (%) <span className="text-destructive">*</span></Label>
              <Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Previsão de aplicação</Label>
              <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Valor Reajustado (total)</div>
                <div className="font-semibold text-primary">{formatCentavosBRL(valorReajustadoCent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Meses retroativos</div>
                <div className="font-medium">{mesesRetro}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Retroativo (total)</div>
                <div className="font-semibold">{formatCentavosBRL(retroativoCent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor Final (total)</div>
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
          <Button onClick={() => mutation.mutate()} disabled={!podeEnviar || mutation.isPending}>
            {mutation.isPending ? "Enviando..." : "Enviar para Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
