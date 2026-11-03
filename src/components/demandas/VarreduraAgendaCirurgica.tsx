import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SituacaoCirurgia = {
  demanda_id: string; situacao: "agendada" | "aguardando" | "realizado" | "cancelado" | "validar" | "erro";
  data_procedimento: string | null; status_api: string | null; consultado_em: string;
};

export const SITUACAO_LABEL: Record<SituacaoCirurgia["situacao"], string> = {
  agendada: "Cirurgia agendada", aguardando: "Aguardando agendamento", realizado: "Procedimento realizado",
  cancelado: "Cancelado", validar: "Validar paciente", erro: "Erro na consulta",
};
const SITUACAO_COR: Record<SituacaoCirurgia["situacao"], string> = {
  agendada: "bg-success/15 text-success border-success/40",
  aguardando: "bg-warning/15 text-warning border-warning/40",
  realizado: "bg-info/15 text-info border-info/40",
  cancelado: "bg-destructive/15 text-destructive border-destructive/40",
  validar: "bg-muted text-foreground border-border",
  erro: "bg-destructive/10 text-destructive border-destructive/30",
};

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const dataHoraBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function useSituacoesCirurgia() {
  return useQuery({
    queryKey: ["demandas-cirurgia-situacao"],
    queryFn: async () => {
      const out: SituacaoCirurgia[] = [];
      for (let off = 0; ; off += 1000) {
        const { data, error } = await (supabase as any).from("demandas_cirurgia_situacao")
          .select("demanda_id,situacao,data_procedimento,status_api,consultado_em").range(off, off + 999);
        if (error) throw error;
        out.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
      }
      return new Map(out.map((s) => [s.demanda_id, s]));
    },
    staleTime: 60_000,
  });
}

export function CelulasCirurgia({ s }: { s?: SituacaoCirurgia }) {
  return (
    <>
      <td className="py-2.5 px-3">
        {s ? (
          <Badge variant="outline" title={s.status_api ? `Status na agenda: ${s.status_api}` : undefined}
            className={cn("text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap", SITUACAO_COR[s.situacao])}>
            {SITUACAO_LABEL[s.situacao]}
          </Badge>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className={cn("py-2.5 px-3 whitespace-nowrap", s?.situacao === "agendada" ? "font-bold text-success" : "text-muted-foreground")}>
        {dataBr(s?.data_procedimento ?? null)}
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">{s ? dataHoraBr(s.consultado_em) : "—"}</td>
    </>
  );
}

type Resumo = { analisadas: number; agendada: number; aguardando: number; realizado: number; cancelado: number; validar: number; erro: number };

export function BotaoVarreduraAgenda() {
  const qc = useQueryClient();
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 });
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const { data: ultima } = useQuery({
    queryKey: ["demandas-cirurgia-ultima-varredura"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("demandas_cirurgia_varreduras").select("concluido_em,origem")
        .not("concluido_em", "is", null).order("concluido_em", { ascending: false }).limit(1).maybeSingle();
      return data as { concluido_em: string; origem: string } | null;
    },
  });

  const executar = async () => {
    setRodando(true); setFalha(null); setResumo(null);
    const r: Resumo = { analisadas: 0, agendada: 0, aguardando: 0, realizado: 0, cancelado: 0, validar: 0, erro: 0 };
    try {
      const { data, error } = await supabase.functions.invoke("verificar-agenda-reclamacoes", { body: { acao: "iniciar" } });
      if (error || !data?.ok) throw new Error(data?.error || "Não foi possível iniciar a verificação.");
      const ids: string[] = data.ids ?? [];
      setProgresso({ feito: 0, total: ids.length });
      for (let i = 0; i < ids.length; i += 5) {
        const lote = ids.slice(i, i + 5);
        const res = await supabase.functions.invoke("verificar-agenda-reclamacoes", {
          body: { acao: "verificar", ids: lote, varredura_id: data.varredura_id, ultimo: i + 5 >= ids.length },
        });
        if (res.error || !res.data?.ok) { r.erro += lote.length; r.analisadas += lote.length; }
        else {
          r.analisadas += res.data.analisadas;
          for (const k of ["agendada", "aguardando", "realizado", "cancelado", "validar", "erro"] as const) r[k] += res.data.contagem?.[k] ?? 0;
        }
        setProgresso({ feito: Math.min(i + 5, ids.length), total: ids.length });
      }
      setResumo(r);
    } catch (e) {
      setFalha((e as Error).message);
    } finally {
      setRodando(false);
      qc.invalidateQueries({ queryKey: ["demandas-cirurgia-situacao"] });
      qc.invalidateQueries({ queryKey: ["demandas-cirurgia-ultima-varredura"] });
    }
  };

  const aberto = rodando || !!resumo || !!falha;
  const pct = progresso.total ? Math.round((progresso.feito / progresso.total) * 100) : 0;
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={executar} disabled={rodando}
        title={ultima ? `Última verificação: ${dataHoraBr(ultima.concluido_em)} (${ultima.origem === "diaria" ? "automática" : "manual"})` : "Nenhuma verificação ainda"}>
        {rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
        Verificar agenda cirúrgica
      </Button>
      <Dialog open={aberto} onOpenChange={(v) => { if (!v && !rodando) { setResumo(null); setFalha(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verificação da Agenda Cirúrgica</DialogTitle>
            <DialogDescription>Só reclamações pendentes que mencionam cirurgia. Nenhuma reclamação é finalizada ou alterada.</DialogDescription>
          </DialogHeader>
          {rodando && (
            <div className="space-y-2">
              <Progress value={pct} />
              <p className="text-sm text-muted-foreground">{progresso.feito} de {progresso.total} reclamações verificadas</p>
            </div>
          )}
          {falha && <p className="text-sm text-destructive">{falha}</p>}
          {resumo && (
            <ul className="text-sm space-y-1.5">
              <li className="flex justify-between"><span>Reclamações analisadas</span><b>{resumo.analisadas}</b></li>
              <li className="flex justify-between"><span>Com cirurgia agendada</span><b className="text-success">{resumo.agendada}</b></li>
              <li className="flex justify-between"><span>Sem data identificada</span><b>{resumo.aguardando}</b></li>
              <li className="flex justify-between"><span>Procedimentos realizados</span><b>{resumo.realizado}</b></li>
              <li className="flex justify-between"><span>Cancelados</span><b>{resumo.cancelado}</b></li>
              <li className="flex justify-between"><span>Precisam de validação</span><b>{resumo.validar}</b></li>
              <li className="flex justify-between"><span>Erros na consulta</span><b className="text-destructive">{resumo.erro}</b></li>
            </ul>
          )}
          {!rodando && (
            <DialogFooter><Button onClick={() => { setResumo(null); setFalha(null); }}>Fechar</Button></DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
