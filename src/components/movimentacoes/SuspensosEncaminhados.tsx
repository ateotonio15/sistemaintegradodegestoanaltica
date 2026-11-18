import { useEffect, useState } from "react";
import { diasSuspenso, itensEmSuspensaoAtiva, nivelSuspensao, ordenarPorSuspensao, rotuloDias } from "@/lib/contrato-suspenso";
import { formatDateBR } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Ban, AlertTriangle, ChevronRight, RotateCcw, Building2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { SuspenderContratoButton } from "./SuspenderContratoButton";
import { SuspensaoDialog } from "@/components/empresas/SuspensaoDialog";

export interface EncaminhamentoSuspenso {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  codigo_contrato: string | null;
  mes_referencia: string;
  periodo: string;
  movimentacao_id: string | null;
  status: "encaminhado" | "devolvido_fluxo_normal" | "analise_humana";
  encaminhado_em: string;
  encaminhado_por_nome: string;
  observacao: string | null;
  data_suspensao?: string | null;
  motivo_suspensao?: string | null;
  suspensao_observacao?: string | null;
  suspenso_por_nome?: string | null;
}

/** Roda o encaminhamento automático e lê os registros da competência. */
export function useEncaminhamentosSuspensos(mes: string, userId?: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    supabase.rpc("processar_contratos_suspensos" as any).then(({ error }) => {
      if (!error) qc.invalidateQueries({ queryKey: ["suspensos-encaminhados"] });
    });
  }, [qc]);
  return useQuery({
    queryKey: ["suspensos-encaminhados", mes, userId ?? null],
    queryFn: async () => {
      // Com userId: só os contratos dos quais o usuário é responsável
      let ids: string[] | null = null;
      if (userId === "__none__") return [] as EncaminhamentoSuspenso[];
      if (userId) {
        const { data: vinc, error: e1 } = await supabase
          .from("empresa_usuarios").select("empresa_id").eq("user_id", userId);
        if (e1) throw e1;
        const { data: perfil } = await supabase
          .from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
        const nome = (perfil?.display_name ?? "").replace(/[,()*%]/g, " ").trim();
        const filtros = [`responsavel_user_id.eq.${userId}`, `executiva_user_id.eq.${userId}`];
        if (nome) filtros.push(`responsavel_contrato.ilike.${nome}`);
        const { data: resp, error: e2 } = await supabase
          .from("empresas").select("id")
          .or(filtros.join(","));
        if (e2) throw e2;
        ids = Array.from(new Set([
          ...(vinc ?? []).map((v) => v.empresa_id),
          ...(resp ?? []).map((r: any) => r.id),
        ]));
        if (!ids.length) return [] as EncaminhamentoSuspenso[];
      }
      let q = supabase
        .from("movimentacao_suspensos_encaminhamentos" as any)
        .select("id, empresa_id, empresa_nome, codigo_contrato, mes_referencia, periodo, movimentacao_id, status, encaminhado_em, encaminhado_por_nome, observacao")
        .eq("mes_referencia", mes);
      if (ids) q = q.in("empresa_id", ids);
      const { data, error } = await q.order("empresa_nome");
      if (error) throw error;
      const rows = (data ?? []) as unknown as EncaminhamentoSuspenso[];
      if (!rows.length) return rows;
      const empIds = rows.map((r) => r.empresa_id);
      const { data: emps, error: e3 } = await supabase
        .from("empresas").select("id, status_empresa, data_suspensao, motivo_suspensao")
        .in("id", empIds);
      if (e3) throw e3;
      const mapa = new Map((emps ?? []).map((e: any) => [e.id, e]));
      const { data: susp } = await supabase
        .from("empresa_suspensoes").select("empresa_id, data_inicio, observacao, suspenso_por, reativado_em")
        .in("empresa_id", empIds).is("reativado_em", null).order("data_inicio", { ascending: false });
      const suspPor = new Map<string, any>();
      for (const s of susp ?? []) if (!suspPor.has((s as any).empresa_id)) suspPor.set((s as any).empresa_id, s);
      const uids = Array.from(new Set(Array.from(suspPor.values()).map((s) => s.suspenso_por).filter(Boolean)));
      const nomes = new Map<string, string>();
      if (uids.length) {
        const { data: pf } = await supabase.from("profiles").select("user_id, display_name").in("user_id", uids);
        for (const p of pf ?? []) nomes.set((p as any).user_id, (p as any).display_name);
      }
      return rows
        .filter((r) => (mapa.get(r.empresa_id) as any)?.status_empresa !== "Inativa")
        .map((r) => {
          const e: any = mapa.get(r.empresa_id);
          const s = suspPor.get(r.empresa_id);
          return {
            ...r,
            data_suspensao: e?.data_suspensao ?? s?.data_inicio ?? null,
            motivo_suspensao: e?.motivo_suspensao ?? null,
            suspensao_observacao: s?.observacao ?? null,
            suspenso_por_nome: s?.suspenso_por ? nomes.get(s.suspenso_por) ?? null : null,
          };
        });
    },
  });
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const corNivel = {
  normal: "susp-badge-neutro",
  atencao: "susp-badge-atencao",
  critico: "susp-badge-critico",
} as const;

