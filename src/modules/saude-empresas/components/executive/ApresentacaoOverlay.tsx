import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Slide {
  title: string;
  subtitle?: string;
  render: () => React.ReactNode;
  bg?: "dark" | "light";
}

export function ApresentacaoOverlay({ slides, onClose }: { slides: Slide[]; onClose: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setI((v) => Math.min(v + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [slides.length, onClose]);

  const s = slides[i];
  const dark = s.bg === "dark";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.35 }}
          className={`relative flex-1 overflow-hidden ${dark ? "bg-gradient-to-br from-[#00332b] via-[#004d40] to-[#012a24] text-white" : "bg-[#f8fafc] text-slate-900"}`}
        >
          <div className="mx-auto flex h-full max-w-[1400px] flex-col px-16 py-14">
            <div className="mb-8">
              <p className={`text-xs uppercase tracking-[0.3em] ${dark ? "text-emerald-300/80" : "text-[#004d40]/60"}`}>
                Saúde Ocupacional · Relatório Executivo
              </p>
              <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight">{s.title}</h1>
              {s.subtitle && <p className={`mt-2 text-lg ${dark ? "text-emerald-100/70" : "text-slate-500"}`}>{s.subtitle}</p>}
            </div>
            <div className="flex-1 overflow-auto">{s.render()}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between border-t border-white/10 bg-black/60 px-6 py-3 text-white backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">{i + 1} / {slides.length}</span>
          <div className="ml-3 h-1 w-56 rounded bg-white/10">
            <div className="h-full rounded bg-emerald-400 transition-all" style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setI((v) => Math.max(v - 1, 0))}><ChevronLeft className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setI((v) => Math.min(v + 1, slides.length - 1))}><ChevronRight className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
      </div>
    </div>
  );
}
