import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { OUTUBRO_ROSA } from "../../lib/exec-mock-julho-2026";

export function OutubroRosaModule() {
  const d = OUTUBRO_ROSA;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-rose-50 p-6"
    >
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          {/* Laço rosa */}
          <svg viewBox="0 0 80 100" className="h-24 w-20 drop-shadow-md">
            <path d="M40 90 C 10 60, 25 30, 40 45 C 55 30, 70 60, 40 90 Z" fill="#ec4899" stroke="#be185d" strokeWidth="2" />
            <path d="M25 55 C 35 65, 45 65, 55 55" fill="none" stroke="#fbcfe8" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-pink-600">Campanha do Mês</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-pink-800">Outubro Rosa</h2>
          <p className="mt-1 text-sm text-pink-900/70">Prevenção ao câncer de mama e engajamento feminino</p>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Mamografias Agendadas" value={d.mamografiasAgendadas} />
            <Metric label="Mamografias Realizadas" value={d.mamografiasRealizadas} />
            <Metric label="Engajamento Feminino" value={`${d.engajamentoFeminino}%`} />
            <Metric label="Palestras Femininas" value={d.palestrasMulher} />
          </div>

          <Card className="mt-5 border-pink-200 bg-white/70">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-700">Destaques por Empresa</p>
              <div className="mt-3 grid gap-2">
                {d.destaques.map((e) => (
                  <div key={e.empresa} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{e.empresa}</span>
                    <span className="text-pink-800">{e.realizadas}/{e.agendadas} realizadas</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-pink-200 bg-white/80 p-3">
      <p className="text-[10px] uppercase tracking-wider text-pink-600">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-pink-800 tabular-nums">{value}</p>
    </div>
  );
}
