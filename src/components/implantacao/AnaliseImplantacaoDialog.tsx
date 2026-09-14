import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, AlertTriangle, XCircle, FileText, Calendar, Paperclip, Rocket, Loader2, ShieldCheck, Check, Gavel, TrendingUp, Eye, ChevronDown, ChevronUp, Building2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SelecionarResponsavelCadastroDialog } from "./SelecionarResponsavelCadastroDialog";
import { AnexoPreviewDialog } from "./AnexoPreviewDialog";
import { formatDateBR, formatDay } from "@/lib/date-utils";
import { formatCentavosBRL } from "@/lib/reajuste-utils";
import { useContratoProcessoPorImplantacao, useContratoProcessoPendencias, useContratoProcessoHistorico } from "@/hooks/useContratoProcessos";
import { useBloqueioValidacaoCruzada, useExecutarValidacaoCruzada, useValidacaoCruzada } from "@/hooks/useValidacaoCruzada";
import { resumoValidacao, validarCruzado, type ValidacaoCruzadaRow } from "@/lib/validacao-cruzada";
import { cn } from "@/lib/utils";
import {
  setorLabel, statusGeralLabel, statusLabel, pendenciaEmAberto,
  type ProcessoStatusGeral,
} from "@/lib/contrato-processo";

type Tom = "verde" | "amarelo" | "vermelho" | "cinza";
const TOM_DOT: Record<Tom, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-red-500",
  cinza: "bg-muted-foreground/40",
};
const TOM_TXT: Record<Tom, string> = {
  verde: "text-emerald-600",
  amarelo: "text-amber-600",
  vermelho: "text-red-600",
  cinza: "text-muted-foreground",
};

const TOM_SURFACE: Record<Tom, string> = {
  verde: "border-emerald-500/30 bg-emerald-500/10",
  amarelo: "border-amber-500/30 bg-amber-500/10",
  vermelho: "border-red-500/30 bg-red-500/10",
  cinza: "border-border bg-muted/30",
};

type CampoEstado = "ok" | "vazio" | "naoAplicavel" | "divergente";

