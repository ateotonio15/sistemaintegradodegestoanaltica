import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartCard } from "@/components/dashboard/charts/ChartCard";
import { useResultadosPesquisas } from "../../hooks/usePesquisas";
import { unificarEmpresas } from "@/lib/empresa-nome-similar";


const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PIE_COLORS = ["#2a78d6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#8a8a8a"];

const mesKey = (iso: string) => (iso ?? "").slice(0, 7);
const mesLabel = (key: string) => {
  const [a, m] = (key ?? "").split("-");
  if (!a || !m) return "—";
  return `${MESES_CURTO[Number(m) - 1] ?? m}/${a.slice(2)}`;
};

const rotuloTema = (origem: string, tema?: string | null) => {
  if (origem === "acao") return "Ação de saúde";
  if (tema) return tema;
  return null;
};

type BarraEmpresaProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { empresa?: string };
  onSelecionar: (empresa?: string) => void;
};

function BarraEmpresa({ x = 0, y = 0, width = 0, height = 0, payload, onSelecionar }: BarraEmpresaProps) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={4}
      ry={4}
      fill="hsl(var(--primary))"
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`Filtrar por ${payload?.empresa ?? "empresa"}`}
      onClick={() => onSelecionar(payload?.empresa)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelecionar(payload?.empresa);
      }}
    />
  );
}

