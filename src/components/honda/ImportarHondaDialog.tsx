import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { parseHondaExclusoes, type HondaImportResult } from "@/lib/honda-exclusoes-import";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportarHondaDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<HondaImportResult | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const reset = () => {
    setFile(null);
    setResult(null);
    setParsing(false);
    setImporting(false);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setParsing(true);
    try {
      const r = await parseHondaExclusoes(f);
      setResult(r);
    } catch (e: any) {
      toast({ title: "Erro ao ler arquivo", description: e.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!result || result.valid.length === 0 || !user) return;
    setImporting(true);
    try {
      // Fetch existing records to dedupe by CPF + data_demissao
      const { data: existing, error: fetchErr } = await supabase
        .from("honda_exclusoes" as any)
        .select("cpf, data_demissao");
      if (fetchErr) throw fetchErr;
      const dedupSet = new Set<string>(
        (existing as any[] ?? []).map((e) => `${(e.cpf || "").replace(/\D/g, "")}|${e.data_demissao}`),
      );
      const novos = result.valid.filter(
        (r) => !dedupSet.has(`${r.cpf}|${r.data_demissao}`),
      );
      const duplicados = result.valid.length - novos.length;
      if (novos.length === 0) {
        toast({
          title: "Nenhum registro novo",
          description: `${duplicados} já programado(s). Nada a importar.`,
        });
        setImporting(false);
        return;
      }
      const rows = novos.map((r) => ({ ...r, importado_por: user.id }));
      const chunk = 200;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await supabase.from("honda_exclusoes" as any).insert(slice as any);
        if (error) throw error;
      }
      toast({
        title: "Importação concluída",
        description: `${rows.length} novo(s) importado(s)${duplicados ? `, ${duplicados} já programado(s) ignorado(s)` : ""}.`,
      });
      qc.invalidateQueries({ queryKey: ["honda-exclusoes"] });
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Exclusões Honda</DialogTitle>
          <DialogDescription>
            Aceita arquivos .xlsx e .csv com as colunas: TIPO OPERAÇÃO, SEQUENCIA, NOME BENEFICIARIO, CPF, DATA DEMISSÃO, MOTIVO DO DESLIGAMENTO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            className={cn(
              "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors",
              "border-border hover:border-primary/60 hover:bg-accent/30",
            )}
          >
            <input
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {file ? file.name : "Clique para selecionar arquivo"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx ou .csv</p>
          </label>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo arquivo...
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 rounded-md border p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{result.valid.length}</p>
                    <p className="text-xs text-muted-foreground">Registros válidos</p>
                  </div>
                </div>
                <div className="flex-1 rounded-md border p-3 flex items-center gap-2">
                  <AlertCircle className={cn("h-5 w-5", result.errors.length ? "text-amber-500" : "text-muted-foreground")} />
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{result.errors.length}</p>
                    <p className="text-xs text-muted-foreground">Erros / ignorados</p>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <ScrollArea className="h-32 rounded-md border p-3">
                  <ul className="text-xs space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="font-mono">Linha {e.linha}:</span> {e.motivo}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!result || result.valid.length === 0 || importing}
          >
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar {result?.valid.length ?? 0} registro(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
