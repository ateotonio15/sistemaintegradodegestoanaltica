import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";

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
  const s = String(v).trim();
  if (!s) return null;
  return s;
}

export function ImportPagadoresDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<LinhaImport[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [resumo, setResumo] = useState<{
    criados: number;
    atualizados: number;
    ignorados: number;
    erros: string[];
  } | null>(null);

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
    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;
    const erros: string[] = [];

    try {
      // Buscar a empresa "âncora" de cada contrato (1ª encontrada com aquele codigo_contrato).
      // Pagadores ficam vinculados a essa empresa em financeiro_pagadores.
      const contratos = Array.from(new Set(parsedRows.map((r) => r.contrato)));
      const { data: empresasContrato } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato")
        .in("codigo_contrato", contratos);

      const ancoraPorContrato = new Map<string, { id: string; nome: string }>();
      (empresasContrato || []).forEach((e: any) => {
        if (!ancoraPorContrato.has(e.codigo_contrato)) {
          ancoraPorContrato.set(e.codigo_contrato, { id: e.id, nome: e.nome });
        }
      });

      // Pagadores já cadastrados nessas empresas (para detectar duplicados)
      const ancoraIds = Array.from(ancoraPorContrato.values()).map((a) => a.id);
      const { data: pagsExist } = ancoraIds.length
        ? await supabase
            .from("financeiro_pagadores")
            .select("id, empresa_id, nome_pagador, cnpj")
            .in("empresa_id", ancoraIds)
        : { data: [] as any[] };

      const chaveExist = new Set<string>();
      const cnpjPorChave = new Map<string, { id: string; cnpj: string | null }>();
      (pagsExist || []).forEach((p: any) => {
        const k = `${p.empresa_id}|${p.nome_pagador.trim().toLowerCase()}`;
        chaveExist.add(k);
        cnpjPorChave.set(k, { id: p.id, cnpj: p.cnpj });
      });

      for (const linha of parsedRows) {
        try {
          const ancora = ancoraPorContrato.get(linha.contrato);
          if (!ancora) {
            erros.push(`${linha.empresa} (${linha.contrato}): contrato não encontrado em Empresas`);
            continue;
          }
          const k = `${ancora.id}|${linha.empresa.trim().toLowerCase()}`;
          if (chaveExist.has(k)) {
            // já existe — atualiza CNPJ se vier preenchido e estiver vazio
            const ex = cnpjPorChave.get(k)!;
            if (linha.cnpj && !ex.cnpj) {
              const { error } = await supabase
                .from("financeiro_pagadores")
                .update({ cnpj: linha.cnpj })
                .eq("id", ex.id);
              if (error) throw error;
              atualizados += 1;
            } else {
              ignorados += 1;
            }
          } else {
            const { error } = await supabase.from("financeiro_pagadores").insert({
              empresa_id: ancora.id,
              nome_pagador: linha.empresa,
              cnpj: linha.cnpj,
              ativo: true,
            });
            if (error) throw error;
            criados += 1;
            chaveExist.add(k);
          }
        } catch (err: any) {
          erros.push(`${linha.empresa} (${linha.contrato}): ${err.message}`);
        }
      }

      setResumo({ criados, atualizados, ignorados, erros });
      queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores-all"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-pagadores"] });

      if (erros.length === 0) {
        toast.success(
          `Importação concluída: ${criados} criados, ${atualizados} atualizados, ${ignorados} ignorados`,
        );
      } else {
        toast.warning(
          `Concluído com ${erros.length} erro(s). ${criados} criados, ${atualizados} atualizados.`,
        );
      }
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParsedRows([]);
    setFileName("");
    setResumo(null);
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
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {resumo ? "Fechar" : "Cancelar"}
            </Button>
            {parsedRows.length > 0 && !resumo && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : `Importar ${parsedRows.length} pagador(es)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
