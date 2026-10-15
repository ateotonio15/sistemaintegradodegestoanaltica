import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Star, Users, MessageSquare, TrendingUp, Building2, Award, Calendar, Eye, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const db = supabase as any;

interface Props {
  form: any;
  tipo?: "rh" | "plantao";
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

export function AvaliacoesRHDashboard({ form, tipo = "rh" }: Props) {
  const [loading, setLoading] = useState(true);
  const [todasRespostas, setTodasRespostas] = useState<Resposta[]>([]);
  const [mesFiltro, setMesFiltro] = useState<string>("todos");
  const [execSelecionada, setExecSelecionada] = useState<string | null>(null);
  const [meuNome, setMeuNome] = useState<string>("");
  const [exportando, setExportando] = useState(false);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (!user?.id) { setMeuNome(""); return; }
    (async () => {
      const { data } = await db.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      setMeuNome((data?.display_name || "").toString());
    })();
  }, [user?.id]);

  // Somente admin e as executivas autorizadas podem ver as avaliações individuais
  const NOMES_AUTORIZADOS = ["tania", "glaucia", "jaina", "marcia", "mayara"];
  const podeVerDetalhes = useMemo(() => {
    if (isAdmin) return true;
    const n = meuNome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return NOMES_AUTORIZADOS.some(a => n.includes(a));
  }, [isAdmin, meuNome]);


  useEffect(() => {
    if (!form?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await db
        .from("cs_avaliacao_respostas")
        .select("id, nota_media, comentario, nome_empresa, nome_executiva, respostas, created_at")
        .eq("tipo", tipo)
        .order("created_at", { ascending: false })
        .limit(5000);
      setTodasRespostas(data || []);
      setLoading(false);
    })();
  }, [form?.id, tipo]);

  // Lista de meses disponíveis (YYYY-MM)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    todasRespostas.forEach(r => {
      const d = new Date(r.created_at);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [todasRespostas]);

  const respostas = useMemo(() => {
    if (mesFiltro === "todos") return todasRespostas;
    return todasRespostas.filter(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === mesFiltro;
    });
  }, [todasRespostas, mesFiltro]);

  const formatMesLabel = (key: string) => {
    const [y, m] = key.split("-");
    const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${nomes[Number(m) - 1]}/${y}`;
  };

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

  // Normaliza nome para agrupar: remove acentos, caracteres especiais,
  // espaços extras e diferenças de caixa. "Márcia"/"marcia"/"MARCIA " -> "marcia".
  const normalizeKey = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  // Escolhe o melhor rótulo entre as variações: prioriza versões com acentos
  // e evita TUDO MAIÚSCULO, capitalizando a primeira letra de cada palavra.
  const prettyLabel = (variantes: string[]) => {
    const limpos = variantes.map(v => v.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!limpos.length) return "";
    const score = (s: string) => {
      const temAcento = /[\u00C0-\u017F]/.test(s) ? 2 : 0;
      const letras = s.replace(/[^a-zA-Z]/g, "").length || 1;
      const ratioMin = s.replace(/[^a-z]/g, "").length / letras;
      return temAcento + ratioMin;
    };
    const best = [...limpos].sort((a, b) => score(b) - score(a))[0];
    return best
      .toLowerCase()
      .split(" ")
      .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  };

  // Ranking executivas (consolida nomes equivalentes)
  const rankingExecutivas = useMemo(() => {
    const map = new Map<string, { variantes: string[]; soma: number; qtd: number }>();
    respostas.forEach(r => {
      const raw = (r.nome_executiva || "").trim();
      const n = Number(r.nota_media);
      if (!raw || !n) return;
      const key = normalizeKey(raw);
      if (!key) return;
      const ex = map.get(key) || { variantes: [], soma: 0, qtd: 0 };
      ex.variantes.push(raw);
      ex.soma += n; ex.qtd += 1;
      map.set(key, ex);
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, nome: prettyLabel(v.variantes), media: Number((v.soma / v.qtd).toFixed(2)), qtd: v.qtd }))
      .sort((a, b) => b.media - a.media || b.qtd - a.qtd);
  }, [respostas]);

  // Ranking de EMPRESAS (consolida nomes equivalentes)
  const rankingVolume = useMemo(() => {
    const map = new Map<string, { variantes: string[]; qtd: number }>();
    respostas.forEach(r => {
      const raw = (r.nome_empresa || "").trim();
      if (!raw) return;
      const key = normalizeKey(raw);
      if (!key) return;
      const cur = map.get(key) || { variantes: [], qtd: 0 };
      cur.variantes.push(raw);
      cur.qtd += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map(v => ({ nome: prettyLabel(v.variantes), qtd: v.qtd }))
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

  if (todasRespostas.length === 0) {
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtrar por mês:</span>
          <Select value={mesFiltro} onValueChange={setMesFiltro}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {mesesDisponiveis.map(m => (
                <SelectItem key={m} value={m}>{formatMesLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Exibindo {respostas.length} de {todasRespostas.length} avaliações
          </span>
          <Button size="sm" variant="outline" disabled={!respostas.length || exportando} onClick={async () => {
            setExportando(true);
            try {
              const { exportarAvaliacoesRHPptx } = await import("../lib/avaliacoes-rh-pptx");
              await exportarAvaliacoesRHPptx({
                titulo: form?.titulo || "Avaliação RH",
                periodo: mesFiltro === "todos" ? "Todos os meses" : formatMesLabel(mesFiltro),
                stats,
                distribuicao: distribuicao.map(d => ({ name: `Nota ${d.nota.replace("★", "")}`, value: d.qtd })),
                mediaPorPergunta,
                rankingExecutivas,
                rankingEmpresas: rankingVolume,
                evolucao: evolucao.map(e => ({ ...e, mes: formatMesLabel(e.mes) })),
              });
              toast.success("Apresentação gerada");
            } catch (e) { console.error(e); toast.error("Não foi possível gerar a apresentação"); }
            finally { setExportando(false); }
          }}>
            {exportando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Presentation className="h-4 w-4 mr-1" />}
            Exportar PPT
          </Button>
        </div>
      </div>

      {respostas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma avaliação neste mês.</p>
        </Card>
      ) : (
      <>
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
                <div key={r.key} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-yellow-500/20 text-yellow-600" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  {podeVerDetalhes ? (
                    <button
                      type="button"
                      onClick={() => setExecSelecionada(r.key)}
                      className="flex-1 truncate text-left hover:text-primary hover:underline inline-flex items-center gap-1"
                      title="Ver avaliações desta executiva"
                    >
                      <Eye className="h-3 w-3 opacity-60 shrink-0" />
                      <span className="truncate">{r.nome}</span>
                    </button>
                  ) : (
                    <span className="flex-1 truncate">{r.nome}</span>
                  )}
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

      {(() => {
        const hoje = new Date();
        const isHoje = (iso: string) => {
          const d = new Date(iso);
          return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();
        };
        const comentariosHoje = respostas.filter(r => r.comentario && r.comentario.trim() && isHoje(r.created_at));
        return (
          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-sm">Últimos comentários (hoje)</h3>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {comentariosHoje.map(r => (
                <div key={r.id} className="border-l-2 border-primary/40 pl-3 py-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{r.nome_empresa || "—"} → {r.nome_executiva || "—"}</span>
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{Number(r.nota_media).toFixed(1)}</span>
                  </div>
                  <p className="text-sm mt-1">{r.comentario}</p>
                </div>
              ))}
              {comentariosHoje.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum comentário recebido hoje.</p>
              )}
            </div>
          </Card>
        );
      })()}
      </>
      )}

      <Dialog open={!!execSelecionada} onOpenChange={(o) => !o && setExecSelecionada(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {(() => {
            if (!execSelecionada) return null;
            const item = rankingExecutivas.find(r => r.key === execSelecionada);
            const lista = respostas.filter(r => normalizeKey((r.nome_executiva || "").trim()) === execSelecionada);
            const perguntas = (form?.perguntas || []) as any[];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-500" />
                    Avaliações de {item?.nome || "—"}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{lista.length} avaliação(ões)</span>
                  {item && (
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{item.media.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="space-y-4 mt-2">
                  {lista.map(r => (
                    <Card key={r.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
                        <span className="font-medium">{r.nome_empresa || "Empresa não informada"}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {perguntas.map((p: any, idx: number) => {
                          const v = r.respostas?.[p.id];
                          return (
                            <div key={p.id} className="flex items-start justify-between gap-3 text-sm border-b border-border/50 py-1 last:border-0">
                              <span className="flex-1 text-muted-foreground">{idx + 1}. {p.titulo}</span>
                              {p.tipo === "rating" ? (
                                <span className="font-semibold flex items-center gap-1 shrink-0">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  {typeof v === "number" ? v : "—"}
                                </span>
                              ) : (
                                <span className="flex-1 text-right">{v || "—"}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Nota média</span>
                        <span className="font-bold">{Number(r.nota_media || 0).toFixed(2)}</span>
                      </div>
                      {r.comentario?.trim() && (
                        <div className="rounded-md bg-muted/40 p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário</p>
                          <p className="text-sm">{r.comentario}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                  {lista.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma avaliação no período filtrado.</p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
