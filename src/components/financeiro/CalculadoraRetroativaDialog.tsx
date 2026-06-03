import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Copy, Calculator, Loader2, AlertTriangle, FileSpreadsheet, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMesesOptions, formatMesReferencia, getCurrentMesReferencia } from "@/lib/financeiro-utils";
import {
  calcularItem,
  calcularTotais,
  formatBRLFromCentavos,
  type PeriodoMensal,
  type TipoLancamento,
} from "@/lib/cobranca-retroativa-calc";

type EmpresaOption = { id: string; nome: string; codigo_contrato: string | null };

const MOTIVOS = [
  "Inclusão retroativa",
  "Exclusão retroativa",
  "Alteração de plano",
  "Correção de mensalidade",
  "Ajuste manual",
  "Outro",
] as const;

const TIPOS_BENEFICIARIO = [
  { value: "titular", label: "Titular" },
  { value: "conjuge", label: "Dependente Cônjuge" },
  { value: "filho", label: "Dependente Filho(a)" },
  { value: "outro", label: "Outro" },
] as const;

interface Beneficiario {
  uiId: string;
  beneficiario_nome: string;
  codigo_beneficiario: string;
  matricula: string;
  tipo_beneficiario: string;
  beneficiario_titular: string;
  plano_modulo: string;
  mensalidadeStr: string;
  data_inicio: string;
  data_fim: string;
  tipo_lancamento: TipoLancamento;
  observacao: string;
  // calc
  diasProporcionais: number;
  valorCalculadoCentavos: number; // com sinal
  valorFinalCentavos: number; // com sinal
  alteradoManualmente: boolean;
  periodos: PeriodoMensal[];
}

function novoBeneficiario(prefill?: Partial<Beneficiario>): Beneficiario {
  return {
    uiId: crypto.randomUUID(),
    beneficiario_nome: "",
    codigo_beneficiario: "",
    matricula: "",
    tipo_beneficiario: "titular",
    beneficiario_titular: "",
    plano_modulo: "",
    mensalidadeStr: "",
    data_inicio: "",
    data_fim: "",
    tipo_lancamento: "cobranca",
    observacao: "",
    diasProporcionais: 0,
    valorCalculadoCentavos: 0,
    valorFinalCentavos: 0,
    alteradoManualmente: false,
    periodos: [],
    ...prefill,
  };
}

