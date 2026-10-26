import { useEffect, useRef, useState } from "react";
import { CalendarCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAgendaPaciente } from "@/hooks/useAgendaPaciente";
import type { DadosCirurgiaPaciente } from "@/lib/agenda-paciente-lookup";

export function AlertaCirurgiaAgendada({ cirurgia }: { cirurgia: DadosCirurgiaPaciente }) {
  const data = cirurgia.data_entrada.split("-").reverse().join("/");
  return (
    <Alert className="border-warning/60 bg-warning/10 text-foreground [&>svg]:text-warning" aria-live="polite">
      <TriangleAlert className="h-5 w-5" />
      <AlertTitle className="flex flex-wrap items-center gap-2 leading-normal">
        Alerta: cirurgia já agendada
        <Badge variant="outline" className="border-warning/60 bg-warning/10 text-foreground">Cirurgia Agendada</Badge>
      </AlertTitle>
      <AlertDescription>
        Este paciente já possui um procedimento cirúrgico agendado para {data}
        {cirurgia.nome_medico ? ` com o Dr(a). ${cirurgia.nome_medico}` : " (médico não informado pela agenda)"}.
        {cirurgia.nome_procedimento && <p className="mt-1 font-medium break-words">{cirurgia.nome_procedimento}</p>}
      </AlertDescription>
    </Alert>
  );
}

/** Limita as consultas às linhas visíveis, compartilhando o cache com o formulário. */
export function SeloCirurgiaDemanda({ cpf, nome }: { cpf?: string | null; nome: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const agenda = useAgendaPaciente(cpf, nome, visible);
  const cirurgia = agenda.data?.agendamentoAtivo;
  return <div ref={ref}>
    {cirurgia && <Badge variant="outline" className="mt-1 gap-1 border-warning/60 bg-warning/10 text-foreground whitespace-nowrap" title={`${cirurgia.data_entrada.split("-").reverse().join("/")} — ${cirurgia.nome_medico || "Médico não informado"} — ${cirurgia.nome_procedimento}`}>
      <CalendarCheck className="h-3 w-3 shrink-0" /> Cirurgia Agendada
    </Badge>}
    {agenda.isError && <span className="block mt-1 text-xs text-muted-foreground">Agenda indisponível</span>}
  </div>;
}