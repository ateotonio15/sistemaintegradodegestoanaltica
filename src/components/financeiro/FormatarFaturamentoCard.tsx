import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Upload, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { formatarFaturamentoExcel, type ModoFaturamento } from "@/lib/faturamento-formatter";

export function FormatarFaturamentoCard() {
  const [modo, setModo] = useState<ModoFaturamento>("nao_prorata");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleProcess() {
    if (!file) {
      toast.error("Selecione o arquivo do faturamento (.xlsx).");
      return;
    }
    try {
      setProcessing(true);
      const buf = await file.arrayBuffer();
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
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Formatar faturamento empresarial</p>
            <p className="text-xs text-muted-foreground">
              Anexe o Excel do faturamento (bruto) e escolha o modo. O arquivo formatado será baixado
              automaticamente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <Label className="text-xs">Arquivo (.xlsx)</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-primary/90"
              />
            </div>
            {file && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                <Upload className="inline h-3 w-3 mr-1" />
                {file.name}
              </p>
            )}
          </div>

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

          <Button onClick={handleProcess} disabled={!file || processing} size="sm">
            {processing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Formatar e baixar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
