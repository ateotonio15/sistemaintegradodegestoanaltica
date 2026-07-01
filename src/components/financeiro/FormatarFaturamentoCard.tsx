import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Loader2, Download, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { formatarFaturamentoExcel, type ModoFaturamento } from "@/lib/faturamento-formatter";
import { cn } from "@/lib/utils";

export function FormatarFaturamentoCard() {
  const [modo, setModo] = useState<ModoFaturamento>("nao_prorata");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast.error("Envie um arquivo .xlsx ou .xls do faturamento.");
      return;
    }
    setFile(f);
  }

  async function handleProcess() {
    if (!file) {
      toast.error("Selecione o arquivo do faturamento (.xlsx ou .xls).");
      return;
    }
    try {
      setProcessing(true);
      let buf = await file.arrayBuffer();
      // Converte .xls legado para .xlsx antes de formatar
      if (/\.xls$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "array", cellStyles: true, cellDates: true });
        buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      }
      const { blob, filename } = await formatarFaturamentoExcel(buf, modo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Arquivo formatado: ${filename}`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      console.error(err);
      toast.error(`Falha ao formatar: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm h-full">
      <CardContent className="p-4 h-full flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Formatar faturamento empresarial</p>
            <p className="text-xs text-muted-foreground">
              Anexe o Excel do faturamento (bruto) e escolha o modo. O arquivo formatado é baixado automaticamente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-stretch flex-1">
          {/* Drop zone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "relative flex items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left transition-colors min-h-[92px]",
              dragOver
                ? "border-primary bg-primary/5"
                : file
                  ? "border-primary/60 bg-primary/5"
                  : "border-border/70 bg-muted/30 hover:bg-muted/50",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => pickFile(e.target.files?.[0])}
              className="hidden"
            />
            <UploadCloud className={cn("h-6 w-6 shrink-0", file ? "text-primary" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              {file ? (
                <>
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB · clique para trocar
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Arraste o Excel do faturamento aqui</p>
                  <p className="text-[11px] text-muted-foreground">
                    ou clique para selecionar um arquivo .xlsx ou .xls bruto
                  </p>
                </>
              )}
            </div>
            {file && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded-md p-1 hover:bg-muted"
                title="Remover arquivo"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </span>
            )}
          </button>

          {/* Modo + ação */}
          <div className="flex flex-col justify-between gap-3 lg:min-w-[220px]">
            <div>
              <Label className="text-xs">Modo</Label>
              <RadioGroup
                value={modo}
                onValueChange={(v) => setModo(v as ModoFaturamento)}
                className="mt-1 flex items-center gap-3"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="nao_prorata" id="mod-np" />
                  <Label htmlFor="mod-np" className="text-xs cursor-pointer">
                    Não Prorata
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="prorata" id="mod-pr" />
                  <Label htmlFor="mod-pr" className="text-xs cursor-pointer">
                    Prorata
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <Button onClick={handleProcess} disabled={!file || processing} size="sm" className="w-full">
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Formatar e baixar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
