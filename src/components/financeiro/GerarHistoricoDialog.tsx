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
        .select("data_vencimento_fatura")
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
    return gerarHistoricoTexto(resultados, {
      competenciaLabel: competencia.label,
      dataVencimento: vencimentoBR,
      incluirDda: notaEmitida,
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
      vencimentoBR = calcularVencimentoPadrao(
        empresaInfo?.data_vencimento_fatura ?? null,
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
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleCopiar} className="gap-1">
                <Copy className="h-4 w-4" />
                Copiar histórico
              </Button>
              <Button
                onClick={() => salvarMutation.mutate()}
                disabled={salvarMutation.isPending || !texto.trim()}
                className="gap-1"
              >
                {salvarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar histórico
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
