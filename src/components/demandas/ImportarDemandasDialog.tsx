import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useImportDemandasLote } from "@/hooks/useDemandas";
import { useAuth } from "@/hooks/useAuth";
import {
  parseBool,
  parseFlexibleDate,
  type Demanda,
} from "@/lib/demandas-utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

// Mapa de cabeçalhos aceitos (lowercase, sem acentos) → coluna da tabela
const COL_MAP: Record<string, keyof Demanda> = {
  "data": "data_reclamacao",
  "data da reclamacao": "data_reclamacao",
  "data reclamacao": "data_reclamacao",
  "beneficiario": "nome_cliente",
  "nome cliente": "nome_cliente",
  "cliente": "nome_cliente",
  "empresa": "empresa",
  "setor": "setor_responsavel",
  "setor responsavel": "setor_responsavel",
  "tipo": "tipo_reclamacao",
  "tipo reclamacao": "tipo_reclamacao",
  "reclamacao": "reclamacao",
  "detalhamento": "detalhamento",
  "observacao": "observacao",
  "executiva": "executiva",
  "executivo": "executiva",
  "cpf": "cpf",
  "data entrada": "data_entrada",
  "data de entrada": "data_entrada",
  "nome medico": "nome_medico",
  "medico": "nome_medico",
  "nome procedimento": "nome_procedimento",
  "procedimento": "nome_procedimento",
  "encaminhado": "encaminhado_setor",
  "encaminhado ao setor": "encaminhado_setor",
  "resolvido setor": "resolvido_setor",
  "resolvido pelo setor": "resolvido_setor",
  "data resolucao setor": "data_resolucao_setor",
  "data resolucao (setor)": "data_resolucao_setor",
  "resolvido executiva": "resolvido_executiva",
  "resolvido pela executiva": "resolvido_executiva",
  "data resolucao executiva": "data_resolucao_executiva",
  "data resolucao (executiva)": "data_resolucao_executiva",
};

const DATE_FIELDS = new Set<keyof Demanda>([
  "data_reclamacao",
  "data_entrada",
  "data_resolucao_setor",
  "data_resolucao_executiva",
]);
const BOOL_FIELDS = new Set<keyof Demanda>([
  "encaminhado_setor",
  "resolvido_setor",
  "resolvido_executiva",
]);

const normHeader = (h: string) =>
  String(h || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export default function ImportarDemandasDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: any[][] } | null>(null);
  const importMut = useImportDemandasLote();
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile-display", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const handleFile = async (f: File) => {
    setFile(f);
    setPreview(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
      if (!json.length) {
        toast.error("Planilha vazia");
        return;
      }
      const headers = (json[0] as any[]).map((h) => String(h ?? ""));
      const rows = json.slice(1).filter((r) => (r as any[]).some((c) => String(c ?? "").trim() !== ""));
      setPreview({ headers, rows: rows as any[][] });
    } catch (e: any) {
      toast.error("Erro ao ler planilha: " + (e?.message || ""));
    }
  };

  const onImport = async () => {
    if (!preview || !file) {
      toast.error("Selecione uma planilha");
      return;
    }
    const colIdx = preview.headers.map((h) => COL_MAP[normHeader(h)]);
    if (!colIdx.includes("data_reclamacao") || !colIdx.includes("nome_cliente")) {
      toast.error("A planilha precisa ter colunas 'Data' e 'Beneficiário'");
      return;
    }

    const registros: Partial<Demanda>[] = [];
    for (const row of preview.rows) {
      const reg: any = {};
      preview.headers.forEach((_, i) => {
        const field = colIdx[i];
        if (!field) return;
        const v = row[i];
        if (DATE_FIELDS.has(field)) {
          reg[field] = parseFlexibleDate(v);
        } else if (BOOL_FIELDS.has(field)) {
          reg[field] = parseBool(v);
        } else {
          const s = String(v ?? "").trim();
          reg[field] = s === "" ? null : s;
        }
      });
      if (!reg.data_reclamacao || !reg.nome_cliente) continue;
      registros.push(reg);
    }

    if (!registros.length) {
      toast.error("Nenhum registro válido para importar");
      return;
    }

    try {
      await importMut.mutateAsync({
        nomeArquivo: file.name,
        registros,
        importadoPorNome: profile?.display_name || user?.email || null,
      });
      toast.success(`${registros.length} demanda(s) importada(s)`);
      onOpenChange(false);
      setFile(null);
      setPreview(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar planilha</DialogTitle>
          <DialogDescription>
            Aceita XLSX ou CSV. Colunas obrigatórias: <b>Data</b> e <b>Beneficiário</b>. Outras
            colunas reconhecidas: Empresa, Setor, Tipo, Reclamação, Executiva, CPF, Detalhamento,
            Resolvido pelo Setor, Resolvido pela Executiva, etc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col min-h-0">
          <div>
            <Label className="text-xs text-muted-foreground">Arquivo</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {preview && (
            <div className="rounded-lg border border-border px-3 py-2 bg-muted/40 text-sm">
              <span className="font-medium">{preview.rows.length}</span> linha(s) prontas para importar.
              <div className="text-xs text-muted-foreground mt-1">
                Colunas reconhecidas:{" "}
                {Array.from(
                  new Set(
                    preview.headers
                      .map((h) => COL_MAP[normHeader(h)])
                      .filter(Boolean) as string[],
                  ),
                ).join(", ") || "—"}
              </div>
            </div>
          )}
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={onImport} disabled={!preview || importMut.isPending}>
            {importMut.isPending ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
