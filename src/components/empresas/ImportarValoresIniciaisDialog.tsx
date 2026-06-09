import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ExcelJS from "exceljs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const FAIXAS: Array<[number, number, string]> = [
  [0, 18, "0-18"], [19, 23, "19-23"], [24, 28, "24-28"], [29, 33, "29-33"],
  [34, 38, "34-38"], [39, 43, "39-43"], [44, 48, "44-48"], [49, 53, "49-53"],
  [54, 58, "54-58"], [59, 200, "59+"],
];

type ParsedRow = {
  codigo: string;
  nome: string;
  percentual: number; // %
  enf: number; // centavos (valor atual)
  apt: number;
  enfFaixas: number[]; // centavos por faixa (10) - valor atual
  aptFaixas: number[];
  status: "match" | "not-found" | "ambiguous";
  empresaId?: string;
  empresaNome?: string;
  empresaCodigo?: string;
  error?: string;
};

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function toCentavos(v: unknown): number {
  const n = toNumber(v);
  if (n < 0) return 0;
  return Math.round(n * 100);
}

function aplicarPct(centavos: number, pct: number): number {
  if (!centavos || !pct) return centavos;
  return Math.round(centavos * (1 + pct / 100));
}

export function ImportarValoresIniciaisDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const reset = () => { setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Planilha vazia");

      const parsed: Omit<ParsedRow, "status" | "empresaId" | "empresaNome" | "empresaCodigo">[] = [];
      ws.eachRow((row, idx) => {
        if (idx === 1) return; // header
        const codigo = String(row.getCell(1).value ?? "").trim();
        const nome = String(row.getCell(2).value ?? "").trim();
        if (!codigo && !nome) return;
        const percentual = toNumber(row.getCell(3).value);
        const enf = toCentavos(row.getCell(4).value);
        const apt = toCentavos(row.getCell(5).value);
        const enfFaixas = FAIXAS.map((_, i) => toCentavos(row.getCell(6 + i).value));
        const aptFaixas = FAIXAS.map((_, i) => toCentavos(row.getCell(16 + i).value));
        parsed.push({ codigo, nome, percentual, enf, apt, enfFaixas, aptFaixas });
      });

      if (parsed.length === 0) throw new Error("Nenhuma linha encontrada");

      // Match com empresas
      const { data: empresas, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato");
      if (error) throw error;

      const byCodigo = new Map<string, { id: string; nome: string; codigo_contrato: string | null }>();
      const byNome = new Map<string, Array<{ id: string; nome: string; codigo_contrato: string | null }>>();
      for (const e of empresas ?? []) {
        if (e.codigo_contrato) byCodigo.set(e.codigo_contrato.trim(), e);
        const key = e.nome.trim().toLowerCase();
        const arr = byNome.get(key) ?? [];
        arr.push(e);
        byNome.set(key, arr);
      }

      const result: ParsedRow[] = parsed.map((p) => {
        if (p.codigo) {
          const m = byCodigo.get(p.codigo);
          if (m) return { ...p, status: "match", empresaId: m.id, empresaNome: m.nome, empresaCodigo: m.codigo_contrato ?? "" };
        }
        if (p.nome) {
          const arr = byNome.get(p.nome.toLowerCase()) ?? [];
          if (arr.length === 1) return { ...p, status: "match", empresaId: arr[0].id, empresaNome: arr[0].nome, empresaCodigo: arr[0].codigo_contrato ?? "" };
          if (arr.length > 1) return { ...p, status: "ambiguous", error: `${arr.length} empresas com este nome` };
        }
        return { ...p, status: "not-found" };
      });

      setRows(result);
    } catch (err: any) {
      toast({ title: "Erro ao ler planilha", description: err.message, variant: "destructive" });
      reset();
    } finally {
      setParsing(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Valores Iniciais");
      const header = [
        "Código Contrato", "Nome", "Percentual Reajuste (%)", "Valor Enfermaria", "Valor Apartamento",
        ...FAIXAS.map(([, , label]) => `ENF ${label}`),
        ...FAIXAS.map(([, , label]) => `APT ${label}`),
      ];

      ws.addRow(header);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      ws.columns = header.map((h) => ({ width: Math.max(14, Math.min(28, h.length + 4)) }));
      ws.addRow([
        "9999", "EMPRESA EXEMPLO", 0, 0, 0,
        ...FAIXAS.map(() => 0),
        ...FAIXAS.map(() => 0),
      ]);

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template_valores_iniciais.xlsx";
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message ?? "Não foi possível baixar o template", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    const valid = rows.filter((r) => r.status === "match" && r.empresaId);
    if (valid.length === 0) {
      toast({ title: "Nenhuma empresa encontrada para salvar", variant: "destructive" });
      return;
    }
    setSaving(true);
    let okCount = 0;
    let errCount = 0;
    try {
      for (const r of valid) {
        const enfArr = FAIXAS.map(([ini, fim, label], i) => ({ ini, fim, label, centavos: r.enfFaixas[i] }));
        const aptArr = FAIXAS.map(([ini, fim, label], i) => ({ ini, fim, label, centavos: r.aptFaixas[i] }));
        const faixas_etarias = {
          origem: "importacao_valores_iniciais",
          enfermaria: enfArr,
          apartamento: aptArr,
        };

        // Verifica se já existe registro de implantação
        const { data: existing } = await supabase
          .from("implantacoes_contratos")
          .select("id")
          .eq("empresa_id", r.empresaId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await supabase
            .from("implantacoes_contratos")
            .update({
              valor_enfermaria_centavos: r.enf,
              valor_apartamento_centavos: r.apt,
              faixas_etarias: faixas_etarias as any,
            })
            .eq("id", existing.id);
          if (error) { errCount++; continue; }
        } else {
          const { error } = await supabase.from("implantacoes_contratos").insert({
            empresa_id: r.empresaId!,
            nome_empresa: r.empresaNome,
            codigo_contrato: r.empresaCodigo,
            status: "implantado",
            etapa_atual: 99,
            progresso: 100,
            valor_enfermaria_centavos: r.enf,
            valor_apartamento_centavos: r.apt,
            faixas_etarias: faixas_etarias as any,
          });
          if (error) { errCount++; continue; }
        }

        // Se houver percentual, criar/atualizar reajuste do ano atual com os valores do layout como "valor atual"
        if (r.percentual > 0) {
          const ano = new Date().getFullYear();
          const possui_enfermaria = r.enf > 0 || r.enfFaixas.some((x) => x > 0);
          const possui_apartamento = r.apt > 0 || r.aptFaixas.some((x) => x > 0);
          const usa_faixa_enf = r.enfFaixas.some((x) => x > 0);
          const usa_faixa_apt = r.aptFaixas.some((x) => x > 0);

          const enfReaj = aplicarPct(r.enf, r.percentual);
          const aptReaj = aplicarPct(r.apt, r.percentual);

          const { data: reajUp, error: reajErr } = await supabase
            .from("reajustes_anuais")
            .upsert(
              {
                empresa_id: r.empresaId!,
                ano,
                percentual: r.percentual,
                mes_reajuste: new Date().getMonth() + 1,
                data_aplicacao: new Date().toISOString().slice(0, 10),
                status: "Reajustado",
                status_reajuste: "confirmado",
                possui_enfermaria,
                possui_apartamento,
                usa_faixa_etaria_enfermaria: usa_faixa_enf,
                usa_faixa_etaria_apartamento: usa_faixa_apt,
                percentual_unico_enfermaria: !usa_faixa_enf,
                percentual_unico_apartamento: !usa_faixa_apt,
                valor_antigo_enfermaria_centavos: r.enf,
                valor_reajustado_enfermaria_centavos: enfReaj,
                valor_final_enfermaria_centavos: enfReaj,
                valor_antigo_apartamento_centavos: r.apt,
                valor_reajustado_apartamento_centavos: aptReaj,
                valor_final_apartamento_centavos: aptReaj,
                valor_antigo_centavos: r.enf + r.apt,
                valor_reajustado_centavos: enfReaj + aptReaj,
                valor_final_centavos: enfReaj + aptReaj,
                observacao: "Importado via planilha de valores iniciais",
              },
              { onConflict: "empresa_id,ano" }
            )
            .select("id")
            .single();

          if (!reajErr && reajUp?.id) {
            // Limpa faixas anteriores e insere novas
            await supabase.from("reajuste_faixas").delete().eq("reajuste_id", reajUp.id);
            const faixasInsert: any[] = [];
            FAIXAS.forEach(([ini, fim], i) => {
              if (r.enfFaixas[i] > 0) {
                const reaj = aplicarPct(r.enfFaixas[i], r.percentual);
                faixasInsert.push({
                  reajuste_id: reajUp.id,
                  modalidade: "enfermaria",
                  idade_inicial: ini,
                  idade_final: fim,
                  valor_atual_centavos: r.enfFaixas[i],
                  percentual: r.percentual,
                  valor_reajustado_centavos: reaj,
                  valor_final_centavos: reaj,
                });
              }
              if (r.aptFaixas[i] > 0) {
                const reaj = aplicarPct(r.aptFaixas[i], r.percentual);
                faixasInsert.push({
                  reajuste_id: reajUp.id,
                  modalidade: "apartamento",
                  idade_inicial: ini,
                  idade_final: fim,
                  valor_atual_centavos: r.aptFaixas[i],
                  percentual: r.percentual,
                  valor_reajustado_centavos: reaj,
                  valor_final_centavos: reaj,
                });
              }
            });
            if (faixasInsert.length > 0) {
              await supabase.from("reajuste_faixas").insert(faixasInsert);
            }
          }
        }

        okCount++;
      }

      qc.invalidateQueries({ queryKey: ["empresa-valores"] });
      qc.invalidateQueries({ queryKey: ["reajustes"] });
      toast({
        title: "Importação concluída",
        description: `${okCount} empresa(s) atualizada(s)${errCount > 0 ? ` · ${errCount} erro(s)` : ""}`,
      });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const matchCount = rows.filter((r) => r.status === "match").length;
  const notFoundCount = rows.filter((r) => r.status !== "match").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl animate-fade-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Valores Iniciais
          </DialogTitle>
          <DialogDescription>
            O tipo de contrato é detectado automaticamente: preencha <b>Valor Enfermaria/Apartamento</b> para contratos com <b>valor fixo</b>, ou preencha as <b>10 colunas de faixa etária</b> (Enf/Apt) para contratos por <b>faixa etária</b>. Veja a aba <b>Instruções</b> do template. Os valores informados são Valor Atual e o % é aplicado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <Button onClick={() => fileRef.current?.click()} disabled={parsing || saving} className="rounded-lg">
            {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {parsing ? "Lendo..." : "Selecionar Planilha"}
          </Button>
          <Button variant="outline" onClick={downloadTemplate} className="rounded-lg">
            <Download className="mr-2 h-4 w-4" /> Baixar template
          </Button>
          {fileName && <span className="text-xs text-muted-foreground truncate">{fileName}</span>}
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="rounded-md bg-primary/10 text-primary border-primary/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {matchCount} encontradas
              </Badge>
              {notFoundCount > 0 && (
                <Badge variant="outline" className="rounded-md bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="h-3 w-3 mr-1" /> {notFoundCount} sem correspondência
                </Badge>
              )}
            </div>

            <div className="rounded-lg border border-border overflow-hidden mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/30">
                    <TableHead>Status</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome (planilha)</TableHead>
                    <TableHead>Empresa encontrada</TableHead>
                    <TableHead className="text-right">% Reaj</TableHead>
                    <TableHead className="text-right">Enf</TableHead>
                    <TableHead className="text-right">Apt</TableHead>
                    <TableHead className="text-right">Faixas Enf</TableHead>
                    <TableHead className="text-right">Faixas Apt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className="hover:bg-accent/40">
                      <TableCell>
                        {r.status === "match" ? (
                          <Badge className="bg-primary/15 text-primary border-primary/20 rounded-md">OK</Badge>
                        ) : (
                          <Badge variant="destructive" className="rounded-md">
                            {r.status === "ambiguous" ? "Ambíguo" : "Não encontrada"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.codigo || "—"}</TableCell>
                      <TableCell className="text-sm">{r.nome || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.empresaNome ?? r.error ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{r.percentual > 0 ? `${r.percentual.toFixed(2)}%` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{(r.enf / 100).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{(r.apt / 100).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{r.enfFaixas.filter((x) => x > 0).length}/10</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{r.aptFaixas.filter((x) => x > 0).length}/10</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || matchCount === 0} className="rounded-lg">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar {matchCount} empresa(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