const seloBase = "susp-badge";
const rotuloDiasPainel = (d: number) => (d === 0 ? "Hoje" : rotuloDias(d));

function ItemSuspenso({ i }: { i: EncaminhamentoSuspenso }) {
  const [aberto, setAberto] = useState(false);
  const dias = diasSuspenso(i.data_suspensao);
  const nivel = nivelSuspensao(dias);
  const critico = nivel === "critico";
  const { isAdmin, isComum } = useAuth();
  const qc = useQueryClient();
  const [liberar, setLiberar] = useState(false);
  return (
    <li className={cn("susp-item", critico && "susp-item-critico")}>
      <div className="flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap md:items-center gap-3">
        <div className="flex items-start gap-3 min-w-0 md:w-[30%] lg:w-[26%]">
          <span className={cn("susp-icone", critico && "susp-icone-critico")}><Building2 className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="font-semibold susp-texto-forte truncate" title={i.empresa_nome}>{i.empresa_nome}</p>
            <p className="text-xs susp-texto-suave">#{i.codigo_contrato ?? "—"} • Período {i.periodo}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={cn(seloBase, "susp-badge-suspenso")}>Contrato suspenso</Badge>
            {dias != null && (
              <Badge variant="outline" className={cn(seloBase, "gap-1", corNivel[nivel])} title={`Suspenso há ${rotuloDias(dias)}`}>
                {nivel !== "normal" && <AlertTriangle className="h-3 w-3" />}{rotuloDiasPainel(dias)}{critico ? " • Crítico" : ""}
              </Badge>
            )}
            <Badge variant="outline" className={cn(seloBase, "susp-badge-neutro")}>Encaminhado ao Financeiro</Badge>
          </div>
          {critico && dias != null && (
            <p className="text-xs susp-texto-critico flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />Suspensão prolongada — {dias - 30} {dias - 30 === 1 ? "dia" : "dias"} acima do alerta de 30 dias</p>
          )}
        </div>
        <div className="md:text-right text-xs space-y-0.5 md:w-full lg:w-auto lg:min-w-[250px]">
          <p className="text-sm font-semibold susp-texto-forte flex items-center md:justify-end gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 susp-texto-verde" />
            {i.data_suspensao ? `Suspenso desde ${formatDateBR(i.data_suspensao)}` : "Data de suspensão não informada"}
          </p>
          <p className="susp-texto-suave">Encaminhado em {fmt(i.encaminhado_em)} • {i.encaminhado_por_nome}</p>
        </div>
        <button type="button" onClick={() => setAberto((v) => !v)} className="susp-detalhes self-start md:self-center" aria-expanded={aberto}>
          {aberto ? "Ocultar detalhes" : "Ver detalhes"}
          <ChevronRight className={cn("h-3.5 w-3.5 susp-texto-verde transition-transform", aberto && "rotate-90")} />
        </button>
      </div>
      {aberto && (
        <div className="susp-detalhe-painel mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <p><span className="susp-texto-suave">Suspenso em: </span>{i.data_suspensao ? formatDateBR(i.data_suspensao) : "—"}</p>
          <p><span className="susp-texto-suave">Responsável: </span>{i.suspenso_por_nome || "—"}</p>
          <p><span className="susp-texto-suave">Tempo de suspensão: </span>{dias != null ? rotuloDias(dias) : "—"}</p>
          <p><span className="susp-texto-suave">Motivo: </span>{i.motivo_suspensao || "—"}</p>
          <p className="sm:col-span-2"><span className="susp-texto-suave">Observação: </span>{i.suspensao_observacao || "—"}</p>
          {(isAdmin || isComum) && (
            <div className="sm:col-span-2 flex justify-end pt-1">
              <Button size="sm" className="gap-1.5 h-8" onClick={() => setLiberar(true)}>
                <RotateCcw className="h-3.5 w-3.5" />Liberar atendimentos
              </Button>
            </div>
          )}
        </div>
      )}
      {liberar && (
        <SuspensaoDialog
          open={liberar}
          onOpenChange={(o) => { setLiberar(o); if (!o) qc.invalidateQueries({ queryKey: ["suspensos-encaminhados"] }); }}
          empresa={{ id: i.empresa_id, nome: i.empresa_nome, contrato_suspenso: true, data_suspensao: i.data_suspensao ?? null, motivo_suspensao: i.motivo_suspensao ?? null, codigo_contrato: i.codigo_contrato }}
        />
      )}
    </li>
  );
}