function parseBRLToCentavos(s: string): number {
  const cleaned = String(s ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centavosToBRLInput(c: number): string {
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresas: EmpresaOption[];
  cobrancaId?: string | null;
  empresaIdPrefill?: string | null;
  competenciaPrefill?: string | null;
}

export function CalculadoraRetroativaDialog({
  open,
  onOpenChange,
  empresas,
  cobrancaId,
  empresaIdPrefill,
  competenciaPrefill,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const meses = useMemo(() => getMesesOptions(), []);

  // Dados gerais
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [competencia, setCompetencia] = useState<string>(getCurrentMesReferencia());
  const [tipoAjuste, setTipoAjuste] = useState<TipoLancamento>("cobranca");
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0]);
  const [descricao, setDescricao] = useState<string>("");

  // Período geral (sugestão para preenchimento dos beneficiários)
  const [periodoIni, setPeriodoIni] = useState<string>("");
  const [periodoFim, setPeriodoFim] = useState<string>("");

  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([novoBeneficiario()]);
  const [calculado, setCalculado] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carrega cabeçalho + itens existentes
  const { data: existente } = useQuery({
    queryKey: ["calc-retroativa", cobrancaId],
    enabled: open && !!cobrancaId,
    queryFn: async () => {
      const { data: head, error: e1 } = await supabase
        .from("cobrancas_retroativas")
        .select("*")
        .eq("id", cobrancaId!)
        .maybeSingle();
      if (e1) throw e1;
      const { data: itens, error: e2 } = await supabase
        .from("cobrancas_retroativas_itens")
        .select("*")
        .eq("cobranca_retroativa_id", cobrancaId!)
        .order("created_at", { ascending: true });
      if (e2) throw e2;
      return { head, itens: itens ?? [] };
    },
  });

  // Inicializa estado quando abre
  useEffect(() => {
    if (!open) return;
    if (existente?.head) {
      setEmpresaId(existente.head.empresa_id);
      setCompetencia(existente.head.competencia);
      setTipoAjuste(((existente.head as any).tipo_ajuste as TipoLancamento) || "cobranca");
      setMotivo(((existente.head as any).motivo as string) || MOTIVOS[0]);
      setDescricao(existente.head.descricao || "");
      const its = (existente.itens || []).map((it: any) =>
        novoBeneficiario({
          beneficiario_nome: it.beneficiario_nome,
          codigo_beneficiario: it.codigo_beneficiario || "",
          matricula: it.matricula || "",
          tipo_beneficiario: it.tipo_beneficiario || "titular",
          beneficiario_titular: it.beneficiario_titular || "",
          plano_modulo: it.plano_modulo || "",
          mensalidadeStr: centavosToBRLInput(it.mensalidade_centavos),
          data_inicio: it.data_inicio,
          data_fim: it.data_fim,
          tipo_lancamento: it.tipo_lancamento || "cobranca",
          observacao: it.observacao || "",
          diasProporcionais: it.dias_proporcionais || 0,
          valorCalculadoCentavos: Number(it.valor_calculado_centavos) || 0,
          valorFinalCentavos: Number(it.valor_final_centavos) || 0,
          alteradoManualmente: !!it.alterado_manualmente,
        }),
      );
      setBeneficiarios(its.length ? its : [novoBeneficiario()]);
      setCalculado(its.length > 0);
    } else {
      setEmpresaId(empresaIdPrefill ?? null);
      setCompetencia(competenciaPrefill ?? getCurrentMesReferencia());
      setTipoAjuste("cobranca");
      setMotivo(MOTIVOS[0]);
      setDescricao("");
      setPeriodoIni("");
      setPeriodoFim("");
      setBeneficiarios([novoBeneficiario()]);
      setCalculado(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existente?.head?.id]);

  const empresa = empresas.find((e) => e.id === empresaId);

  const totais = useMemo(
    () =>
      calcularTotais(
        beneficiarios.map((b) => ({ valorFinalCentavos: b.valorFinalCentavos, tipo: b.tipo_lancamento })),
      ),
    [beneficiarios],
  );

  const atravessaMes = beneficiarios.some((b) => b.periodos.length > 1);
  const temAlteracaoManual = beneficiarios.some((b) => b.alteradoManualmente);

  function atualizar(uiId: string, patch: Partial<Beneficiario>) {
    setBeneficiarios((prev) => prev.map((b) => (b.uiId === uiId ? { ...b, ...patch } : b)));
  }

  function aplicarPeriodoGeral() {
    if (!periodoIni || !periodoFim) {
      toast.error("Informe data inicial e final do período geral.");
      return;
    }
    if (periodoFim < periodoIni) {
      toast.error("Data final não pode ser menor que a inicial.");
      return;
    }
    setBeneficiarios((prev) =>
      prev.map((b) => ({ ...b, data_inicio: periodoIni, data_fim: periodoFim })),
    );
    toast.success("Período aplicado aos beneficiários.");
  }

  function calcular() {
    const errs: string[] = [];
    const novos = beneficiarios.map((b) => {
      if (!b.beneficiario_nome.trim()) errs.push("Beneficiário sem nome.");
      if (!b.plano_modulo.trim()) errs.push(`Plano vazio em ${b.beneficiario_nome || "beneficiário"}.`);
      const mens = parseBRLToCentavos(b.mensalidadeStr);
      if (mens <= 0) errs.push(`Mensalidade inválida em ${b.beneficiario_nome || "beneficiário"}.`);
      if (!b.data_inicio || !b.data_fim) errs.push(`Datas faltando em ${b.beneficiario_nome || "beneficiário"}.`);
      else if (b.data_fim < b.data_inicio)
        errs.push(`Data final < inicial em ${b.beneficiario_nome || "beneficiário"}.`);

      if (mens > 0 && b.data_inicio && b.data_fim && b.data_fim >= b.data_inicio) {
        const r = calcularItem({
          mensalidadeCentavos: mens,
          dataInicio: b.data_inicio,
          dataFim: b.data_fim,
          tipo: b.tipo_lancamento,
        });
        return {
          ...b,
          diasProporcionais: r.diasProporcionais,
          valorCalculadoCentavos: r.valorCalculadoCentavos,
          valorFinalCentavos: b.alteradoManualmente ? b.valorFinalCentavos : r.valorCalculadoCentavos,
          periodos: r.periodos,
        };
      }
      return b;
    });
    if (errs.length) {
      toast.error(errs[0]);
      return;
    }
    setBeneficiarios(novos);
    setCalculado(true);
    toast.success("Cálculo realizado.");
  }

  async function salvar() {
    if (!empresaId) return toast.error("Selecione o contrato.");
    if (!competencia) return toast.error("Informe a competência.");
    if (!calculado) {
      calcular();
      return;
    }
    if (beneficiarios.length === 0) return toast.error("Adicione ao menos um beneficiário.");

    setSaving(true);
    try {
      const valorTotalCalc = beneficiarios.reduce((s, b) => s + b.valorCalculadoCentavos, 0);
      const valorTotalManual = beneficiarios.reduce((s, b) => s + b.valorFinalCentavos, 0);
      const valorAbs = Math.abs(valorTotalManual);

      let id = cobrancaId ?? null;
      if (id) {
        const { error } = await supabase
          .from("cobrancas_retroativas")
          .update({
            empresa_id: empresaId,
            competencia,
            valor_centavos: valorAbs,
            descricao: descricao || null,
            motivo,
            tipo_ajuste: tipoAjuste,
            valor_total_calculado_centavos: valorTotalCalc,
            valor_total_manual_centavos: valorTotalManual,
            status_calc: "calculado",
          } as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("cobrancas_retroativas")
          .insert({
            empresa_id: empresaId,
            competencia,
            valor_centavos: valorAbs,
            descricao: descricao || null,
            motivo,
            tipo_ajuste: tipoAjuste,
            valor_total_calculado_centavos: valorTotalCalc,
            valor_total_manual_centavos: valorTotalManual,
            status_calc: "calculado",
            created_by: user?.id,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }

      // Recria itens + períodos
      await supabase.from("cobrancas_retroativas_itens").delete().eq("cobranca_retroativa_id", id!);

      for (const b of beneficiarios) {
        const mens = parseBRLToCentavos(b.mensalidadeStr);
        const { data: itemRow, error: eIt } = await supabase
          .from("cobrancas_retroativas_itens")
          .insert({
            cobranca_retroativa_id: id!,
            beneficiario_nome: b.beneficiario_nome,
            codigo_beneficiario: b.codigo_beneficiario || null,
            matricula: b.matricula || null,
            tipo_beneficiario: b.tipo_beneficiario || null,
            beneficiario_titular: b.beneficiario_titular || null,
            plano_modulo: b.plano_modulo,
            mensalidade_centavos: mens,
            data_inicio: b.data_inicio,
            data_fim: b.data_fim,
            dias_proporcionais: b.diasProporcionais,
            valor_calculado_centavos: b.valorCalculadoCentavos,
            valor_final_centavos: b.valorFinalCentavos,
            tipo_lancamento: b.tipo_lancamento,
            observacao: b.observacao || null,
            alterado_manualmente: b.alteradoManualmente,
            usuario_alteracao_id: b.alteradoManualmente ? user?.id : null,
            usuario_alteracao_nome: null,
            data_alteracao: b.alteradoManualmente ? new Date().toISOString() : null,
          } as any)
          .select("id")
          .single();
        if (eIt) throw eIt;

        if (b.periodos.length) {
          const rows = b.periodos.map((p) => ({
            item_id: itemRow.id,
            mes_referencia: p.mes,
            data_inicio_periodo: p.inicio,
            data_fim_periodo: p.fim,
            dias_mes: p.diasMes,
            dias_cobrados: p.diasCobrados,
            mensalidade_centavos: p.mensalidadeCentavos,
            valor_diario_centavos: p.valorDiarioCentavos,
            valor_calculado_centavos: p.valorCalculadoCentavos,
          }));
          const { error: eP } = await supabase
            .from("cobrancas_retroativas_periodos")
            .insert(rows as any);
          if (eP) throw eP;
        }
      }

      toast.success("Cobrança retroativa salva.");
      queryClient.invalidateQueries({ queryKey: ["cobrancas-retroativas"] });
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora de Cobrança Retroativa
            <Badge variant="outline" className="ml-2 capitalize">
              {tipoAjuste}
            </Badge>
            {calculado && <Badge className="bg-success text-success-foreground">Calculado</Badge>}
          </DialogTitle>
          <DialogDescription>
            Calcule cobranças ou devoluções proporcionais por beneficiário com base na mensalidade,
            período e quantidade de dias do mês.
          </DialogDescription>
        </DialogHeader>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Beneficiários</div>
              <div className="text-xl font-semibold">{totais.totalBeneficiarios}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Total cobranças</div>
              <div className="text-lg font-semibold text-success">
                {formatBRLFromCentavos(totais.totalCobrancasCentavos)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Total devoluções</div>
              <div className="text-lg font-semibold text-destructive">
                {formatBRLFromCentavos(totais.totalDevolucoesCentavos)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Valor líquido</div>
              <div className={cn("text-lg font-semibold", totais.valorLiquidoCentavos < 0 ? "text-destructive" : "text-primary")}>
                {formatBRLFromCentavos(totais.valorLiquidoCentavos)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bloco 1 — Dados gerais */}
        <div className="space-y-3 border rounded-md p-3">
          <div className="text-sm font-semibold">Dados gerais</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Contrato *</Label>
              <Select value={empresaId ?? ""} onValueChange={(v) => setEmpresaId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.codigo_contrato ? `${e.codigo_contrato} — ` : ""}{e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Competência *</Label>
              <Select value={competencia} onValueChange={setCompetencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>{formatMesReferencia(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo do ajuste *</Label>
              <Select value={tipoAjuste} onValueChange={(v) => setTipoAjuste(v as TipoLancamento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cobranca">Cobrança</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Descrição / Observação</Label>
              <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Bloco 2 — Período geral */}
        <div className="space-y-3 border rounded-md p-3">
          <div className="text-sm font-semibold">Período de referência (aplicado em todos)</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" onClick={aplicarPeriodoGeral}>
              Aplicar aos beneficiários
            </Button>
            {periodoIni && periodoFim && periodoIni.slice(0, 7) !== periodoFim.slice(0, 7) && (
              <div className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Período atravessa mais de um mês — o cálculo será quebrado por mês.
              </div>
            )}
          </div>
        </div>

        {/* Bloco 3 — Beneficiários */}
        <div className="space-y-3 border rounded-md p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Beneficiários</div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled title="Em breve" className="gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Importar Excel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBeneficiarios((p) => [...p, novoBeneficiario()])}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {beneficiarios.map((b, idx) => (
              <div key={b.uiId} className="border rounded p-3 space-y-2 bg-accent/20">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">Beneficiário #{idx + 1}</div>
                  <div className="flex gap-1">
                    <Button
                      type="button" size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => setBeneficiarios((p) => [...p, novoBeneficiario({ ...b, uiId: crypto.randomUUID(), beneficiario_nome: b.beneficiario_nome + " (cópia)" })])}
                      title="Duplicar"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button" size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => setBeneficiarios((p) => p.length > 1 ? p.filter((x) => x.uiId !== b.uiId) : p)}
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={b.beneficiario_nome} onChange={(e) => atualizar(b.uiId, { beneficiario_nome: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Código</Label>
                    <Input value={b.codigo_beneficiario} onChange={(e) => atualizar(b.uiId, { codigo_beneficiario: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Matrícula</Label>
                    <Input value={b.matricula} onChange={(e) => atualizar(b.uiId, { matricula: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={b.tipo_beneficiario} onValueChange={(v) => atualizar(b.uiId, { tipo_beneficiario: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_BENEFICIARIO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Titular</Label>
                    <Input value={b.beneficiario_titular} onChange={(e) => atualizar(b.uiId, { beneficiario_titular: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Plano/Módulo *</Label>
                    <Input value={b.plano_modulo} onChange={(e) => atualizar(b.uiId, { plano_modulo: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Mensalidade (BRL) *</Label>
                    <Input
                      inputMode="decimal" placeholder="0,00"
                      value={b.mensalidadeStr}
                      onChange={(e) => atualizar(b.uiId, { mensalidadeStr: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data inicial *</Label>
                    <Input type="date" value={b.data_inicio} onChange={(e) => atualizar(b.uiId, { data_inicio: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Data final *</Label>
                    <Input type="date" value={b.data_fim} onChange={(e) => atualizar(b.uiId, { data_fim: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Lançamento</Label>
                    <Select value={b.tipo_lancamento} onValueChange={(v) => atualizar(b.uiId, { tipo_lancamento: v as TipoLancamento })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cobranca">Cobrança</SelectItem>
                        <SelectItem value="devolucao">Devolução</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs">Observação</Label>
                    <Input value={b.observacao} onChange={(e) => atualizar(b.uiId, { observacao: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 4 — Tabela de cálculo */}
        {calculado && (
          <div className="space-y-2 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Resultado do cálculo</div>
              {atravessaMes && (
                <Badge variant="outline" className="text-warning border-warning">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Período atravessa mais de um mês
                </Badge>
              )}
              {temAlteracaoManual && (
                <Badge variant="outline" className="text-yellow-700 border-yellow-500">
                  Há valores alterados manualmente
                </Badge>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Mensalidade</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Dias prop.</TableHead>
                    <TableHead className="text-right">Calculado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beneficiarios.map((b) => {
                    const mens = parseBRLToCentavos(b.mensalidadeStr);
                    const rowClass = b.alteradoManualmente
                      ? "bg-yellow-50 dark:bg-yellow-500/10"
                      : b.tipo_lancamento === "devolucao"
                        ? "bg-destructive/5"
                        : "bg-success/5";
                    return (
                      <TableRow key={b.uiId} className={rowClass}>
                        <TableCell>
                          <div className="font-medium">{b.beneficiario_nome || "—"}</div>
                          {b.periodos.length > 1 && (
                            <div className="text-[10px] text-muted-foreground">
                              {b.periodos.map((p) => `${formatMesReferencia(p.mes)}: ${p.diasCobrados}d`).join(" • ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{b.plano_modulo || "—"}</TableCell>
                        <TableCell className="text-right">{formatBRLFromCentavos(mens)}</TableCell>
                        <TableCell className="text-xs">
                          {b.data_inicio && b.data_fim
                            ? `${b.data_inicio.split("-").reverse().join("/")} → ${b.data_fim.split("-").reverse().join("/")}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">{b.diasProporcionais}</TableCell>
                        <TableCell className="text-right">{formatBRLFromCentavos(b.valorCalculadoCentavos)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={b.tipo_lancamento === "devolucao" ? "text-destructive border-destructive" : "text-success border-success"}>
                            {b.tipo_lancamento}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="h-7 text-right text-xs w-28 ml-auto"
                            value={centavosToBRLInput(Math.abs(b.valorFinalCentavos))}
                            onChange={(e) => {
                              const abs = parseBRLToCentavos(e.target.value);
                              const sinal = b.tipo_lancamento === "devolucao" ? -1 : 1;
                              const novoValor = abs * sinal;
                              atualizar(b.uiId, {
                                valorFinalCentavos: novoValor,
                                alteradoManualmente: novoValor !== b.valorCalculadoCentavos,
                              });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={calcular} disabled={saving} className="gap-1.5">
            <Calculator className="h-4 w-4" /> Calcular
          </Button>
          <Button onClick={salvar} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar cobrança"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
