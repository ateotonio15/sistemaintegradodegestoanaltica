import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, History, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlteracaoHistorico, CATEGORIAS_HISTORICO, NomeProduto, eventoCombinaBusca, formatarValorHistorico, tomDoEvento,
} from "@/lib/historico-contrato";

interface Evento {
  id: string; usuario_nome: string | null; usuario_perfil: string | null; categoria: string; origem: string;
  acao: string; alteracoes: AlteracaoHistorico[]; motivo: string | null; created_at: string;
}

const TODOS = "__todos__";
const PERIODOS: Record<string, number | null> = { [TODOS]: null, "7": 7, "30": 30, "90": 90, "365": 365 };

const tomClasses = {
  suspensao: { dot: "bg-destructive", badge: "border-destructive/40 text-destructive" },
  reativacao: { dot: "bg-primary", badge: "border-primary/40 text-primary" },
  reajuste: { dot: "bg-sky-500", badge: "border-sky-500/40 text-sky-600 dark:text-sky-400" },
  neutro: { dot: "bg-muted-foreground/60", badge: "" },
};

function dataHora(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} • ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function HistoricoContratoSheet({ empresa, onOpenChange }: {
  empresa: { id: string; nome: string; codigo_contrato?: string | null } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState(TODOS);
  const [usuario, setUsuario] = useState(TODOS);
  const [periodo, setPeriodo] = useState(TODOS);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["empresa-historico", empresa?.id],
    enabled: !!empresa,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("empresa_historico")
        .select("id,usuario_nome,usuario_perfil,categoria,origem,acao,alteracoes,motivo,created_at")
        .eq("empresa_id", empresa!.id).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Evento[];
    },
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-planos-nomes"],
    enabled: !!empresa,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("produtos_planos").select("codigo_produto,nome_produto,acomodacao");
      return (data ?? []) as NomeProduto[];
    },
  });

  const usuarios = useMemo(() => [...new Set(eventos.map(e => e.usuario_nome || "—"))].sort(), [eventos]);
  const filtrados = useMemo(() => {
    const dias = PERIODOS[periodo];
    const limite = dias ? Date.now() - dias * 86400000 : null;
    return eventos.filter(e =>
      (categoria === TODOS || e.categoria === categoria || e.alteracoes.some(a => a.categoria === categoria)) &&
      (usuario === TODOS || (e.usuario_nome || "—") === usuario) &&
      (!limite || new Date(e.created_at).getTime() >= limite) &&
      eventoCombinaBusca(e, busca, produtos));
  }, [eventos, categoria, usuario, periodo, busca, produtos]);

  return (
    <Sheet open={!!empresa} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/10 to-transparent text-left">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Histórico do Contrato
          </p>
          <SheetTitle className="text-lg leading-tight">{empresa?.nome}</SheetTitle>
          <p className="text-sm text-muted-foreground">Contrato {empresa?.codigo_contrato || "—"}</p>
          <SheetDescription>Todas as alterações realizadas neste contrato.</SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4 space-y-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar no histórico" value={busca} onChange={e => setBusca(e.target.value)} className="pl-8" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todo o período</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={usuario} onValueChange={setUsuario}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os responsáveis</SelectItem>
                {usuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as categorias</SelectItem>
                {CATEGORIAS_HISTORICO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {eventos.length === 0 ? "Nenhuma alteração registrada ainda. As próximas alterações aparecerão aqui." : "Nenhum evento encontrado com esses filtros."}
            </p>
          ) : (
            <ol className="relative border-l border-border/70 ml-1.5 space-y-5">
              {filtrados.map(ev => {
                const tom = tomClasses[tomDoEvento(ev.acao, ev.categoria)];
                const varios = ev.alteracoes.length > 1;
                const aberto = abertos[ev.id] ?? !varios;
                return (
                  <li key={ev.id} className="ml-5">
                    <span className={cn("absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background", tom.dot)} />
                    <button type="button" className="w-full text-left rounded-lg border bg-card/60 hover:bg-card p-3 transition-colors"
                      onClick={() => setAbertos(s => ({ ...s, [ev.id]: !aberto }))}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold tabular-nums">{dataHora(ev.created_at)}</p>
                          <p className="text-sm mt-0.5">{ev.acao}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ev.usuario_nome || "—"}{varios && ` • ${ev.alteracoes.length} campos alterados`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={cn("text-[10px]", tom.badge)}>{ev.categoria}</Badge>
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
                        </div>
                      </div>
                      {aberto && (
                        <div className="mt-3 space-y-2.5">
                          {ev.alteracoes.map((a, i) => (
                            <div key={i} className="text-xs">
                              <p className="font-medium text-foreground/90">{a.rotulo}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-muted-foreground line-through decoration-muted-foreground/40 break-all">{formatarValorHistorico(a.campo, a.valor_anterior, produtos)}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-primary font-medium break-all">{formatarValorHistorico(a.campo, a.valor_novo, produtos)}</span>
                              </div>
                            </div>
                          ))}
                          {ev.motivo && <p className="text-xs"><span className="text-muted-foreground">Motivo: </span>{ev.motivo}</p>}
                          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                            Origem: {ev.origem}{ev.usuario_perfil && ` • Perfil: ${ev.usuario_perfil}`}
                          </p>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
