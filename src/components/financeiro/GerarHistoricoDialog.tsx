import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, FileText } from "lucide-react";
import {
  calcularVencimentoPadrao,
  detectarCompetencia,
  gerarHistoricoTexto,
  isoToBR,
} from "@/lib/historico-utils";
import { calcularPeriodoCobranca, formatPeriodoCobranca } from "@/lib/date-utils";
import type { AnaliseResultado } from "@/lib/excel-analysis-utils";
import type { FinanceiroRow } from "./FinanceiroTable";

const MOTIVOS_PRORROGACAO = [
  "Solicitado pela empresa",
  "Atraso Financeiro",
  "Atraso Cadastro",
  "Outros",
] as const;

type Step = "prorrogacao" | "preview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: FinanceiroRow | null;
  resultados: AnaliseResultado[] | null;
  anexosNomes: string[];
}

export function GerarHistoricoDialog({
  open,
  onOpenChange,
  row,
  resultados,
  anexosNomes,
}: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("prorrogacao");
  const [prorrogar, setProrrogar] = useState<boolean | null>(null);
  const [dataProrrogacao, setDataProrrogacao] = useState("");
  const [motivoProrrogacao, setMotivoProrrogacao] = useState("");
  const [observacaoProrrogacao, setObservacaoProrrogacao] = useState("");
  const [texto, setTexto] = useState("");

  // Busca dia de vencimento da empresa
  const { data: empresaInfo } = useQuery({
    queryKey: ["empresa-vencimento", row?.empresa_id],
    queryFn: async () => {
      if (!row?.empresa_id) return null;
      const { data, error } = await supabase
        .from("empresas")
        .select("data_vencimento_fatura, pagamento_via_deposito, codigo_contrato, periodo_especifico_cobranca, periodo_cobranca_inicio")
        .eq("id", row.empresa_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    enabled: !!row?.empresa_id && open,
  });

  // Resetar ao abrir
  useEffect(() => {
    if (!open) return;
    setStep("prorrogacao");
    setProrrogar(null);
    setDataProrrogacao(row?.data_prorrogacao || "");
    setMotivoProrrogacao(row?.motivo_prorrogacao || "");
    setObservacaoProrrogacao(row?.observacao_prorrogacao || "");
    setTexto("");
  }, [open, row]);

  const competencia = useMemo(() => {
    const nome = anexosNomes.find((n) => /\.(xlsx|xls|csv)$/i.test(n)) || anexosNomes[0] || null;
    return detectarCompetencia(row?.mes_referencia, nome);
  }, [row, anexosNomes]);

  // Status nota emitida → exibe DDA
  const notaEmitida = useMemo(() => {
    if (!row) return false;
    if (row.data_envio_nota) return true;
    if (row.status === "Nota emitida" || row.status === "Enviada") return true;
    return false;
  }, [row]);

  const buildTexto = (vencimentoBR: string): string => {
    if (!resultados || !competencia) return "";
    const codigo = String((empresaInfo as any)?.codigo_contrato ?? "").trim();
    const poFixo = codigo === "571" ? "4600004172" : null;

    // Período específico de cobrança (intervalo de 30 dias) tem precedência sobre a competência.
    let periodoCobrancaLabel: string | null = null;
    const temPeriodoEspecifico = !!(empresaInfo as any)?.periodo_especifico_cobranca;
    const dataBase = (empresaInfo as any)?.periodo_cobranca_inicio as string | null | undefined;
    if (temPeriodoEspecifico && dataBase && row?.mes_referencia) {
      const intervalo = calcularPeriodoCobranca(dataBase, row.mes_referencia);
      if (intervalo) periodoCobrancaLabel = formatPeriodoCobranca(intervalo.inicio, intervalo.fim);
    }

    return gerarHistoricoTexto(resultados, {
      competenciaLabel: competencia.label,
      dataVencimento: vencimentoBR,
      incluirDda: notaEmitida,
      pagamentoViaDeposito: !!(empresaInfo as any)?.pagamento_via_deposito,
      poFixo,
      periodoCobrancaLabel,
    });
  };


  const irParaPreview = async (prorrogou: boolean) => {
    if (!row || !competencia) {
      toast.error("Não foi possível identificar a competência.");
      return;
    }

    let vencimentoBR: string;

    if (prorrogou) {
      if (!dataProrrogacao || !motivoProrrogacao) {
        toast.error("Preencha data e motivo da prorrogação.");
        return;
      }
      // Persiste prorrogação em financeiro_movimentacoes
      const { error } = await supabase
        .from("financeiro_movimentacoes")
        .update({
          possui_prorrogacao: true,
          data_prorrogacao: dataProrrogacao,
          motivo_prorrogacao: motivoProrrogacao,
          observacao_prorrogacao: observacaoProrrogacao || null,
          data_vencimento: dataProrrogacao,
        })
        .eq("id", row.id);
      if (error) {
        toast.error("Erro ao salvar prorrogação: " + error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      vencimentoBR = isoToBR(dataProrrogacao);
      toast.success("Prorrogação salva.");
    } else {
      // Prioriza o dia de vencimento da própria movimentação (coluna VENCIMENTO da tabela);
      // se ausente, usa o cadastrado na empresa.
      let diaVenc: number | null = null;
      if (row.data_vencimento) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(row.data_vencimento);
        if (m) diaVenc = parseInt(m[3], 10);
        else {
          const n = parseInt(String(row.data_vencimento), 10);
          if (Number.isFinite(n) && n >= 1 && n <= 31) diaVenc = n;
        }
      }
      if (diaVenc == null && empresaInfo?.data_vencimento_fatura != null) {
        const v: any = empresaInfo.data_vencimento_fatura;
        const n = typeof v === "number" ? v : parseInt(String(v), 10);
        if (Number.isFinite(n) && n >= 1 && n <= 31) diaVenc = n;
      }
      vencimentoBR = calcularVencimentoPadrao(
        diaVenc,
        competencia.mes,
        competencia.ano,
      );
    }

    setTexto(buildTexto(vencimentoBR));
    setStep("preview");
  };


  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Histórico copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Histórico Automático
          </DialogTitle>
          <DialogDescription>
            {row?.empresa_nome} — {competencia?.label ?? row?.mes_referencia}
          </DialogDescription>
        </DialogHeader>

        {step === "prorrogacao" && (
          <div className="space-y-4 py-2">
            {prorrogar === null && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  O vencimento será prorrogado?
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setProrrogar(true)} variant="outline" className="flex-1">
                    Sim
                  </Button>
                  <Button onClick={() => { setProrrogar(false); irParaPreview(false); }} className="flex-1">
                    Não
                  </Button>
                </div>
              </div>
            )}

            {prorrogar === true && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="data-prorrog">Data da prorrogação</Label>
                  <Input
                    id="data-prorrog"
                    type="date"
                    value={dataProrrogacao}
                    onChange={(e) => setDataProrrogacao(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="motivo-prorrog">Motivo da prorrogação</Label>
                  <Select
                    value={motivoProrrogacao || undefined}
                    onValueChange={(v) => setMotivoProrrogacao(v)}
                  >
                    <SelectTrigger id="motivo-prorrog">
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_PRORROGACAO.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="obs-prorrog">Observação</Label>
                  <Textarea
                    id="obs-prorrog"
                    value={observacaoProrrogacao}
                    onChange={(e) => setObservacaoProrrogacao(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setProrrogar(null)}>Voltar</Button>
                  <Button onClick={() => irParaPreview(true)}>Continuar</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 py-2">
            <Label>Pré-visualização do histórico (editável)</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={16}
              className="font-mono text-xs"
            />
            <DialogFooter>
              <Button onClick={handleCopiar} className="gap-1">
                <Copy className="h-4 w-4" />
                Copiar histórico
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
