import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { validarRelatorioVidas } from "@/lib/relatorio-vidas-validator";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const STORAGE_BUCKET = "anexos-movimentacoes";

type Result = {
  empresa_id: string;
  nome: string;
  vidas: number | null;
  status: "ok" | "skip" | "erro";
  detalhe?: string;
};

export function RecalcularVidasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);

  const run = async () => {
    setRunning(true);
    setDone(false);
    setResults([]);
    setProgress(0);

    try {
      // 1) Empresas com vidas zeradas
      const { data: empresas, error: e1 } = await supabase
        .from("empresas")
        .select("id, nome, vidas")
        .or("vidas.is.null,vidas.eq.0");
      if (e1) throw e1;

      const empresaIds = (empresas ?? []).map((e) => e.id);
      if (empresaIds.length === 0) {
        toast.info("Nenhuma empresa com Vidas zeradas.");
        setRunning(false);
        return;
      }

      // 2) Anexos .xlsx dessas empresas (mais recentes primeiro)
      const { data: anexos, error: e2 } = await supabase
        .from("anexos_movimentacao")
        .select("empresa_id, storage_path, nome_arquivo, created_at")
        .in("empresa_id", empresaIds)
        .order("created_at", { ascending: false });
      if (e2) throw e2;

      // pega só o primeiro .xlsx por empresa
      const byEmpresa = new Map<string, { storage_path: string; nome_arquivo: string }>();
      (anexos ?? []).forEach((a: any) => {
        const ext = (a.nome_arquivo || "").toLowerCase().split(".").pop();
        if (ext !== "xlsx" && ext !== "xlsm") return;
        if (!byEmpresa.has(a.empresa_id)) {
          byEmpresa.set(a.empresa_id, { storage_path: a.storage_path, nome_arquivo: a.nome_arquivo });
        }
      });

      const alvos = (empresas ?? []).filter((e) => byEmpresa.has(e.id));
      if (alvos.length === 0) {
        toast.info("Nenhuma empresa zerada possui anexo .xlsx para reprocessar.");
        setRunning(false);
        return;
      }

      const out: Result[] = [];
      let i = 0;
      for (const emp of alvos) {
        i++;
        setProgress(Math.round((i / alvos.length) * 100));
        const meta = byEmpresa.get(emp.id)!;
        try {
          const { data: file, error: dErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(meta.storage_path);
          if (dErr || !file) throw dErr ?? new Error("download falhou");
          const buffer = await file.arrayBuffer();
          const sig = new Uint8Array(buffer.slice(0, 4));
          if (!(sig[0] === 0x50 && sig[1] === 0x4b)) {
            out.push({ empresa_id: emp.id, nome: emp.nome, vidas: null, status: "skip", detalhe: "arquivo não é XLSX" });
            setResults([...out]);
            continue;
          }
          const result = await validarRelatorioVidas(buffer);
          const vidas = result?.total_vidas ?? 0;
          if (vidas <= 0) {
            out.push({ empresa_id: emp.id, nome: emp.nome, vidas: 0, status: "skip", detalhe: "0 vidas detectadas no layout" });
            setResults([...out]);
            continue;
          }
          const { error: uErr } = await supabase
            .from("empresas")
            .update({ vidas, updated_at: new Date().toISOString() })
            .eq("id", emp.id);
          if (uErr) throw uErr;
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas, status: "ok" });
          setResults([...out]);
        } catch (err: any) {
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas: null, status: "erro", detalhe: err?.message ?? String(err) });
          setResults([...out]);
        }
      }

      setProgress(100);
      setDone(true);
      const ok = out.filter((r) => r.status === "ok").length;
      toast.success(`Recálculo concluído: ${ok} empresa(s) atualizada(s) de ${alvos.length}.`);
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setRunning(false);
    }
  };

  const okCount = results.filter((r) => r.status === "ok").length;
  const skipCount = results.filter((r) => r.status === "skip").length;
  const erroCount = results.filter((r) => r.status === "erro").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Recalcular Vidas Ativas pelos Layouts Anexados
          </DialogTitle>
          <DialogDescription>
            Varre todas as empresas com Vidas = 0 e que tenham layout (.xlsx) anexado em movimentações.
            Para cada uma, lê o arquivo mais recente, conta as linhas válidas (TIPO OPERACAO = "I") e atualiza Vidas Ativas.
          </DialogDescription>
        </DialogHeader>

        {(running || done) && (
          <div className="space-y-2">
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground flex gap-4">
              <span>Processadas: {results.length}</span>
              <span className="text-success">OK: {okCount}</span>
              <span className="text-warning">Ignoradas: {skipCount}</span>
              <span className="text-destructive">Erros: {erroCount}</span>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto border rounded-md divide-y">
            {results.map((r) => (
              <div key={r.empresa_id} className="px-3 py-2 text-sm flex items-center gap-2">
                {r.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : r.status === "skip" ? (
                  <XCircle className="h-4 w-4 text-warning shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.nome}</div>
                  {r.detalhe && <div className="text-xs text-muted-foreground truncate">{r.detalhe}</div>}
                </div>
                {r.vidas != null && r.status === "ok" && (
                  <div className="text-sm font-mono">{r.vidas.toLocaleString("pt-BR")}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Fechar
          </Button>
          <Button onClick={run} disabled={running}>
            {running ? "Processando..." : done ? "Rodar novamente" : "Iniciar recálculo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
