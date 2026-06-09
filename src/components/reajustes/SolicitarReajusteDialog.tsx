import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BedDouble, Hotel, Sparkles, TrendingUp, Calendar, Users, LineChart, Activity } from "lucide-react";
import { ModalidadesPicker } from "./ReajusteDialog";
import { ReajusteFaixaEtariaTable } from "./ReajusteFaixaEtariaTable";
import {
  calcularValorReajustadoCentavos, reaisToCentavos, formatCentavosBRL,
  getMesReajuste, nomeMes, calcularMesesRetroativos, calcularRetroativoCentavos, calcularValorFinalCentavos,
  criarFaixasIniciais, somarFaixas, type FaixaEtariaItem,
} from "@/lib/reajuste-utils";

interface Empresa { id: string; nome: string; codigo_contrato?: string | null; data_implantacao?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: Empresa | null;
}

export function SolicitarReajusteDialog({ open, onOpenChange, empresa }: Props) {
  const { toast } = useToast();
  const { isDiretora } = useAuth();
  const qc = useQueryClient();

  const [possuiEnf, setPossuiEnf] = useState(true);
  const [possuiApt, setPossuiApt] = useState(false);
  const [valorEnf, setValorEnf] = useState("");
  const [valorApt, setValorApt] = useState("");
  const [percentual, setPercentual] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");

  const [usaFaixaEnf, setUsaFaixaEnf] = useState(false);
  const [usaFaixaApt, setUsaFaixaApt] = useState(false);
  const [pctUnicoEnf, setPctUnicoEnf] = useState(true);
  const [pctUnicoApt, setPctUnicoApt] = useState(true);
  const [faixasEnf, setFaixasEnf] = useState<FaixaEtariaItem[]>(() => criarFaixasIniciais());
  const [faixasApt, setFaixasApt] = useState<FaixaEtariaItem[]>(() => criarFaixasIniciais());

  useEffect(() => {
    if (!open) return;
    setPossuiEnf(true);
    setPossuiApt(false);
    setValorEnf("");
    setValorApt("");
    setPercentual("");
    setDataAplicacao(new Date().toISOString().slice(0, 10));
    setObservacao("");
    setUsaFaixaEnf(false);
    setUsaFaixaApt(false);
    setPctUnicoEnf(true);
    setPctUnicoApt(true);
    setFaixasEnf(criarFaixasIniciais());
    setFaixasApt(criarFaixasIniciais());
  }, [open]);

  const pctNum = useMemo(() => {
    const n = parseFloat(String(percentual).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [percentual]);
  const mesReajuste = useMemo(() => getMesReajuste(empresa?.data_implantacao || null), [empresa]);
  const mesesRetro = useMemo(() => calcularMesesRetroativos(mesReajuste, dataAplicacao), [mesReajuste, dataAplicacao]);

  const enfTotais = useMemo(() => {
    if (possuiEnf && usaFaixaEnf) return somarFaixas(faixasEnf);
    const va = possuiEnf ? reaisToCentavos(valorEnf) : 0;
    const vr = calcularValorReajustadoCentavos(va, pctNum);
    const ret = calcularRetroativoCentavos(va, vr, mesesRetro);
    return { valor_atual_centavos: va, valor_reajustado_centavos: vr, valor_retroativo_centavos: ret, valor_final_centavos: calcularValorFinalCentavos(vr, ret) };
  }, [possuiEnf, usaFaixaEnf, faixasEnf, valorEnf, pctNum, mesesRetro]);

  const aptTotais = useMemo(() => {
    if (possuiApt && usaFaixaApt) return somarFaixas(faixasApt);
    const va = possuiApt ? reaisToCentavos(valorApt) : 0;
    const vr = calcularValorReajustadoCentavos(va, pctNum);
    const ret = calcularRetroativoCentavos(va, vr, mesesRetro);
    return { valor_atual_centavos: va, valor_reajustado_centavos: vr, valor_retroativo_centavos: ret, valor_final_centavos: calcularValorFinalCentavos(vr, ret) };
  }, [possuiApt, usaFaixaApt, faixasApt, valorApt, pctNum, mesesRetro]);

  const valorAntigoCent = (possuiEnf ? enfTotais.valor_atual_centavos : 0) + (possuiApt ? aptTotais.valor_atual_centavos : 0);
  const valorReajustadoCent = (possuiEnf ? enfTotais.valor_reajustado_centavos : 0) + (possuiApt ? aptTotais.valor_reajustado_centavos : 0);
  const retroativoCent = (possuiEnf ? enfTotais.valor_retroativo_centavos : 0) + (possuiApt ? aptTotais.valor_retroativo_centavos : 0);
  const valorFinalCent = (possuiEnf ? enfTotais.valor_final_centavos : 0) + (possuiApt ? aptTotais.valor_final_centavos : 0);

  const podeEnviar =
    (possuiEnf || possuiApt) &&
    (!possuiEnf || enfTotais.valor_atual_centavos > 0) &&
    (!possuiApt || aptTotais.valor_atual_centavos > 0) &&
    pctNum > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!empresa) throw new Error("Empresa não selecionada");
      if (!possuiEnf && !possuiApt) throw new Error("Selecione ao menos uma modalidade");
      if (possuiEnf && enfTotais.valor_atual_centavos <= 0) throw new Error("Informe o Valor Atual da Enfermaria");
      if (possuiApt && aptTotais.valor_atual_centavos <= 0) throw new Error("Informe o Valor Atual do Apartamento");
      if (pctNum <= 0) throw new Error("Preencha o percentual de reajuste.");

      const { data: novoId, error: rpcErr } = await supabase.rpc("solicitar_reajuste", {
        p_empresa_id: empresa.id,
      } as any);
      if (rpcErr) throw rpcErr;
      const reajusteId = novoId as unknown as string;

      const { error: upErr } = await supabase
        .from("reajustes_anuais")
        .update({
          possui_enfermaria: possuiEnf,
          possui_apartamento: possuiApt,
          valor_antigo_enfermaria_centavos: possuiEnf ? enfTotais.valor_atual_centavos : 0,
          valor_antigo_apartamento_centavos: possuiApt ? aptTotais.valor_atual_centavos : 0,
          valor_antigo_centavos: valorAntigoCent,
          percentual: pctNum,
          data_aplicacao: dataAplicacao || null,
          observacao: observacao || null,
          usa_faixa_etaria_enfermaria: possuiEnf && usaFaixaEnf,
          usa_faixa_etaria_apartamento: possuiApt && usaFaixaApt,
          percentual_unico_enfermaria: pctUnicoEnf,
          percentual_unico_apartamento: pctUnicoApt,
        } as any)
        .eq("id", reajusteId);
      if (upErr) throw upErr;

      // Faixas
      const rows: any[] = [];
      if (possuiEnf && usaFaixaEnf) {
        for (const f of faixasEnf) {
          if (f.valor_atual_centavos <= 0) continue;
          rows.push({
            reajuste_id: reajusteId, modalidade: "enfermaria",
            idade_inicial: f.idade_inicial, idade_final: f.idade_final,
            valor_atual_centavos: f.valor_atual_centavos,
            percentual: pctUnicoEnf ? pctNum : f.percentual,
            valor_reajustado_centavos: f.valor_reajustado_centavos,
            valor_retroativo_centavos: f.valor_retroativo_centavos,
            valor_final_centavos: f.valor_final_centavos,
          });
        }
      }
      if (possuiApt && usaFaixaApt) {
        for (const f of faixasApt) {
          if (f.valor_atual_centavos <= 0) continue;
          rows.push({
            reajuste_id: reajusteId, modalidade: "apartamento",
            idade_inicial: f.idade_inicial, idade_final: f.idade_final,
            valor_atual_centavos: f.valor_atual_centavos,
            percentual: pctUnicoApt ? pctNum : f.percentual,
            valor_reajustado_centavos: f.valor_reajustado_centavos,
            valor_retroativo_centavos: f.valor_retroativo_centavos,
            valor_final_centavos: f.valor_final_centavos,
          });
        }
      }
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("reajuste_faixas" as any).insert(rows);
        if (insErr) throw insErr;
      }

      // Avança automaticamente para "aguardando_aprovacao" e notifica o Cadastro
      const { error: confErr } = await supabase.rpc("confirmar_reajuste_cadastro" as any, { p_id: reajusteId });
      if (confErr) throw confErr;
    },
    onSuccess: () => {
      toast({ title: "Solicitação enviada", description: "Cadastro responsável foi notificado para análise e aprovação." });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-list"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-count"] });
      qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
      qc.invalidateQueries({ queryKey: ["reajustes-aprovar-count"] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e?.message || "Erro ao solicitar", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto backdrop-blur-xl bg-background/95 border-primary/20 shadow-2xl">
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
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="font-semibold text-base">{empresa?.nome || "—"}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>{empresa?.codigo_contrato || "Sem contrato"}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Mês oficial: {mesReajuste ? `${nomeMes(mesReajuste)} (${String(mesReajuste).padStart(2, "0")})` : "—"}</span>
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
              <div className="grid gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <BedDouble className="h-4 w-4 text-emerald-600" /> Enfermaria
                  </Label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={usaFaixaEnf} onCheckedChange={setUsaFaixaEnf} />
                    <Users className="h-3.5 w-3.5" />
                    <span>Contrato com Faixa Etária</span>
                  </label>
                </div>
                {!usaFaixaEnf ? (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Valor Atual (R$) <span className="text-destructive">*</span></Label>
                    <Input inputMode="decimal" placeholder="0,00" value={valorEnf} onChange={(e) => setValorEnf(e.target.value)} />
                  </div>
                ) : (
                  <ReajusteFaixaEtariaTable
                    modalidade="enfermaria"
                    faixas={faixasEnf}
                    onChange={setFaixasEnf}
                    percentualGlobal={pctNum}
                    percentualUnico={pctUnicoEnf}
                    onPercentualUnicoChange={setPctUnicoEnf}
                    mesesRetro={mesesRetro}
                  />
                )}
              </div>
            )}
            {possuiApt && (
              <div className="grid gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Hotel className="h-4 w-4 text-blue-600" /> Apartamento
                  </Label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={usaFaixaApt} onCheckedChange={setUsaFaixaApt} />
                    <Users className="h-3.5 w-3.5" />
                    <span>Contrato com Faixa Etária</span>
                  </label>
                </div>
                {!usaFaixaApt ? (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Valor Atual (R$) <span className="text-destructive">*</span></Label>
                    <Input inputMode="decimal" placeholder="0,00" value={valorApt} onChange={(e) => setValorApt(e.target.value)} />
                  </div>
                ) : (
                  <ReajusteFaixaEtariaTable
                    modalidade="apartamento"
                    faixas={faixasApt}
                    onChange={setFaixasApt}
                    percentualGlobal={pctNum}
                    percentualUnico={pctUnicoApt}
                    onPercentualUnicoChange={setPctUnicoApt}
                    mesesRetro={mesesRetro}
                  />
                )}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Percentual (%) <span className="text-destructive">*</span></Label>
                <Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Previsão de aplicação</Label>
                <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
              </div>
            </div>
          </div>

          {(possuiEnf || possuiApt) && (
            <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-3 gap-3 text-sm animate-fade-in">
              <div>
                <div className="text-xs text-muted-foreground">Reajustado total</div>
                <div className="font-semibold">{formatCentavosBRL(valorReajustadoCent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Retroativo total</div>
                <div className="font-semibold">{formatCentavosBRL(retroativoCent)}</div>
                <Badge variant="outline" className="text-[10px] mt-1">{mesesRetro} {mesesRetro === 1 ? "mês" : "meses"}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor Final total</div>
                <div className="font-bold text-primary">{formatCentavosBRL(valorFinalCent)}</div>
              </div>
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
