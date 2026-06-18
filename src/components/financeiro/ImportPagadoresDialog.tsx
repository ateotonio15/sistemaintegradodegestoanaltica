import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import type { ProcessJob } from "@/lib/process-jobs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LinhaImport {
  empresa: string;
  contrato: string;
  cnpj: string;
}

function normalizeCnpj(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 14) return digits.padStart(14, "0");
  return digits;
}

const emptyRow = (): LinhaImport => ({ empresa: "", contrato: "", cnpj: "" });

export function ImportPagadoresDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<LinhaImport[]>([emptyRow()]);
  const [importing, setImporting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(() => {
    try { return localStorage.getItem("import-pagadores-job-id"); } catch { return null; }
  });
  const [resumo, setResumo] = useState<{
    criados: number;
    atualizados: number;
    ignorados: number;
    erros: string[];
  } | null>(null);

  const { data: job } = useQuery({
    queryKey: ["process-job", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_jobs" as any)
        .select("*")
        .eq("id", jobId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ProcessJob | null;
    },
  });

  const jobResult = useMemo(() => job?.result as any, [job]);

  useEffect(() => {
    if (!jobId) return;
    const ch = supabase
      .channel(`process-job-import-pagadores-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "process_jobs", filter: `id=eq.${jobId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["process-job", jobId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [jobId, queryClient]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" || job.status === "error") {
      setResumo({
        criados: Number(jobResult?.criados ?? 0),
        atualizados: Number(jobResult?.atualizados ?? 0),
        ignorados: Number(jobResult?.ignorados ?? 0),
        erros: Array.isArray(jobResult?.erros) ? jobResult.erros : job.error ? [job.error] : [],
      });
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores-all"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores"] });
      if (job.status === "completed") toast.success("Importação de pagadores concluída");
      else toast.warning("Importação concluída com erro(s). Veja o resultado salvo.");
    } else if (job.status === "pending" || job.status === "processing") {
      setImporting(true);
    }
  }, [job, jobResult, queryClient]);

  const updateRow = (idx: number, field: keyof LinhaImport, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) =>
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== idx)));

  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({
          empresa: r.empresa.trim(),
          contrato: r.contrato.trim(),
          cnpj: normalizeCnpj(r.cnpj),
        }))
        .filter((r) => r.empresa && r.contrato && r.cnpj),
    [rows]
  );

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("Preencha Empresa, Contrato e CNPJ em pelo menos uma linha");
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-pagadores", {
        body: { rows: validRows, fileName: "entrada-manual" },
      });
      if (error) throw error;
      if (!data?.jobId) throw new Error("Servidor não retornou o código do processo");
      setJobId(data.jobId);
      try { localStorage.setItem("import-pagadores-job-id", data.jobId); } catch {}
      toast.success("Importação enviada ao servidor.");
    } catch (err: any) {
      setImporting(false);
      toast.error("Erro ao iniciar importação: " + err.message);
    }
  };

  const handleClose = () => {
    setRows([emptyRow()]);
    setResumo(null);
    if (job?.status === "completed" || job?.status === "error") {
      setJobId(null);
      try { localStorage.removeItem("import-pagadores-job-id"); } catch {}
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adicionar pagadores</DialogTitle>
          <DialogDescription>
            Preencha as colunas <strong>Empresa</strong>, <strong>Contrato</strong> e{" "}
            <strong>CNPJ</strong>. Todos os campos são obrigatórios. Pagadores irmãos compartilham o mesmo Contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {job && !resumo && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {job.status === "error" ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                )}
                Processo salvo: {job.status === "pending" ? "pendente" : job.status === "processing" ? "processando" : job.status}
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${job.progress || 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{job.message || "Consultando status salvo..."}</p>
            </div>
          )}

          {!resumo && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                {validRows.length} linha(s) válida(s) de {rows.length}
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Empresa *</th>
                      <th className="px-2 py-2 font-medium w-40">Contrato *</th>
                      <th className="px-2 py-2 font-medium w-48">CNPJ *</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="px-2 py-1">
                          <Input
                            value={r.empresa}
                            onChange={(e) => updateRow(idx, "empresa", e.target.value)}
                            placeholder="Nome do pagador"
                            className="h-8"
                            disabled={importing}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={r.contrato}
                            onChange={(e) => updateRow(idx, "contrato", e.target.value)}
                            placeholder="Código"
                            className="h-8"
                            disabled={importing}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            value={r.cnpj}
                            onChange={(e) => updateRow(idx, "cnpj", e.target.value)}
                            placeholder="Obrigatório"
                            className="h-8"
                            disabled={importing}
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeRow(idx)}
                            disabled={importing}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border p-2">
                <Button variant="outline" size="sm" onClick={addRow} disabled={importing} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar linha
                </Button>
              </div>
            </div>
          )}

          {resumo && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Resultado
              </div>
              <ul className="text-sm space-y-0.5">
                <li>Criados: <strong>{resumo.criados}</strong></li>
                <li>Atualizados (CNPJ): <strong>{resumo.atualizados}</strong></li>
                <li>Ignorados (já existem): <strong>{resumo.ignorados}</strong></li>
                {resumo.erros.length > 0 && (
                  <li className="text-destructive">
                    Erros: {resumo.erros.length}
                    <ul className="text-xs mt-1 list-disc ml-4">
                      {resumo.erros.slice(0, 5).map((er, i) => (
                        <li key={i}>{er}</li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {resumo || importing ? "Fechar" : "Cancelar"}
            </Button>
            {!resumo && (
              <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
                {importing ? "Processando no servidor..." : `Adicionar ${validRows.length} pagador(es)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
