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
  /** Recebe o total calculado (em centavos) para preencher a cobrança. */
  onAplicar?: (totalCentavos: number, resumo: string) => void;
  /** Segue para o cadastro da cobrança sem usar o cálculo. */
  onPular?: () => void;
}

type Item = {
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

const br = (d: string) => (d ? d.split("-").reverse().join("/") : "—");

export function CalculadoraRetroativaDialog({ open, onOpenChange, onAplicar, onPular }: Props) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [beneficiarios, setBeneficiarios] = useState("1");
  const [mensalidade, setMensalidade] = useState("");
  const [divisor, setDivisor] = useState("30");
  const [copiado, setCopiado] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);

  useEffect(() => {
    if (!open) setCopiado(false);
  }, [open]);

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

  const resumoItem = (i: Item) =>
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
    return todos.map((i) => `${resumoItem(i)} = ${formatBRLFromCentavos(i.total)}`).join(" | ");
  }, [itens, atual, inicio, fim]);

  const limparCampos = () => {
    setInicio("");
    setFim("");
    setBeneficiarios("1");
    setMensalidade("");
    setDivisor("30");
  };

  const adicionarItem = () => {
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

  const podeAplicar = totalGeral > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-lg sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Calculadora de Cobrança Retroativa
          </DialogTitle>
          <DialogDescription>
            Cálculo proporcional por dias: (mensalidade ÷ divisor) × dias × beneficiários. Adicione
            quantos cálculos precisar — o total será somado no final.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Início da cobrança</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim da cobrança</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nº de beneficiários</Label>
              <Input
                type="number"
                min={1}
                value={beneficiarios}
                onChange={(e) => setBeneficiarios(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensalidade base (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={mensalidade}
                onChange={(e) => setMensalidade(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
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

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Dias cobrados</span>
              <span className="font-medium text-foreground">{atual.dias || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Valor diário</span>
              <span className="font-medium text-foreground">
                {atual.mensalCent > 0 ? formatBRLFromCentavos(Math.round(atual.diarioCent)) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Por beneficiário</span>
              <span className="font-medium text-foreground">
                {atual.valido ? formatBRLFromCentavos(atual.porBeneficiario) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium">Subtotal deste cálculo</span>
              <span className="text-base font-semibold text-foreground">
                {atual.valido ? formatBRLFromCentavos(atual.total) : "—"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={!atual.valido}
              onClick={adicionarItem}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar à soma
            </Button>
          </div>

          {itens.length > 0 && (
            <div className="rounded-lg border divide-y">
              {itens.map((i, idx) => (
                <div key={i.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                  <p className="text-xs text-muted-foreground truncate flex-1">{resumoItem(i)}</p>
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    {formatBRLFromCentavos(i.total)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setItens((p) => p.filter((x) => x.id !== i.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
            <span className="text-sm font-medium">Total a cobrar</span>
            <span className="text-lg font-bold text-primary tabular-nums">
              {totalGeral > 0 ? formatBRLFromCentavos(totalGeral) : "—"}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
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
                onClick={() => {
                  onOpenChange(false);
                  onPular();
                }}
              >
                Preencher manualmente
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={!podeAplicar}
              onClick={async () => {
                await navigator.clipboard.writeText(
                  (totalGeral / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                );
                setCopiado(true);
                toast.success("Valor copiado.");
              }}
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar valor
            </Button>
            {onAplicar && (
              <Button
                disabled={!podeAplicar}
                onClick={() => {
                  onAplicar(totalGeral, resumoFinal);
                  onOpenChange(false);
                }}
              >
                Usar total
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
