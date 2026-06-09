import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ExcelJS from "exceljs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Download, Plus, RefreshCw } from "lucide-react";
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

const CORTES_VALIDOS = new Set([1, 5, 10, 20]);

type ParsedRow = {
  nome: string;
  cnpj: string;
  codigo: string;
  operadora: string;
  vidas: number;
  data_corte: number | null;
  dia_movimentacao: number | null;
  dia_emissao: number | null;
  dia_vencimento: number | null;
  email: string;
  telefone: string;
  contato: string;
  endereco: string;
  data_implantacao: string | null; // ISO
  status: string;
  percentual: number;
  observacoes: string;
  enfFaixas: number[]; // centavos
  aptFaixas: number[];
  action: "create" | "update" | "invalid";
  empresaId?: string;
  error?: string;
};

function clean(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && v && "text" in (v as any)) return String((v as any).text ?? "").trim();
  return String(v).trim();
}

function toNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = clean(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function toInt(v: unknown): number | null {
  const n = toNumber(v);
  if (!n) return null;
  return Math.round(n);
}

function toCentavos(v: unknown): number {
  const n = toNumber(v);
  if (n <= 0) return 0;
  return Math.round(n * 100);
}

function parseDateBR(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function aplicarPct(centavos: number, pct: number) {
  if (!centavos || !pct) return centavos;
  return Math.round(centavos * (1 + pct / 100));
}

export function ImportarAdministradorasDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const reset = () => { setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const downloadTemplate = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Administradoras");

      const headerBase = [
        "Nome", "CNPJ", "Código Contrato", "Operadora", "Vidas",
        "Data Corte (1/5/10/20)", "Dia Movimentação", "Dia Emissão", "Dia Vencimento",
        "Email", "Telefone", "Contato", "Endereço",
        "Data Implantação (DD/MM/AAAA)", "Status", "Percentual Reajuste (%)", "Observações",
      ];
      const enfHeaders = FAIXAS.map(([, , label]) => `ENF ${label}`);
      const aptHeaders = FAIXAS.map(([, , label]) => `APT ${label}`);
      const header = [...headerBase, ...enfHeaders, ...aptHeaders];

      ws.addRow(header);
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      ws.columns = header.map((h) => ({ width: Math.max(14, Math.min(28, h.length + 4)) }));

      // Linha exemplo
      const exemplo = [
        "ADMINISTRADORA EXEMPLO LTDA", "00.000.000/0001-00", "9999", "OPERADORA EXEMPLO", 100,
        5, 5, 5, 10,
        "contato@exemplo.com", "(11) 99999-9999", "Fulano", "Rua Exemplo, 123",
        "01/01/2025", "Ativa", 0, "",
        ...FAIXAS.map(() => 0),
        ...FAIXAS.map(() => 0),
      ];
      ws.addRow(exemplo);

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template_administradoras.xlsx";
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

      const parsed: ParsedRow[] = [];
      ws.eachRow((row, idx) => {
        if (idx === 1) return;
        const nome = clean(row.getCell(1).value);
        const cnpj = clean(row.getCell(2).value);
        const codigo = clean(row.getCell(3).value);
        if (!nome && !cnpj && !codigo) return;
        const enfFaixas = FAIXAS.map((_, i) => toCentavos(row.getCell(18 + i).value));
        const aptFaixas = FAIXAS.map((_, i) => toCentavos(row.getCell(28 + i).value));
        parsed.push({
          nome,
          cnpj,
          codigo,
          operadora: clean(row.getCell(4).value),
          vidas: toInt(row.getCell(5).value) ?? 0,
          data_corte: toInt(row.getCell(6).value),
          dia_movimentacao: toInt(row.getCell(7).value),
          dia_emissao: toInt(row.getCell(8).value),
          dia_vencimento: toInt(row.getCell(9).value),
          email: clean(row.getCell(10).value),
          telefone: clean(row.getCell(11).value),
          contato: clean(row.getCell(12).value),
          endereco: clean(row.getCell(13).value),
          data_implantacao: parseDateBR(row.getCell(14).value),
          status: clean(row.getCell(15).value) || "Ativa",
          percentual: toNumber(row.getCell(16).value),
          observacoes: clean(row.getCell(17).value),
          enfFaixas,
          aptFaixas,
          action: "create",
        });
      });

      if (parsed.length === 0) throw new Error("Nenhuma linha encontrada");

      // Match com empresas existentes (por código ou CNPJ)
      const { data: empresas, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato, cnpj");
      if (error) throw error;

      const byCodigo = new Map<string, string>();
      const byCnpj = new Map<string, string>();
      for (const e of empresas ?? []) {
        if (e.codigo_contrato) byCodigo.set(e.codigo_contrato.trim(), e.id);
        if (e.cnpj) byCnpj.set(e.cnpj.replace(/\D/g, ""), e.id);
      }

      const result: ParsedRow[] = parsed.map((p) => {
        if (!p.nome) return { ...p, action: "invalid", error: "Nome obrigatório" };
        if (p.data_corte && !CORTES_VALIDOS.has(p.data_corte)) {
          return { ...p, action: "invalid", error: `Dia corte inválido (${p.data_corte}); use 1, 5, 10 ou 20` };
        }
        let empresaId: string | undefined;
        // Quando há Código Contrato, ele é o identificador único — mesmo CNPJ
        // pode existir em múltiplos contratos (cada código vira um cadastro).
        // Só caímos no match por CNPJ quando a linha NÃO tem código informado.
        if (p.codigo) {
          empresaId = byCodigo.get(p.codigo);
        } else if (p.cnpj) {
          empresaId = byCnpj.get(p.cnpj.replace(/\D/g, ""));
        }
        return { ...p, empresaId, action: empresaId ? "update" : "create" };
      });

      setRows(result);
    } catch (err: any) {
      toast({ title: "Erro ao ler planilha", description: err.message, variant: "destructive" });
      reset();
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    const valid = rows.filter((r) => r.action !== "invalid");
    if (valid.length === 0) {
      toast({ title: "Nenhuma linha válida", variant: "destructive" });
      return;
    }
    setSaving(true);
    let okCount = 0, errCount = 0;
    const errors: string[] = [];
    try {
      for (const r of valid) {
        const temEnf = r.enfFaixas.some((x) => x > 0);
        const temApt = r.aptFaixas.some((x) => x > 0);
        const usa_faixa = temEnf || temApt;

        const enfArr = FAIXAS.map(([ini, fim, label], i) => ({ ini, fim, label, centavos: r.enfFaixas[i] }));
        const aptArr = FAIXAS.map(([ini, fim, label], i) => ({ ini, fim, label, centavos: r.aptFaixas[i] }));
        const faixas_etarias_json = usa_faixa ? {
          origem: "importacao_administradoras",
          enfermaria: enfArr,
          apartamento: aptArr,
        } : null;

        const totalEnfCent = r.enfFaixas.reduce((a, b) => a + b, 0);
        const totalAptCent = r.aptFaixas.reduce((a, b) => a + b, 0);

        const payload: any = {
          nome: r.nome,
          cnpj: r.cnpj || null,
          codigo_contrato: r.codigo || null,
          operadora_plano: r.operadora || null,
          vidas: r.vidas || 0,
          data_corte: r.data_corte ?? null,
          dia_movimentacao: r.dia_movimentacao ?? null,
          data_emissao_fatura: r.dia_emissao ?? null,
          data_vencimento_fatura: r.dia_vencimento ?? null,
          email_empresa: r.email || null,
          telefone_empresa: r.telefone || null,
          contato_empresa: r.contato || null,
          endereco: r.endereco || null,
          data_implantacao: r.data_implantacao,
          status_empresa: r.status === "Inativa" ? "Inativa" : "Ativa",
          observacoes: r.observacoes || null,
          tipo_contrato: "ADMINISTRADORA",
          tipo_movimentacao: "Diária",
          responsavel_contrato: "Márcia Cristina",
          contrato_faixa_etaria: usa_faixa,
          faixas_etarias: faixas_etarias_json,
          valor_enfermaria_centavos: totalEnfCent || null,
          valor_apartamento_centavos: totalAptCent || null,
        };

        let empresaId = r.empresaId;
        if (empresaId) {
          const { error } = await supabase.from("empresas").update(payload).eq("id", empresaId);
          if (error) { errCount++; errors.push(`${r.nome}: ${error.message}`); continue; }
        } else {
          const { data: created, error } = await supabase.from("empresas").insert(payload).select("id").single();
          if (error || !created) { errCount++; errors.push(`${r.nome}: ${error?.message || "falha ao criar"}`); continue; }
          empresaId = created.id;
        }

        if (usa_faixa) {
          const { data: existing } = await supabase
            .from("implantacoes_contratos")
            .select("id")
            .eq("empresa_id", empresaId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            await supabase.from("implantacoes_contratos").update({ faixas_etarias: faixas_etarias_json as any }).eq("id", existing.id);
          } else {
            await supabase.from("implantacoes_contratos").insert({
              empresa_id: empresaId,
              nome_empresa: r.nome,
              codigo_contrato: r.codigo || null,
              status: "implantado",
              etapa_atual: 99,
              progresso: 100,
              faixas_etarias: faixas_etarias_json as any,
            });
          }

          if (r.percentual > 0) {
            const ano = new Date().getFullYear();
            const { data: reajUp } = await supabase
              .from("reajustes_anuais")
              .upsert({
                empresa_id: empresaId,
                ano,
                percentual: r.percentual,
                mes_reajuste: new Date().getMonth() + 1,
                data_aplicacao: new Date().toISOString().slice(0, 10),
                status: "Reajustado",
                status_reajuste: "confirmado",
                possui_enfermaria: temEnf,
                possui_apartamento: temApt,
                usa_faixa_etaria_enfermaria: temEnf,
                usa_faixa_etaria_apartamento: temApt,
                percentual_unico_enfermaria: false,
                percentual_unico_apartamento: false,
                observacao: "Importado via planilha de Administradoras",
              }, { onConflict: "empresa_id,ano" })
              .select("id")
              .single();

            if (reajUp?.id) {
              await supabase.from("reajuste_faixas").delete().eq("reajuste_id", reajUp.id);
              const faixasInsert: any[] = [];
              FAIXAS.forEach(([ini, fim], i) => {
                if (r.enfFaixas[i] > 0) {
                  const reaj = aplicarPct(r.enfFaixas[i], r.percentual);
                  faixasInsert.push({ reajuste_id: reajUp.id, modalidade: "enfermaria", idade_inicial: ini, idade_final: fim, valor_atual_centavos: r.enfFaixas[i], percentual: r.percentual, valor_reajustado_centavos: reaj, valor_final_centavos: reaj });
                }
                if (r.aptFaixas[i] > 0) {
                  const reaj = aplicarPct(r.aptFaixas[i], r.percentual);
                  faixasInsert.push({ reajuste_id: reajUp.id, modalidade: "apartamento", idade_inicial: ini, idade_final: fim, valor_atual_centavos: r.aptFaixas[i], percentual: r.percentual, valor_reajustado_centavos: reaj, valor_final_centavos: reaj });
                }
              });
              if (faixasInsert.length > 0) await supabase.from("reajuste_faixas").insert(faixasInsert);
            }
          }
        }

        okCount++;
      }

      qc.invalidateQueries({ queryKey: ["empresas-administradoras"] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["empresa-valores"] });
      toast({
        title: "Importação concluída",
        description: `${okCount} registro(s) salvo(s)${errCount > 0 ? ` · ${errCount} erro(s): ${errors.slice(0, 3).join(" | ")}` : ""}`,
        variant: errCount > 0 ? "destructive" : "default",
      });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createCount = rows.filter((r) => r.action === "create").length;
  const updateCount = rows.filter((r) => r.action === "update").length;
  const invalidCount = rows.filter((r) => r.action === "invalid").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl animate-fade-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Administradoras
          </DialogTitle>
          <DialogDescription>
            Baixe o template, preencha os dados das administradoras (incluindo valores por faixa etária) e envie a planilha.
            Empresas existentes serão <b>atualizadas</b> pelo Código ou CNPJ.
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
                <Plus className="h-3 w-3 mr-1" /> {createCount} novas
              </Badge>
              <Badge variant="outline" className="rounded-md bg-amber-500/10 text-amber-600 border-amber-500/20">
                <RefreshCw className="h-3 w-3 mr-1" /> {updateCount} atualizações
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="rounded-md bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="h-3 w-3 mr-1" /> {invalidCount} inválidas
                </Badge>
              )}
            </div>

            <div className="rounded-lg border border-border overflow-hidden mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent/30">
                    <TableHead>Ação</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-center">Vidas Ativas</TableHead>
                    <TableHead className="text-center">Corte</TableHead>
                    <TableHead className="text-right">Faixas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const totalFaixas = r.enfFaixas.filter((x) => x > 0).length + r.aptFaixas.filter((x) => x > 0).length;
                    return (
                      <TableRow key={i} className="hover:bg-accent/40">
                        <TableCell>
                          {r.action === "create" && <Badge className="bg-primary/15 text-primary border-primary/20 rounded-md">Novo</Badge>}
                          {r.action === "update" && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 rounded-md">Atualizar</Badge>}
                          {r.action === "invalid" && <Badge variant="destructive" className="rounded-md">Inválido</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{r.nome || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.cnpj || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.codigo || "—"}</TableCell>
                        <TableCell className="text-center tabular-nums text-xs">{r.vidas}</TableCell>
                        <TableCell className="text-center tabular-nums text-xs">{r.data_corte ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{totalFaixas}/20</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.error ?? r.status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || (createCount + updateCount) === 0} className="rounded-lg">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar {createCount + updateCount} registro(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
