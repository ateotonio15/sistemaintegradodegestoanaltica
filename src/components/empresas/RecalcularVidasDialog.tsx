import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { validarRelatorioVidas } from "@/lib/relatorio-vidas-validator";
import {
  fetchVidasOperadoraAgrupado,
  normalizeNome,
  normalizeNomeStrict,
  tokensSignificativos,
  jaccard,
} from "@/lib/vidasOperadoraApi";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, XCircle, FileSpreadsheet, Cloud } from "lucide-react";

const STORAGE_BUCKET = "anexos-movimentacoes";

type Result = {
  empresa_id: string;
  nome: string;
  vidas: number | null;
  status: "ok" | "skip" | "erro";
  detalhe?: string;
};

type Mode = "layout" | "api";

export function RecalcularVidasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("api");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);

  const reset = () => { setResults([]); setProgress(0); setDone(false); };

  const runLayout = async () => {
    const { data: empresas, error: e1 } = await supabase
      .from("empresas")
      .select("id, nome, vidas")
      .or("vidas.is.null,vidas.eq.0");
    if (e1) throw e1;

    const empresaIds = (empresas ?? []).map((e) => e.id);
    if (empresaIds.length === 0) { toast.info("Nenhuma empresa com Vidas zeradas."); return; }

    const { data: anexos, error: e2 } = await supabase
      .from("anexos_movimentacao")
      .select("empresa_id, storage_path, nome_arquivo, created_at")
      .in("empresa_id", empresaIds)
      .order("created_at", { ascending: false });
    if (e2) throw e2;

    const byEmpresa = new Map<string, { storage_path: string; nome_arquivo: string }>();
    (anexos ?? []).forEach((a: any) => {
      const ext = (a.nome_arquivo || "").toLowerCase().split(".").pop();
      if (ext !== "xlsx" && ext !== "xlsm") return;
      if (!byEmpresa.has(a.empresa_id)) byEmpresa.set(a.empresa_id, { storage_path: a.storage_path, nome_arquivo: a.nome_arquivo });
    });

    const alvos = (empresas ?? []).filter((e) => byEmpresa.has(e.id));
    if (alvos.length === 0) { toast.info("Nenhuma empresa zerada possui anexo .xlsx."); return; }

    const out: Result[] = [];
    let i = 0;
    for (const emp of alvos) {
      i++;
      setProgress(Math.round((i / alvos.length) * 100));
      const meta = byEmpresa.get(emp.id)!;
      try {
        const { data: file, error: dErr } = await supabase.storage.from(STORAGE_BUCKET).download(meta.storage_path);
        if (dErr || !file) throw dErr ?? new Error("download falhou");
        const buffer = await file.arrayBuffer();
        const sig = new Uint8Array(buffer.slice(0, 4));
        if (!(sig[0] === 0x50 && sig[1] === 0x4b)) {
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas: null, status: "skip", detalhe: "arquivo não é XLSX" });
          setResults([...out]); continue;
        }
        const result = await validarRelatorioVidas(buffer);
        const vidas = result?.total_vidas ?? 0;
        if (vidas <= 0) {
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas: 0, status: "skip", detalhe: "0 vidas detectadas" });
          setResults([...out]); continue;
        }
        const { error: uErr } = await supabase.from("empresas")
          .update({ vidas, updated_at: new Date().toISOString() }).eq("id", emp.id);
        if (uErr) throw uErr;
        out.push({ empresa_id: emp.id, nome: emp.nome, vidas, status: "ok" });
        setResults([...out]);
      } catch (err: any) {
        out.push({ empresa_id: emp.id, nome: emp.nome, vidas: null, status: "erro", detalhe: err?.message ?? String(err) });
        setResults([...out]);
      }
    }
  };

  const runApi = async () => {
    // 1) fetch API
    const data = await fetchVidasOperadoraAgrupado();
    const apiMap = new Map<string, number>();
    data.porEmpresa.forEach((e) => {
      const k = normalizeNome(e.NM_ESTIPULANTE);
      // soma quando há duplicidade de filiais com mesmo nome normalizado
      apiMap.set(k, (apiMap.get(k) ?? 0) + (e.QT_VIDAS ?? 0));
    });

    // 2) todas empresas (vamos atualizar todas onde houver match e o valor mudou)
    const { data: empresas, error } = await supabase
      .from("empresas")
      .select("id, nome, vidas");
    if (error) throw error;
    const lista = empresas ?? [];

    const out: Result[] = [];
    let i = 0;
    for (const emp of lista) {
      i++;
      setProgress(Math.round((i / lista.length) * 100));
      const k = normalizeNome(emp.nome);
      const vidasApi = apiMap.get(k);
      if (vidasApi == null) {
        // tenta match parcial: nome da API começando com nome da empresa, ou vice-versa
        let alt: number | undefined;
        for (const [key, qt] of apiMap.entries()) {
          if (key.includes(k) && k.length >= 6) { alt = qt; break; }
        }
        if (alt == null) {
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas: null, status: "skip", detalhe: "não encontrado na API" });
          setResults([...out]); continue;
        }
        if ((emp.vidas ?? 0) === alt) {
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas: alt, status: "skip", detalhe: "já igual (match parcial)" });
          setResults([...out]); continue;
        }
        const { error: uErr } = await supabase.from("empresas")
          .update({ vidas: alt, updated_at: new Date().toISOString() }).eq("id", emp.id);
        if (uErr) {
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas: null, status: "erro", detalhe: uErr.message });
        } else {
          out.push({ empresa_id: emp.id, nome: emp.nome, vidas: alt, status: "ok", detalhe: "match parcial" });
        }
        setResults([...out]);
        continue;
      }
      if ((emp.vidas ?? 0) === vidasApi) {
        out.push({ empresa_id: emp.id, nome: emp.nome, vidas: vidasApi, status: "skip", detalhe: "já igual" });
        setResults([...out]); continue;
      }
      const { error: uErr } = await supabase.from("empresas")
        .update({ vidas: vidasApi, updated_at: new Date().toISOString() }).eq("id", emp.id);
      if (uErr) {
        out.push({ empresa_id: emp.id, nome: emp.nome, vidas: null, status: "erro", detalhe: uErr.message });
      } else {
        out.push({ empresa_id: emp.id, nome: emp.nome, vidas: vidasApi, status: "ok" });
      }
      setResults([...out]);
    }
  };

  const run = async () => {
    setRunning(true); reset();
    try {
      if (mode === "layout") await runLayout();
      else await runApi();
      setProgress(100); setDone(true);
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["gestao-vidas"] });
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally { setRunning(false); }
  };

  const okCount = results.filter((r) => r.status === "ok").length;
  const skipCount = results.filter((r) => r.status === "skip").length;
  const erroCount = results.filter((r) => r.status === "erro").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Recalcular Vidas Ativas
          </DialogTitle>
          <DialogDescription>
            Escolha a fonte para atualizar o campo Vidas Ativas das empresas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => !running && setMode("api")}
            className={`text-left rounded-lg border p-3 transition ${mode === "api" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <div className="flex items-center gap-2 font-medium"><Cloud className="h-4 w-4" /> API Samel</div>
            <div className="text-xs text-muted-foreground mt-1">
              Casa nome da empresa com a operadora e atualiza com QT_VIDAS oficial.
            </div>
          </button>
          <button
            type="button"
            onClick={() => !running && setMode("layout")}
            className={`text-left rounded-lg border p-3 transition ${mode === "layout" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <div className="flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4" /> Layout (.xlsx)</div>
            <div className="text-xs text-muted-foreground mt-1">
              Reprocessa anexos das empresas com vidas zeradas (linhas TIPO OPERACAO = I).
            </div>
          </button>
        </div>

        {(running || done) && (
          <div className="space-y-2">
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground flex gap-4 flex-wrap">
              <span>Processadas: {results.length}</span>
              <span className="text-success">OK: {okCount}</span>
              <span className="text-warning">Ignoradas: {skipCount}</span>
              <span className="text-destructive">Erros: {erroCount}</span>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto border rounded-md divide-y">
            {results.filter((r) => r.status !== "skip" || r.detalhe?.includes("match")).slice(0, 500).map((r) => (
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
                {r.vidas != null && (
                  <div className="text-sm font-mono">{r.vidas.toLocaleString("pt-BR")}</div>
                )}
              </div>
            ))}
            {results.filter((r) => r.status === "skip" && !r.detalhe?.includes("match")).length > 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                + {results.filter((r) => r.status === "skip" && !r.detalhe?.includes("match")).length} empresa(s) sem alteração
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Fechar</Button>
          <Button onClick={run} disabled={running}>
            {running ? "Processando..." : done ? "Rodar novamente" : "Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
