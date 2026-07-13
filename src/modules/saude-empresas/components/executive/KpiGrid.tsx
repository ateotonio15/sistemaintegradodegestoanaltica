import { motion } from "framer-motion";
import { Activity, Building2, Mic, TestTube, HeartPulse, Sparkles, Calendar, Beaker } from "lucide-react";
import type { ExecKpis } from "../../lib/exec-mock-julho-2026";

const items = [
  { key: "totalAcoes", label: "Total de Ações", icon: Activity },
  { key: "empresasAtendidas", label: "Empresas Atendidas", icon: Building2 },
  { key: "palestras", label: "Palestras", icon: Mic },
  { key: "sinaisVitais", label: "Sinais Vitais", icon: HeartPulse },
  { key: "psa", label: "PSA", icon: TestTube },
  { key: "coletasPreventivas", label: "Coletas Preventivas", icon: Beaker },
  { key: "campanhasAtivas", label: "Campanhas Ativas", icon: Sparkles },
  { key: "mediaSemanal", label: "Média Semanal", icon: Calendar },
] as const;

export function KpiGrid({ kpis }: { kpis: ExecKpis }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((it, idx) => {
        const Icon = it.icon;
        const value = (kpis as any)[it.key] as number;
        return (
          <motion.div
            key={it.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.35, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-[hsl(var(--exec-border))] bg-[hsl(var(--exec-surface))] p-5 shadow-sm"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#004d40] via-[#1b998b] to-[#004d40]" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{it.label}</p>
                <p className="mt-2 font-serif text-4xl font-semibold tabular-nums text-[hsl(var(--exec-primary))]">
                  {value.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="rounded-xl bg-[#004d40]/10 p-2.5 text-[#004d40]">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
