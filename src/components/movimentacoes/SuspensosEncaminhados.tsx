import { useEffect, useState } from "react";
import { diasSuspenso, itensEmSuspensaoAtiva, nivelSuspensao, ordenarPorSuspensao, rotuloDias } from "@/lib/contrato-suspenso";
import { formatDateBR } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ban, AlertTriangle, ChevronDown, RotateCcw } from "lucide-react";
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
  normal: "bg-muted text-muted-foreground border-border",
  atencao: "bg-warning/15 text-warning border-warning/40",
  critico: "bg-destructive/15 text-destructive border-destructive/40",
} as const;

const seloBase = "rounded-md h-5 px-2 text-[11px] font-medium leading-none";

function ItemSuspenso({ i }: { i: EncaminhamentoSuspenso }) {
  const [aberto, setAberto] = useState(false);
  const dias = diasSuspenso(i.data_suspensao);
  const nivel = nivelSuspensao(dias);
  const { isAdmin, isComum } = useAuth();
  const qc = useQueryClient();
  const [liberar, setLiberar] = useState(false);
  return (
    <li className={cn("py-1.5 px-2 -mx-2 rounded-md transition-colors hover:bg-muted/40", nivel === "critico" && "border border-destructive/40 bg-destructive/5 my-1 hover:bg-destructive/10")}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full text-left flex flex-wrap items-center gap-2" aria-expanded={aberto}>
        <span className="font-semibold text-foreground">{i.empresa_nome}</span>
        <span className="text-xs text-muted-foreground">#{i.codigo_contrato ?? "—"} · Período {i.periodo}</span>
        <Badge className={cn(seloBase, "bg-destructive text-destructive-foreground")}>Contrato suspenso</Badge>
        {dias != null && (
          <Badge variant="outline" className={cn(seloBase, "gap-1", corNivel[nivel])} title={`Suspenso há ${rotuloDias(dias)}`}>
            {nivel !== "normal" && <AlertTriangle className="h-3 w-3" />}{rotuloDias(dias)}
          </Badge>
        )}
        <Badge variant="outline" className={seloBase}>Encaminhado ao Financeiro</Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          {i.data_suspensao ? `Suspenso em ${formatDateBR(i.data_suspensao)} · ` : ""}encaminhado em {fmt(i.encaminhado_em)} · {i.encaminhado_por_nome}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          Detalhes
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
        </span>
      </button>
      {nivel === "critico" && dias != null && (
        <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />Contrato suspenso há {rotuloDias(dias)}</p>
      )}
      {aberto && (
        <div className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 rounded-md border border-border bg-muted/40 p-2">
          <p><span className="text-muted-foreground">Suspenso em: </span>{i.data_suspensao ? formatDateBR(i.data_suspensao) : "—"}</p>
          <p><span className="text-muted-foreground">Responsável: </span>{i.suspenso_por_nome || "—"}</p>
          <p><span className="text-muted-foreground">Tempo de suspensão: </span>{dias != null ? rotuloDias(dias) : "—"}</p>
          <p><span className="text-muted-foreground">Motivo: </span>{i.motivo_suspensao || "—"}</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Observação: </span>{i.suspensao_observacao || "—"}</p>
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
      <Card className="rounded-xl"><CardContent className="py-3 flex items-center gap-2 text-sm">
        <p className="font-semibold flex items-center gap-2 text-primary"><Ban className="h-4 w-4" />Contratos suspensos no período</p>
        <span className="text-xs text-muted-foreground">Nenhum contrato suspenso.</span>
        <span className="ml-auto"><SuspenderContratoButton /></span>
      </CardContent></Card>
    ) : null;
  }
  const criticos = semMov.filter((i) => nivelSuspensao(diasSuspenso(i.data_suspensao)) === "critico").length;
  return (
    <Card className="rounded-xl">
      <CardContent className="pt-4 space-y-3 text-sm">
        {semMov.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-semibold flex items-center gap-2 text-primary"><Ban className="h-4 w-4" />Contratos suspensos no período</p>
              <span className="ml-auto" />
              {podeSuspender && <SuspenderContratoButton />}
              <Badge variant="outline" className={seloBase}>
                {semMov.length} {semMov.length === 1 ? "contrato suspenso" : "contratos suspensos"}{criticos > 0 ? ` • ${criticos} em alerta` : ""}
              </Badge>
            </div>
            {criticos > 0 && (
              <p className="text-xs flex items-center gap-1.5 border-l-2 border-warning pl-2 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {criticos === 1 ? "1 contrato precisa de atenção" : `${criticos} contratos precisam de atenção`} — suspensos há 30 dias ou mais.
              </p>
            )}
            <ul className="divide-y divide-border">
              {semMov.map((i) => <ItemSuspenso key={i.id} i={i} />)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
