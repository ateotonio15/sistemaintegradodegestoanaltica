import { ShieldCheck, KeyRound, Database, Network, Workflow } from "lucide-react";

export default function LoginAccessDecor() {
  return (
    <div className="siga-access-decor" aria-hidden="true">
      {[
        { icon: ShieldCheck, label: "Segurança", position: "security" },
        { icon: KeyRound, label: "Acesso", position: "key" },
        { icon: Database, label: "Dados", position: "data" },
        { icon: Network, label: "Integração", position: "network" },
        { icon: Workflow, label: "Automação", position: "workflow" },
      ].map(({ icon: Icon, label, position }) => (
        <div key={label} className={`siga-access-satellite siga-access-${position}`}>
          <div className="siga-access-satellite-float"><Icon strokeWidth={1.5} /><span>{label}</span></div>
        </div>
      ))}
    </div>
  );
}