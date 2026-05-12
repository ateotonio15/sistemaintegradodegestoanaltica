import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BedDouble, Hotel, Users } from "lucide-react";
import {
  calcularValorReajustadoCentavos, reaisToCentavos, centavosToReais, formatCentavosBRL,
  getMesReajuste, nomeMes, calcularMesesRetroativos, calcularRetroativoCentavos, calcularValorFinalCentavos,
  criarFaixasIniciais, somarFaixas, type FaixaEtariaItem,
} from "@/lib/reajuste-utils";
import { ReajusteFaixaEtariaTable } from "./ReajusteFaixaEtariaTable";
import { ReajusteFaixaEtariaCards } from "./ReajusteFaixaEtariaCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Empresa { id: string; nome: string; codigo_contrato: string | null; data_implantacao?: string | null }

interface ReajusteRow {
  id: string;
  empresa_id: string;
  ano: number;
  valor_antigo_centavos: number;
  percentual: number;
  data_aplicacao: string;
  observacao: string | null;
  valor_antigo_enfermaria_centavos?: number | null;
  valor_antigo_apartamento_centavos?: number | null;
  possui_enfermaria?: boolean | null;
  possui_apartamento?: boolean | null;
  usa_faixa_etaria_enfermaria?: boolean | null;
  usa_faixa_etaria_apartamento?: boolean | null;
  percentual_unico_enfermaria?: boolean | null;
  percentual_unico_apartamento?: boolean | null;
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
  const [possuiEnf, setPossuiEnf] = useState<boolean>(true);
  const [possuiApt, setPossuiApt] = useState<boolean>(true);
  const [valorEnf, setValorEnf] = useState<string>("");
  const [valorApt, setValorApt] = useState<string>("");
  const [percentual, setPercentual] = useState<string>("");
  const [dataAplicacao, setDataAplicacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState<string>("");

  const [usaFaixaEnf, setUsaFaixaEnf] = useState(false);
  const [usaFaixaApt, setUsaFaixaApt] = useState(false);
  const [pctUnicoEnf, setPctUnicoEnf] = useState(true);
  const [pctUnicoApt, setPctUnicoApt] = useState(true);
  const [faixasEnf, setFaixasEnf] = useState<FaixaEtariaItem[]>(() => criarFaixasIniciais());
  const [faixasApt, setFaixasApt] = useState<FaixaEtariaItem[]>(() => criarFaixasIniciais());

  // Carrega faixas existentes ao editar
  const { data: faixasDb } = useQuery({
    queryKey: ["reajuste-faixas", editing?.id],
    enabled: !!editing?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reajuste_faixas" as any)
        .select("*")
        .eq("reajuste_id", editing!.id);
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpresaId(editing.empresa_id);
      setAno(String(editing.ano));
      const enfCent = editing.valor_antigo_enfermaria_centavos || 0;
      const aptCent = editing.valor_antigo_apartamento_centavos || 0;
      const hasEnfFlag = typeof editing.possui_enfermaria === "boolean" ? editing.possui_enfermaria : enfCent > 0 || (enfCent === 0 && aptCent === 0);
      const hasAptFlag = typeof editing.possui_apartamento === "boolean" ? editing.possui_apartamento : aptCent > 0;
      setPossuiEnf(hasEnfFlag);
      setPossuiApt(hasAptFlag);
      setValorEnf(enfCent > 0 ? centavosToReais(enfCent).toFixed(2).replace(".", ",") : "");
      setValorApt(aptCent > 0 ? centavosToReais(aptCent).toFixed(2).replace(".", ",") : "");
      setPercentual(editing.percentual > 0 ? String(editing.percentual).replace(".", ",") : "");
      setDataAplicacao(editing.data_aplicacao || new Date().toISOString().slice(0, 10));
      setObservacao(editing.observacao || "");
      setUsaFaixaEnf(!!editing.usa_faixa_etaria_enfermaria);
      setUsaFaixaApt(!!editing.usa_faixa_etaria_apartamento);
      setPctUnicoEnf(editing.percentual_unico_enfermaria !== false);
      setPctUnicoApt(editing.percentual_unico_apartamento !== false);
    } else {
      setEmpresaId(defaultEmpresaId || "");
      setAno(String(anoAtual));
      setPossuiEnf(true);
      setPossuiApt(true);
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
    }
  }, [open, editing, defaultEmpresaId, anoAtual]);

