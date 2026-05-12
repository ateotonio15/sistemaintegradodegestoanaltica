import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BedDouble, Hotel, Sparkles, TrendingUp, Calendar } from "lucide-react";
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
  const [possuiApt, setPossuiApt] = useState(false);
  const [valorEnf, setValorEnf] = useState("");
  const [valorApt, setValorApt] = useState("");
  const [percentual, setPercentual] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    setPossuiEnf(true);
    setPossuiApt(false);
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
  const mesReajuste = useMemo(() => getMesReajuste(empresa?.data_implantacao || null), [empresa]);
  const mesesRetro = useMemo(() => calcularMesesRetroativos(mesReajuste, dataAplicacao), [mesReajuste, dataAplicacao]);

  const enfReaj = useMemo(() => calcularValorReajustadoCentavos(enfCent, pctNum), [enfCent, pctNum]);
  const enfRetro = useMemo(() => calcularRetroativoCentavos(enfCent, enfReaj, mesesRetro), [enfCent, enfReaj, mesesRetro]);
  const enfFinal = useMemo(() => calcularValorFinalCentavos(enfReaj, enfRetro), [enfReaj, enfRetro]);

  const aptReaj = useMemo(() => calcularValorReajustadoCentavos(aptCent, pctNum), [aptCent, pctNum]);
  const aptRetro = useMemo(() => calcularRetroativoCentavos(aptCent, aptReaj, mesesRetro), [aptCent, aptReaj, mesesRetro]);
  const aptFinal = useMemo(() => calcularValorFinalCentavos(aptReaj, aptRetro), [aptReaj, aptRetro]);

  const valorReajustadoCent = enfReaj + aptReaj;
  const retroativoCent = enfRetro + aptRetro;
  const valorFinalCent = enfFinal + aptFinal;

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
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto backdrop-blur-xl bg-background/95 border-primary/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Solicitar Reajuste
          </DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo. O cálculo é feito em tempo real e o pedido será enviado ao Cadastro responsável.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Empresa */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="font-semibold text-base">{empresa?.nome || "—"}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>{empresa?.codigo_contrato || "Sem contrato"}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Mês oficial: {mesReajuste ? `${nomeMes(mesReajuste)} (${String(mesReajuste).padStart(2, "0")})` : "—"}</span>
            </div>
          </div>

          {/* Modalidades */}
          <ModalidadesPicker
            possuiEnf={possuiEnf}
            possuiApt={possuiApt}
            onEnf={setPossuiEnf}
            onApt={setPossuiApt}
          />

          {/* Inputs */}
          <div className="grid gap-3 md:grid-cols-2">
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
              <Label className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Percentual (%) <span className="text-destructive">*</span></Label>
              <Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Previsão de aplicação</Label>
              <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
            </div>
          </div>

          {/* Preview por modalidade */}
          {(possuiEnf || possuiApt) && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preview do cálculo</Label>
                <Badge variant="outline" className="text-xs">{mesesRetro} {mesesRetro === 1 ? "mês retro" : "meses retro"}</Badge>
              </div>
              <div className={`grid gap-3 ${possuiEnf && possuiApt ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                {possuiEnf && (
                  <PreviewCard
                    titulo="Enfermaria"
                    Icone={BedDouble}
                    cor="emerald"
                    percentual={pctNum}
                    valorAtual={enfCent}
                    valorReajustado={enfReaj}
                    retroativo={enfRetro}
                    valorFinal={enfFinal}
                  />
                )}
                {possuiApt && (
                  <PreviewCard
                    titulo="Apartamento"
                    Icone={Hotel}
                    cor="blue"
                    percentual={pctNum}
                    valorAtual={aptCent}
                    valorReajustado={aptReaj}
                    retroativo={aptRetro}
                    valorFinal={aptFinal}
                  />
                )}
              </div>
              {possuiEnf && possuiApt && (
                <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Reajustado total</div>
                    <div className="font-semibold">{formatCentavosBRL(valorReajustadoCent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Retroativo total</div>
                    <div className="font-semibold">{formatCentavosBRL(retroativoCent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Valor Final total</div>
                    <div className="font-bold text-primary">{formatCentavosBRL(valorFinalCent)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

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

type PreviewCardProps = {
  titulo: string;
  Icone: React.ComponentType<{ className?: string }>;
  cor: "emerald" | "blue";
  percentual: number;
  valorAtual: number;
  valorReajustado: number;
  retroativo: number;
  valorFinal: number;
};

function PreviewCard({ titulo, Icone, cor, percentual, valorAtual, valorReajustado, retroativo, valorFinal }: PreviewCardProps) {
  const styles = cor === "emerald"
    ? { card: "border-emerald-500/40 bg-emerald-500/5", icon: "text-emerald-600", final: "text-emerald-600" }
    : { card: "border-blue-500/40 bg-blue-500/5", icon: "text-blue-600", final: "text-blue-600" };
  return (
    <div className={`rounded-lg border p-3 ${styles.card}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icone className={`h-4 w-4 ${styles.icon}`} />
          {titulo}
        </div>
        <Badge variant="outline" className="text-[10px]">{percentual.toFixed(2).replace(".", ",")}%</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <div className="text-muted-foreground">Valor Atual</div>
          <div className="font-medium text-sm">{formatCentavosBRL(valorAtual)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Valor Reajustado</div>
          <div className="font-medium text-sm">{formatCentavosBRL(valorReajustado)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Retroativo</div>
          <div className="font-medium text-sm">{formatCentavosBRL(retroativo)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Valor Final</div>
          <div className={`font-bold text-sm ${styles.final}`}>{formatCentavosBRL(valorFinal)}</div>
        </div>
      </div>
    </div>
  );
}
