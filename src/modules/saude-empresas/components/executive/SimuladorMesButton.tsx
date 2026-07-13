import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles } from "lucide-react";

export function SimuladorMesButton({
  forced, onChange,
}: { forced: number | null; onChange: (m: number | null) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 border-[#004d40]/30 text-[#004d40] hover:bg-[#004d40]/5">
          <Sparkles className="h-4 w-4" />
          {forced === 10 ? "Simulando: Outubro" : forced === 11 ? "Simulando: Novembro" : "Simular Mês"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Módulos Sazonais</p>
        <Button variant={forced === 10 ? "default" : "ghost"} size="sm"
                className="w-full justify-start" onClick={() => onChange(10)}>🎀 Outubro Rosa</Button>
        <Button variant={forced === 11 ? "default" : "ghost"} size="sm"
                className="w-full justify-start" onClick={() => onChange(11)}>💙 Novembro Azul</Button>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground"
                onClick={() => onChange(null)}>Limpar simulação</Button>
      </PopoverContent>
    </Popover>
  );
}