  // Mescla faixas do DB quando chegam
  useEffect(() => {
    if (!faixasDb) return;
    const base = criarFaixasIniciais();
    const enf = base.map((f) => {
      const d = faixasDb.find((x: any) => x.modalidade === "enfermaria" && x.idade_inicial === f.idade_inicial && x.idade_final === f.idade_final);
      return d ? {
        ...f,
        valor_atual_centavos: d.valor_atual_centavos || 0,
        percentual: Number(d.percentual) || 0,
        valor_reajustado_centavos: d.valor_reajustado_centavos || 0,
        valor_retroativo_centavos: d.valor_retroativo_centavos || 0,
        valor_final_centavos: d.valor_final_centavos || 0,
      } : f;
    });
    const apt = base.map((f) => {
      const d = faixasDb.find((x: any) => x.modalidade === "apartamento" && x.idade_inicial === f.idade_inicial && x.idade_final === f.idade_final);
      return d ? {
        ...f,
        valor_atual_centavos: d.valor_atual_centavos || 0,
        percentual: Number(d.percentual) || 0,
        valor_reajustado_centavos: d.valor_reajustado_centavos || 0,
        valor_retroativo_centavos: d.valor_retroativo_centavos || 0,
        valor_final_centavos: d.valor_final_centavos || 0,
      } : f;
    });
    setFaixasEnf(enf);
    setFaixasApt(apt);
  }, [faixasDb]);

