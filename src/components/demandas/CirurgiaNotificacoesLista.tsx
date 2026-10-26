import { useNavigate } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificacoesCirurgia } from "@/hooks/useNotificacoesCirurgia";
import { destinoCirurgia, mensagemCirurgia } from "@/lib/cirurgia-notificacao";
import { toast } from "sonner";

export function CirurgiaNotificacoesLista({ onNavigate }: { onNavigate: () => void }) {
  const { enabled, avisos, sync, erro, marcar } = useNotificacoesCirurgia();
  const navigate = useNavigate();
  if (!enabled) return null;
  return <section aria-label="Avisos de cirurgia" className="border-b border-border">
    <h5 className="px-3.5 pt-3 text-xs font-semibold text-success">Agenda Cirúrgica · {avisos.length} novos avisos</h5>
    {(sync?.erro || erro) && <p role="status" className="px-3.5 py-2 text-xs text-warning">Agenda indisponível. Aguardando nova verificação.</p>}
    {!sync?.ultimo_sucesso_em && !sync?.erro && <p className="px-3.5 py-2 text-xs text-muted-foreground">Aguardando primeira verificação da agenda.</p>}
    {avisos.map(n => <Button key={n.id} variant="ghost" className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none px-3.5 py-3 text-left" onClick={async () => {
      try { await marcar([n.id]); } catch { toast.error("Não foi possível marcar o aviso como lido."); }
      onNavigate(); navigate(destinoCirurgia(n.demanda_id));
    }}><CalendarCheck className="h-5 w-5 shrink-0 text-success" /><span className="min-w-0 text-xs font-normal leading-relaxed">{mensagemCirurgia(n)}</span></Button>)}
  </section>;
}