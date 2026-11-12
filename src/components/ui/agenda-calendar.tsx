import { useMemo, type ReactNode } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgendaItem = { id: string; date: string; title: string; time: string; status: string; details?: ReactNode; onOpen: () => void };
type Props = {
  month: Date; onMonthChange: (date: Date) => void;
  selected: Date; onSelect: (date: Date) => void;
  items: AgendaItem[]; locked?: boolean;
  holiday: (date: Date) => string | undefined;
  dayNote?: (date: Date) => ReactNode;
  dayActions?: (date: Date) => ReactNode;
};

export function AgendaCalendar({ month, onMonthChange, selected, onSelect, items, locked, holiday, dayNote, dayActions }: Props) {
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }), [month]);
  const selectedKey = format(selected, "yyyy-MM-dd");
  const schedule = items.filter((item) => item.date === selectedKey).sort((a, b) => a.time.localeCompare(b.time));
  const select = (date: Date) => { if (!isSameMonth(date, month) && !locked) onMonthChange(startOfMonth(date)); onSelect(date); };
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 rounded-lg border bg-card p-2 sm:p-4" aria-label="Calendário mensal">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold capitalize">{format(month, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" disabled={locked} onClick={() => onMonthChange(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" disabled={locked} onClick={() => { const today = new Date(); onMonthChange(startOfMonth(today)); onSelect(today); }}>Hoje</Button>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" disabled={locked} onClick={() => onMonthChange(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((name) => <div key={name} className="pb-2 text-center text-xs font-medium text-muted-foreground">{name}</div>)}
          {days.map((date) => {
            const key = format(date, "yyyy-MM-dd");
            const outside = !isSameMonth(date, month);
            const events = outside ? [] : items.filter((item) => item.date === key);
            const note = holiday(date);
            return <Button key={key} variant="ghost" aria-label={format(date, "dd/MM/yyyy")} aria-pressed={key === selectedKey} disabled={outside && locked} title={note} onClick={() => select(date)} className={cn("h-auto min-h-[84px] min-w-0 flex-col items-stretch justify-start gap-1 overflow-hidden rounded-lg border p-1 text-left font-normal sm:p-1.5", outside && "opacity-40", (date.getDay() === 0 || date.getDay() === 6) && "bg-muted/40", note && "bg-destructive/5", key === selectedKey && "border-primary bg-primary/5 ring-1 ring-primary")}>
              <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-xs font-semibold", isToday(date) && "bg-primary text-primary-foreground")}>{date.getDate()}</span>
              {note && <span className="w-full truncate text-[10px] text-destructive">{note}</span>}
              {events.slice(0, 2).map((item) => <span key={item.id} className="block w-full truncate rounded border bg-muted px-1 py-0.5 text-[10px] leading-tight">{item.time} · {item.title}</span>)}
              {events.length > 2 && <span className="text-[10px] text-muted-foreground">+{events.length - 2} mais</span>}
            </Button>;
          })}
        </div>
      </section>
      <aside className="min-w-0 space-y-3 border-t pt-4 lg:sticky lg:top-4 lg:border-t-0 lg:pt-0" aria-label="Programação do dia">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{format(selected, "dd 'de' MMMM", { locale: ptBR })}</h2>
          {dayActions?.(selected)}
        </div>
        {holiday(selected) && <p className="rounded-lg border bg-muted p-2 text-xs">Feriado: {holiday(selected)}</p>}
        {dayNote?.(selected)}
        {!schedule.length && <p className="text-sm text-muted-foreground">Nenhuma programação agendada neste dia.</p>}
        <div className="max-h-[600px] space-y-3 overflow-y-auto">
          {schedule.map((item) => <article key={item.id} className="space-y-2 rounded-lg border bg-card p-3">
            <Button variant="link" className="h-auto w-full justify-start whitespace-normal p-0 text-left text-sm font-semibold" onClick={item.onOpen}>{item.title}</Button>
            <p className="text-xs font-medium">{item.time}</p>
            <p className="text-xs text-muted-foreground">{item.status}</p>
            <div className="space-y-1 break-words text-xs text-muted-foreground">{item.details}</div>
          </article>)}
        </div>
      </aside>
    </div>
  );
}