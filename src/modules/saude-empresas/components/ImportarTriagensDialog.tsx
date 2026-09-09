import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { buscarPessoaFisica, isCpfValido, type PessoaFisicaResult } from "@/lib/pessoa-fisica-lookup";
import { maskCpf } from "../lib/saude-rules";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  acaoId: string;
  empresaId: string;
}

type LinhaBruta = {
  nome: string;
  cpf: string;
  pas: number | null;
  pad: number | null;
  glicemia: number | null;
  jejum: boolean;
};

type LinhaValidada = LinhaBruta & {
  encontrado: boolean;
  nomeApi?: string;
  cpfApi?: string;
  data_nascimento?: string | null;
  sexo?: string | null;
  email?: string | null;
  telefone?: string | null;
};

function toIsoDate(v?: string | null): string | null {
  const s = String(v ?? "").trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function normalizarSexo(v?: string | null): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return null;
}

function num(v: any): number | null {
  const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function achaCampo(row: Record<string, any>, alvos: string[]): any {
  for (const k of Object.keys(row)) {
    const norm = k
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    if (alvos.some((a) => norm === a || norm.startsWith(a))) return row[k];
  }
  return undefined;
}

export function ImportarTriagensDialog({ open, onOpenChange, acaoId, empresaId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [linhas, setLinhas] = useState<LinhaValidada[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const reset = () => {
    setLinhas(null);
    setProgresso({ feitos: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
  };

  const lerArquivo = async (file: File) => {
    setProcessando(true);
    setLinhas(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      const brutas: LinhaBruta[] = rows
        .map((r) => {
          const nome = String(achaCampo(r, ["nome", "beneficiario", "paciente"]) ?? "").trim();
          const cpf = String(achaCampo(r, ["cpf", "documento"]) ?? "").replace(/\D/g, "");
          const jejumRaw = String(achaCampo(r, ["jejum"]) ?? "").trim().toLowerCase();
          return {
            nome,
            cpf,
            pas: num(achaCampo(r, ["pas", "pressao sistolica", "sistolica"])),
            pad: num(achaCampo(r, ["pad", "pressao diastolica", "diastolica"])),
            glicemia: num(achaCampo(r, ["glicemia", "glicose"])),
            jejum: jejumRaw.startsWith("s") || jejumRaw === "1" || jejumRaw === "true",
          };
        })
        .filter((l) => l.nome || l.cpf);

      if (brutas.length === 0) {
        toast.error("Nenhuma linha com nome ou CPF encontrada na planilha.");
        return;
      }

      setProgresso({ feitos: 0, total: brutas.length });
      const validadas: LinhaValidada[] = [];
      for (const l of brutas) {
        let match: PessoaFisicaResult | null = null;
        try {
          if (l.cpf.length === 11) {
            const res = await buscarPessoaFisica(l.cpf);
            match =
              res.find((p) => String(p.NR_CPF ?? "").replace(/\D/g, "") === l.cpf) ??
              (res.length === 1 ? res[0] : null);
          }
          if (!match && l.nome.length >= 3) {
            const res = await buscarPessoaFisica(l.nome);
            const alvo = l.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
            match =
              res.find(
                (p) =>
                  String(p.NM_PESSOA_FISICA ?? "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase()
                    .trim() === alvo,
              ) ?? (res.length === 1 ? res[0] : null);
          }
        } catch {
          match = null;
        }

        if (match) {
          validadas.push({
            ...l,
            encontrado: true,
            nomeApi: String(match.NM_PESSOA_FISICA || match.NAME || l.nome).trim(),
            cpfApi: isCpfValido(match.NR_CPF) ? maskCpf(String(match.NR_CPF)) : l.cpf ? maskCpf(l.cpf) : "",
            data_nascimento: toIsoDate(match.DT_NASCIMENTO),
            sexo: normalizarSexo(match.SEXO),
            email: String(match.DS_EMAIL || "").trim() || null,
            telefone: String(match.NR_TELEFONE_CELULAR || match.TELEFONE_APP || "").trim() || null,
          });
        } else {
          validadas.push({ ...l, encontrado: false });
        }
        setProgresso((p) => ({ ...p, feitos: p.feitos + 1 }));
      }

      setLinhas(validadas);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ler o arquivo.");
    } finally {
      setProcessando(false);
    }
  };

  const encontrados = (linhas ?? []).filter((l) => l.encontrado);
  const descartados = (linhas ?? []).length - encontrados.length;

  const importar = async () => {
    if (encontrados.length === 0) return;
    setSalvando(true);
    try {
      const payload = encontrados.map((l) => ({
        acao_id: acaoId,
        empresa_id: empresaId,
        nome: l.nomeApi || l.nome,
        cpf: l.cpfApi || null,
        data_nascimento: l.data_nascimento ?? null,
        sexo: l.sexo ?? null,
        email: l.email ?? null,
        telefone: l.telefone ?? null,
        pas_mmhg: l.pas,
        pad_mmhg: l.pad,
        glicemia_mg_dl: l.glicemia,
        jejum: l.jejum,
        created_by: user?.id ?? null,
      }));
      const { error } = await supabase.from("triagens").insert(payload);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["triagens"] });
      qc.invalidateQueries({ queryKey: ["acoes_saude"] });
      toast.success(
        `${encontrados.length} triagem(ns) importada(s)${descartados > 0 ? ` · ${descartados} descartada(s)` : ""}`,
      );
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar triagens</DialogTitle>
          <DialogDescription>
            Envie uma planilha (Excel ou CSV) com as colunas Nome, CPF e, opcionalmente, PAS, PAD, Glicemia e Jejum.
            Cada pessoa é conferida na base de beneficiários; quem não for localizado é descartado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lerArquivo(f);
            }}
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={processando || salvando}
            className="w-full gap-2"
          >
            {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            {processando
              ? `Conferindo ${progresso.feitos}/${progresso.total}...`
              : "Selecionar planilha"}
          </Button>

          {linhas && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  {encontrados.length} localizados
                </Badge>
                {descartados > 0 && (
                  <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400">
                    {descartados} descartados
                  </Badge>
                )}
              </div>
              <ScrollArea className="h-64 rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Nome</th>
                      <th className="p-2 font-medium">CPF</th>
                      <th className="p-2 font-medium">PA</th>
                      <th className="p-2 font-medium">Glicemia</th>
                      <th className="p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{l.nomeApi || l.nome || "—"}</td>
                        <td className="p-2">{l.cpfApi || (l.cpf ? maskCpf(l.cpf) : "—")}</td>
                        <td className="p-2">{l.pas && l.pad ? `${l.pas}/${l.pad}` : "—"}</td>
                        <td className="p-2">{l.glicemia ?? "—"}</td>
                        <td className="p-2">
                          {l.encontrado ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" /> Localizado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <XCircle className="h-4 w-4" /> Descartado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={salvando || encontrados.length === 0} className="gap-2">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {encontrados.length > 0 ? `(${encontrados.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
