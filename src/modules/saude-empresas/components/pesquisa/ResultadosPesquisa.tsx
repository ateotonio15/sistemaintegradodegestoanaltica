import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
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
      .sort((a, b) => b.pessoas - a.pessoas || b.media - a.media)
      .slice(0, 12);
  }, [notas, canonico]);

  const porEmpresaMedia = useMemo(
    () => [...porEmpresa].sort((a, b) => b.media - a.media),
    [porEmpresa],
  );

  const distribuicaoNotas = useMemo(() => {
    const map = new Map<string, { empresa: string; pessoas: Set<string>; notas: Record<number, number> }>();
    notas.forEach((i) => {
      const label = nomeEmpresa(i.empresa);
      if (!label) return;
      const key = label.toLowerCase();
      const cur = map.get(key) ?? { empresa: label, pessoas: new Set<string>(), notas: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
      cur.pessoas.add(i.resposta_id);
      const n = Math.round(i.valor_nota ?? 0);
      if (n >= 1 && n <= 5) cur.notas[n] = (cur.notas[n] ?? 0) + 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((v) => ({
        empresa: v.empresa,
        pessoas: v.pessoas.size,
        nota1: v.notas[1],
        nota2: v.notas[2],
        nota3: v.notas[3],
        nota4: v.notas[4],
        nota5: v.notas[5],
      }))
      .sort((a, b) => b.pessoas - a.pessoas)
      .slice(0, 12);
  }, [notas, canonico]);



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

  // IDs de respostas que possuem nota válida (para comentários só aparecerem junto de uma nota)
  const respostasComNota = useMemo(
    () => new Set(filtrado.filter((i) => i.tipo === "nota" && i.valor_nota != null).map((i) => i.resposta_id)),
    [filtrado],
  );

  const textos = useMemo(
    () =>
      filtrado.filter(
        (i) =>
          i.tipo === "texto_livre" &&
          respostasComNota.has(i.resposta_id) &&
          (i.valor_texto ?? "").trim(),
      ),
    [filtrado, respostasComNota],
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
            <Badge variant="outline" className="text-[11px]">
              {porEmpresa.reduce((s, e) => s + e.pessoas, 0)} pessoas · {porEmpresa.length} empresas
            </Badge>
          </div>
          {porEmpresa.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação no filtro atual.</p>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-auto pr-1">
              {porEmpresa.map((e) => (
                <div key={e.empresa} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium truncate" title={e.empresa}>{e.empresa}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {e.pessoas} {e.pessoas === 1 ? "pessoa" : "pessoas"} · <span className="text-foreground font-semibold">{e.media}</span>/5
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(4, (e.media / 5) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>


      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Média por empresa"
          subtitle="Nota média de satisfação (0 a 5)"
          empty={porEmpresaMedia.length === 0}
          height={260}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porEmpresaMedia} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 5]} hide />
              <YAxis
                type="category"
                dataKey="empresa"
                width={130}
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <RTooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v}/5`, "Média"]}
              />
              <Bar
                dataKey="media"
                name="Média"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                label={{ position: "right", formatter: (v: number) => v, fontSize: 10, fill: "hsl(var(--foreground))" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Quantidade de pessoas por empresa"
          subtitle="Avaliadores únicos"
          empty={porEmpresa.length === 0}
          height={260}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porEmpresa} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="empresa"
                width={130}
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <RTooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v} pessoa${v === 1 ? "" : "s"}`, "Pessoas"]}
              />
              <Bar
                dataKey="pessoas"
                name="Pessoas"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                label={{ position: "right", formatter: (v: number) => v, fontSize: 10, fill: "hsl(var(--foreground))" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Notas por empresa"
          subtitle="Distribuição das notas 1 a 5"
          empty={distribuicaoNotas.length === 0}
          height={260}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distribuicaoNotas} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="empresa"
                width={120}
                tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <RTooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any, n: any) => [`${v} resposta${v === 1 ? "" : "s"}`, `Nota ${n}`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar stackId="a" dataKey="nota1" name="1" fill="hsl(0 84% 60%)" radius={[0, 0, 0, 0]} />
              <Bar stackId="a" dataKey="nota2" name="2" fill="hsl(25 95% 53%)" />
              <Bar stackId="a" dataKey="nota3" name="3" fill="hsl(45 93% 47%)" />
              <Bar stackId="a" dataKey="nota4" name="4" fill="hsl(142 45% 55%)" />
              <Bar stackId="a" dataKey="nota5" name="5" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
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
                    {p.origem === "acao" ? "Ação de saúde" : p.tema ?? "Sem tema"} · {p.data?.split("-").reverse().join("/")}
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
                  {t.empresa} · {t.origem === "acao" ? "ação" : t.tema ?? "sem tema"} · {t.data?.split("-").reverse().join("/")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
