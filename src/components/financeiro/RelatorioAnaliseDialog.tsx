import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { MultiSelectFiltro } from "@/components/dashboard/MultiSelectFiltro";
import {
  formatMesReferencia,
  getMesesOptions,
  labelStatusFinanceiro,
  type StatusFinanceiro,
} from "@/lib/financeiro-utils";
import {
  carregarDadosRelatorioAnalise,
  carregarOpcoesRelatorio,
  type RelatorioAnaliseFiltros,
} from "@/lib/financeiro-relatorio-analise-data";
import { gerarRelatorioAnaliseFaturamento } from "@/lib/financeiro-relatorio-analise-pdf";

const STATUS_ALL: StatusFinanceiro[] = [
  "Enviada",
  "Nota emitida",
  "Aguardando validação",
  "Aguardando faturamento",
  "Faturado",
  "Em faturamento",
  "Fora do prazo",
  "Aguardando nota",
  "Pendente",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Competência atualmente selecionada na aba Faturamento */
  mesAtual: string;
}

export function RelatorioAnaliseDialog({ open, onOpenChange, mesAtual }: Props) {
  const [competencias, setCompetencias] = useState<string[]>([mesAtual]);
  const [dias, setDias] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [incluirValores, setIncluirValores] = useState(true);
  const [incluirDetalhamento, setIncluirDetalhamento] = useState(true);
  const [incluirFaltantes, setIncluirFaltantes] = useState(true);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (open) setCompetencias((prev) => (prev.length === 0 ? [mesAtual] : prev));
  }, [open, mesAtual]);

  const mesesOptions = useMemo(
    () => getMesesOptions().map((m) => ({ value: m, label: formatMesReferencia(m) })),
    [],
  );

  const { data: opcoes, isLoading: loadingOpcoes } = useQuery({
    queryKey: ["relatorio-analise-opcoes", competencias.slice().sort().join(",")],
    queryFn: () => carregarOpcoesRelatorio(competencias),
    enabled: open && competencias.length > 0,
  });

  const rotuloDia = (d: number) => (d > 0 ? `Dia ${String(d).padStart(2, "0")}` : "Sem dia definido");

  const handleGerar = async () => {
    if (competencias.length === 0) {
      toast.warning("Selecione ao menos uma competência");
      return;
    }
    setGerando(true);
    try {
      const filtros: RelatorioAnaliseFiltros = {
        competencias: competencias.slice().sort(),
        diasEmissao: dias.map(Number),
        tiposMovimentacao: tipos,
        periodos,
        status: status as StatusFinanceiro[],
        responsaveis,
        incluirValores,
        incluirDetalhamento,
        incluirFaltantes,
      };
      const dados = await carregarDadosRelatorioAnalise(filtros);
      if (dados.linhas.length === 0) {
        toast.warning("Nenhum contrato encontrado com os filtros selecionados");
        return;
      }
      await gerarRelatorioAnaliseFaturamento(dados);
      toast.success(`Relatório gerado com ${dados.linhas.length} contrato(s)`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao gerar relatório: " + (e?.message || "falha desconhecida"));
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Relatório analítico de faturamento
          </DialogTitle>
          <DialogDescription>
            Escolha competências, dias de emissão, tipos de movimentação e status. O PDF traz resumo
            executivo, distribuição por status, quebras analíticas, o que falta emitir e detalhamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Competências</Label>
            <MultiSelectFiltro
              label="Competências"
              options={mesesOptions}
              selected={competencias}
              onChange={setCompetencias}
              width="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Dias de emissão</Label>
            <MultiSelectFiltro
              label="Datas de emissão"
              options={(opcoes?.dias ?? []).map((d) => ({ value: String(d), label: rotuloDia(d) }))}
              selected={dias}
              onChange={setDias}
              width="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipos de movimentação</Label>
            <MultiSelectFiltro
              label="Tipos"
              options={(opcoes?.tipos ?? []).map((t) => ({ value: t, label: t }))}
              selected={tipos}
              onChange={setTipos}
              width="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Períodos de corte</Label>
            <MultiSelectFiltro
              label="Períodos"
              options={(opcoes?.periodos ?? []).map((p) => ({ value: p, label: p }))}
              selected={periodos}
              onChange={setPeriodos}
              width="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <MultiSelectFiltro
              label="Status"
              options={STATUS_ALL.map((s) => ({ value: s, label: labelStatusFinanceiro(s) }))}
              selected={status}
              onChange={setStatus}
              width="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Responsáveis</Label>
            <MultiSelectFiltro
              label="Responsáveis"
              options={(opcoes?.responsaveis ?? []).map((r) => ({ value: r, label: r }))}
              selected={responsaveis}
              onChange={setResponsaveis}
              width="w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Switch checked={incluirValores} onCheckedChange={setIncluirValores} id="rel-valores" />
            <Label htmlFor="rel-valores" className="text-xs cursor-pointer">
              Valores das análises
            </Label>
          </div>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Switch checked={incluirFaltantes} onCheckedChange={setIncluirFaltantes} id="rel-faltam" />
            <Label htmlFor="rel-faltam" className="text-xs cursor-pointer">
              Seção "o que falta"
            </Label>
          </div>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Switch
              checked={incluirDetalhamento}
              onCheckedChange={setIncluirDetalhamento}
              id="rel-detalhe"
            />
            <Label htmlFor="rel-detalhe" className="text-xs cursor-pointer">
              Tabela detalhada
            </Label>
          </div>
          {loadingOpcoes && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> carregando opções...
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gerando}>
            Cancelar
          </Button>
          <Button onClick={handleGerar} disabled={gerando} className="gap-1.5">
            {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {gerando ? "Gerando..." : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
