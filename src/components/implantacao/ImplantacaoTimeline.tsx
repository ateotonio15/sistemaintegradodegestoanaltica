import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Send, AlertTriangle, XCircle, FileSignature, UserCog, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const ACAO_META: Record<string, { label: string; color: string; icon: any }> = {
  criada: { label: "Implantação criada", color: "text-muted-foreground", icon: FileSignature },
  enviado_diretoria: { label: "Enviado à Diretoria", color: "text-primary", icon: Send },
  aprovado_diretoria: { label: "Aprovado pela Diretoria", color: "text-emerald-500", icon: CheckCircle2 },
  correcao_solicitada: { label: "Correção solicitada", color: "text-amber-500", icon: AlertTriangle },
  rejeitado: { label: "Rejeitado", color: "text-red-500", icon: XCircle },
  implantado: { label: "Implantação finalizada", color: "text-emerald-500", icon: CheckCircle2 },
  editado: { label: "Dados atualizados", color: "text-muted-foreground", icon: UserCog },
};

export function ImplantacaoTimeline({ implantacaoId }: { implantacaoId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["impl-timeline", implantacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_logs" as any)
        .select("*")
        .eq("implantacao_id", implantacaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!implantacaoId,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Carregando histórico…</p>;
  if (logs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Clock className="h-4 w-4" /> Sem atividade registrada.
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
      <ul className="space-y-4">
        {logs.map((l) => {
          const meta = ACAO_META[l.acao] || { label: l.acao, color: "text-muted-foreground", icon: Clock };
          const Icon = meta.icon;
          const detalhes = l.detalhes || {};
          return (
            <li key={l.id} className="relative animate-fade-in">
              <span className={cn("absolute -left-[18px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border", meta.color)}>
                <Icon className="h-2.5 w-2.5" />
              </span>
              <div className="text-sm">
                <p className={cn("font-medium", meta.color)}>{meta.label}</p>
                <p className="text-xs text-muted-foreground">
                  {l.user_nome || "Sistema"} · {format(parseISO(l.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                {detalhes.motivo && (
                  <p className="text-xs mt-1 italic text-foreground/80 border-l-2 border-amber-500/50 pl-2">
                    "{detalhes.motivo}"
                  </p>
                )}
                {detalhes.observacao && (
                  <p className="text-xs mt-1 italic text-foreground/80 border-l-2 border-emerald-500/50 pl-2">
                    "{detalhes.observacao}"
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