export function ResultadosPesquisa() {
  const { data: itens = [], isLoading } = useResultadosPesquisas();
  const [empresa, setEmpresa] = useState("all");
  const [periodo, setPeriodo] = useState("all");
  const [origem, setOrigem] = useState("all");

  // Unifica nomes parecidos ("Vitória regia" = "Indústrias Reunidas Vitória Régia LTDA")
  const canonico = useMemo(
    () => unificarEmpresas(itens.map((i) => (i.empresa ?? "").trim())),
    [itens],
  );
  const nomeEmpresa = (v?: string | null) => {
    const raw = (v ?? "").trim();
    return canonico.get(raw) ?? raw;
  };

  const empresas = useMemo(
    () =>
      Array.from(new Set<string>(itens.map((i) => nomeEmpresa(i.empresa))))
        .filter(Boolean)
        .sort(),

    [itens, canonico],
  );

  const periodos = useMemo(() => {
    const set = new Set<string>(
      itens.map((i) => mesKey(i.data)).filter((p): p is string => !!p),
    );
    // Sempre oferecer os últimos 12 meses, mesmo sem respostas registradas
    const hoje = new Date();
    for (let n = 0; n < 12; n++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [itens]);


  const filtrado = useMemo(
    () =>
      itens.filter(
        (i) =>
          (origem === "all" || i.origem === origem) &&
          (empresa === "all" || nomeEmpresa(i.empresa) === empresa) &&
          (periodo === "all" || mesKey(i.data) === periodo),
      ),
    [itens, empresa, periodo, origem, canonico],

  );

  const totalRespostas = useMemo(
    () => new Set(filtrado.map((i) => i.resposta_id)).size,
    [filtrado],
  );

  const notas = useMemo(() => filtrado.filter((i) => i.tipo === "nota" && i.valor_nota != null), [filtrado]);

  const mediaGeral = notas.length
    ? (notas.reduce((a, b) => a + (b.valor_nota ?? 0), 0) / notas.length).toFixed(2)
    : "—";

  const porEmpresa = useMemo(() => {
    const map = new Map<string, { label: string; soma: number; n: number; pessoas: Set<string> }>();
    notas.forEach((i) => {
      const label = nomeEmpresa(i.empresa);
      if (!label) return;
      const key = label.toLowerCase();
      const cur = map.get(key) ?? { label, soma: 0, n: 0, pessoas: new Set<string>() };
      cur.pessoas.add(i.resposta_id);
      cur.soma += i.valor_nota ?? 0;
      cur.n += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((v) => ({
        empresa: v.label,
        media: Number((v.soma / v.n).toFixed(2)),
        pessoas: v.pessoas.size,
      }))
      .sort((a, b) => b.pessoas - a.pessoas || b.media - a.media);
  }, [notas, canonico]);




  const ranking = porEmpresa;
  const mediaNum = mediaGeral === "—" ? 0 : Number(mediaGeral);

  const tendencia = useMemo(() => {
    if (periodo === "all" || mediaGeral === "—") return "Todos os meses";
    const [a, m] = periodo.split("-").map(Number);
    const d = new Date(a, m - 2, 1);
    const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = itens.filter(
      (i) => i.tipo === "nota" && i.valor_nota != null && mesKey(i.data) === prevKey &&
        (origem === "all" || i.origem === origem) && (empresa === "all" || nomeEmpresa(i.empresa) === empresa),
    );
    if (!prev.length) return `Sem base em ${mesLabel(prevKey)}`;
    const pm = prev.reduce((s, b) => s + (b.valor_nota ?? 0), 0) / prev.length;
    const dif = Number(mediaGeral) - pm;
    return `${dif > 0 ? "▲ +" : dif < 0 ? "▼ " : "= "}${dif.toFixed(2)} vs ${mesLabel(prevKey)} (${pm.toFixed(2)})`;
  }, [periodo, mediaGeral, itens, origem, empresa, canonico]);

  const insights = useMemo(() => {
    const out: { titulo: string; texto: string; tom: "ok" | "alerta" | "info" }[] = [];
    if (!ranking.length || !totalRespostas) return out;
    const top = ranking[0];
    out.push({
      titulo: "Conta-chave em destaque",
      texto: `${top.empresa} representou ${Math.round((top.pessoas / totalRespostas) * 100)}% do público (${top.pessoas} pessoas) com nota média ${top.media.toFixed(2)}.`,
      tom: "ok",
    });
    const maximas = ranking.filter((e) => e.media >= 4.95);
    if (maximas.length) out.push({ titulo: "Excelência", texto: `${maximas.length} empresa${maximas.length > 1 ? "s" : ""} com nota máxima ou praticamente máxima: ${maximas.slice(0, 3).map((e) => e.empresa).join(", ")}${maximas.length > 3 ? "…" : ""}.`, tom: "ok" });
    const abaixo = ranking.filter((e) => e.media < mediaNum - 0.001);
    if (abaixo.length) out.push({ titulo: "Atenção de relacionamento", texto: `${abaixo.length} empresa${abaixo.length > 1 ? "s" : ""} abaixo da média geral (${mediaGeral}): ${abaixo.slice(0, 3).map((e) => `${e.empresa} (${e.media.toFixed(2)})`).join(", ")}${abaixo.length > 3 ? "…" : ""}.`, tom: abaixo.some((e) => e.media < 4) ? "alerta" : "info" });
    else out.push({ titulo: "Atenção de relacionamento", texto: "Nenhuma empresa abaixo da média geral no período.", tom: "ok" });
    return out;
  }, [ranking, totalRespostas, mediaNum, mediaGeral]);

  const porPalestra = useMemo(() => {
    const map = new Map<string, { empresa: string; tema: string | null; data: string; origem: string; respostas: Set<string> }>();
    filtrado.forEach((i) => {
      const emp = nomeEmpresa(i.empresa);
      const key = `${i.origem}|${i.palestra_id}|${emp}|${i.data}`;
      const cur = map.get(key) ?? {
        empresa: emp, tema: i.tema, data: i.data, origem: i.origem, respostas: new Set<string>(),

      };
      cur.respostas.add(i.resposta_id);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  }, [filtrado]);

  const multiplas = useMemo(() => {
    const map = new Map<string, { pergunta: string; dist: Map<string, number> }>();
    filtrado
      .filter((i) => i.tipo === "multipla_escolha" && i.valor_texto)
      .forEach((i) => {
        const cur = map.get(i.pergunta_id) ?? { pergunta: i.pergunta, dist: new Map<string, number>() };
        cur.dist.set(i.valor_texto!, (cur.dist.get(i.valor_texto!) ?? 0) + 1);
        map.set(i.pergunta_id, cur);
      });
    return Array.from(map.values()).map((m) => ({
      pergunta: m.pergunta,
      data: Array.from(m.dist.entries()).map(([name, value]) => ({ name, value })),
    }));
  }, [filtrado]);

  // Mapa resposta_id → nota (para comentários aparecerem junto da nota da mesma pessoa)
  const notaPorResposta = useMemo(() => {
    const m = new Map<string, number>();
    filtrado
      .filter((i) => i.tipo === "nota" && i.valor_nota != null)
      .forEach((i) => m.set(i.resposta_id, i.valor_nota!));
    return m;
  }, [filtrado]);

  const textos = useMemo(
    () =>
      filtrado.filter(
        (i) =>
          i.tipo === "texto_livre" &&
          notaPorResposta.has(i.resposta_id) &&
          (i.valor_texto ?? "").trim(),
      ),
    [filtrado, notaPorResposta],
  );

  const alternarEmpresa = (nome?: string | null) => {
    const n = (nome ?? "").trim();
    if (!n) return;
    setEmpresa((prev) => (prev === n ? "all" : n));
  };

  if (isLoading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Carregando resultados…</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={origem} onValueChange={setOrigem}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Palestras e Ações</SelectItem>
            <SelectItem value="palestra">Somente palestras</SelectItem>
            <SelectItem value="acao">Somente ações</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {periodos.map((p) => <SelectItem key={p} value={p}>{mesLabel(p)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {/* ===== KPIs executivos ===== */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiExec
          label="Nota média geral"
          value={mediaGeral === "—" ? "—" : `${mediaGeral}`}
          suffix={mediaGeral === "—" ? undefined : "/5"}
          hint={tendencia}
          destaque={mediaNum >= 4.5}
        />
        <KpiExec label="Participantes avaliadores" value={String(totalRespostas)} hint="Pessoas únicas que responderam" />
        <KpiExec label="Empresas envolvidas" value={String(ranking.length)} hint="Com ao menos uma avaliação" />
        <KpiExec
          label="Engajamento médio"
          value={porPalestra.length ? (totalRespostas / porPalestra.length).toFixed(1) : "—"}
          hint={`Avaliadores por evento · ${porPalestra.length} evento${porPalestra.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ===== Leaderboard Empresa x Satisfação ===== */}
        <Card className="rounded-xl border-border/60 p-0 shadow-sm xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div>
              <p className="text-sm font-semibold tracking-tight">Matriz Empresa × Satisfação</p>
              <p className="text-[11px] text-muted-foreground">
                Ordenado por participantes e nota média · {empresa === "all" ? "clique numa empresa para filtrar" : `filtrando ${empresa} · clique para limpar`}
              </p>
            </div>
          </div>
          {ranking.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma avaliação no filtro atual.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="px-5 py-2.5 text-left font-semibold">Empresa</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Participantes</th>
                    <th className="px-3 py-2.5 text-left font-semibold w-[34%]">Nota média</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((e, idx) => {
                    const st = statusNota(e.media);
                    return (
                      <tr
                        key={e.empresa}
                        className={`cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/40 ${empresa === e.empresa ? "bg-muted/50" : ""}`}
                        onClick={() => alternarEmpresa(e.empresa)}
                        tabIndex={0}
                        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") alternarEmpresa(e.empresa); }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-5 shrink-0 text-[11px] tabular-nums text-muted-foreground">{idx + 1}</span>
                            <span className="truncate font-medium" title={e.empresa}>{e.empresa}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {e.pessoas}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {totalRespostas ? `${Math.round((e.pessoas / totalRespostas) * 100)}%` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full ${e.media >= 4.8 ? "bg-success" : e.media >= 4 ? "bg-primary/70" : "bg-warning"}`}
                                style={{ width: `${Math.max(4, (e.media / 5) * 100)}%` }}
                              />
                            </div>
                            <span className={`w-10 text-right text-xs font-semibold tabular-nums ${e.media >= 4.8 ? "text-success" : ""}`}>
                              {e.media.toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ===== Insights ===== */}
        <Card className="rounded-xl border-border/60 p-5 shadow-sm space-y-4">
          <div>
            <p className="text-sm font-semibold tracking-tight">Destaques e insights</p>
            <p className="text-[11px] text-muted-foreground">Gerados automaticamente a partir do filtro</p>
          </div>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
          ) : (
            <ul className="space-y-3">
              {insights.map((i, k) => (
                <li key={k} className={`rounded-lg border-l-2 bg-muted/30 px-3 py-2.5 ${i.tom === "alerta" ? "border-warning" : i.tom === "ok" ? "border-success" : "border-border"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{i.titulo}</p>
                  <p className="mt-0.5 text-[13px] leading-snug">{i.texto}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold mb-3">Respostas por palestra / ação</p>
        {porPalestra.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma resposta no filtro atual.</p>
        ) : (
          <div className="divide-y">
            {porPalestra.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.empresa}</p>
                  <p className="text-xs text-muted-foreground">
                    {[rotuloTema(p.origem, p.tema), p.data?.split("-").reverse().join("/")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge variant="outline">
                  {p.respostas.size} {p.respostas.size === 1 ? "pessoa" : "pessoas"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {multiplas.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {multiplas.map((m, idx) => (
            <Card key={idx} className="p-4">
              <p className="text-sm font-semibold mb-3">{m.pergunta}</p>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={m.data} dataKey="value" nameKey="name" outerRadius={80} label>
                      {m.data.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4">
        <p className="text-sm font-semibold mb-3">Comentários (texto livre)</p>
        {textos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário no filtro atual.</p>
        ) : (
          <ul className="space-y-2">
            {textos.map((t, i) => {
              const nota = notaPorResposta.get(t.resposta_id);
              return (
                <li key={i} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0">{t.valor_texto}</p>
                    {nota != null && (
                      <span className="flex items-center gap-0.5 shrink-0" title={`Nota ${nota}/5`}>
                        {Array.from({ length: 5 }, (_, s) => (
                          <Star
                            key={s}
                            className={
                              s < nota
                                ? "h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
                                : "h-3.5 w-3.5 text-muted-foreground/30"
                            }
                          />
                        ))}
                        <span className="ml-1 text-xs font-semibold">{nota}/5</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[t.empresa, rotuloTema(t.origem, t.tema), t.data?.split("-").reverse().join("/")].filter(Boolean).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}


function statusNota(m: number) {
  if (m >= 4.8) return { label: "Excelente", cls: "bg-success/10 text-success" };
  if (m >= 4) return { label: "Satisfatório", cls: "bg-muted text-foreground/80" };
  return { label: "Atenção", cls: "bg-warning/15 text-warning" };
}

function KpiExec({ label, value, suffix, hint, destaque }: { label: string; value: string; suffix?: string; hint?: string; destaque?: boolean }) {
  return (
    <Card className="rounded-xl border-border/60 p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${destaque ? "text-success" : ""}`}>
        {value}{suffix && <span className="ml-0.5 text-base font-medium text-muted-foreground">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
