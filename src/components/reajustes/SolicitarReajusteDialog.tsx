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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface Empresa {
  id: string;
  nome: string;
  codigo_contrato?: string | null;
  data_implantacao?: string | null;
  valor_enfermaria_centavos?: number | null;
  valor_apartamento_centavos?: number | null;
  faixas_etarias?: any;
  contrato_faixa_etaria?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: Empresa | null;
  existingReajusteId?: string | null;
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
  const [indexador, setIndexador] = useState<string>("IPCA");
  const [sinistralidade, setSinistralidade] = useState<string>("");

  // Fallback: busca valores da implantação quando empresa não tem valores cadastrados
  const { data: implantacao } = useQuery({
    queryKey: ["implantacao-contrato-reajuste", empresa?.id],
    enabled: !!empresa?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("implantacoes_contratos")
        .select("valor_enfermaria_centavos,valor_apartamento_centavos,faixas_etarias")
        .eq("empresa_id", empresa!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    // Pré-popular: usa valores da empresa, com fallback para implantação
    const empEnf = Number((empresa as any)?.valor_enfermaria_centavos) || Number((implantacao as any)?.valor_enfermaria_centavos) || 0;
    const empApt = Number((empresa as any)?.valor_apartamento_centavos) || Number((implantacao as any)?.valor_apartamento_centavos) || 0;
    const empFaixas = (empresa as any)?.faixas_etarias || (implantacao as any)?.faixas_etarias;
    const usaFx = !!(empresa as any)?.contrato_faixa_etaria;

    const fxEnfArr: Array<{ ini: number; fim: number; centavos: number }> =
      empFaixas && typeof empFaixas === "object" && Array.isArray(empFaixas.enfermaria) ? empFaixas.enfermaria : [];
    const fxAptArr: Array<{ ini: number; fim: number; centavos: number }> =
      empFaixas && typeof empFaixas === "object" && Array.isArray(empFaixas.apartamento) ? empFaixas.apartamento : [];
    const sumFx = (arr: any[]) => arr.reduce((s, f) => s + (Number(f?.centavos) || 0), 0);
    const temFxEnf = sumFx(fxEnfArr) > 0;
    const temFxApt = sumFx(fxAptArr) > 0;

    const hasEnf = empEnf > 0 || temFxEnf;
    const hasApt = empApt > 0 || temFxApt;

    setPossuiEnf(hasEnf || (!hasEnf && !hasApt)); // default Enfermaria se nada
    setPossuiApt(hasApt);
    setValorEnf(empEnf > 0 ? (empEnf / 100).toFixed(2).replace(".", ",") : "");
    setValorApt(empApt > 0 ? (empApt / 100).toFixed(2).replace(".", ",") : "");
    setPercentual("");
    setDataAplicacao(new Date().toISOString().slice(0, 10));
    setObservacao("");

    const useFxEnf = usaFx && temFxEnf;
    const useFxApt = usaFx && temFxApt;
    setUsaFaixaEnf(useFxEnf);
    setUsaFaixaApt(useFxApt);
    setPctUnicoEnf(true);
    setPctUnicoApt(true);

    const baseEnf = criarFaixasIniciais();
    if (useFxEnf) {
      for (const f of fxEnfArr) {
        const idx = baseEnf.findIndex((b) => b.idade_inicial === f.ini && b.idade_final === f.fim);
        if (idx >= 0) baseEnf[idx].valor_atual_centavos = Number(f.centavos) || 0;
      }
    }
    const baseApt = criarFaixasIniciais();
    if (useFxApt) {
      for (const f of fxAptArr) {
        const idx = baseApt.findIndex((b) => b.idade_inicial === f.ini && b.idade_final === f.fim);
        if (idx >= 0) baseApt[idx].valor_atual_centavos = Number(f.centavos) || 0;
      }
    }
    setFaixasEnf(baseEnf);
    setFaixasApt(baseApt);
    setIndexador("IPCA");
    setSinistralidade("");
  }, [open, empresa, implantacao]);

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
          ...(isDiretora ? {
            indexador_financeiro: indexador || null,
            sinistralidade_percentual: sinistralidade ? parseFloat(String(sinistralidade).replace(",", ".")) : null,
          } : {}),
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
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto backdrop-blur-xl bg-background/95 border-primary/20 shadow-2xl p-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Solicitar Reajuste
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha em etapas. O cálculo é feito em tempo real e o pedido será enviado ao Cadastro responsável.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Empresa */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="font-semibold text-base">{empresa?.nome || "—"}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>{empresa?.codigo_contrato || "Sem contrato"}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Mês oficial: {mesReajuste ? `${nomeMes(mesReajuste)} (${String(mesReajuste).padStart(2, "0")})` : "—"}</span>
            </div>
          </div>

          {/* 1. Modalidades */}
          <Section number={1} title="Modalidades do Contrato" required>
            <ModalidadesPicker
              possuiEnf={possuiEnf}
              possuiApt={possuiApt}
              onEnf={setPossuiEnf}
              onApt={setPossuiApt}
            />
          </Section>

          {/* 2. Valores Atuais */}
          {(possuiEnf || possuiApt) && (
            <Section number={2} title="Valores Atuais" required>
              <div className={`grid gap-3 ${possuiEnf && possuiApt ? "md:grid-cols-2" : ""}`}>
                {possuiEnf && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <BedDouble className="h-4 w-4 text-emerald-600" /> Enfermaria
                      </Label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Switch checked={usaFaixaEnf} onCheckedChange={setUsaFaixaEnf} />
                        <Users className="h-3.5 w-3.5" />
                        <span>Faixa Etária</span>
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
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Hotel className="h-4 w-4 text-blue-600" /> Apartamento
                      </Label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Switch checked={usaFaixaApt} onCheckedChange={setUsaFaixaApt} />
                        <Users className="h-3.5 w-3.5" />
                        <span>Faixa Etária</span>
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
              </div>
            </Section>
          )}

          {/* 3. Parâmetros do Reajuste */}
          <Section number={3} title="Parâmetros do Reajuste" required>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1 text-sm"><TrendingUp className="h-3.5 w-3.5" /> Percentual (%) <span className="text-destructive">*</span></Label>
                <Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">Previsão de aplicação</Label>
                <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
              </div>
            </div>
          </Section>

          {/* 4. Análise da Diretora */}
          {isDiretora && (
            <Section
              number={4}
              title="Análise da Diretora"
              accent="amber"
              badge="Exclusivo Diretora"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1 text-sm"><LineChart className="h-3.5 w-3.5" /> Indexador Financeiro</Label>
                  <Select value={indexador} onValueChange={setIndexador}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IPCA">IPCA</SelectItem>
                      <SelectItem value="IGPM">IGPM</SelectItem>
                      <SelectItem value="ANS">ANS</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1 text-sm"><Activity className="h-3.5 w-3.5" /> Sinistralidade (%)</Label>
                  <Input inputMode="decimal" placeholder="0,00" value={sinistralidade} onChange={(e) => setSinistralidade(e.target.value)} />
                </div>
              </div>
            </Section>
          )}

          {/* Resumo */}
          {(possuiEnf || possuiApt) && (
            <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-muted/40 to-transparent p-4 animate-fade-in">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Resumo do Cálculo</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[11px] text-muted-foreground">Reajustado total</div>
                  <div className="font-semibold text-base">{formatCentavosBRL(valorReajustadoCent)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Retroativo total</div>
                  <div className="font-semibold text-base">{formatCentavosBRL(retroativoCent)}</div>
                  <Badge variant="outline" className="text-[10px] mt-1">{mesesRetro} {mesesRetro === 1 ? "mês" : "meses"}</Badge>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Valor Final total</div>
                  <div className="font-bold text-lg text-primary">{formatCentavosBRL(valorFinalCent)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Observação */}
          <Section number={isDiretora ? 5 : 4} title="Observação" optional>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes adicionais (opcional)"
              rows={2}
            />
          </Section>
        </div>

        <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-xl border-t px-6 py-3">
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={!podeEnviar || mutation.isPending}>
              {mutation.isPending ? "Enviando..." : "Enviar para Cadastro"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  number, title, children, required, optional, accent, badge,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  accent?: "amber";
  badge?: string;
}) {
  const accentBorder = accent === "amber" ? "border-amber-500/40 bg-amber-500/5" : "border-border";
  const numBg = accent === "amber" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-primary/15 text-primary";
  return (
    <section className={`rounded-xl border ${accentBorder} p-4 space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">
          {title} {required && <span className="text-destructive">*</span>}
          {optional && <span className="text-[11px] font-normal text-muted-foreground ml-1">(opcional)</span>}
        </h3>
        {badge && (
          <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40">
            {badge}
          </Badge>
        )}
      </div>
      {children}
    </section>
  );
}

