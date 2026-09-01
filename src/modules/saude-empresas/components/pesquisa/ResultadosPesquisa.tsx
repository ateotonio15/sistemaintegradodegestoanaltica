import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResultadosPesquisas } from "../../hooks/usePesquisas";

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PIE_COLORS = ["#2a78d6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#8a8a8a"];

const mesKey = (iso: string) => (iso ?? "").slice(0, 7);
const mesLabel = (key: string) => {
  const [a, m] = (key ?? "").split("-");
  if (!a || !m) return "—";
  return `${MESES_CURTO[Number(m) - 1] ?? m}/${a.slice(2)}`;
};

export function ResultadosPesquisa() {
  const { data: itens = [], isLoading } = useResultadosPesquisas();
  const [empresa, setEmpresa] = useState("all");
  const [periodo, setPeriodo] = useState("all");

  const empresas = useMemo(
    () =>
      (Array.from(new Set(itens.map((i) => (i.empresa ?? "").trim()))) as string[])
        .filter(Boolean)
        .sort(),
    [itens],
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
          (empresa === "all" || i.empresa === empresa) &&
          (periodo === "all" || mesKey(i.data) === periodo),
      ),
    [itens, empresa, periodo],
  );

  const totalRespostas = useMemo(
    () => new Set(filtrado.map((i) => i.resposta_id)).size,
    [filtrado],
  );

  const notas = useMemo(() => filtrado.filter((i) => i.tipo === "nota" && i.valor_nota != null), [filtrado]);

  const mediaGeral = notas.length
    ? (notas.reduce((a, b) => a + (b.valor_nota ?? 0), 0) / notas.length).toFixed(2)
    : "—";

  const porMes = useMemo(() => {
    const map = new Map<string, { soma: number; n: number; pessoas: Set<string> }>();
    notas.forEach((i) => {
      const k = mesKey(i.data);
      const cur = map.get(k) ?? { soma: 0, n: 0, pessoas: new Set<string>() };
      cur.pessoas.add(i.resposta_id);
      map.set(k, { soma: cur.soma + (i.valor_nota ?? 0), n: cur.n + 1, pessoas: cur.pessoas });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        mes: mesLabel(k),
        media: Number((v.soma / v.n).toFixed(2)),
        pessoas: v.pessoas.size,
      }));
  }, [notas]);

  const porEmpresa = useMemo(() => {
    const map = new Map<string, { soma: number; n: number; pessoas: Set<string> }>();
    notas.forEach((i) => {
      const cur = map.get(i.empresa) ?? { soma: 0, n: 0, pessoas: new Set<string>() };
      cur.pessoas.add(i.resposta_id);
      map.set(i.empresa, { soma: cur.soma + (i.valor_nota ?? 0), n: cur.n + 1, pessoas: cur.pessoas });
    });
    return Array.from(map.entries())
      .map(([k, v]) => ({
        empresa: k,
        media: Number((v.soma / v.n).toFixed(2)),
        pessoas: v.pessoas.size,
      }))
      .sort((a, b) => b.media - a.media)
      .slice(0, 12);
  }, [notas]);

  const porPalestra = useMemo(() => {
    const map = new Map<string, { empresa: string; tema: string | null; data: string; respostas: Set<string> }>();
    filtrado.forEach((i) => {
      const cur = map.get(i.palestra_id) ?? {
        empresa: i.empresa, tema: i.tema, data: i.data, respostas: new Set<string>(),
      };
      cur.respostas.add(i.resposta_id);
      map.set(i.palestra_id, cur);
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

  const textos = useMemo(
    () => filtrado.filter((i) => i.tipo === "texto_livre" && (i.valor_texto ?? "").trim()),
    [filtrado],
  );

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
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {periodos.map((p) => <SelectItem key={p} value={p}>{mesLabel(p)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Badge variant="outline">
            {totalRespostas} {totalRespostas === 1 ? "pessoa avaliou" : "pessoas avaliaram"}
          </Badge>
          <Badge variant="secondary">Média geral: {mediaGeral}</Badge>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Satisfação por mês</p>
            <span className="text-xs text-muted-foreground">{totalRespostas} avaliações</span>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={porMes} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, n: any, p: any) => [`${v} · ${p?.payload?.pessoas ?? 0} pessoas`, n]}
                />
                <Line type="monotone" dataKey="media" name="Média" stroke="#2a78d6" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Satisfação por empresa</p>
            <span className="text-xs text-muted-foreground">
              {porEmpresa.reduce((s, e) => s + e.pessoas, 0)} pessoas
            </span>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porEmpresa} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="empresa" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, n: any, p: any) => [`${v} · ${p?.payload?.pessoas ?? 0} pessoas`, n]}
                />
                <Bar dataKey="media" name="Média" fill="#2a78d6" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="pessoas" position="top" formatter={(v: any) => `${v}`} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1 max-h-40 overflow-auto">
            {porEmpresa.map((e) => (
              <div key={e.empresa} className="flex items-center justify-between text-xs">
                <span className="truncate pr-2">{e.empresa}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {e.pessoas} {e.pessoas === 1 ? "pessoa" : "pessoas"} · média {e.media}
                </span>
              </div>
            ))}
          </div>
        </Card>

      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold mb-3">Respostas por palestra</p>
        {porPalestra.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma resposta no filtro atual.</p>
        ) : (
          <div className="divide-y">
            {porPalestra.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.empresa}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.tema ?? "Sem tema"} · {p.data?.split("-").reverse().join("/")}
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
            {textos.map((t, i) => (
              <li key={i} className="rounded-md border p-3 text-sm">
                <p>{t.valor_texto}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.empresa} · {t.tema ?? "sem tema"} · {t.data?.split("-").reverse().join("/")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