  const pctNum = useMemo(() => {
    const n = parseFloat(String(percentual).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [percentual]);

  const empresaSel = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  const mesReajuste = useMemo(() => getMesReajuste(empresaSel?.data_implantacao || null), [empresaSel]);
  const mesesRetro = useMemo(() => calcularMesesRetroativos(mesReajuste, dataAplicacao), [mesReajuste, dataAplicacao]);

  // Totais por modalidade (faixa OU valor único)
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione um contrato");
      if (!ano) throw new Error("Informe o ano");
      if (!possuiEnf && !possuiApt) throw new Error("Selecione ao menos uma modalidade (Enfermaria ou Apartamento)");
      if (possuiEnf && !usaFaixaEnf && enfTotais.valor_atual_centavos <= 0) throw new Error("Informe o Valor Atual da Enfermaria");
      if (possuiApt && !usaFaixaApt && aptTotais.valor_atual_centavos <= 0) throw new Error("Informe o Valor Atual do Apartamento");
      if (possuiEnf && usaFaixaEnf && enfTotais.valor_atual_centavos <= 0) throw new Error("Informe ao menos uma faixa com valor para Enfermaria");
      if (possuiApt && usaFaixaApt && aptTotais.valor_atual_centavos <= 0) throw new Error("Informe ao menos uma faixa com valor para Apartamento");
      if (!dataAplicacao) throw new Error("Informe a data de aplicação");

      let usuario_nome: string | null = null;
      if (user?.id) {
        const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
        usuario_nome = data?.display_name || null;
      }

      const basePayload: any = {
        empresa_id: empresaId,
        ano: parseInt(ano, 10),
        possui_enfermaria: possuiEnf,
        possui_apartamento: possuiApt,
        valor_antigo_enfermaria_centavos: possuiEnf ? enfTotais.valor_atual_centavos : 0,
        valor_antigo_apartamento_centavos: possuiApt ? aptTotais.valor_atual_centavos : 0,
        valor_antigo_centavos: valorAntigoCent,
        percentual: pctNum,
        valor_reajustado_centavos: valorReajustadoCent,
        data_aplicacao: dataAplicacao,
        observacao: observacao || null,
        status: "Reajustado",
        usuario_id: user?.id || null,
        usuario_nome,
        usa_faixa_etaria_enfermaria: possuiEnf && usaFaixaEnf,
        usa_faixa_etaria_apartamento: possuiApt && usaFaixaApt,
        percentual_unico_enfermaria: pctUnicoEnf,
        percentual_unico_apartamento: pctUnicoApt,
      };

      let reajusteId: string;
      if (editing) {
        const updatePayload: any = { ...basePayload };
        if ((editing as any).status_reajuste === "solicitado" && valorAntigoCent > 0 && pctNum > 0) {
          updatePayload.status_reajuste = "pendente_confirmacao";
        }
        const { error } = await supabase.from("reajustes_anuais").update(updatePayload).eq("id", editing.id);
        if (error) throw error;
        reajusteId = editing.id;
      } else {
        const { data, error } = await supabase.from("reajustes_anuais").insert({
          ...basePayload,
          status_reajuste: "pendente_confirmacao",
        }).select("id").single();
        if (error) throw error;
        reajusteId = data!.id as string;
      }

      // Sincroniza faixas
      await supabase.from("reajuste_faixas" as any).delete().eq("reajuste_id", reajusteId);
      const rows: any[] = [];
      if (possuiEnf && usaFaixaEnf) {
        for (const f of faixasEnf) {
          if (f.valor_atual_centavos <= 0) continue;
          rows.push({
            reajuste_id: reajusteId,
            modalidade: "enfermaria",
            idade_inicial: f.idade_inicial,
            idade_final: f.idade_final,
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
            reajuste_id: reajusteId,
            modalidade: "apartamento",
            idade_inicial: f.idade_inicial,
            idade_final: f.idade_final,
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
    },
    onSuccess: () => {
      toast({
        title: editing ? "Reajuste atualizado" : "Reajuste criado",
        description: editing ? undefined : "Cadastro foi notificado para confirmar.",
      });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-count"] });
      qc.invalidateQueries({ queryKey: ["reajuste-faixas"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.message?.includes("duplicate") ? "Já existe um reajuste para este contrato neste ano" : (e?.message || "Erro ao salvar");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const TABS = ["geral", "enfermaria", "apartamento", "resumo"] as const;
  type TabId = (typeof TABS)[number];
  const [tab, setTab] = useState<TabId>("geral");
  useEffect(() => { if (open) setTab("geral"); }, [open]);

  const tabDisponivel = (t: TabId) =>
    !(t === "enfermaria" && !possuiEnf) && !(t === "apartamento" && !possuiApt);

  const tabsOrdenadas = TABS.filter(tabDisponivel);
  const idxAtual = tabsOrdenadas.indexOf(tab);
  const podeVoltar = idxAtual > 0;
  const podeAvancar = idxAtual >= 0 && idxAtual < tabsOrdenadas.length - 1;

  // Quando a modalidade ativa é desmarcada, voltar para Geral
  useEffect(() => {
    if (tab === "enfermaria" && !possuiEnf) setTab("geral");
    if (tab === "apartamento" && !possuiApt) setTab("geral");
  }, [possuiEnf, possuiApt, tab]);

  const empresaNomeSel = empresaSel?.nome || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1280px] w-[95vw] p-0 max-h-[92vh] flex flex-col gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg">
            {editing ? "Editar Reajuste" : "Novo Reajuste"}
          </DialogTitle>
          {(empresaNomeSel || ano) && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
              {empresaNomeSel && <span className="font-medium text-foreground">{empresaNomeSel}</span>}
              {empresaNomeSel && ano && <span>•</span>}
              {ano && <span>Ano {ano}</span>}
              {(usaFaixaEnf || usaFaixaApt) && (
                <Badge variant="outline" className="ml-2 text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30">
                  Faixa Etária
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 border-b">
            <TabsList className="bg-transparent p-0 h-auto gap-1">
              <TabsTrigger value="geral" className="data-[state=active]:bg-muted px-4 py-2 rounded-md">
                Informações Gerais
              </TabsTrigger>
              <TabsTrigger value="enfermaria" disabled={!possuiEnf} className="data-[state=active]:bg-muted px-4 py-2 rounded-md flex items-center gap-2">
                <BedDouble className="h-3.5 w-3.5 text-emerald-600" />
                Enfermaria
                {usaFaixaEnf && <Badge variant="outline" className="text-[9px] h-4 px-1 bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Faixas</Badge>}
                {enfTotais.valor_atual_centavos > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </TabsTrigger>
              <TabsTrigger value="apartamento" disabled={!possuiApt} className="data-[state=active]:bg-muted px-4 py-2 rounded-md flex items-center gap-2">
                <Hotel className="h-3.5 w-3.5 text-blue-600" />
                Apartamento
                {usaFaixaApt && <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-500/15 text-blue-700 border-blue-500/30">Faixas</Badge>}
                {aptTotais.valor_atual_centavos > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              </TabsTrigger>
              <TabsTrigger value="resumo" className="data-[state=active]:bg-muted px-4 py-2 rounded-md">
                Resumo
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Aba: Informações Gerais */}
            <TabsContent value="geral" className="m-0 animate-fade-in space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div className="grid gap-2 md:col-span-2">
                  <Label className="text-sm font-medium">Contrato</Label>
                  <Select value={empresaId} onValueChange={setEmpresaId} disabled={!!editing}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}{e.codigo_contrato ? ` — ${e.codigo_contrato}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Ano do Reajuste</Label>
                  <Input className="h-11" type="number" value={ano} onChange={(e) => setAno(e.target.value)} disabled={!!editing} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Data de Aplicação</Label>
                  <Input className="h-11" type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label className="text-sm font-medium">
                    Percentual padrão (%) <span className="text-destructive">*</span>
                  </Label>
                  <Input className="h-11" inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">
                    Aplicado às modalidades sem faixa etária e às faixas com "percentual único" ativado.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <ModalidadesPicker
                    possuiEnf={possuiEnf}
                    possuiApt={possuiApt}
                    onEnf={setPossuiEnf}
                    onApt={setPossuiApt}
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label className="text-sm font-medium">Observação</Label>
                  <Textarea
                    className="min-h-[88px]"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Mês oficial de reajuste</div>
                  <div className="font-semibold mt-0.5">{mesReajuste ? `${nomeMes(mesReajuste)} (mês ${String(mesReajuste).padStart(2, "0")})` : "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Meses retroativos</div>
                  <div className="font-semibold mt-0.5">{mesesRetro}</div>
                </div>
              </div>
            </TabsContent>

            {/* Aba: Enfermaria */}
            <TabsContent value="enfermaria" className="m-0 animate-fade-in space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-semibold">Enfermaria</h3>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <Switch checked={usaFaixaEnf} onCheckedChange={setUsaFaixaEnf} />
                  <Users className="h-3.5 w-3.5" />
                  <span>Contrato com Faixa Etária</span>
                </label>
              </div>

              {!usaFaixaEnf ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
                  <div className="grid gap-2 max-w-md">
                    <Label className="text-sm font-medium">Valor Atual (R$) <span className="text-destructive">*</span></Label>
                    <Input
                      className="h-11"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valorEnf}
                      onChange={(e) => setValorEnf(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-emerald-500/20">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Valor Atual</div>
                      <div className="font-semibold tabular-nums">{formatCentavosBRL(enfTotais.valor_atual_centavos)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Reajustado</div>
                      <div className="font-semibold tabular-nums">{formatCentavosBRL(enfTotais.valor_reajustado_centavos)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Retroativo</div>
                      <div className="font-semibold tabular-nums">{formatCentavosBRL(enfTotais.valor_retroativo_centavos)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Valor Final</div>
                      <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCentavosBRL(enfTotais.valor_final_centavos)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <ReajusteFaixaEtariaCards
                  modalidade="enfermaria"
                  faixas={faixasEnf}
                  onChange={setFaixasEnf}
                  percentualGlobal={pctNum}
                  percentualUnico={pctUnicoEnf}
                  onPercentualUnicoChange={setPctUnicoEnf}
                  mesesRetro={mesesRetro}
                />
              )}
            </TabsContent>

            {/* Aba: Apartamento */}
            <TabsContent value="apartamento" className="m-0 animate-fade-in space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Hotel className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-semibold">Apartamento</h3>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <Switch checked={usaFaixaApt} onCheckedChange={setUsaFaixaApt} />
                  <Users className="h-3.5 w-3.5" />
                  <span>Contrato com Faixa Etária</span>
                </label>
              </div>

              {!usaFaixaApt ? (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4">
                  <div className="grid gap-2 max-w-md">
                    <Label className="text-sm font-medium">Valor Atual (R$) <span className="text-destructive">*</span></Label>
                    <Input
                      className="h-11"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valorApt}
                      onChange={(e) => setValorApt(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-blue-500/20">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Valor Atual</div>
                      <div className="font-semibold tabular-nums">{formatCentavosBRL(aptTotais.valor_atual_centavos)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Reajustado</div>
                      <div className="font-semibold tabular-nums">{formatCentavosBRL(aptTotais.valor_reajustado_centavos)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Retroativo</div>
                      <div className="font-semibold tabular-nums">{formatCentavosBRL(aptTotais.valor_retroativo_centavos)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Valor Final</div>
                      <div className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">{formatCentavosBRL(aptTotais.valor_final_centavos)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <ReajusteFaixaEtariaCards
                  modalidade="apartamento"
                  faixas={faixasApt}
                  onChange={setFaixasApt}
                  percentualGlobal={pctNum}
                  percentualUnico={pctUnicoApt}
                  onPercentualUnicoChange={setPctUnicoApt}
                  mesesRetro={mesesRetro}
                />
              )}
            </TabsContent>

            {/* Aba: Resumo */}
            <TabsContent value="resumo" className="m-0 animate-fade-in space-y-5">
              <div className={`grid gap-4 ${possuiEnf && possuiApt ? "md:grid-cols-2" : "grid-cols-1"}`}>
                {possuiEnf && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-base font-semibold text-emerald-700 dark:text-emerald-400">
                        <BedDouble className="h-5 w-5" />
                        Enfermaria
                      </div>
                      {usaFaixaEnf && (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">
                          {faixasEnf.filter((f) => f.valor_atual_centavos > 0).length} faixas
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="text-muted-foreground">Valor atual</div>
                      <div className="text-right font-medium tabular-nums">{formatCentavosBRL(enfTotais.valor_atual_centavos)}</div>
                      <div className="text-muted-foreground">Reajustado</div>
                      <div className="text-right font-medium tabular-nums">{formatCentavosBRL(enfTotais.valor_reajustado_centavos)}</div>
                      <div className="text-muted-foreground">Retroativo</div>
                      <div className="text-right font-medium tabular-nums">{formatCentavosBRL(enfTotais.valor_retroativo_centavos)}</div>
                    </div>
                    <div className="border-t border-emerald-500/30 pt-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Valor final cobrança</div>
                      <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                        {formatCentavosBRL(enfTotais.valor_final_centavos)}
                      </div>
                    </div>
                  </div>
                )}
                {possuiApt && (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-base font-semibold text-blue-700 dark:text-blue-400">
                        <Hotel className="h-5 w-5" />
                        Apartamento
                      </div>
                      {usaFaixaApt && (
                        <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30 text-[10px]">
                          {faixasApt.filter((f) => f.valor_atual_centavos > 0).length} faixas
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="text-muted-foreground">Valor atual</div>
                      <div className="text-right font-medium tabular-nums">{formatCentavosBRL(aptTotais.valor_atual_centavos)}</div>
                      <div className="text-muted-foreground">Reajustado</div>
                      <div className="text-right font-medium tabular-nums">{formatCentavosBRL(aptTotais.valor_reajustado_centavos)}</div>
                      <div className="text-muted-foreground">Retroativo</div>
                      <div className="text-right font-medium tabular-nums">{formatCentavosBRL(aptTotais.valor_retroativo_centavos)}</div>
                    </div>
                    <div className="border-t border-blue-500/30 pt-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Valor final cobrança</div>
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums mt-0.5">
                        {formatCentavosBRL(aptTotais.valor_final_centavos)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Mês oficial</div>
                  <div className="font-semibold mt-0.5">{mesReajuste ? nomeMes(mesReajuste) : "—"}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Meses retroativos</div>
                  <div className="font-semibold mt-0.5">{mesesRetro}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Percentual</div>
                  <div className="font-semibold mt-0.5">{pctNum > 0 ? `${pctNum.toFixed(2).replace(".", ",")}%` : "—"}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Data de aplicação</div>
                  <div className="font-semibold mt-0.5">{dataAplicacao ? dataAplicacao.split("-").reverse().join("/") : "—"}</div>
                </div>
              </div>

              {observacao && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Observação</div>
                  <div className="text-sm whitespace-pre-wrap">{observacao}</div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t bg-background flex-row sm:justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!podeVoltar}
              onClick={() => podeVoltar && setTab(tabsOrdenadas[idxAtual - 1])}
            >
              ← Voltar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!podeAvancar}
              onClick={() => podeAvancar && setTab(tabsOrdenadas[idxAtual + 1])}
            >
              Avançar →
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : editing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModalidadesPicker({
  possuiEnf, possuiApt, onEnf, onApt,
}: { possuiEnf: boolean; possuiApt: boolean; onEnf: (v: boolean) => void; onApt: (v: boolean) => void }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm">Modalidades do Contrato <span className="text-destructive">*</span></Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label
          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
            possuiEnf ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:bg-muted/40"
          }`}
        >
          <Checkbox checked={possuiEnf} onCheckedChange={(v) => onEnf(!!v)} />
          <BedDouble className="h-4 w-4 text-emerald-600" />
          <div className="flex-1">
            <div className="text-sm font-medium">Enfermaria</div>
            <div className="text-[11px] text-muted-foreground">Modalidade Enfermaria</div>
          </div>
          {possuiEnf && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">Selecionada</Badge>}
        </label>
        <label
          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
            possuiApt ? "border-blue-500/50 bg-blue-500/5" : "border-border hover:bg-muted/40"
          }`}
        >
          <Checkbox checked={possuiApt} onCheckedChange={(v) => onApt(!!v)} />
          <Hotel className="h-4 w-4 text-blue-600" />
          <div className="flex-1">
            <div className="text-sm font-medium">Apartamento</div>
            <div className="text-[11px] text-muted-foreground">Modalidade Apartamento</div>
          </div>
          {possuiApt && <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30 text-[10px]">Selecionada</Badge>}
        </label>
      </div>
    </div>
  );
}
