import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Calendar, Pencil, Trash2, User, Star, TrendingUp, TrendingDown, ArrowRight, FileSpreadsheet, MessageCircle, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface Props {
  empresaId: string;
  nome: string;
  plantoesIds: string[];
  plantoesDatas: string[];
  plantonista: string | null;
  totalAtendimentos: number;
  totalPlantoes: number;
  from: string;
  to: string;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface AtendRow {
  id: string;
  plantao_id: string;
  assunto: string | null;
  observacao: string | null;
}

function isWhatsapp(a: AtendRow) {
  const txt = `${a.assunto ?? ""} ${a.observacao ?? ""}`.toLowerCase();
  return /whats|wpp|zap/.test(txt);
}

function statusBadge(total: number) {
  if (total >= 60) return { label: "ALTA ATIVIDADE", color: "bg-emerald-500" };
  if (total >= 20) return { label: "ATIVIDADE MÉDIA", color: "bg-amber-500" };
  return { label: "BAIXA ATIVIDADE", color: "bg-slate-400" };
}

export function EmpresaPlantaoCard({
  empresaId, nome, plantoesIds, plantoesDatas, plantonista,
  totalAtendimentos, totalPlantoes, from, to, isAdmin, onEdit, onDelete,
}: Props) {
  const [atend, setAtend] = useState<AtendRow[]>([]);
  const [prevCount, setPrevCount] = useState<number | null>(null);
  const [fallback, setFallback] = useState<{
    ids: string[]; datas: string[]; plantonista: string | null; total: number;
  } | null>(null);

  // Se não há plantões no período filtrado, busca o histórico completo da empresa
  useEffect(() => {
    let cancel = false;
    if (plantoesIds.length > 0) { setFallback(null); return; }
    (async () => {
      const { data } = await supabase
        .from("plantoes")
        .select("id,data,plantonista,plantoes_atendimentos(count)")
        .eq("empresa_id", empresaId)
        .order("data", { ascending: false });
      if (cancel) return;
      const rows = (data as any[]) ?? [];
      if (!rows.length) { setFallback(null); return; }
      setFallback({
        ids: rows.map((r) => r.id),
        datas: rows.map((r) => r.data),
        plantonista: rows.find((r) => r.plantonista)?.plantonista ?? null,
        total: rows.reduce((acc, r) => acc + (r.plantoes_atendimentos?.[0]?.count ?? 0), 0),
      });
    })();
    return () => { cancel = true; };
  }, [empresaId, plantoesIds.join(",")]);

  const idsEfetivos = plantoesIds.length ? plantoesIds : fallback?.ids ?? [];
  const datasEfetivas = plantoesIds.length ? plantoesDatas : fallback?.datas ?? [];
  const plantonistaEfetivo = plantoesIds.length ? plantonista : fallback?.plantonista ?? null;
  const totalAtend = plantoesIds.length ? totalAtendimentos : fallback?.total ?? 0;
  const totalPlant = plantoesIds.length ? totalPlantoes : fallback?.ids.length ?? 0;
  const foraDoPeriodo = plantoesIds.length === 0 && !!fallback;

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (idsEfetivos.length === 0) { setAtend([]); return; }
      const { data } = await supabase
        .from("plantoes_atendimentos")
        .select("id,plantao_id,assunto,observacao")
        .in("plantao_id", idsEfetivos);
      if (!cancel) setAtend((data as AtendRow[]) ?? []);
    })();
    return () => { cancel = true; };
  }, [idsEfetivos.join(",")]);


  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const fromD = parseISO(from);
        const toD = parseISO(to);
        const span = Math.max(1, differenceInCalendarDays(toD, fromD) + 1);
        const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (span - 1));
        const pf = prevFrom.toISOString().slice(0, 10);
        const pt = prevTo.toISOString().slice(0, 10);
        const { data: prevPlantoes } = await supabase
          .from("plantoes")
          .select("id, plantoes_atendimentos(count)")
          .eq("empresa_id", empresaId)
          .gte("data", pf).lte("data", pt);
        const total = (prevPlantoes ?? []).reduce((acc: number, p: any) => acc + (p.plantoes_atendimentos?.[0]?.count ?? 0), 0);
        if (!cancel) setPrevCount(total);
      } catch { /* noop */ }
    })();
    return () => { cancel = true; };
  }, [empresaId, from, to]);

  const wppCount = useMemo(() => atend.filter(isWhatsapp).length, [atend]);
  const presCount = Math.max(0, totalAtend - wppCount);
  const presPct = totalAtend > 0 ? Math.round((presCount / totalAtend) * 100) : 0;
  const wppPct = totalAtend > 0 ? 100 - presPct : 0;
  const media = totalPlant > 0 ? (totalAtend / totalPlant) : 0;

  const servicoTop = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of atend) {
      const key = (a.assunto || "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    let best: string | null = null; let max = 0;
    for (const [k, v] of map) if (v > max) { max = v; best = k; }
    return best;
  }, [atend]);

  const ultimoPlantao = useMemo(() => {
    if (!datasEfetivas.length) return null;
    const sorted = [...datasEfetivas].sort();
    return sorted[sorted.length - 1];
  }, [datasEfetivas.join(",")]);

  const tendencia = useMemo(() => {
    if (prevCount === null) return null;
    if (prevCount === 0) return totalAtend > 0 ? 100 : 0;
    return Math.round(((totalAtend - prevCount) / prevCount) * 100);
  }, [prevCount, totalAtend]);

  const status = statusBadge(totalAtend);


  const exportar = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const rows = atend.map((a) => ({
      Empresa: nome, Assunto: a.assunto ?? "", Observação: a.observacao ?? "",
      Canal: isWhatsapp(a) ? "WhatsApp" : "Presencial",
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Empresa: nome, Atendimentos: totalAtend }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantoes");
    XLSX.writeFile(wb, `${nome.slice(0, 30)}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <Card className="rounded-2xl border-2 border-emerald-200/60 dark:border-emerald-900/40 bg-card p-5 space-y-4 card-shadow hover:border-emerald-400/70 transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3 items-start min-w-0">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight uppercase line-clamp-2">{nome}</div>
            <Badge className={`mt-1.5 ${status.color} hover:${status.color} text-white text-[10px] tracking-wider`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white mr-1.5" />
              {status.label}
            </Badge>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {foraDoPeriodo && (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          Sem plantões no período filtrado — exibindo histórico completo da empresa.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-muted/30 px-2 py-2.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><User className="h-3 w-3" /> Atend.</div>
          <div className="text-2xl font-bold leading-tight">{totalAtend}</div>
        </div>
        <div className="rounded-lg border bg-muted/30 px-2 py-2.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3 w-3" /> Plantões</div>
          <div className="text-2xl font-bold leading-tight">{totalPlant}</div>
        </div>
        <div className="rounded-lg border bg-muted/30 px-2 py-2.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Média</div>
          <div className="text-2xl font-bold leading-tight">{media.toFixed(1)}</div>
        </div>
      </div>

      {/* Canais */}
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5 text-emerald-600" /> Presencial</span>
            <span className="text-muted-foreground">{presCount} ({presPct}%)</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-600" style={{ width: `${presPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp</span>
            <span className="text-muted-foreground">{wppCount} ({wppPct}%)</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${wppPct}%` }} />
          </div>
        </div>
      </div>

      {/* Detalhes */}
      <div className="space-y-1.5 text-xs border-t pt-3">
        <div className="flex gap-2"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span className="text-muted-foreground">Executiva:</span><span className="font-medium truncate">{plantonistaEfetivo || "—"}</span></div>
        <div className="flex gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span className="text-muted-foreground">Último plantão:</span><span className="font-medium">{ultimoPlantao ? format(parseISO(ultimoPlantao), "dd 'de' MMM yyyy", { locale: ptBR }) : "—"}</span></div>
        <div className="flex gap-2"><Star className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span className="text-muted-foreground">Serviço top:</span><span className="font-medium truncate">{servicoTop || "—"}</span></div>
        <div className="flex gap-2">
          {tendencia !== null && tendencia >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
          <span className="text-muted-foreground">Tendência:</span>
          <span className={`font-medium ${tendencia !== null && tendencia >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {tendencia === null ? "—" : `${tendencia >= 0 ? "+" : ""}${tendencia}% vs período anterior`}
          </span>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2 pt-1">
        <Button asChild className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link to={`/plantoes/empresa/${empresaId}`}>Ver detalhes <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
        <Button variant="outline" onClick={exportar} className="gap-1.5">
          <FileSpreadsheet className="h-4 w-4" /> Exportar
        </Button>
      </div>
    </Card>
  );
}
