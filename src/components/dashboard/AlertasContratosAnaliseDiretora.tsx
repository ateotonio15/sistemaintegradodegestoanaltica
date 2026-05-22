import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, FileSignature, Users, Calendar, UserCheck, ChevronRight, Sparkles } from "lucide-react";
import { formatDateBR } from "@/lib/date-utils";
import { AnaliseImplantacaoDialog } from "@/components/implantacao/AnaliseImplantacaoDialog";

type Row = {
  id: string;
  nome_empresa: string | null;
  codigo_contrato: string | null;
  total_vidas: number | null;
  data_vigencia: string | null;
  enviado_diretoria_em: string | null;
  enviado_diretoria_por_nome: string | null;
  created_by_nome: string | null;
};

export function AlertasContratosAnaliseDiretora() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["impl-analise-diretoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos")
        .select(
          "id, nome_empresa, codigo_contrato, total_vidas, data_vigencia, enviado_diretoria_em, enviado_diretoria_por_nome, created_by_nome"
        )
        .eq("status", "em_analise_diretoria")
        .order("enviado_diretoria_em", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  // Realtime: alertas + tabela de implantação
  useEffect(() => {
    const channel = supabase
      .channel("diretora-analise-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "implantacoes_contratos" },
        () => {
          qc.invalidateQueries({ queryKey: ["impl-analise-diretoria"] });
          qc.invalidateQueries({ queryKey: ["implantacoes-andamento"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "implantacao_alertas" },
        () => {
          qc.invalidateQueries({ queryKey: ["impl-analise-diretoria"] });
          qc.invalidateQueries({ queryKey: ["implantacao-alertas-count"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const total = items.length;

  const header = useMemo(
    () => (
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-600" />
            {total > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold px-1 ring-2 ring-background animate-pulse">
                {total}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              Contratos disponíveis para análise
              <Sparkles className="h-4 w-4 text-blue-500" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atualização automática em tempo real
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-700 border-blue-500/30 font-medium"
        >
          {total} aguardando
        </Badge>
      </div>
    ),
    [total]
  );

  if (total === 0) return null;

  return (
    <>
      <Card className="rounded-xl border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-md shadow-blue-500/10 ring-1 ring-blue-500/20 animate-in fade-in slide-in-from-top-2 duration-500">
        <CardContent className="p-5 space-y-4">
          {header}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((row) => (
              <button
                key={row.id}
                onClick={() => setOpenId(row.id)}
                className="group text-left rounded-xl border bg-card/80 backdrop-blur-sm hover:bg-card hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all p-4 relative overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300"
              >
                <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-blue-500 to-blue-600" />
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <FileSignature className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="font-semibold truncate text-sm">
                        {row.nome_empresa || "Sem nome"}
                      </span>
                    </div>
                    {row.codigo_contrato && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {row.codigo_contrato}
                      </p>
                    )}
                  </div>
                  <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 text-[10px] shrink-0" variant="outline">
                    Disponível
                  </Badge>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="h-3 w-3" />
                    <span className="truncate">
                      {row.enviado_diretoria_por_nome || row.created_by_nome || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Enviado em {formatDateBR(row.enviado_diretoria_em)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {row.total_vidas ?? "—"} vidas
                  </div>
                </div>

                <div className="flex items-center justify-end mt-3 pt-2 border-t border-border/40">
                  <span className="text-xs font-medium text-blue-600 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    Analisar agora <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {openId && (
        <AnaliseImplantacaoDialog
          implantacaoId={openId}
          open={!!openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
