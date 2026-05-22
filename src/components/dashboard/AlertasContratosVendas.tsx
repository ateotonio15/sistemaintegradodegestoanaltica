import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle, FileSignature, ChevronRight, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ImplantacaoWizard } from "@/components/implantacao/ImplantacaoWizard";

type Row = {
  id: string;
  nome_empresa: string | null;
  codigo_contrato: string | null;
  status: string;
  motivo_correcao: string | null;
};

export function AlertasContratosVendas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["impl-vendas-correcao", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("implantacoes_contratos")
        .select("id, nome_empresa, codigo_contrato, status, motivo_correcao")
        .eq("created_by", user.id)
        .in("status", ["necessita_correcao", "rejeitado"])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const channel = supabase
      .channel("vendas-correcao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "implantacoes_contratos" }, () => {
        qc.invalidateQueries({ queryKey: ["impl-vendas-correcao"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "implantacao_alertas" }, () => {
        qc.invalidateQueries({ queryKey: ["impl-vendas-correcao"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  if (items.length === 0) return null;

  return (
    <>
      <Card className="rounded-xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-md shadow-amber-500/10 ring-1 ring-amber-500/20 animate-in fade-in slide-in-from-top-2 duration-500">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Bell className="h-5 w-5 text-amber-600" />
                <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 text-white text-[10px] font-bold px-1 ring-2 ring-background animate-pulse">
                  {items.length}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold">Contratos para corrigir</h3>
                <p className="text-xs text-muted-foreground mt-0.5">A Diretoria devolveu para ajuste — corrija e reenvie.</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 font-medium">
              {items.length} pendente{items.length > 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((row) => {
              const rejeitado = row.status === "rejeitado";
              return (
                <button
                  key={row.id}
                  onClick={() => setOpenId(row.id)}
                  className="group text-left rounded-xl border bg-card/80 backdrop-blur-sm hover:bg-card hover:shadow-lg transition-all p-4 relative overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  <div className={`absolute top-0 left-0 h-full w-1 bg-gradient-to-b ${rejeitado ? "from-red-500 to-red-600" : "from-amber-500 to-amber-600"}`} />
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FileSignature className={`h-4 w-4 shrink-0 ${rejeitado ? "text-red-600" : "text-amber-600"}`} />
                        <span className="font-semibold truncate text-sm">{row.nome_empresa || "Sem nome"}</span>
                      </div>
                      {row.codigo_contrato && (
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{row.codigo_contrato}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${rejeitado ? "bg-red-500/15 text-red-700 border-red-500/30" : "bg-amber-500/15 text-amber-700 border-amber-500/30"}`}
                    >
                      {rejeitado ? "Rejeitado" : "Correção"}
                    </Badge>
                  </div>

                  {row.motivo_correcao && (
                    <div className={`text-xs p-2 rounded-md border ${rejeitado ? "bg-red-500/5 border-red-500/20 text-red-900 dark:text-red-200" : "bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-200"}`}>
                      <div className="flex items-start gap-1.5">
                        {rejeitado ? <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
                        <span className="line-clamp-3">{row.motivo_correcao}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end mt-3 pt-2 border-t border-border/40">
                    <span className={`text-xs font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all ${rejeitado ? "text-red-600" : "text-amber-600"}`}>
                      Corrigir e reenviar <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {openId && (
        <ImplantacaoWizard id={openId} open={!!openId} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
