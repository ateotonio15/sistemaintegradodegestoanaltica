import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Loader2, Download, UploadCloud, X, FilePlus2, FileMinus2, Sparkles, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatarFaturamentoExcel, type ModoFaturamento } from "@/lib/faturamento-formatter";
import { adicionarExclusoesAoBruto, detectarCnpjsDePeriodo, type CnpjPeriodoSuspeita } from "@/lib/faturamento-exclusoes";
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
  const [exclModo] = useState<ModoFaturamento>("prorata");
  const brutoRef = useRef<HTMLInputElement>(null);
  const exclRef = useRef<HTMLInputElement>(null);

  // Auto-detecção de empresas de PERÍODO (via dia da competência ≠ 01)
  const [suspeitasOpen, setSuspeitasOpen] = useState(false);
  const [suspeitas, setSuspeitas] = useState<CnpjPeriodoSuspeita[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [pendingBufs, setPendingBufs] = useState<{ bruto: ArrayBuffer; excl: ArrayBuffer } | null>(null);
  const [marcandoPeriodo, setMarcandoPeriodo] = useState(false);


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

  async function fetchPeriodoPorCnpj(): Promise<Map<string, number>> {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("empresas")
      .select("cnpj, periodo_cobranca_inicio")
      .eq("periodo_especifico_cobranca", true)
      .not("periodo_cobranca_inicio", "is", null);
    const map = new Map<string, number>();
    (data ?? []).forEach((e: any) => {
      const digits = String(e.cnpj ?? "").replace(/\D/g, "");
      const m = /^\d{4}-\d{2}-(\d{2})$/.exec(String(e.periodo_cobranca_inicio ?? ""));
      if (digits && m) map.set(digits, parseInt(m[1], 10));
    });
    return map;
  }

  async function handleProcess() {
    if (!file) {
      toast.error("Selecione o arquivo do faturamento (.xlsx ou .xls).");
      return;
    }
    try {
      setProcessing(true);
      const buf = await normalizeBrToXlsxBuffer(await file.arrayBuffer());
      const periodoPorCnpj = await fetchPeriodoPorCnpj();
      const { blob, filename } = await formatarFaturamentoExcel(buf, modo, { periodoPorCnpj });
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

  async function gerarFinal(
    brutoBuf: ArrayBuffer,
    exclBuf: ArrayBuffer,
    periodoPorCnpj: Map<string, number>,
  ) {
    const mergedBuf = await adicionarExclusoesAoBruto(brutoBuf, exclBuf, { periodoPorCnpj });
    const finalBuf = await normalizeBrToXlsxBuffer(mergedBuf);
    const { blob, filename } = await formatarFaturamentoExcel(finalBuf, exclModo, {
      pularResumo: true,
      periodoPorCnpj,
    });
    downloadBlob(blob, filename);
    toast.success(`Exclusões adicionadas e formatação aplicada: ${filename}`);
    setBrutoFile(null);
    setExclFile(null);
    if (brutoRef.current) brutoRef.current.value = "";
    if (exclRef.current) exclRef.current.value = "";
    setExclOpen(false);
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

      const periodoPorCnpj = await fetchPeriodoPorCnpj();

      // Auto-detecção: CNPJs com competência dia ≠ 01 e ainda não cadastrados como PERÍODO
      const suspeitosDetectados = detectarCnpjsDePeriodo(brutoBuf);
      const naoCadastrados = suspeitosDetectados.filter((s) => !periodoPorCnpj.has(s.digits));

      if (naoCadastrados.length > 0) {
        setSuspeitas(naoCadastrados);
        setSelecionadas(new Set(naoCadastrados.map((s) => s.digits)));
        setPendingBufs({ bruto: brutoBuf, excl: exclBuf });
        setSuspeitasOpen(true);
        setExclProcessing(false);
        return;
      }

      await gerarFinal(brutoBuf, exclBuf, periodoPorCnpj);
    } catch (err) {
      console.error(err);
      toast.error(`Falha ao adicionar exclusões: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setExclProcessing(false);
    }
  }

  async function marcarSuspeitasEContinuar(marcar: boolean) {
    if (!pendingBufs) {
      setSuspeitasOpen(false);
      return;
    }
    try {
      setMarcandoPeriodo(true);
      const { supabase } = await import("@/integrations/supabase/client");

      if (marcar && selecionadas.size > 0) {
        const alvos = suspeitas.filter((s) => selecionadas.has(s.digits));
        // Busca empresas cadastradas para casar por dígitos do CNPJ
        const { data: empresas } = await supabase
          .from("empresas")
          .select("id, cnpj")
          .not("cnpj", "is", null);
        const porDigits = new Map<string, string>();
        (empresas ?? []).forEach((e: any) => {
          const d = String(e.cnpj ?? "").replace(/\D/g, "");
          if (d) porDigits.set(d, e.id);
        });

        let atualizadas = 0;
        let semCadastro = 0;
        for (const s of alvos) {
          const id = porDigits.get(s.digits);
          if (!id) {
            semCadastro += 1;
            continue;
          }
          const { error } = await supabase
            .from("empresas")
            .update({
              periodo_especifico_cobranca: true,
              periodo_cobranca_inicio: s.dataSugerida,
            } as any)
            .eq("id", id);
          if (!error) atualizadas += 1;
        }
        if (atualizadas > 0) toast.success(`${atualizadas} empresa(s) marcada(s) como período.`);
        if (semCadastro > 0)
          toast.warning(`${semCadastro} CNPJ(s) não localizados no cadastro — não foram marcados.`);
      }

      setSuspeitasOpen(false);
      setExclProcessing(true);
      // Refaz o mapa após as atualizações
      const periodoPorCnpj = await fetchPeriodoPorCnpj();
      await gerarFinal(pendingBufs.bruto, pendingBufs.excl, periodoPorCnpj);
    } catch (err) {
      console.error(err);
      toast.error(`Falha ao concluir: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    } finally {
      setMarcandoPeriodo(false);
      setExclProcessing(false);
      setPendingBufs(null);
      setSuspeitas([]);
      setSelecionadas(new Set());
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
        <DialogContent className="sm:max-w-[880px] p-0 overflow-hidden gap-0">
          {/* Header com faixa gradiente */}
          <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-8 pt-7 pb-6 border-b border-border/60">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                <FilePlus2 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <DialogHeader className="space-y-1.5 text-left">
                  <DialogTitle className="text-2xl leading-tight">Adicionar Exclusões ao Faturamento</DialogTitle>
                  <DialogDescription className="text-base leading-relaxed">
                    Envie o arquivo <strong>bruto</strong> e o arquivo de <strong>exclusões</strong>. As linhas serão anexadas ao final do bruto com <span className="text-foreground font-medium">Tipo Cobrança = "Exclusão"</span> e o cálculo <strong>prorata</strong> será aplicado automaticamente.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>


          <div className="px-8 py-7 space-y-6">
            {/* Uploads lado a lado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Bruto */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-sm font-semibold flex items-center justify-center">1</span>
                  <Label className="text-base font-medium">Arquivo Bruto</Label>
                </div>
                <button
                  type="button"
                  onClick={() => brutoRef.current?.click()}
                  className={cn(
                    "group relative w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all",
                    brutoFile
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/70 bg-muted/20 hover:bg-muted/40 hover:border-primary/40",
                  )}
                >
                  <input
                    ref={brutoRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => pickExtra(e.target.files?.[0], setBrutoFile)}
                  />
                  {brutoFile ? (
                    <>
                      <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 w-full">
                        <p className="text-base font-medium truncate">{brutoFile.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {(brutoFile.size / 1024).toFixed(0)} KB · clique para trocar
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBrutoFile(null);
                          if (brutoRef.current) brutoRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 rounded-md p-1.5 hover:bg-background/80"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-base font-medium">Selecionar bruto</p>
                        <p className="text-sm text-muted-foreground">.xlsx / .xls</p>
                      </div>
                    </>
                  )}
                </button>
              </div>

              {/* Exclusões */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-sm font-semibold flex items-center justify-center">2</span>
                  <Label className="text-base font-medium">Arquivo de Exclusões</Label>
                </div>
                <button
                  type="button"
                  onClick={() => exclRef.current?.click()}
                  className={cn(
                    "group relative w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all",
                    exclFile
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/70 bg-muted/20 hover:bg-muted/40 hover:border-primary/40",
                  )}
                >
                  <input
                    ref={exclRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => pickExtra(e.target.files?.[0], setExclFile)}
                  />
                  {exclFile ? (
                    <>
                      <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 w-full">
                        <p className="text-base font-medium truncate">{exclFile.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {(exclFile.size / 1024).toFixed(0)} KB · clique para trocar
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExclFile(null);
                          if (exclRef.current) exclRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 rounded-md p-1.5 hover:bg-background/80"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <FileMinus2 className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-base font-medium">Selecionar exclusões</p>
                        <p className="text-sm text-muted-foreground">.xlsx / .xls</p>
                      </div>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Dica */}
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 border border-border/60 px-4 py-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Bruto normalmente começa com <span className="font-mono text-foreground/80">hNr8B1</span> e exclusões com <span className="font-mono text-foreground/80">A05MV</span>. Empresas de período específico são detectadas automaticamente e o cálculo prorata é aplicado.
              </p>
            </div>
          </div>


          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/20">
            <Button variant="outline" onClick={() => setExclOpen(false)} disabled={exclProcessing}>
              Cancelar
            </Button>
            <Button onClick={handleAdicionarExclusoes} disabled={!brutoFile || !exclFile || exclProcessing}>
              {exclProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Gerar arquivo final
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Auto-sugestão de cadastro como PERÍODO */}
      <Dialog open={suspeitasOpen} onOpenChange={(o) => !marcandoPeriodo && setSuspeitasOpen(o)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Empresas de período detectadas</DialogTitle>
            <DialogDescription>
              {suspeitas.length} CNPJ{suspeitas.length > 1 ? "s parecem ser" : " parece ser"} de{" "}
              <strong>período específico</strong> (competência com dia ≠ 01), mas ainda{" "}
              {suspeitas.length > 1 ? "não estão cadastrados" : "não está cadastrado"}. Deseja marcar
              automaticamente? Isso ajusta o cálculo proporcional das exclusões.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[320px] overflow-auto rounded-lg border border-border/60 divide-y">
            {suspeitas.map((s) => {
              const checked = selecionadas.has(s.digits);
              return (
                <label
                  key={s.digits}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selecionadas);
                      if (e.target.checked) next.add(s.digits);
                      else next.delete(s.digits);
                      setSelecionadas(next);
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.nome || "(sem nome)"}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {s.cnpj} · ciclo dia {String(s.diaCiclo).padStart(2, "0")}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => marcarSuspeitasEContinuar(false)}
              disabled={marcandoPeriodo}
            >
              Continuar sem marcar
            </Button>
            <Button
              onClick={() => marcarSuspeitasEContinuar(true)}
              disabled={marcandoPeriodo || selecionadas.size === 0}
            >
              {marcandoPeriodo ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Marcar {selecionadas.size} e continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
