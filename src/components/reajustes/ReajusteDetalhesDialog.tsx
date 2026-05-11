import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Building2 } from "lucide-react";
import { formatCentavosBRL } from "@/lib/reajuste-utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reajuste: any | null;
  empresaNome?: string;
}

export function ReajusteDetalhesDialog({ open, onOpenChange, reajuste, empresaNome }: Props) {
  if (!reajuste) return null;
  const enfAntigo = reajuste.valor_antigo_enfermaria_centavos || 0;
  const aptAntigo = reajuste.valor_antigo_apartamento_centavos || 0;
  const enfReaj = reajuste.valor_reajustado_enfermaria_centavos || 0;
  const aptReaj = reajuste.valor_reajustado_apartamento_centavos || 0;
  const enfRetro = reajuste.valor_retroativo_enfermaria_centavos || 0;
  const aptRetro = reajuste.valor_retroativo_apartamento_centavos || 0;
  const enfFinal = reajuste.valor_final_enfermaria_centavos || 0;
  const aptFinal = reajuste.valor_final_apartamento_centavos || 0;
  const pct = Number(reajuste.percentual || 0).toFixed(2).replace(".", ",");
  const meses = reajuste.meses_retroativos || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Reajuste {empresaNome ? `— ${empresaNome}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Percentual" value={`${pct}%`} />
          <Stat label="Meses retroativos" value={String(meses)} />
          <Stat label="Ano" value={String(reajuste.ano)} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <CategoriaCard
            cor="blue"
            icon={<BedDouble className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            titulo="Enfermaria"
            atual={enfAntigo} reaj={enfReaj} retro={enfRetro} final={enfFinal} meses={meses}
          />
          <CategoriaCard
            cor="purple"
            icon={<Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            titulo="Apartamento"
            atual={aptAntigo} reaj={aptReaj} retro={aptRetro} final={aptFinal} meses={meses}
          />
        </div>
        <div className="rounded-lg border bg-primary/5 p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total Final (Enfermaria + Apartamento)</span>
          <span className="text-2xl font-bold text-primary">{formatCentavosBRL(enfFinal + aptFinal)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 bg-muted/40">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function CategoriaCard({ cor, icon, titulo, atual, reaj, retro, final, meses }: {
  cor: "blue" | "purple"; icon: React.ReactNode; titulo: string;
  atual: number; reaj: number; retro: number; final: number; meses: number;
}) {
  const c = cor === "blue"
    ? { border: "border-blue-500/30", bg: "bg-blue-500/5", divider: "border-blue-500/20", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", text: "text-blue-700 dark:text-blue-400" }
    : { border: "border-purple-500/30", bg: "bg-purple-500/5", divider: "border-purple-500/20", badge: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30", text: "text-purple-700 dark:text-purple-400" };
  return (
    <div className={`rounded-xl border-2 ${c.border} ${c.bg} p-4 space-y-2`}>
      <div className="flex items-center gap-2">
        {icon}
        <Badge variant="outline" className={c.badge}>{titulo}</Badge>
      </div>
      <Linha label="Valor Atual" value={formatCentavosBRL(atual)} />
      <Linha label="Reajustado" value={formatCentavosBRL(reaj)} />
      <Linha label={`Retroativo${meses > 0 ? ` (${meses}m)` : ""}`} value={formatCentavosBRL(retro)} />
      <div className={`flex justify-between items-center pt-2 mt-1 border-t ${c.divider}`}>
        <span className="text-xs text-muted-foreground">Valor Final</span>
        <span className={`text-lg font-bold ${c.text}`}>{formatCentavosBRL(final)}</span>
      </div>
    </div>
  );
}

function Linha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
