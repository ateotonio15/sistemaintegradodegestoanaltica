import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ChartNoAxesCombined, FileText, Workflow, Database, Network, ShieldCheck } from "lucide-react";

const nodes = [
  { label: "Contratos", icon: FileText, position: "contracts", path: "M280 130 C200 130 210 55 90 55" },
  { label: "Automação", icon: Workflow, position: "automation", path: "M280 130 C350 130 345 48 450 48" },
  { label: "Dados", icon: Database, position: "data", path: "M280 130 C370 95 410 164 475 164" },
  { label: "Integração", icon: Network, position: "integration", path: "M280 130 C285 195 330 180 350 225" },
  { label: "Segurança", icon: ShieldCheck, position: "security", path: "M280 130 C175 125 180 200 85 200" },
];

export default function LoginAnalyticsVisual() {
  const reducedMotion = useReducedMotion();
  const [screen, setScreen] = useState(() => ({ mobile: window.matchMedia("(max-width: 639px)").matches, tablet: window.matchMedia("(max-width: 1023px)").matches }));
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 639px)");
    const tablet = window.matchMedia("(max-width: 1023px)");
    const update = () => setScreen({ mobile: mobile.matches, tablet: tablet.matches });
    mobile.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => { mobile.removeEventListener("change", update); tablet.removeEventListener("change", update); };
  }, []);
  if (screen.mobile) return null;
  const visibleNodes = screen.tablet ? nodes.filter(node => ["contracts", "automation", "security"].includes(node.position)) : nodes;
  return (
    <div className="siga-analytics relative mt-7 w-full" aria-label="Contratos, Automação, Dados, Integração e Segurança conectados ao SIGA">
      <svg className="siga-analytics-connections absolute inset-0 h-full w-full" viewBox="0 0 560 260" preserveAspectRatio="none" fill="none" aria-hidden="true">
        {visibleNodes.map(({ label, path }, index) => (
          <g key={label}>
            <path d={path} className="siga-analytics-path" />
            <circle r="2" className="siga-analytics-dot" opacity={reducedMotion ? 0 : 0.75}>
              {!reducedMotion && <animateMotion dur={`${12 + index * 2}s`} begin={`${index * -3}s`} repeatCount="indefinite" path={path} />}
            </circle>
          </g>
        ))}
      </svg>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.28 }}
        className="siga-analytics-center absolute flex flex-col items-center justify-center rounded-2xl"
      >
        <ChartNoAxesCombined className="h-9 w-9" strokeWidth={1.3} aria-hidden="true" />
        <span className="mt-1.5 text-xs font-semibold">SIGA</span>
      </motion.div>
      {visibleNodes.map(({ label, icon: Icon, position }, index) => (
        <motion.div
          key={label}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 + index * 0.07 }}
          className={`siga-analytics-node siga-analytics-${position} absolute`}
        >
          <div className="siga-analytics-float">
            <div className="siga-analytics-tile flex items-center justify-center gap-2 rounded-lg px-3 py-3">
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-xs font-medium">{label}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}