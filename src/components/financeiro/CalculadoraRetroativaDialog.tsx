import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Copy, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { diasEntreInclusivo, formatBRLFromCentavos } from "@/lib/cobranca-retroativa-calc";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Recebe o total calculado (em centavos) e o tipo para preencher a cobrança. */
  onAplicar?: (totalCentavos: number, resumo: string, tipo: "retroativa" | "devolucao") => void;
  /** Segue para o cadastro da cobrança sem usar o cálculo. */
  onPular?: () => void;
  /** Cálculos já registrados para esta cobrança específica. */
  itensIniciais?: CalcItem[];
  /** Notifica o pai sobre os itens registrados desta cobrança. */
  onItensChange?: (itens: CalcItem[]) => void;
  /** Tipo pré-selecionado ao abrir. */
  tipoInicial?: "retroativa" | "devolucao" | "";
}


export type CalcItem = {
  id: string;
  inicio: string;
  fim: string;
  qtd: number;
  dias: number;
  mensalCent: number;
  div: number;
  total: number;
};

const DIVISORES = [28, 29, 30, 31];

function parseBRLToCentavos(s: string): number {
  const cleaned = String(s ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const br = (d: string) => (d ? d.split("-").reverse().join("/") : "—");

export function CalculadoraRetroativaDialog({ open, onOpenChange, onAplicar, onPular, itensIniciais, onItensChange }: Props) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [beneficiarios, setBeneficiarios] = useState("1");
  const [mensalidade, setMensalidade] = useState("");
  const [divisor, setDivisor] = useState("30");
  const [copiado, setCopiado] = useState(false);
  const [itens, setItens] = useState<CalcItem[]>([]);
  const [tipoCobranca, setTipoCobranca] = useState<"" | "retroativa" | "devolucao">("");

  // Ao abrir, carrega apenas os cálculos já registrados desta cobrança
  useEffect(() => {
    if (!open) return;
    setCopiado(false);
    setItens(itensIniciais ?? []);
    setTipoCobranca("");
    setInicio("");
    setFim("");
    setBeneficiarios("1");
    setMensalidade("");
    setDivisor("30");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) onItensChange?.(itens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, open]);

  const atual = useMemo(() => {
    const dias = inicio && fim ? diasEntreInclusivo(inicio, fim) : 0;
    const qtd = Math.max(0, parseInt(beneficiarios) || 0);
    const mensalCent = parseBRLToCentavos(mensalidade);
    const div = Math.max(1, parseInt(divisor) || 30);
    const diarioCent = mensalCent / div;
    const porBeneficiario = Math.round(diarioCent * Math.max(0, dias));
    return {
      dias,
      qtd,
      mensalCent,
      div,
      diarioCent,
      porBeneficiario,
      total: porBeneficiario * qtd,
      valido: dias > 0 && qtd > 0 && mensalCent > 0,
    };
  }, [inicio, fim, beneficiarios, mensalidade, divisor]);

  const totalGeral = useMemo(
    () => itens.reduce((s, i) => s + i.total, 0) + (atual.valido ? atual.total : 0),
    [itens, atual],
  );

  const resumoItem = (i: CalcItem) =>
    `${i.qtd} benef. × ${i.dias} dia(s) (${br(i.inicio)} a ${br(i.fim)}) · ${formatBRLFromCentavos(
      i.mensalCent,
    )}/${i.div}`;

  const resumoFinal = useMemo(() => {
    const todos = [...itens];
    if (atual.valido) {
      todos.push({
        id: "atual",
        inicio,
        fim,
        qtd: atual.qtd,
        dias: atual.dias,
        mensalCent: atual.mensalCent,
        div: atual.div,
        total: atual.total,
      });
    }
    const detalhes = todos
      .map((i) => `${resumoItem(i)} = ${formatBRLFromCentavos(i.total)}`)
      .join(" | ");
    const prefixo =
      tipoCobranca === "devolucao"
        ? "Devolução"
        : tipoCobranca === "retroativa"
          ? "Cobrança retroativa"
          : "";
    return prefixo ? `${prefixo}: ${detalhes}` : detalhes;
  }, [itens, atual, inicio, fim, tipoCobranca]);

  const limparCampos = () => {
    setInicio("");
    setFim("");
    setBeneficiarios("1");
    setMensalidade("");
    setDivisor("30");
  };

  const adicionarItem = () => {
    if (!tipoCobranca) {
      toast.error("Selecione o tipo de lançamento (cobrança retroativa ou devolução).");
      return;
    }
    if (!atual.valido) return;
    setItens((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        inicio,
        fim,
        qtd: atual.qtd,
        dias: atual.dias,
        mensalCent: atual.mensalCent,
        div: atual.div,
        total: atual.total,
      },
    ]);
    limparCampos();
  };

  const podeAplicar = totalGeral > 0 && !!tipoCobranca;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[600px] max-w-[90vw] flex-col overflow-hidden p-0">
        <div className="shrink-0 bg-gradient-to-br from-primary/10 to-primary/5 border-b p-4">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/20">
                <Calculator className="h-4 w-4 text-primary" />
              </div>
              Calculadora de Cobrança Retroativa
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Cálculo proporcional por dias: (mensalidade ÷ divisor) × dias × beneficiários.
              Adicione quantos cálculos precisar — o total será somado no final.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="rounded-xl border bg-card p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Dados da cobrança
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Tipo de lançamento <span className="text-destructive">*</span>
              </Label>
              <Select value={tipoCobranca} onValueChange={(v) => setTipoCobranca(v as any)}>
                <SelectTrigger className={tipoCobranca ? "" : "border-destructive/60"}>
                  <SelectValue placeholder="Selecione: cobrança retroativa ou devolução" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retroativa">Cobrança retroativa</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
              {!tipoCobranca && (
                <p className="text-[11px] text-destructive">Campo obrigatório.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Início da cobrança</Label>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim da cobrança</Label>
                <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nº de beneficiários</Label>
                <Input
                  type="number"
                  min={1}
                  value={beneficiarios}
                  onChange={(e) => setBeneficiarios(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mensalidade base (R$)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="0,00"
                  value={mensalidade}
                  onChange={(e) => setMensalidade(formatCurrencyInput(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Dividir mensalidade por</Label>
              <Select value={divisor} onValueChange={setDivisor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIVISORES.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} dias
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Resumo do cálculo
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-card p-2 text-center border">
                <div className="text-[10px] text-muted-foreground uppercase">Dias</div>
                <div className="text-sm font-semibold tabular-nums">{atual.dias || "—"}</div>
              </div>
              <div className="rounded-lg bg-card p-2 text-center border">
                <div className="text-[10px] text-muted-foreground uppercase">Valor diário</div>
                <div className="text-sm font-semibold tabular-nums">
                  {atual.mensalCent > 0 ? formatBRLFromCentavos(Math.round(atual.diarioCent)) : "—"}
                </div>
              </div>
              <div className="rounded-lg bg-card p-2 text-center border">
                <div className="text-[10px] text-muted-foreground uppercase">Por benef.</div>
                <div className="text-sm font-semibold tabular-nums">
                  {atual.valido ? formatBRLFromCentavos(atual.porBeneficiario) : "—"}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-dashed bg-card px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Subtotal deste cálculo</span>
              <span className="text-base font-bold text-foreground tabular-nums">
                {atual.valido ? formatBRLFromCentavos(atual.total) : "—"}
              </span>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full gap-1.5"
              disabled={!atual.valido}
              onClick={adicionarItem}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar à soma
            </Button>
          </div>

          {itens.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Itens adicionados ({itens.length})
              </div>
              <div className="divide-y">
                {itens.map((i, idx) => (
                  <div key={i.id} className="flex items-center gap-2 px-4 py-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                    <p className="text-xs text-muted-foreground truncate flex-1">{resumoItem(i)}</p>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {formatBRLFromCentavos(i.total)}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setItens((p) => p.filter((x) => x.id !== i.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
            <span className="text-sm font-semibold">Total a cobrar</span>
            <span className="text-xl font-bold text-primary tabular-nums">
              {totalGeral > 0 ? formatBRLFromCentavos(totalGeral) : "—"}
            </span>
          </div>
        </div>

        <div className="shrink-0 border-t bg-muted/20 px-5 py-3">
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-3">
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  limparCampos();
                  setItens([]);
                }}
              >
                Limpar
              </Button>
              {onPular && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => {
                    onOpenChange(false);
                    onPular();
                  }}
                >
                  Preencher manualmente
                </Button>
              )}
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 sm:flex-none"
                disabled={!podeAplicar}
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    (totalGeral / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                  );
                  setCopiado(true);
                  toast.success("Valor copiado.");
                }}
              >
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar
              </Button>
              {onAplicar && (
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 sm:flex-none"
                  disabled={!podeAplicar}
                  onClick={() => {
                    if (!tipoCobranca) {
                      toast.error("Selecione o tipo de lançamento.");
                      return;
                    }
                    onAplicar(totalGeral, resumoFinal);
                    onOpenChange(false);
                  }}
                >
                  <Check className="h-4 w-4" /> Usar total
                </Button>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