function CampoGridItem({
  label,
  value,
  estado = "ok",
  financeiro = false,
  title,
  className,
}: {
  label: string;
  value: ReactNode;
  estado?: CampoEstado;
  financeiro?: boolean;
  title?: string;
  className?: string;
}) {
  const vazio = estado === "vazio";
  const divergente = estado === "divergente";
  const naoAplicavel = estado === "naoAplicavel";
  return (
    <div
      title={title}
      className={cn(
        "rounded-md p-2 transition-colors",
        divergente && "border border-amber-500/40 bg-amber-500/10",
        vazio && "bg-amber-500/5",
        financeiro && !divergente && !vazio && !naoAplicavel && "bg-emerald-500/5",
        className
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-medium leading-tight",
          vazio && "text-amber-600",
          divergente && "text-amber-700",
          naoAplicavel && "text-muted-foreground",
          financeiro && !divergente && !vazio && !naoAplicavel && "text-emerald-600"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function useMapaValidacao(itens: ValidacaoCruzadaRow[]) {
  return useMemo(() => {
    const map = new Map<string, ValidacaoCruzadaRow>();
    for (const i of itens) map.set(i.campo, i);
    return map;
  }, [itens]);
}

function BlocoResumo({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="border-b border-border bg-muted/20 px-4 py-2.5">
        <h5 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</h5>
      </div>
      <div className="flex-1 space-y-4 p-4">{children}</div>
    </div>
  );
}

function CampoPrimario({
  label,
  value,
  tom = "cinza",
}: {
  label: string;
  value: React.ReactNode;
  tom?: Tom;
}) {
  const vazio = value == null || value === "" || value === "—";
  const t = vazio ? "cinza" : tom;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 break-words text-base font-semibold leading-snug", TOM_TXT[t])}>
        {vazio ? "—" : value}
      </p>
    </div>
  );
}

function CampoSecundario({ label, value }: { label: string; value: React.ReactNode }) {
  const vazio = value == null || value === "" || value === "—";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{label}</p>
      <p className="mt-0.5 break-words text-sm text-muted-foreground">{vazio ? "—" : value}</p>
    </div>
  );
}

function MetricaResumo({
  label,
  value,
  tom = "cinza",
}: {
  label: string;
  value: React.ReactNode;
  tom?: Tom;
}) {
  const vazio = value == null || value === "" || value === "—";
  const t = vazio ? "cinza" : tom;
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", TOM_DOT[t])} />
        <span className={cn("truncate text-sm font-bold", TOM_TXT[t])}>{vazio ? "—" : value}</span>
      </div>
    </div>
  );
}

function ResultadoExecutivo({
  label,
  tom,
  title = "Resultado da elegibilidade",
}: {
  label: string;
  tom: Tom;
  title?: string;
}) {
  const Icon = tom === "verde" ? CheckCircle2 : tom === "vermelho" ? XCircle : AlertTriangle;
  return (
    <div className={cn("flex min-h-20 items-center gap-3 border p-3 sm:gap-3.5 sm:p-3.5", TOM_SURFACE[tom])}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card/70", TOM_TXT[tom])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{title}</p>
        <p className={cn("mt-0.5 whitespace-nowrap text-sm font-bold leading-tight sm:text-base", TOM_TXT[tom])}>{label}</p>
      </div>
    </div>
  );
}

function tomResultado(r?: string | null): Tom {
  if (!r || r === "Em análise") return "cinza";
  if (r === "Aprovado" || r === "Implantado") return "verde";
  if (r === "Aprovado com ressalva") return "amarelo";
  return "vermelho";
}

function dataHoraCurta(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${formatDateBR(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function MetricaPonto({
  label,
  value,
  tom,
}: {
  label: string;
  value: string;
  tom: Tom;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", TOM_DOT[tom])} />
        <span className={cn("text-sm font-bold", TOM_TXT[tom])}>{value}</span>
      </div>
    </div>
  );
}

interface PontosAtencaoSectionProps {
  processo?: any;
  impl: any;
  itens: any[];
  resumo: ReturnType<typeof resumoValidacao>;
  pendencias: number;
  isLoading: boolean;
}

function PontosAtencaoSection({
  processo,
  impl,
  itens,
  resumo,
  pendencias,
  isLoading,
}: PontosAtencaoSectionProps) {
  const { toast } = useToast();
  const executar = useExecutarValidacaoCruzada();

  const problemas = itens.filter((i) => i.resultado !== "compativel");
  const statusVC = isLoading
    ? { label: "Em processamento", tom: "amarelo" as Tom }
    : !processo || itens.length === 0
    ? { label: "Não executada", tom: "cinza" as Tom }
    : problemas.length > 0
    ? { label: "Com divergências", tom: "vermelho" as Tom }
    : { label: "Compatível", tom: "verde" as Tom };

  const handleExecutar = async () => {
    if (!impl || !processo) {
      toast({ title: "Não foi possível carregar os dados do contrato.", variant: "destructive" });
      return;
    }
    try {
      const r = await executar.mutateAsync({ processoId: processo.id, itens: validarCruzado(impl) });
      toast({
        title: `Validação cruzada concluída: ${r.divergencias} divergência(s), ${r.pendencias_criadas} pendência(s) criada(s).`,
      });
    } catch (e: any) {
      toast({ title: e.message || "Erro ao executar a validação cruzada", variant: "destructive" });
    }
  };

  const semProblema = !isLoading && !!processo && itens.length > 0 && problemas.length === 0 && pendencias === 0;
  const naoExecutada = !isLoading && (!processo || itens.length === 0);

  return (
    <section aria-labelledby="pontos-atencao-title" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
        <h4 id="pontos-atencao-title" className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Validação e Pontos de Atenção
        </h4>
        {processo && (
          <Button size="sm" variant="outline" onClick={handleExecutar} disabled={executar.isPending || !impl}>
            {executar.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {itens.length ? "Revalidar" : "Executar validação"}
          </Button>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricaPonto label="Validação Cruzada" value={statusVC.label} tom={statusVC.tom} />
          <MetricaPonto
            label="Pendências"
            value={String(pendencias)}
            tom={pendencias > 0 ? "amarelo" : processo ? "verde" : "cinza"}
          />
          <MetricaPonto
            label="Divergências"
            value={String(resumo.divergentes)}
            tom={resumo.divergentes > 0 ? "vermelho" : processo ? "verde" : "cinza"}
          />
          <MetricaPonto
            label="Divergências Críticas"
            value={String(resumo.criticas)}
            tom={resumo.criticas > 0 ? "vermelho" : processo ? "verde" : "cinza"}
          />
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando validação cruzada…
          </p>
        ) : naoExecutada ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma validação cruzada registrada. Execute a validação para comparar os dados do contrato com o Anexo I.
          </p>
        ) : semProblema ? (
          <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Nenhuma divergência crítica encontrada
            </p>
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Dados principais compatíveis
            </p>
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Sem pendências impeditivas
            </p>
          </div>
        ) : problemas.length > 0 ? (
          <div className="space-y-3">
            {problemas.map((i) => {
              const isCritica = i.criticidade === "Crítica";
              return (
                <div
                  key={i.id || i.campo}
                  id={`problema-${i.id || i.campo}`}
                  className={cn(
                    "rounded-lg border p-3",
                    isCritica ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", isCritica ? "text-red-500" : "text-amber-500")} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{i.rotulo}</span>
                        {i.categoria && (
                          <Badge variant="outline" className="text-[10px]">
                            {i.categoria}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            isCritica
                              ? "border-red-500/30 bg-red-500/10 text-red-600"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-600"
                          )}
                        >
                          {i.criticidade}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {setorLabel(i.setor_destino)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-md border bg-muted/30 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contrato</p>
                          <p className="font-medium break-words">{i.valor_contrato || "—"}</p>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Anexo I</p>
                          <p className="font-medium break-words">{i.valor_anexo || "—"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : pendencias > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Existem {pendencias} pendência(s) aberta(s) no processo. Revise-as antes de aprovar.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface DecisaoItem {
  id: string;
  tipo: "divergencia" | "pendencia" | "parecer";
  titulo: string;
  subtitulo?: string;
  acao: string;
  alvo?: string;
  tom: Tom;
  icone: React.ReactNode;
  detalhes?: React.ReactNode;
}

function scrollToElement(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-lg");
  setTimeout(() => {
    el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-lg");
  }, 1800);
}

function DecisaoDiretoriaSection({
  itens,
  pendenciasList,
  historico,
}: {
  itens: any[];
  pendenciasList: any[];
  historico: any[];
}) {
  const decisoes = useMemo(() => {
    const list: DecisaoItem[] = [];

    itens.forEach((i) => {
      if (i.resultado !== "compativel" && (i.criticidade === "Alta" || i.criticidade === "Crítica")) {
        list.push({
          id: `div-${i.id || i.campo}`,
          tipo: "divergencia",
          titulo: `${i.rotulo} diverge entre Contrato e Anexo I.`,
          subtitulo: `Contrato: ${i.valor_contrato || "—"} · Anexo I: ${i.valor_anexo || "—"}`,
          acao: "Ver divergência",
          alvo: `problema-${i.id || i.campo}`,
          tom: i.criticidade === "Crítica" ? "vermelho" : "amarelo",
          icone: <AlertTriangle className="h-5 w-5" />,
        });
      }
    });

    pendenciasList.forEach((p) => {
      if (pendenciaEmAberto(p.status) && (p.criticidade === "Alta" || p.criticidade === "Crítica")) {
        list.push({
          id: `pend-${p.id}`,
          tipo: "pendencia",
          titulo: p.titulo,
          subtitulo: `${setorLabel(p.setor)} · ${p.categoria} · ${p.criticidade}`,
          acao: "Ver pendência",
          alvo: undefined,
          tom: p.criticidade === "Crítica" ? "vermelho" : "amarelo",
          icone: <AlertTriangle className="h-5 w-5" />,
          detalhes: p.descricao ? <p>{p.descricao}</p> : undefined,
        });
      }
    });

    const pareceres = historico.filter((m) =>
      ["parecer_juridico", "parecer_cadastro", "parecer_financeiro"].includes(m.acao)
    );
    const latestByAcao: Record<string, any> = {};
    pareceres.forEach((m) => {
      latestByAcao[m.acao] = m;
    });

    Object.values(latestByAcao).forEach((m) => {
      const isRessalva = m.resultado_novo === "Aprovado com ressalva";
      const isAprovado = m.resultado_novo === "Aprovado";
      if (!isRessalva && !isAprovado) return;

      const setorNome = m.acao === "parecer_juridico" ? "Jurídico" : m.acao === "parecer_financeiro" ? "Financeiro" : "Cadastro";
      const titulo =
        m.acao === "parecer_financeiro" && isAprovado
          ? "Financeiro validou o valor divergente e recomenda prosseguir."
          : `${setorNome} aprovou com ressalva${m.observacao ? ` devido à ${m.observacao}` : "."}`;

      list.push({
        id: `parecer-${m.id}`,
        tipo: "parecer",
        titulo,
        subtitulo: `${setorNome} · ${dataHoraCurta(m.created_at)}`,
        acao: m.acao === "parecer_juridico" ? "Ver análise jurídica" : "Ver parecer",
        alvo: undefined,
        tom: isRessalva ? "amarelo" : "verde",
        icone: m.acao === "parecer_juridico" ? <Gavel className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />,
        detalhes: (
          <div className="space-y-1">
            {m.observacao && (
              <p>
                <span className="font-medium">Observação:</span> {m.observacao}
              </p>
            )}
            {m.responsavel_nome && (
              <p>
                <span className="font-medium">Responsável:</span> {m.responsavel_nome}
              </p>
            )}
            {m.detalhes &&
              Object.entries(m.detalhes).map(([k, v]) => (
                <p key={k}>
                  <span className="font-medium">{k}:</span> {String(v)}
                </p>
              ))}
          </div>
        ),
      });
    });

    const ordem: Record<Tom, number> = { vermelho: 0, amarelo: 1, verde: 2, cinza: 3 };
    return list.sort((a, b) => ordem[a.tom] - ordem[b.tom]);
  }, [itens, pendenciasList, historico]);

  return (
    <section aria-labelledby="decisao-diretoria-title" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
        <h4 id="decisao-diretoria-title" className="text-sm font-semibold">O que precisa da sua decisão?</h4>
      </div>
      <div className="space-y-3 p-4">
        {decisoes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Nenhuma ação da diretoria pendente
          </p>
        ) : (
          decisoes.map((d) => <DecisaoCard key={d.id} item={d} />)
        )}
      </div>
    </section>
  );
}

function DecisaoCard({ item }: { item: DecisaoItem }) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    if (item.alvo) {
      scrollToElement(item.alvo);
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <div className={cn("rounded-lg border p-3", TOM_SURFACE[item.tom])}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 shrink-0", TOM_TXT[item.tom])}>{item.icone}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{item.titulo}</p>
          {item.subtitulo && <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitulo}</p>}
          {expanded && item.detalhes && (
            <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
              {item.detalhes}
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleClick}>
          {item.acao}
        </Button>
      </div>
    </div>
  );
}

const CATEGORIAS_DOC = [
  { key: "anexo_1", label: "ANEXO I" },
  { key: "contrato", label: "Contrato" },
  { key: "relatorio_vidas", label: "Relatório de Vidas" },
  { key: "primeira_cobranca", label: "Relatórios da Primeira Cobrança" },
  { key: "complementares", label: "Complementares" },
] as const;

function isAnexoCadastro(a: any) {
  const tipo = String(a.tipo || "").toLowerCase();
  const nome = String(a.nome_arquivo || "").toLowerCase();
  if (tipo === "anexo_1" || tipo === "relatorio_vidas") return true;
  if (nome.includes("anexo") && nome.includes("1")) return true;
  if (nome.includes("layout") && nome.includes("vida")) return true;
  if ((nome.includes("relatorio") || nome.includes("relatório")) && nome.includes("vida")) return true;
  return false;
}

function tipoDocLabel(tipo?: string) {
  const t = String(tipo || "").toLowerCase();
  switch (t) {
    case "anexo_1": return "Anexo I";
    case "contrato": return "Contrato";
    case "relatorio_vidas": return "Relatório de Vidas";
    case "primeira_cobranca": return "Primeira Cobrança";
    case "complementar": return "Complementar";
    default: return t ? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Documento";
  }
}

function DocumentosVendasSection({
  anexos,
  readOnly,
  onVisualizar,
  loading,
  open: openProp,
  onOpenChange,
}: {
  anexos: any[];
  readOnly?: boolean;
  onVisualizar: (path: string, name: string) => void;
  loading?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };
  const visiveis = readOnly ? anexos.filter(isAnexoCadastro) : anexos;

  const porCategoria = useMemo(() => {
    const map: Record<string, any[]> = {
      anexo_1: [],
      contrato: [],
      relatorio_vidas: [],
      primeira_cobranca: [],
      complementares: [],
    };
    visiveis.forEach((a) => {
      const t = String(a.tipo || "").toLowerCase();
      if (map[t]) map[t].push(a);
      else map.complementares.push(a);
    });
    return map;
  }, [visiveis]);

  const total = visiveis.length;
  const categoriasComItens = CATEGORIAS_DOC.filter((c) => porCategoria[c.key].length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card/50">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
          <h4 className="text-sm font-semibold truncate">
            {readOnly ? "Documentos para importação" : "Documentos enviados pelo Vendas"}
          </h4>
          <Badge variant="secondary" className="text-[10px] shrink-0">{total} arquivo{total !== 1 ? "s" : ""}</Badge>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 shrink-0 text-muted-foreground hover:text-foreground">
            {open ? (
              <>
                Ocultar documentos <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Ver documentos <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      {readOnly && (
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          Você visualiza apenas o Anexo 1 e o Layout de Vidas necessários para a importação.
        </p>
      )}

      <CollapsibleContent>
        <div className="border-t border-border px-4 py-4 space-y-5">
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">
              {readOnly ? "Sem Anexo 1 ou Layout de Vidas anexado." : "Sem anexos."}
            </p>
          ) : (
            categoriasComItens.map((cat) => (
              <div key={cat.key}>
                <div className="flex items-center gap-2 mb-2">
                  <h5 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat.label}</h5>
                  <Badge variant="outline" className="text-[10px]">
                    {porCategoria[cat.key].length} arquivo{porCategoria[cat.key].length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {porCategoria[cat.key].map((a: any) => {
                    const isLoading = loading === a.storage_path;
                    return (
                      <div
                        key={a.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium break-words leading-snug">{a.nome_arquivo}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{tipoDocLabel(a.tipo)}</span>
                              {a.created_at && <span>{dataHoraCurta(a.created_at)}</span>}
                              {a.uploaded_by_nome ? <span>Enviado por {a.uploaded_by_nome}</span> : <span>Enviado por —</span>}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1 self-start sm:self-center"
                          disabled={isLoading || !a.storage_path}
                          onClick={() => onVisualizar(a.storage_path, a.nome_arquivo)}
                        >
                          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                          Visualizar documento
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentosCadastroSection({
  anexos,
  onVisualizar,
  loading,
  open: openProp,
  onOpenChange,
}: {
  anexos: any[];
  onVisualizar: (path: string, name: string) => void;
  loading?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  const porCategoria = useMemo(() => {
    const map: Record<string, any[]> = {
      anexo_1: [],
      contrato: [],
      relatorio_vidas: [],
      primeira_cobranca: [],
      complementares: [],
    };
    anexos.forEach((a) => {
      const t = String(a.tipo || "").toLowerCase();
      if (map[t]) map[t].push(a);
      else map.complementares.push(a);
    });
    return map;
  }, [anexos]);

  const total = anexos.length;

  return (
    <Card className={cn("overflow-hidden border-border bg-card shadow-sm", open && "ring-1 ring-primary/10")}>
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Documentos</p>
            <h3 className="mt-1 text-lg font-bold leading-tight">
              {total} arquivo{total !== 1 ? "s" : ""} enviado{total !== 1 ? "s" : ""}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {total === 0
                ? "Nenhum documento anexado"
                : `${porCategoria.anexo_1.length} Anexo I · ${porCategoria.contrato.length} Contrato · ${porCategoria.relatorio_vidas.length} Relatório de Vidas`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open ? "Ocultar documentos" : "Visualizar documentos"}
            </Button>
          </div>
        </div>

        {open && (
          <div className="space-y-3 border-t border-border bg-muted/20 p-4 sm:p-5">
            {total === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum documento anexado à implantação.</p>
            ) : (
              CATEGORIAS_DOC.map((cat) => {
                const itens = porCategoria[cat.key];
                const qtd = itens.length;
                const temItens = qtd > 0;
                const aberta = categoriaAberta === cat.key;
                const primeiro = itens[0];

                return (
                  <div
                    key={cat.key}
                    className={cn(
                      "rounded-lg border bg-card p-3 transition-colors",
                      temItens ? "border-border" : "border-dashed border-muted-foreground/30 bg-muted/30"
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {temItens ? (
                            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                          )}
                          <h4 className="text-sm font-semibold">{cat.label}</h4>
                          <Badge variant="outline" className="text-[10px]">
                            {qtd} arquivo{qtd !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        {!temItens && (
                          <p className="mt-1 text-xs text-muted-foreground">Nenhum arquivo nesta categoria</p>
                        )}
                        {temItens && !aberta && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {itens.map((a) => a.nome_arquivo).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {temItens && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={loading === primeiro?.storage_path || !primeiro?.storage_path}
                            onClick={() => {
                              if (qtd === 1) {
                                onVisualizar(primeiro.storage_path, primeiro.nome_arquivo);
                              } else {
                                setCategoriaAberta((v) => (v === cat.key ? null : cat.key));
                              }
                            }}
                          >
                            {loading === primeiro?.storage_path ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                            {qtd === 1 ? "Visualizar" : aberta ? "Ocultar lista" : "Visualizar todos"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {aberta && temItens && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {itens.map((a: any) => {
                          const isLoading = loading === a.storage_path;
                          return (
                            <div
                              key={a.id}
                              className="flex flex-col gap-2 rounded-md border border-border bg-background p-2.5 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-medium leading-snug">{a.nome_arquivo}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {tipoDocLabel(a.tipo)}
                                    {a.created_at && ` · ${dataHoraCurta(a.created_at)}`}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 gap-1.5 self-start sm:self-center"
                                disabled={isLoading || !a.storage_path}
                                onClick={() => onVisualizar(a.storage_path, a.nome_arquivo)}
                              >
                                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                Visualizar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResumoCadastro({ impl, processo }: {
  impl: any;
  processo?: any;
}) {
  const totalVidas =
    impl.vidas_titulares != null || impl.vidas_dependentes != null
      ? (impl.vidas_titulares || 0) + (impl.vidas_dependentes || 0)
      : null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do contrato">
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Total de Vidas
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">
          {totalVidas ?? "Não informado"}
        </p>
        {totalVidas != null && (
          <p className="text-[11px] text-muted-foreground">
            {impl.vidas_titulares || 0} titulares · {impl.vidas_dependentes || 0} dependentes
          </p>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Contrato
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">
          {processo?.codigo || impl.codigo_contrato || "Não informado"}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> Vigência / Implantação
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">
          {formatDateBR(impl.inicio_atendimento || impl.data_implantacao)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" /> Modalidade
        </p>
        <p className="mt-1 text-lg font-bold tracking-tight leading-tight">
          {impl.modalidade || "Não informado"}
        </p>
      </div>
    </section>
  );
}

function EmpresaDadosCadastraisSection({ impl, onVerDocumentos }: {
  impl: any;
  onVerDocumentos?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const campos = [
    { label: "Razão Social", value: impl.nome_empresa },
    { label: "CNPJ", value: impl.cnpj },
    { label: "Telefone", value: impl.telefone },
    { label: "Endereço", value: impl.endereco },
    { label: "CEP", value: impl.cep },
    { label: "Inscrição Municipal", value: impl.inscricao_municipal },
    { label: "Inscrição Estadual", value: impl.inscricao_estadual },
    { label: "Grupo / Contrato", value: impl.grupo_contrato },
    { label: "Código do contrato", value: impl.codigo_contrato },
    { label: "Modalidade", value: impl.modalidade },
    { label: "Tipo de contrato", value: impl.tipo_contrato },
    { label: "Período de movimentação", value: impl.periodo_movimentacao },
    { label: "Dia de vencimento", value: impl.data_vencimento != null ? String(impl.data_vencimento).padStart(2, "0") : null },
    { label: "Corretora", value: impl.corretora },
    { label: "Data de implantação", value: formatDateBR(impl.data_implantacao) },
  ];

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Empresa — Dados Cadastrais</p>
            <h3 className="mt-1 break-words text-lg font-bold leading-tight">
              {impl.nome_empresa || "Empresa não informada"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              CNPJ: {impl.cnpj || "Não informado"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Visualizar Menos" : "Visualizar Mais"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onVerDocumentos}
            >
              <Paperclip className="h-4 w-4" />
              Visualizar documentos
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border bg-muted/20 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campos.map((campo) => {
                const vazio = campo.value == null || campo.value === "" || campo.value === "—";
                return (
                  <div
                    key={campo.label}
                    className={cn(
                      "rounded-md p-2.5",
                      vazio && "border border-amber-500/30 bg-amber-500/10"
                    )}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{campo.label}</p>
                    <p
                      className={cn(
                        "mt-0.5 break-words text-sm font-medium leading-tight",
                        vazio && "text-amber-700"
                      )}
                    >
                      {vazio ? (
                        <span className="inline-flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Não informada
                        </span>
                      ) : (
                        campo.value
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VidasImplantacaoSection({ impl, anexos, pendenciasList, onVisualizarAnexo }: {
  impl: any;
  anexos: any[];
  pendenciasList: any[];
  onVisualizarAnexo?: (path: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mostrarPendencias, setMostrarPendencias] = useState(false);

  const relatorio: any = impl.relatorio_validacao || null;
  const totalVidas =
    impl.total_vidas ??
    (impl.vidas_titulares != null || impl.vidas_dependentes != null
      ? (impl.vidas_titulares || 0) + (impl.vidas_dependentes || 0)
      : relatorio?.total_vidas ?? null);
  const titulares = impl.vidas_titulares ?? relatorio?.titulares ?? null;
  const dependentes = impl.vidas_dependentes ?? relatorio?.dependentes ?? null;

  const recebidas = relatorio?.linhas_lidas ?? relatorio?.total_vidas ?? null;
  const validadas = relatorio?.linhas_validas ?? relatorio?.total_vidas ?? null;
  const comPendencia = relatorio ? Number(relatorio.erros ?? 0) : null;
  const divergentes = relatorio ? Number(relatorio.alertas ?? 0) : null;
  const pendenciasRelatorio: any[] = Array.isArray(relatorio?.pendencias) ? relatorio.pendencias : [];
  const pendenciasVidas = pendenciasList.filter(
    (p) => pendenciaEmAberto(p.status) && /vida|benefici/i.test(`${p.titulo || ""} ${p.descricao || ""}`)
  );

  const anexoRelatorio = anexos.find((a) => a.tipo === "relatorio_vidas" && a.storage_path);

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Vidas da Implantação</p>
            <h3 className="mt-1 text-lg font-bold leading-tight">
              {totalVidas != null ? `${totalVidas} vidas` : "Vidas não informadas"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {titulares ?? 0} titulares · {dependentes ?? 0} dependentes
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Visualizar Menos" : "Visualizar Mais"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!anexoRelatorio}
              title={anexoRelatorio ? undefined : "Relatório de vidas não anexado"}
              onClick={() => anexoRelatorio && onVisualizarAnexo?.(anexoRelatorio.storage_path, anexoRelatorio.nome_arquivo || "Relatório de Vidas")}
            >
              <Users className="h-4 w-4" />
              Visualizar Relatório de Vidas
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-4 border-t border-border bg-muted/20 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total de vidas</p>
                <p className="mt-0.5 text-lg font-bold">{totalVidas ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Titulares</p>
                <p className="mt-0.5 text-lg font-bold">{titulares ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dependentes</p>
                <p className="mt-0.5 text-lg font-bold">{dependentes ?? "—"}</p>
              </div>
            </div>

            {relatorio && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vidas recebidas</p>
                  <p className="mt-0.5 text-sm font-semibold">{recebidas ?? "—"}</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Validadas</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600">{validadas ?? "—"}</p>
                </div>
                <div className={cn("rounded-md border p-3", comPendencia ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-card")}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Com pendência</p>
                  <p className={cn("mt-0.5 text-sm font-semibold", comPendencia ? "text-amber-700" : "")}>{comPendencia ?? "—"}</p>
                </div>
                <div className={cn("rounded-md border p-3", divergentes ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-card")}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Com divergência</p>
                  <p className={cn("mt-0.5 text-sm font-semibold", divergentes ? "text-amber-700" : "")}>{divergentes ?? "—"}</p>
                </div>
              </div>
            )}

            {relatorio && (comPendencia ?? 0) > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  {comPendencia} {comPendencia === 1 ? "vida precisa" : "vidas precisam"} de correção
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setMostrarPendencias((v) => !v)}
                  aria-expanded={mostrarPendencias}
                >
                  <Eye className="h-4 w-4" />
                  {mostrarPendencias ? "Ocultar pendências" : "Ver pendências"}
                </Button>
              </div>
            )}

            {mostrarPendencias && pendenciasRelatorio.length > 0 && (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border bg-card p-3">
                {pendenciasRelatorio.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Linha {p.linha}</span>
                      {p.coluna ? ` · ${p.coluna}` : ""} — {p.motivo}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {pendenciasVidas.length > 0 && (
              <div className="rounded-md border border-border bg-card p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pendências do processo relacionadas a vidas
                </p>
                <div className="space-y-1.5">
                  {pendenciasVidas.map((p) => (
                    <p key={p.id} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{p.titulo}</span>
                      {p.descricao ? ` — ${p.descricao}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CondicoesComerciaisSection({ impl, itensValidacao }: {
  impl: any;
  itensValidacao: ValidacaoCruzadaRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState<string | null>(null);
  const mapaValidacao = useMapaValidacao(itensValidacao);

  const fmtMoeda = (centavos: number | null | undefined) =>
    centavos != null ? formatCentavosBRL(centavos) : null;
  const fmtPct = (v: number | null | undefined) =>
    v != null ? `${Number(v).toFixed(2).replace(".", ",")}%` : null;

  const campos: { label: string; value: string | null; campoValidacao?: string }[] = [
    { label: "Valor Enfermaria", value: fmtMoeda(impl.valor_enfermaria_centavos), campoValidacao: "valor_enfermaria" },
    { label: "Valor Apartamento", value: fmtMoeda(impl.valor_apartamento_centavos), campoValidacao: "valor_apartamento" },
    { label: "% Agenciamento", value: fmtPct(impl.percentual_agenciamento) },
    { label: "% Vitalício", value: fmtPct(impl.percentual_vitalicio) },
    { label: "Corretora", value: impl.corretora },
    { label: "Código do Contrato", value: impl.codigo_contrato },
    { label: "Dia de vencimento", value: impl.data_vencimento != null ? String(impl.data_vencimento).padStart(2, "0") : null },
    { label: "Modalidade", value: impl.modalidade, campoValidacao: "modalidade" },
  ];

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Condições Comerciais</p>
            <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Enfermaria</p>
                <p className="text-lg font-bold">{fmtMoeda(impl.valor_enfermaria_centavos) ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Apartamento</p>
                <p className="text-lg font-bold">{fmtMoeda(impl.valor_apartamento_centavos) ?? "—"}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Visualizar Menos" : "Visualizar Mais"}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border bg-muted/20 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campos.map((campo) => {
                const item = campo.campoValidacao ? mapaValidacao.get(campo.campoValidacao) : undefined;
                const divergente = item?.resultado === "divergente";
                const vazio = campo.value == null || campo.value === "";
                return (
                  <div
                    key={campo.label}
                    className={cn(
                      "rounded-md p-2.5",
                      divergente && "border border-amber-500/40 bg-amber-500/10"
                    )}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{campo.label}</p>
                    {divergente ? (
                      <div className="mt-1 space-y-1">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Contrato: </span>
                          <span className="font-semibold">{item.valor_contrato ?? campo.value ?? "—"}</span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Anexo I: </span>
                          <span className="font-semibold">{item.valor_anexo ?? "—"}</span>
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Divergência encontrada
                        </p>
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 h-7 gap-1.5 px-2 text-xs"
                            onClick={() => setDetalhesAbertos((v) => (v === campo.campoValidacao! ? null : campo.campoValidacao!))}
                            aria-expanded={detalhesAbertos === campo.campoValidacao}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {detalhesAbertos === campo.campoValidacao ? "Ocultar detalhes" : "Ver detalhes"}
                          </Button>
                          {detalhesAbertos === campo.campoValidacao && (
                            <p className="mt-2 rounded-md border border-amber-500/30 bg-card p-2 text-xs text-muted-foreground">
                              {item.justificativa || "Divergência entre o contrato e o Anexo I."}
                              {item.criticidade ? ` Criticidade: ${item.criticidade}.` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className={cn("mt-0.5 break-words text-sm font-medium leading-tight", vazio && "text-muted-foreground")}>
                        {vazio ? "—" : campo.value}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Seção "Validação dos Dados" — exclusiva da visualização do Cadastro.
 * Reutiliza a Validação Cruzada já existente (sem lógica nova): mostra os
 * itens comparados Contrato x Anexo I, escondendo critérios jurídicos.
 */
function ValidacaoDadosCadastroSection({ itensValidacao, pendenciasList }: {
  itensValidacao: ValidacaoCruzadaRow[];
  pendenciasList: any[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [parecerAberto, setParecerAberto] = useState(false);

  // Critérios jurídicos não aparecem para o Cadastro.
  const relevantes = useMemo(
    () => itensValidacao.filter((i) => i.setor_destino !== "juridico"),
    [itensValidacao],
  );
  const pontos = relevantes.filter(
    (i) => i.resultado === "divergente" || i.resultado === "necessita_validacao",
  );
  const ordenados = useMemo(() => {
    const peso = (i: ValidacaoCruzadaRow) =>
      i.resultado === "divergente" ? 0 : i.resultado === "necessita_validacao" ? 1 : i.resultado === "nao_encontrado" ? 2 : 3;
    return [...relevantes].sort((a, b) => peso(a) - peso(b) || a.rotulo.localeCompare(b.rotulo));
  }, [relevantes]);

  // Pendência impeditiva do Jurídico (alta/crítica em aberto) — apenas aviso, sem virar tela jurídica.
  const pendenciasJuridicas = pendenciasList.filter(
    (p) =>
      pendenciaEmAberto(p.status) &&
      p.setor === "juridico" &&
      (p.criticidade === "Alta" || p.criticidade === "Crítica"),
  );

  const semValidacao = itensValidacao.length === 0;

  return (
    <Card className="overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Validação dos Dados</p>
            {semValidacao ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Validação ainda não executada.
              </p>
            ) : pontos.length > 0 ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {pontos.length} {pontos.length === 1 ? "ponto precisa" : "pontos precisam"} de conferência
              </p>
            ) : (
              <div>
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Dados conferidos
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Nenhuma divergência impeditiva.</p>
              </div>
            )}
          </div>
          {!semValidacao && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {expanded ? "Visualizar Menos" : pontos.length > 0 ? "Visualizar divergências" : "Visualizar Mais"}
              </Button>
            </div>
          )}
        </div>

        {expanded && !semValidacao && (
          <div className="space-y-3 border-t border-border bg-muted/20 p-4 sm:p-5">
            {ordenados.map((i) => {
              const divergente = i.resultado === "divergente";
              const atencao = i.resultado === "necessita_validacao";
              return (
                <div
                  key={i.id}
                  className={cn(
                    "rounded-md border border-border bg-card p-3",
                    divergente && "border-amber-500/40 bg-amber-500/10",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{i.rotulo}</p>
                    {divergente ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> Divergente
                      </span>
                    ) : atencao ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> Necessita validação
                      </span>
                    ) : i.resultado === "compativel" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Compatível
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não encontrado</span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contrato</p>
                      <p className="break-words text-sm font-medium">{i.valor_contrato || "—"}</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Anexo I</p>
                      <p className="break-words text-sm font-medium">{i.valor_anexo || "—"}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendenciasJuridicas.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Existe uma pendência impeditiva do Jurídico.
                </p>
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setParecerAberto((v) => !v)}
                    aria-expanded={parecerAberto}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {parecerAberto ? "Ocultar parecer" : "Ver parecer"}
                  </Button>
                  {parecerAberto && (
                    <div className="mt-2 space-y-2">
                      {pendenciasJuridicas.map((p) => (
                        <div key={p.id} className="rounded-md border border-amber-500/30 bg-card p-2 text-xs">
                          <p className="font-medium">{p.titulo || "Pendência do Jurídico"}</p>
                          {p.descricao && <p className="mt-1 text-muted-foreground">{p.descricao}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Props {
  implantacaoId: string;
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
}

export function AnaliseImplantacaoDialog({ implantacaoId, open, onClose, readOnly = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { role } = useAuth();
  const isCadastro = role === "comum" || role === "administradoras";
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");
  const [visualizarMais, setVisualizarMais] = useState(false);
  const [mode, setMode] = useState<"view" | "correcao" | "rejeicao">("view");
  const [atribuirOpen, setAtribuirOpen] = useState(false);
  const [previewAnexo, setPreviewAnexo] = useState<{ storage_path: string; nome_arquivo: string; mime_type?: string } | null>(null);
  const [loadingAnexo, setLoadingAnexo] = useState<string | null>(null);
  const [documentosAbertos, setDocumentosAbertos] = useState(false);
  const documentosRef = useRef<HTMLDivElement>(null);

  const handleVerDocumentos = () => {
    setDocumentosAbertos(true);
    setTimeout(() => documentosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const { data: impl } = useQuery({
    queryKey: ["impl-analise", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("*")
        .eq("id", implantacaoId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: open && !!implantacaoId,
  });

  const { data: processo } = useContratoProcessoPorImplantacao(open ? implantacaoId : null);
  const { data: itensValidacao = [], isLoading: validacaoLoading } = useValidacaoCruzada(open ? processo?.id : null);
  const { data: pendenciasList = [] } = useContratoProcessoPendencias(open ? processo?.id : null);
  const { data: historico = [] } = useContratoProcessoHistorico(open ? processo?.id : null);
  const { bloqueado: bloqueioCritico } = useBloqueioValidacaoCruzada(open ? processo?.id : null);
  const resumoCruzado = resumoValidacao(itensValidacao);
  const mapaValidacao = useMapaValidacao(itensValidacao);

  const { data: anexos = [] } = useQuery({
    queryKey: ["impl-anexos", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_anexos" as any)
        .select("*")
        .eq("implantacao_id", implantacaoId);
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!implantacaoId,
  });

  const aprovar = useMutation({
    mutationFn: async (resp: { userId: string; userNome: string }) => {
      const { error } = await supabase.rpc("aprovar_implantacao" as any, {
        p_impl: implantacaoId,
        p_observacao: obs || null,
        p_responsavel: resp.userId,
        p_responsavel_nome: resp.userNome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Contrato aprovado e atribuído ao Cadastro!" });
      setAtribuirOpen(false);
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao aprovar", variant: "destructive" }),
  });

  const corrigir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("solicitar_correcao_implantacao" as any, { p_impl: implantacaoId, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Correção solicitada à equipe de Vendas" });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao solicitar correção", variant: "destructive" }),
  });

  const rejeitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rejeitar_implantacao" as any, { p_impl: implantacaoId, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Implantação rejeitada" });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao rejeitar", variant: "destructive" }),
  });

  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("finalizar_implantacao_cadastro" as any, { p_impl: implantacaoId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["implantacoes-andamento"] });
      qc.invalidateQueries({ queryKey: ["impl-alertas"] });
      toast({ title: "Contrato liberado! Empresa criada automaticamente." });
      onClose();
    },
    onError: (e: any) => toast({ title: e?.message || "Erro ao liberar contrato", variant: "destructive" }),
  });

  const handleVisualizarAnexo = (path: string, name: string) => {
    if (!path) {
      toast({ title: "Anexo sem caminho de arquivo", variant: "destructive" });
      return;
    }
    setPreviewAnexo({ storage_path: path, nome_arquivo: name });
  };


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn("max-h-[90vh] max-w-4xl overflow-y-auto", isCadastro && "cadastro-analysis-surface")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Análise de Implantação
          </DialogTitle>
          <DialogDescription>
            {isCadastro
              ? "Revise os dados, documentos e informações da implantação antes de aprovar ou solicitar correção."
              : "Revise os dados, anexos e histórico antes de aprovar ou solicitar correção."}
          </DialogDescription>
        </DialogHeader>

        {!impl ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-5">
            {isCadastro && (
              <>
                <ResumoCadastro impl={impl} processo={processo} />
                <EmpresaDadosCadastraisSection
                  impl={impl}
                  onVerDocumentos={handleVerDocumentos}
                />
                <VidasImplantacaoSection
                  impl={impl}
                  anexos={anexos}
                  pendenciasList={pendenciasList}
                  onVisualizarAnexo={handleVisualizarAnexo}
                />
                <CondicoesComerciaisSection
                  impl={impl}
                  itensValidacao={itensValidacao}
                />
                <ValidacaoDadosCadastroSection
                  itensValidacao={itensValidacao}
                  pendenciasList={pendenciasList}
                />
                <div ref={documentosRef}>
                  <DocumentosCadastroSection
                    anexos={anexos}
                    onVisualizar={handleVisualizarAnexo}
                    loading={loadingAnexo}
                    open={documentosAbertos}
                    onOpenChange={setDocumentosAbertos}
                  />
                </div>
              </>
            )}

            <div className={cn(isCadastro ? "space-y-5" : "contents", isCadastro && !visualizarMais && "hidden")}>
            {/* Resumo da Análise */}
            {(() => {
              const validacao: any = impl.relatorio_validacao || null;
              const divergenciasRelatorio = validacao ? Number(validacao.erros ?? 0) : null;
              const divergencias =
                divergenciasRelatorio == null && itensValidacao.length === 0
                  ? null
                  : (divergenciasRelatorio ?? 0) + resumoCruzado.divergentes;
              const pendencias = processo?.pendencias_abertas ?? 0;
              const statusProc = processo?.status || "";
              let risco: { label: string; tom: Tom };
              if (
                processo?.resultado_final === "Reprovado" ||
                statusProc.startsWith("pendencia") ||
                (divergencias ?? 0) > 0
              ) {
                risco = { label: "Alto", tom: "vermelho" };
              } else if (
                pendencias > 0 ||
                statusProc === "aguardando_documento_empresa" ||
                statusProc === "aprovado_ressalva" ||
                (validacao && Number(validacao.alertas ?? 0) > 0)
              ) {
                risco = { label: "Médio", tom: "amarelo" };
              } else if (!processo) {
                risco = { label: "Não analisado", tom: "cinza" };
              } else {
                risco = { label: "Baixo", tom: "verde" };
              }
              const sg = (processo?.status_geral || null) as ProcessoStatusGeral | null;
              const statusExibido = processo?.status
                ? statusLabel(processo.status)
                : impl.status === "implantado"
                ? "Implantado"
                : impl.status === "rejeitado"
                ? "Reprovado"
                : "Em análise";
              const statusTom: Tom =
                impl.status === "implantado" || processo?.resultado_final === "Aprovado" || processo?.resultado_final === "Implantado"
                  ? "verde"
                  : impl.status === "rejeitado" || processo?.resultado_final === "Reprovado"
                  ? "vermelho"
                  : statusProc.startsWith("pendencia") || statusProc === "aguardando_documento_empresa"
                  ? "amarelo"
                  : processo
                  ? "amarelo"
                  : "cinza";
              const resultadoExecutivo: { label: string; tom: Tom } =
                processo?.resultado_final === "Reprovado" || impl.status === "rejeitado" || resumoCruzado.criticas > 0
                  ? { label: "Não recomendado para aprovação", tom: "vermelho" }
                  : processo?.resultado_final === "Aprovado" || processo?.resultado_final === "Implantado" || impl.status === "implantado"
                  ? { label: "Apto para aprovação", tom: "verde" }
                  : pendencias > 0 || (divergencias ?? 0) > 0 || risco.tom === "amarelo" || risco.tom === "vermelho"
                  ? { label: "Necessita correção", tom: "amarelo" }
                  : !processo
                  ? { label: "Ainda não analisado", tom: "cinza" }
                  : { label: "Apto para aprovação", tom: "verde" };
              return (
                <section aria-labelledby="resumo-analise-title" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
                    <h4 id="resumo-analise-title" className="text-sm font-semibold">Resumo da análise</h4>
                  </div>

                  <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                    {/* 1. IDENTIFICAÇÃO */}
                    <BlocoResumo titulo="1. Identificação">
                      <CampoPrimario label="Contrato / ID" value={processo?.codigo || impl.codigo_contrato || "—"} tom="verde" />
                      <CampoPrimario label="Empresa" value={impl.nome_empresa} tom="verde" />
                      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                        <CampoSecundario label="CNPJ" value={impl.cnpj} />
                        <CampoSecundario label="Contratado" value={impl.nome_empresa} />
                        <CampoSecundario label="Tipo de vínculo" value={impl.tipo_contrato} />
                      </div>
                    </BlocoResumo>

                    {/* 2. PROCESSO */}
                    <BlocoResumo titulo="2. Processo">
                      <div className="space-y-3">
                        <CampoPrimario
                          label="Status geral"
                          value={sg ? statusGeralLabel(sg) : processo ? null : "—"}
                          tom={
                            sg === "concluido"
                              ? "verde"
                              : sg === "aguardando_pendencia"
                              ? "amarelo"
                              : sg === "cancelado"
                              ? "vermelho"
                              : sg
                              ? "amarelo"
                              : "cinza"
                          }
                        />
                        <CampoPrimario
                          label="Setor atual"
                          value={processo ? setorLabel(processo.setor_atual) : null}
                          tom={processo ? "amarelo" : "cinza"}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                        <CampoSecundario label="Responsável atual" value={processo?.responsavel_atual_nome} />
                        <CampoSecundario label="Última atualização" value={dataHoraCurta(processo?.ultima_movimentacao_em || impl.updated_at)} />
                        <CampoSecundario label="Próxima ação" value={processo?.proxima_acao} />
                      </div>
                    </BlocoResumo>

                    {/* 3. ANÁLISE */}
                    <BlocoResumo titulo="3. Análise">
                      <ResultadoExecutivo label={resultadoExecutivo.label} tom={resultadoExecutivo.tom} title="Resultado da elegibilidade" />
                      <div className="grid grid-cols-2 gap-3">
                        <MetricaResumo label="Risco" value={risco.label} tom={risco.tom} />
                        <MetricaResumo
                          label="Pendências"
                          value={processo ? String(pendencias) : "—"}
                          tom={pendencias > 0 ? "amarelo" : processo ? "verde" : "cinza"}
                        />
                        <MetricaResumo
                          label="Divergências"
                          value={divergencias != null ? String(divergencias) : null}
                          tom={divergencias == null ? "cinza" : divergencias > 0 ? "vermelho" : "verde"}
                        />
                        <MetricaResumo
                          label="Divergências críticas"
                          value={itensValidacao.length === 0 ? "—" : String(resumoCruzado.criticas)}
                          tom={itensValidacao.length === 0 ? "cinza" : resumoCruzado.criticas > 0 ? "vermelho" : "verde"}
                        />
                      </div>
                      <MetricaResumo
                        label="Validação cruzada"
                        value={itensValidacao.length === 0 ? null : `${resumoCruzado.compativeis}/${resumoCruzado.total} compatíveis`}
                        tom={
                          itensValidacao.length === 0
                            ? "cinza"
                            : resumoCruzado.criticas > 0
                            ? "vermelho"
                            : resumoCruzado.divergentes > 0
                            ? "amarelo"
                            : "verde"
                        }
                      />
                    </BlocoResumo>
                  </div>
                </section>
              );
            })()}

            <PontosAtencaoSection
              processo={processo}
              impl={impl}
              itens={itensValidacao}
              resumo={resumoCruzado}
              pendencias={processo?.pendencias_abertas ?? 0}
              isLoading={validacaoLoading}
            />

            <DecisaoDiretoriaSection
              itens={itensValidacao}
              pendenciasList={pendenciasList}
              historico={historico}
            />

            {/* Anexos */}
            {!isCadastro && (
              <DocumentosVendasSection
                anexos={anexos}
                readOnly={readOnly}
                onVisualizar={handleVisualizarAnexo}
                loading={loadingAnexo}
              />
            )}

            {/* Dados para Implantação */}
            <section>
              <h4 className="text-sm font-semibold mb-2">Dados para Implantação</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 rounded-lg border bg-muted/30">
                <CampoGridItem
                  label="Empresa"
                  value={impl.nome_empresa || "Não informado"}
                  estado={impl.nome_empresa ? (mapaValidacao.get("nome_empresa")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("nome_empresa")?.justificativa}
                />
                <CampoGridItem
                  label="CNPJ"
                  value={impl.cnpj || "Não informado"}
                  estado={impl.cnpj ? (mapaValidacao.get("cnpj")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("cnpj")?.justificativa}
                />
                <CampoGridItem
                  label="Telefone"
                  value={impl.telefone || "Não informado"}
                  estado={impl.telefone ? "ok" : "vazio"}
                />
                <CampoGridItem
                  label="Endereço"
                  value={impl.endereco || "Não informado"}
                  estado={impl.endereco ? "ok" : "vazio"}
                  className="md:col-span-2"
                />
                <CampoGridItem
                  label="CEP"
                  value={impl.cep || "Não informado"}
                  estado={impl.cep ? "ok" : "vazio"}
                />
                <CampoGridItem
                  label="Inscrição Municipal"
                  value={impl.inscricao_municipal || "—"}
                  estado={impl.inscricao_municipal ? "ok" : "naoAplicavel"}
                />
                <CampoGridItem
                  label="Inscrição Estadual"
                  value={impl.inscricao_estadual || "—"}
                  estado={impl.inscricao_estadual ? "ok" : "naoAplicavel"}
                />
                <CampoGridItem
                  label="Grupo / Contrato"
                  value={impl.grupo_contrato || "Não informado"}
                  estado={impl.grupo_contrato ? (mapaValidacao.get("grupo_contrato")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("grupo_contrato")?.justificativa}
                />
                <CampoGridItem
                  label="Vidas Titulares"
                  value={impl.vidas_titulares ?? "Não informado"}
                  estado={impl.vidas_titulares != null ? (mapaValidacao.get("quantidade_vidas")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("quantidade_vidas")?.justificativa}
                />
                <CampoGridItem
                  label="Vidas Dependentes"
                  value={impl.vidas_dependentes ?? "Não informado"}
                  estado={impl.vidas_dependentes != null ? (mapaValidacao.get("quantidade_vidas")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("quantidade_vidas")?.justificativa}
                />
                <CampoGridItem
                  label="Total de Vidas"
                  value={impl.total_vidas ?? "Não informado"}
                  estado={impl.total_vidas != null ? (mapaValidacao.get("quantidade_vidas")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("quantidade_vidas")?.justificativa}
                />
                <CampoGridItem
                  label="Data de Implantação"
                  value={formatDateBR(impl.inicio_atendimento) || "Não informado"}
                  estado={impl.inicio_atendimento ? (mapaValidacao.get("data_implantacao")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("data_implantacao")?.justificativa}
                />
              </div>
            </section>

            {/* Dados Comerciais */}
            <section>
              <h4 className="text-sm font-semibold mb-2">Dados Comerciais</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 rounded-lg border bg-muted/30">
                <CampoGridItem
                  label="Enfermaria"
                  value={impl.valor_enfermaria_centavos != null ? formatCentavosBRL(impl.valor_enfermaria_centavos) : "Não informado"}
                  estado={impl.valor_enfermaria_centavos != null ? (mapaValidacao.get("valor_enfermaria")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  financeiro
                  title={mapaValidacao.get("valor_enfermaria")?.justificativa}
                />
                <CampoGridItem
                  label="Apartamento"
                  value={impl.valor_apartamento_centavos != null ? formatCentavosBRL(impl.valor_apartamento_centavos) : "Não informado"}
                  estado={impl.valor_apartamento_centavos != null ? (mapaValidacao.get("valor_apartamento")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  financeiro
                  title={mapaValidacao.get("valor_apartamento")?.justificativa}
                />
                <CampoGridItem
                  label="% Agenciamento"
                  value={impl.percentual_agenciamento != null ? `${Number(impl.percentual_agenciamento).toFixed(2).replace(".", ",")}%` : "—"}
                  estado={impl.percentual_agenciamento != null ? "ok" : "naoAplicavel"}
                  financeiro
                />
                <CampoGridItem
                  label="% Vitalício"
                  value={impl.percentual_vitalicio != null ? `${Number(impl.percentual_vitalicio).toFixed(2).replace(".", ",")}%` : "—"}
                  estado={impl.percentual_vitalicio != null ? "ok" : "naoAplicavel"}
                  financeiro
                />
                <CampoGridItem
                  label="Corretora"
                  value={impl.corretora || "—"}
                  estado={impl.corretora ? "ok" : "naoAplicavel"}
                />
                <CampoGridItem
                  label="Código do Contrato"
                  value={impl.codigo_contrato || "Não informado"}
                  estado={impl.codigo_contrato ? "ok" : "vazio"}
                />
                <CampoGridItem
                  label="Período de Movimentação"
                  value={impl.periodo_movimentacao || "Não informado"}
                  estado={impl.periodo_movimentacao ? "ok" : "vazio"}
                />
                <CampoGridItem
                  label="Dia de Vencimento"
                  value={formatDay(impl.data_vencimento) || "Não informado"}
                  estado={impl.data_vencimento ? "ok" : "vazio"}
                />
                <CampoGridItem
                  label="Modalidade"
                  value={impl.modalidade || "Não informado"}
                  estado={impl.modalidade ? (mapaValidacao.get("modalidade")?.resultado === "divergente" ? "divergente" : "ok") : "vazio"}
                  title={mapaValidacao.get("modalidade")?.justificativa}
                />
              </div>
            </section>
            </div>

            {isCadastro && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setVisualizarMais((value) => !value)}
                aria-expanded={visualizarMais}
              >
                {visualizarMais ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {visualizarMais ? "Visualizar Menos" : "Visualizar Mais"}
              </Button>
            )}



            {bloqueioCritico && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Conclusão bloqueada: há divergência crítica na validação cruzada. Resolva a pendência gerada no setor
                  responsável para liberar a aprovação.
                </span>
              </div>
            )}

            {/* Ação Cadastro: Liberar contrato */}
            {readOnly && impl.status !== "implantado" && impl.status !== "rejeitado" && (
              <div className={cn("border-t pt-2", isCadastro && "sticky bottom-0 z-10 -mx-6 bg-background px-6 pb-1 shadow-[0_-8px_20px_-16px_hsl(var(--foreground))]")}>
                <Button
                  onClick={() => liberar.mutate()}
                  disabled={liberar.isPending || bloqueioCritico}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Rocket className="h-4 w-4" /> {liberar.isPending ? "Liberando…" : "Liberar contrato"}
                </Button>
              </div>
            )}

            {!readOnly && mode === "view" && (
              <div className={cn("space-y-3 border-t pt-2", isCadastro && "sticky bottom-0 z-10 -mx-6 bg-background px-6 pb-1 shadow-[0_-8px_20px_-16px_hsl(var(--foreground))]")}>
                <div>
                  <label className="text-sm font-medium">Observação (opcional)</label>
                  <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Comentário para o cadastro…" rows={2} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={() => setAtribuirOpen(true)} disabled={aprovar.isPending || bloqueioCritico} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Aprovar e enviar ao Cadastro
                  </Button>
                  <Button onClick={() => setMode("correcao")} variant="outline" className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4" /> Solicitar correção
                  </Button>
                  <Button onClick={() => setMode("rejeicao")} variant="outline" className="gap-2 border-red-500/50 text-red-600 hover:bg-red-500/10">
                    <XCircle className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </div>
            )}

            {!readOnly && mode !== "view" && (
              <div className={cn("space-y-3 border-t pt-2", isCadastro && "sticky bottom-0 z-10 -mx-6 bg-background px-6 pb-1 shadow-[0_-8px_20px_-16px_hsl(var(--foreground))]")}>
                <div>
                  <label className="text-sm font-medium">
                    {mode === "correcao" ? "Motivo da correção" : "Motivo da rejeição"} *
                  </label>
                  <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                    placeholder={mode === "correcao" ? "Descreva o que precisa ser ajustado…" : "Descreva o motivo da rejeição…"} />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setMode("view"); setMotivo(""); }}>Cancelar</Button>
                  <Button
                    disabled={!motivo.trim() || corrigir.isPending || rejeitar.isPending}
                    onClick={() => mode === "correcao" ? corrigir.mutate() : rejeitar.mutate()}
                    className={mode === "correcao" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}
                  >
                    {mode === "correcao" ? "Enviar para correção" : "Confirmar rejeição"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <SelecionarResponsavelCadastroDialog
        open={atribuirOpen}
        onClose={() => setAtribuirOpen(false)}
        onConfirm={(userId, userNome) => aprovar.mutate({ userId, userNome })}
        loading={aprovar.isPending}
      />
      <AnexoPreviewDialog
        anexo={previewAnexo}
        open={!!previewAnexo}
        onOpenChange={(v) => { if (!v) setPreviewAnexo(null); }}
      />
    </Dialog>
  );
}
