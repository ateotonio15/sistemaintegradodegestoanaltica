import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, Star, Users, MessageSquare, TrendingUp, Building2, Award } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const db = supabase as any;

interface Props {
  form: any;
}

interface Resposta {
  id: string;
  nota_media: number | null;
  comentario: string | null;
  nome_empresa: string | null;
  nome_executiva: string | null;
  respostas: any;
  created_at: string;
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

function StatCard({ icon: Icon, label, value, hint }: any) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}

export function AvaliacoesRHDashboard({ form }: Props) {
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState<Resposta[]>([]);

  useEffect(() => {
    if (!form?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await db
        .from("cs_avaliacao_respostas")
        .select("id, nota_media, comentario, nome_empresa, nome_executiva, respostas, created_at")
        .eq("formulario_id", form.id)
        .order("created_at", { ascending: false });
      setRespostas(data || []);
      setLoading(false);
    })();
  }, [form?.id]);

  const stats = useMemo(() => {
    const total = respostas.length;
    const notas = respostas.map(r => Number(r.nota_media)).filter(n => !isNaN(n) && n > 0);
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
    const comentarios = respostas.filter(r => r.comentario && r.comentario.trim().length > 0).length;
    const empresas = new Set(respostas.map(r => (r.nome_empresa || "").trim().toLowerCase()).filter(Boolean)).size;
    return { total, media, comentarios, empresas };
  }, [respostas]);

  // Distribuição de notas (1-5)
  const distribuicao = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    respostas.forEach(r => {
      const n = Math.round(Number(r.nota_media));
      if (n >= 1 && n <= 5) buckets[n - 1]++;
    });
    return buckets.map((qtd, i) => ({ nota: `${i + 1}★`, qtd }));
  }, [respostas]);

  // Média por pergunta
  const mediaPorPergunta = useMemo(() => {
    const perguntas = form?.perguntas || [];
    return perguntas
      .filter((p: any) => p.tipo === "rating")
      .map((p: any) => {
        const vals: number[] = [];
        respostas.forEach(r => {
          const v = r.respostas?.[p.id];
          if (typeof v === "number" && v > 0) vals.push(v);
        });
        const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return { pergunta: p.titulo.length > 28 ? p.titulo.slice(0, 28) + "…" : p.titulo, media: Number(media.toFixed(2)) };
      });
  }, [respostas, form]);

  // Ranking executivas
  const rankingExecutivas = useMemo(() => {
    const map = new Map<string, { soma: number; qtd: number }>();
    respostas.forEach(r => {
      const nome = (r.nome_executiva || "").trim();
      const n = Number(r.nota_media);
      if (!nome || !n) return;
      const ex = map.get(nome) || { soma: 0, qtd: 0 };
      ex.soma += n; ex.qtd += 1;
      map.set(nome, ex);
    });
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, media: Number((v.soma / v.qtd).toFixed(2)), qtd: v.qtd }))
      .sort((a, b) => b.media - a.media || b.qtd - a.qtd);
  }, [respostas]);

  // Ranking por quantidade de EMPRESAS distintas que concluíram a avaliação
  const rankingVolume = useMemo(() => {
    const map = new Map<string, Set<string>>();
    respostas.forEach(r => {
      const nome = (r.nome_executiva || "").trim();
      const empresa = (r.nome_empresa || "").trim().toLowerCase();
      if (!nome || !empresa) return;
      if (!map.has(nome)) map.set(nome, new Set());
      map.get(nome)!.add(empresa);
    });
    return Array.from(map.entries())
      .map(([nome, set]) => ({ nome, qtd: set.size }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [respostas]);

  // Evolução temporal (últimos meses)
  const evolucao = useMemo(() => {
    const map = new Map<string, { soma: number; qtd: number }>();
    respostas.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const ex = map.get(key) || { soma: 0, qtd: 0 };
      const n = Number(r.nota_media);
      if (n) { ex.soma += n; ex.qtd += 1; }
      map.set(key, ex);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, media: v.qtd ? Number((v.soma / v.qtd).toFixed(2)) : 0, qtd: v.qtd }));
  }, [respostas]);

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando dashboard...</div>;
  }

  if (respostas.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma avaliação recebida ainda.</p>
        <p className="text-xs">Compartilhe o link público acima para começar a coletar respostas.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total de avaliações" value={stats.total} />
        <StatCard icon={Star} label="Nota média geral" value={stats.media.toFixed(2)} hint="escala 1-5" />
        <StatCard icon={Building2} label="Empresas avaliando" value={stats.empresas} />
        <StatCard icon={MessageSquare} label="Com comentário" value={stats.comentarios} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Distribuição de notas</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distribuicao}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="nota" />
              <YAxis allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="qtd" name="Avaliações">
                {distribuicao.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Média por pergunta</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mediaPorPergunta} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" domain={[0, 5]} />
              <YAxis type="category" dataKey="pergunta" width={180} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="media" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-yellow-500" />
            <h3 className="font-semibold text-sm">Ranking — executivas mais bem avaliadas</h3>
          </div>
          {rankingExecutivas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {rankingExecutivas.slice(0, 10).map((r, i) => (
                <div key={r.nome} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-yellow-500/20 text-yellow-600" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <span className="flex-1 truncate">{r.nome}</span>
                  <span className="text-xs text-muted-foreground">{r.qtd} aval.</span>
                  <span className="font-semibold flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{r.media.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Ranking — empresas que concluíram a avaliação</h3>
          </div>
          {rankingVolume.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {rankingVolume.slice(0, 10).map((r, i) => (
                <div key={r.nome} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <span className="flex-1 truncate">{r.nome}</span>
                  <span className="font-semibold">{r.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {evolucao.length > 1 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">Evolução mensal</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 5]} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar yAxisId="left" dataKey="qtd" name="Avaliações" fill="hsl(var(--primary))" />
              <Bar yAxisId="right" dataKey="media" name="Nota média" fill="#eab308" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-semibold mb-3 text-sm">Últimos comentários</h3>
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {respostas.filter(r => r.comentario && r.comentario.trim()).slice(0, 20).map(r => (
            <div key={r.id} className="border-l-2 border-primary/40 pl-3 py-1">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{r.nome_empresa || "—"} → {r.nome_executiva || "—"}</span>
                <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{Number(r.nota_media).toFixed(1)}</span>
              </div>
              <p className="text-sm mt-1">{r.comentario}</p>
            </div>
          ))}
          {respostas.filter(r => r.comentario && r.comentario.trim()).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum comentário recebido.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
