import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { useImportCorridasLote, type UberCorrida } from "@/hooks/useUberCorridas";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function parseDateBR(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y.toString().padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return s.slice(0, 10);
  return null;
}

function parseTime(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    const totalSec = Math.round(v * 86400);
    const hh = String(Math.floor(totalSec / 3600) % 24).padStart(2, "0");
    const mm = String(Math.floor(totalSec / 60) % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const s = String(v).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return null;
}

function parseNumber(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

const COL_MAP: Record<string, keyof UberCorrida> = {
  data: "data",
  horário: "horario",
  horario: "horario",
  colaborador: "colaborador",
  origem: "origem",
  destino: "destino",
  motivo: "motivo",
  tipo: "tipo",
  empresa: "empresa",
  "forma pagamento": "forma_pagamento",
  "forma_pagamento": "forma_pagamento",
  responsável: "responsavel",
  responsavel: "responsavel",
  "criado por": "criado_por",
  criado_por: "criado_por",
  valor: "valor",
  reembolso: "reembolso",
  cancelada: "cancelada",
  observação: "observacao",
  observacao: "observacao",
};

export function ImportarCorridasDialog({ open, onOpenChange }: Props) {
  const importar = useImportCorridasLote();
  const [preview, setPreview] = useState<Partial<UberCorrida>[]>([]);
  const [fileName, setFileName] = useState("");

  const onFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
    const parsed: Partial<UberCorrida>[] = [];
    for (const r of rows) {
      const obj: any = {};
      for (const [k, v] of Object.entries(r)) {
        const key = COL_MAP[String(k).toLowerCase().trim()];
        if (!key) continue;
        obj[key] = v;
      }
      const data = parseDateBR(obj.data);
      if (!data || !obj.colaborador) continue;
      parsed.push({
        data,
        horario: parseTime(obj.horario),
        colaborador: String(obj.colaborador).trim(),
        origem: obj.origem ? String(obj.origem) : null,
        destino: obj.destino ? String(obj.destino) : null,
        motivo: obj.motivo ? String(obj.motivo) : null,
        tipo: obj.tipo ? String(obj.tipo) : null,
        empresa: obj.empresa ? String(obj.empresa) : null,
        forma_pagamento: obj.forma_pagamento ? String(obj.forma_pagamento) : null,
        responsavel: obj.responsavel ? String(obj.responsavel) : null,
        criado_por: obj.criado_por ? String(obj.criado_por) : null,
        valor: parseNumber(obj.valor),
        reembolso: parseNumber(obj.reembolso),
        cancelada: String(obj.cancelada ?? "").toLowerCase().startsWith("s"),
        observacao: obj.observacao ? String(obj.observacao) : null,
      });
    }
    setPreview(parsed);
    if (!parsed.length) toast.error("Nenhuma linha válida encontrada");
  };

  const confirm = async () => {
    if (!preview.length) return;
    await importar.mutateAsync(preview);
    setPreview([]); setFileName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar corridas (Excel)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {fileName && (
            <div className="text-sm text-muted-foreground">
              <strong>{fileName}</strong> · {preview.length} linha(s) prontas para importar
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Colunas esperadas: Data, Horário, Colaborador, Origem, Destino, Motivo, Tipo, Empresa, Forma Pagamento, Responsável, Criado por, Valor, Reembolso, Cancelada.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={!preview.length || importar.isPending}>
            <Upload className="h-4 w-4 mr-2" />
            {importar.isPending ? "Importando..." : `Importar ${preview.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
