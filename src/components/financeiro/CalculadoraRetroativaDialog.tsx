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
import { Calculator, Copy, Check } from "lucide-react";
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


const DIVISORES = [28, 29, 30, 31];

function parseBRLToCentavos(s: string): number {
  const cleaned = String(s ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function CalculadoraRetroativaDialog({ open, onOpenChange, onAplicar, onPular }: Props) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [beneficiarios, setBeneficiarios] = useState("1");
  const [mensalidade, setMensalidade] = useState("");
  const [divisor, setDivisor] = useState("30");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!open) setCopiado(false);
  }, [open]);

  const resultado = useMemo(() => {
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

  const resumo = resultado.valido
    ? `${resultado.qtd} beneficiário(s) · ${resultado.dias} dia(s) (${inicio.split("-").reverse().join("/")} a ${fim
        .split("-")
        .reverse()
        .join("/")}) · ${formatBRLFromCentavos(resultado.mensalCent)}/${resultado.div} dias`
    : "";

  const limpar = () => {
    setInicio("");
    setFim("");
    setBeneficiarios("1");
    setMensalidade("");
    setDivisor("30");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Calculadora de Cobrança Retroativa
          </DialogTitle>
          <DialogDescription>
            Cálculo proporcional por dias: (mensalidade ÷ divisor) × dias × beneficiários.
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
              <span className="font-medium text-foreground">{resultado.dias || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Valor diário</span>
              <span className="font-medium text-foreground">
                {resultado.mensalCent > 0 ? formatBRLFromCentavos(Math.round(resultado.diarioCent)) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Por beneficiário</span>
              <span className="font-medium text-foreground">
                {resultado.valido ? formatBRLFromCentavos(resultado.porBeneficiario) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-medium">Total a cobrar</span>
              <span className="text-lg font-bold text-primary">
                {resultado.valido ? formatBRLFromCentavos(resultado.total) : "—"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={limpar}>
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
              disabled={!resultado.valido}
              onClick={async () => {
                await navigator.clipboard.writeText(
                  (resultado.total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
                );
                setCopiado(true);
                toast.success("Valor copiado.");
              }}
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar valor
            </Button>
            {onAplicar && (
              <Button
                disabled={!resultado.valido}
                onClick={() => {
                  onAplicar(resultado.total, resumo);
                  onOpenChange(false);
                }}
              >
                Continuar cobrança
              </Button>
            )}
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