export function SuspensosEncaminhadosPainel({ itens, comMovimentacao }: { itens: EncaminhamentoSuspenso[]; comMovimentacao: Set<string> }) {
  const semMov = ordenarPorSuspensao(itensEmSuspensaoAtiva(itens), (i) => diasSuspenso(i.data_suspensao));
  const { isAdmin, isComum } = useAuth();
  const podeSuspender = isAdmin || isComum;
  if (!semMov.length) {
    return podeSuspender ? (
      <div className="siga-susp-painel rounded-xl p-4 flex flex-wrap items-center gap-2 text-sm">
        <p className="font-semibold flex items-center gap-2 susp-texto-verde"><Ban className="h-4 w-4" />Contratos suspensos no período</p>
        <span className="text-xs susp-texto-suave">Nenhum contrato suspenso.</span>
        <span className="ml-auto"><SuspenderContratoButton /></span>
      </div>
    ) : null;
  }
  const criticos = semMov.filter((i) => nivelSuspensao(diasSuspenso(i.data_suspensao)) === "critico").length;
  return (
    <section className="siga-susp-painel rounded-xl p-4 space-y-3 text-sm animate-fade-in">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-semibold text-base flex items-center gap-2 susp-texto-forte"><Ban className="h-4 w-4 susp-texto-verde" />Contratos suspensos no período</p>
        <span className="ml-auto" />
        <Badge variant="outline" className={cn(seloBase, "susp-badge-neutro")}>
          {semMov.length} {semMov.length === 1 ? "suspenso" : "suspensos"}{criticos > 0 ? ` • ${criticos} ${criticos === 1 ? "crítico" : "críticos"}` : ""}
        </Badge>
        {podeSuspender && <SuspenderContratoButton />}
      </div>
      {criticos > 0 && (
        <div className="susp-alerta flex items-center gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{criticos === 1 ? "1 contrato em alerta de suspensão" : `${criticos} contratos em alerta de suspensão`}</strong> — suspensos há 30 dias ou mais.</span>
        </div>
      )}
      <ul className="space-y-2">
        {semMov.map((i) => <ItemSuspenso key={i.id} i={i} />)}
      </ul>
    </section>
  );
}
