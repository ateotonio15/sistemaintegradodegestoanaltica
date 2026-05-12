import { AlertTriangle, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";
import {
  getMesReajuste, nomeMes, statusReajusteColor,
  labelStatusReajusteFluxo, corStatusReajusteFluxo,
} from "@/lib/reajuste-utils";
import { SolicitarReajusteDialog } from "./SolicitarReajusteDialog";

type EmpresaRow = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  data_implantacao: string | null;
};

type ReajusteRow = {
  empresa_id: string;
  ano: number;
  data_aplicacao: string | null;
  percentual: number;
  valor_antigo_centavos: number;
  valor_reajustado_centavos: number;
  meses_retroativos: number | null;
  status_reajuste: string | null;
};

const STATUS_FINAL = new Set(["reajustado", "liberado", "retroativo_aplicado"]);

export function AlertaReajustesPendentes() {
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const [expanded, setExpanded] = useState(true);
  const { isViewOnly, isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [solicitandoId, setSolicitandoId] = useState<string | null>(null);

  const podeSolicitar = isViewOnly || isAdmin;

  const solicitarMutation = useMutation({
    mutationFn: async (empresaId: string) => {
      const { error } = await supabase.rpc("solicitar_reajuste", { p_empresa_id: empresaId } as any);
      if (error) throw error;
    },
    onMutate: (empresaId: string) => setSolicitandoId(empresaId),
    onSettled: () => setSolicitandoId(null),
    onSuccess: () => {
      toast({ title: "Solicitação enviada", description: "O Cadastro responsável foi notificado." });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-list"] });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["alertas-reajuste-count"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message || "Erro ao solicitar", variant: "destructive" }),
  });

  const { data } = useQuery({
    queryKey: ["reajustes-pendentes-list", ano, mesAtual],
    queryFn: async () => {
      const [{ data: empresas }, { data: reaj }] = await Promise.all([
        supabase
          .from("empresas")
          .select("id,nome,codigo_contrato,data_implantacao")
          .eq("status_empresa", "Ativa"),
        supabase
          .from("reajustes_anuais")
          .select("empresa_id,ano,data_aplicacao,percentual,valor_antigo_centavos,valor_reajustado_centavos,meses_retroativos,status_reajuste")
          .order("ano", { ascending: false }),
      ]);

      const reajPorEmp: Record<string, ReajusteRow[]> = {};
      for (const r of (reaj || []) as ReajusteRow[]) {
        (reajPorEmp[r.empresa_id] ||= []).push(r);
      }

      const pendentes: Array<{
        empresa: EmpresaRow;
        mesReaj: number;
        ultimo?: ReajusteRow;
        atual?: ReajusteRow;
        status: "Pendente" | "Atrasado" | "Solicitado";
      }> = [];

      for (const e of (empresas || []) as EmpresaRow[]) {
        const mesReaj = getMesReajuste(e.data_implantacao);
        if (!mesReaj) continue;
        const lista = reajPorEmp[e.id] || [];
        const atual = lista.find((r) => r.ano === ano);
        // Empresa só sai da lista quando o Cadastro concluir/liberar
        if (atual && STATUS_FINAL.has(String(atual.status_reajuste))) continue;
        if (mesAtual < mesReaj) continue;
        const ultimo = lista.find((r) => r.ano !== ano) || undefined;
        let status: "Pendente" | "Atrasado" | "Solicitado";
        if (atual) status = "Solicitado";
        else status = mesAtual > mesReaj ? "Atrasado" : "Pendente";
        pendentes.push({ empresa: e, mesReaj, ultimo, atual, status });
      }

      return pendentes.sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome));
    },
    refetchInterval: 60000,
  });

  const lista = data || [];
  const total = lista.length;
  const atrasados = useMemo(() => lista.filter((x) => x.status === "Atrasado").length, [lista]);

  if (total === 0) return null;

  return (
    <Card className="border-yellow-500/40 bg-yellow-500/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-yellow-700 dark:text-yellow-300">
              {total} {total === 1 ? "contrato precisa" : "contratos precisam"} de reajuste
            </span>
            {atrasados > 0 && (
              <span className="ml-2 text-orange-700 dark:text-orange-300">({atrasados} atrasado{atrasados === 1 ? "" : "s"})</span>
            )}
            <span className="text-muted-foreground ml-2">— ano {ano}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {expanded ? "Ocultar" : "Ver lista"}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/reajustes">Abrir aba</Link>
          </Button>
        </div>

        {expanded && (
          <div className="rounded-md border bg-background overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Implantação</TableHead>
                  <TableHead>Mês Reajuste</TableHead>
                  <TableHead>Último Reajuste</TableHead>
                  <TableHead>Status</TableHead>
                  {podeSolicitar && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map(({ empresa, mesReaj, ultimo, atual, status }) => (
                  <TableRow key={empresa.id}>
                    <TableCell className="font-medium">{empresa.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{empresa.codigo_contrato || "—"}</TableCell>
                    <TableCell className="text-sm">{empresa.data_implantacao ? formatDateBR(empresa.data_implantacao) : "—"}</TableCell>
                    <TableCell className="text-sm">{nomeMes(mesReaj)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ultimo ? (
                        <>
                          {ultimo.data_aplicacao ? formatDateBR(ultimo.data_aplicacao) : "—"}
                          <div className="text-xs">{Number(ultimo.percentual).toFixed(2).replace(".", ",")}% — {ultimo.ano}</div>
                        </>
                      ) : "Nunca reajustado"}
                    </TableCell>
                    <TableCell>
                      {atual ? (
                        <Badge variant="outline" className={corStatusReajusteFluxo(atual.status_reajuste)}>
                          {labelStatusReajusteFluxo(atual.status_reajuste)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={statusReajusteColor(status as any)}>{status}</Badge>
                      )}
                    </TableCell>
                    {podeSolicitar && (
                      <TableCell className="text-right">
                        {!atual && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={solicitandoId === empresa.id}
                            onClick={() => solicitarMutation.mutate(empresa.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {solicitandoId === empresa.id ? "Enviando..." : "Solicitar Reajuste"}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
