import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { NOVEMBRO_AZUL } from "../../lib/exec-mock-julho-2026";

export function NovembroAzulModule() {
  const d = NOVEMBRO_AZUL;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-blue-200 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6"
    >
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          <svg viewBox="0 0 80 100" className="h-24 w-20 drop-shadow-md">
            <path d="M40 90 C 10 60, 25 30, 40 45 C 55 30, 70 60, 40 90 Z" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
            <path d="M25 55 C 35 65, 45 65, 55 55" fill="none" stroke="#bfdbfe" strokeWidth="2" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Campanha do Mês</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-blue-900">Novembro Azul</h2>
          <p className="mt-1 text-sm text-blue-900/70">Prevenção ao câncer de próstata e saúde do homem</p>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="PSA Realizados" value={d.psaRealizados} />
            <Metric label="Triagem Masculina" value={d.triagemMasculina} />
            <Metric label="Adesão Operária" value={`${d.adesaoOperaria}%`} />
            <Metric label="Palestras Masculinas" value={d.palestrasHomem} />
          </div>

          <Card className="mt-5 border-blue-200 bg-white/70">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Destaques por Empresa</p>
              <div className="mt-3 grid gap-2">
                {d.destaques.map((e) => (
                  <div key={e.empresa} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{e.empresa}</span>
                    <span className="text-blue-900">PSA {e.psa} · Triagem {e.triagem}</span>
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
    <div className="rounded-xl border border-blue-200 bg-white/80 p-3">
      <p className="text-[10px] uppercase tracking-wider text-blue-600">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-blue-900 tabular-nums">{value}</p>
    </div>
  );
}
