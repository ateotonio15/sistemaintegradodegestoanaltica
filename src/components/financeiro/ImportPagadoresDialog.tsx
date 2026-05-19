import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { ProcessJob } from "@/lib/process-jobs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LinhaImport {
  empresa: string;
  contrato: string;
  cnpj: string | null;
}

function normalizeCnpj(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  // Mantém apenas dígitos (Excel pode entregar como número, perdendo zeros à esquerda)
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return null;
  // CNPJ tem 14 dígitos — preenche zeros à esquerda quando vier truncado
  if (digits.length <= 14) return digits.padStart(14, "0");
  // Se vier algo maior (improvável), retorna como está
  return digits;
}

export function ImportPagadoresDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<LinhaImport[]>([]);
  const [fileName, setFileName] = useState<string>("");
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
      const nextResumo = {
        criados: Number(jobResult?.criados ?? 0),
        atualizados: Number(jobResult?.atualizados ?? 0),
        ignorados: Number(jobResult?.ignorados ?? 0),
        erros: Array.isArray(jobResult?.erros) ? jobResult.erros : job.error ? [job.error] : [],
      };
      setResumo(nextResumo);
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores-all"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores"] });
      if (job.status === "completed") toast.success("Importação de pagadores concluída");
      else toast.warning("Importação concluída com erro(s). Veja o resultado salvo.");
    } else if (job.status === "pending" || job.status === "processing") {
      setImporting(true);
    }
  }, [job, jobResult, queryClient]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setResumo(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Planilha vazia");

      const rows: LinhaImport[] = [];
      let header: Record<string, number> = {};
      ws.eachRow((row, rowNumber) => {
        const cells = row.values as any[];
        if (rowNumber === 1) {
          cells.forEach((c, idx) => {
            if (c == null) return;
            const key = String(c).toLowerCase().trim();
            if (key.includes("empresa")) header.empresa = idx;
            else if (key.includes("contrato")) header.contrato = idx;
            else if (key.includes("cnpj")) header.cnpj = idx;
          });
          return;
        }
        const empresa = header.empresa ? String(cells[header.empresa] ?? "").trim() : "";
        const contrato = header.contrato ? String(cells[header.contrato] ?? "").trim() : "";
        const cnpj = header.cnpj ? normalizeCnpj(cells[header.cnpj]) : null;
        if (!empresa || !contrato) return;
        rows.push({ empresa, contrato, cnpj });
      });

      if (rows.length === 0) {
        toast.error("Nenhuma linha válida. Use as colunas: Empresa, Contrato, CNPJ");
        return;
      }
      setParsedRows(rows);
    } catch (err: any) {
      toast.error("Erro ao ler planilha: " + err.message);
    }
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-pagadores", {
        body: { rows: parsedRows, fileName },
      });
      if (error) throw error;
      if (!data?.jobId) throw new Error("Servidor não retornou o código do processo");
      setJobId(data.jobId);
      try { localStorage.setItem("import-pagadores-job-id", data.jobId); } catch {}
      toast.success("Importação enviada ao servidor. Você pode trocar de aba sem perder o processo.");
    } catch (err: any) {
      setImporting(false);
      toast.error("Erro ao iniciar importação: " + err.message);
    }
  };

  const handleClose = () => {
    setParsedRows([]);
    setFileName("");
    setResumo(null);
    if (job?.status === "completed" || job?.status === "error") {
      setJobId(null);
      try { localStorage.removeItem("import-pagadores-job-id"); } catch {}
    }
    onOpenChange(false);
  };

  const grupos = parsedRows.reduce<Record<string, LinhaImport[]>>((acc, r) => {
    if (!acc[r.contrato]) acc[r.contrato] = [];
    acc[r.contrato].push(r);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar pagadores</DialogTitle>
          <DialogDescription>
            Planilha Excel com colunas: <strong>Empresa</strong>, <strong>Contrato</strong>,{" "}
            <strong>CNPJ</strong> (opcional). Pagadores irmãos compartilham o mesmo Contrato.
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

          <label className="block">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFile}
              disabled={importing}
            />
            <span className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-6 w-full justify-center cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                {fileName ? `Arquivo: ${fileName} (clique para trocar)` : "Selecionar planilha (.xlsx)"}
              </span>
            </span>
          </label>

          {parsedRows.length > 0 && !resumo && (
            <div className="rounded-lg border border-border max-h-72 overflow-auto">
              <div className="bg-muted/50 px-3 py-2 text-xs font-medium flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                {parsedRows.length} pagador(es) em {Object.keys(grupos).length} contrato(s)
              </div>
              <ul className="divide-y divide-border text-sm">
                {Object.entries(grupos).map(([contrato, lista]) => (
                  <li key={contrato} className="px-3 py-2">
                    <p className="text-xs text-muted-foreground">Contrato {contrato}</p>
                    {lista.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{l.empresa}</span>
                        <span className="text-xs text-muted-foreground">
                          {l.cnpj || "sem CNPJ"}
                        </span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
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
            {parsedRows.length > 0 && !resumo && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Processando no servidor..." : `Importar ${parsedRows.length} pagador(es)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
