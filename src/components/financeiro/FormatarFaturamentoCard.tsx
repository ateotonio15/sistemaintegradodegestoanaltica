import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Loader2, Download, UploadCloud, X, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { formatarFaturamentoExcel, type ModoFaturamento } from "@/lib/faturamento-formatter";
import { adicionarExclusoesAoBruto } from "@/lib/faturamento-exclusoes";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function FormatarFaturamentoCard() {
  const [modo, setModo] = useState<ModoFaturamento>("nao_prorata");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado da função "Adicionar Exclusões"
  const [exclOpen, setExclOpen] = useState(false);
  const [exclProcessing, setExclProcessing] = useState(false);
  const [brutoFile, setBrutoFile] = useState<File | null>(null);
  const [exclFile, setExclFile] = useState<File | null>(null);
  const [exclModo, setExclModo] = useState<ModoFaturamento>("nao_prorata");
  const brutoRef = useRef<HTMLInputElement>(null);
  const exclRef = useRef<HTMLInputElement>(null);


  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast.error("Envie um arquivo .xlsx ou .xls do faturamento.");
      return;
    }
    setFile(f);
  }

  async function normalizeBrToXlsxBuffer(buf: ArrayBuffer): Promise<ArrayBuffer> {
    // Sempre passa pela normalização do SheetJS para corrigir valores em texto BR.
    // Datas precisam ficar como TEXTO DD/MM/YYYY: se forem gravadas como Date no XLSX
    // intermediário, o ExcelJS interpreta o ano como serial Excel (ex.: 2026 => 18/07/1905).
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: true });

    const fmtSerialDate = (serial: number) => {
      const parsed = XLSX.SSF.parse_date_code(serial);
      if (!parsed) return "";
      const dd = String(parsed.d).padStart(2, "0");
      const mm = String(parsed.m).padStart(2, "0");
      const yy = String(parsed.y).padStart(4, "0");
      return `${dd}/${mm}/${yy}`;
    };

    const fmtBRDateString = (value: string) => {
      const md = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (!md) return null;
      const dn = parseInt(md[1], 10);
      const mn = parseInt(md[2], 10);
      let yn = parseInt(md[3], 10);
      if (yn < 100) yn += 2000;
      if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null;
      const dt = new Date(Date.UTC(yn, mn - 1, dn, 12, 0, 0));
      if (dt.getUTCFullYear() !== yn || dt.getUTCMonth() !== mn - 1 || dt.getUTCDate() !== dn) return null;
      return `${String(dn).padStart(2, "0")}/${String(mn).padStart(2, "0")}/${yn}`;
    };

    wb.SheetNames.forEach((sn) => {
      const ws = wb.Sheets[sn];
      if (!ws || !ws["!ref"]) return;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const dateCols = new Set<number>();
      for (let R = range.s.r; R <= Math.min(range.s.r + 20, range.e.r); R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          const txt = cell && cell.v != null ? String(cell.v).trim().toLowerCase() : "";
          if (/^compet|^dt\b|^dt[_\s-]|^data\b/.test(txt)) dateCols.add(C);
        }
        if (dateCols.size) break;
      }
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (!cell) continue;

          if (dateCols.has(C) && typeof cell.v === "number" && isFinite(cell.v)) {
            const formatted = fmtSerialDate(cell.v);
            if (formatted) {
              cell.t = "s";
              cell.v = formatted;
              cell.w = formatted;
              cell.z = "@";
              continue;
            }
          }

          if (typeof cell.v !== "string") continue;
          const s = cell.v.trim();
          const brDate = fmtBRDateString(s);
          if (brDate) {
            cell.t = "s";
            cell.v = brDate;
            cell.w = brDate;
            cell.z = "@";
            continue;
          }
          if (/^-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d+$/.test(s)) {
            const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
            if (!isNaN(n)) {
              cell.t = "n";
              cell.v = n;
              delete cell.w;
            }
          }
        }
      }
    });
    return XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: false }) as ArrayBuffer;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleProcess() {
    if (!file) {
      toast.error("Selecione o arquivo do faturamento (.xlsx ou .xls).");
      return;
    }
    try {
      setProcessing(true);
      const buf = await normalizeBrToXlsxBuffer(await file.arrayBuffer());
      const { blob, filename } = await formatarFaturamentoExcel(buf, modo);
      downloadBlob(blob, filename);
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

  function pickExtra(f: File | null | undefined, setter: (f: File | null) => void) {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast.error("Envie um arquivo .xlsx ou .xls.");
      return;
    }
    setter(f);
  }

  async function handleAdicionarExclusoes() {
    if (!brutoFile || !exclFile) {
      toast.error("Selecione o arquivo bruto e o arquivo de exclusões.");
      return;
    }
    try {
      setExclProcessing(true);
      const brutoBuf = await normalizeBrToXlsxBuffer(await brutoFile.arrayBuffer());
      const exclBuf = await normalizeBrToXlsxBuffer(await exclFile.arrayBuffer());
      const mergedBuf = await adicionarExclusoesAoBruto(brutoBuf, exclBuf);
      const finalBuf = await normalizeBrToXlsxBuffer(mergedBuf);
      const { blob, filename } = await formatarFaturamentoExcel(finalBuf, exclModo, { pularResumo: true });
      downloadBlob(blob, filename);
      toast.success(`Exclusões adicionadas e formatação aplicada: ${filename}`);
      setBrutoFile(null);
      setExclFile(null);
      if (brutoRef.current) brutoRef.current.value = "";
      if (exclRef.current) exclRef.current.value = "";
      setExclOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(`Falha ao adicionar exclusões: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setExclProcessing(false);
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setExclOpen(true)}
            >
              <FilePlus2 className="h-4 w-4 mr-2" />
              Adicionar Exclusões
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={exclOpen} onOpenChange={setExclOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Adicionar Exclusões ao Faturamento</DialogTitle>
            <DialogDescription>
              Envie o arquivo bruto (ex.: começa com "hNr8B1") e o arquivo de exclusões (ex.: começa com "A05MV").
              As linhas de exclusões serão adicionadas ao final do bruto com <strong>Tipo Cobrança = "Exclusão"</strong> e <strong>Valor</strong> em branco. A formatação padrão é aplicada em seguida.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Bruto */}
            <div>
              <Label className="text-xs">Arquivo Bruto</Label>
              <button
                type="button"
                onClick={() => brutoRef.current?.click()}
                className={cn(
                  "mt-1 w-full flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-3 text-left",
                  brutoFile ? "border-primary/60 bg-primary/5" : "border-border/70 bg-muted/30 hover:bg-muted/50",
                )}
              >
                <input
                  ref={brutoRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => pickExtra(e.target.files?.[0], setBrutoFile)}
                />
                <UploadCloud className={cn("h-5 w-5 shrink-0", brutoFile ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  {brutoFile ? (
                    <>
                      <p className="text-sm font-medium truncate">{brutoFile.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(brutoFile.size / 1024).toFixed(0)} KB · clique para trocar
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">Selecionar arquivo bruto (.xlsx / .xls)</p>
                  )}
                </div>
                {brutoFile && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBrutoFile(null);
                      if (brutoRef.current) brutoRef.current.value = "";
                    }}
                    className="rounded-md p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
              </button>
            </div>

            {/* Exclusões */}
            <div>
              <Label className="text-xs">Arquivo de Exclusões</Label>
              <button
                type="button"
                onClick={() => exclRef.current?.click()}
                className={cn(
                  "mt-1 w-full flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-3 text-left",
                  exclFile ? "border-primary/60 bg-primary/5" : "border-border/70 bg-muted/30 hover:bg-muted/50",
                )}
              >
                <input
                  ref={exclRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => pickExtra(e.target.files?.[0], setExclFile)}
                />
                <UploadCloud className={cn("h-5 w-5 shrink-0", exclFile ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  {exclFile ? (
                    <>
                      <p className="text-sm font-medium truncate">{exclFile.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(exclFile.size / 1024).toFixed(0)} KB · clique para trocar
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">Selecionar arquivo de exclusões (.xlsx / .xls)</p>
                  )}
                </div>
                {exclFile && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExclFile(null);
                      if (exclRef.current) exclRef.current.value = "";
                    }}
                    className="rounded-md p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
              </button>
            </div>

            <div>
              <Label className="text-xs">Modo de formatação final</Label>
              <RadioGroup
                value={exclModo}
                onValueChange={(v) => setExclModo(v as ModoFaturamento)}
                className="mt-1 flex items-center gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="nao_prorata" id="excl-np" />
                  <Label htmlFor="excl-np" className="text-xs cursor-pointer">Não Prorata</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="prorata" id="excl-pr" />
                  <Label htmlFor="excl-pr" className="text-xs cursor-pointer">Prorata</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExclOpen(false)} disabled={exclProcessing}>
              Cancelar
            </Button>
            <Button onClick={handleAdicionarExclusoes} disabled={!brutoFile || !exclFile || exclProcessing}>
              {exclProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Gerar arquivo final
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
