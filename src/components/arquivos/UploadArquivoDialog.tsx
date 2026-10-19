import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileUp, AlertTriangle, CheckCircle2, Calculator } from "lucide-react";
import { CalculadoraRetroativaDialog, type CalcItem } from "@/components/financeiro/CalculadoraRetroativaDialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatBytes, sha256Hex, validarArquivo } from "@/lib/arquivos-utils";

const BUCKET = "arquivos-financeiro";

interface Empresa {
  id: string;
  nome: string;
  codigo_contrato: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmpresaId?: string;
  defaultCompetencia?: string;
}

type FileStatus = "pendente" | "enviando" | "ok" | "duplicado" | "erro";

interface FileItem {
  file: File;
  id: string;
  status: FileStatus;
  progresso: number;
  mensagem?: string;
}

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const compCurta = (c: string) => {
  const [y, m] = c.split("-");
  return `${MESES_CURTOS[Number(m) - 1]}/${y.slice(2)}`;
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Lista competências de 01/2026 até dezembro do ano corrente (no mínimo),
// ou até o mês seguinte ao atual, o que for maior (mais recente primeiro).
function getMesesOptions(): string[] {
  const out: string[] = [];
  const now = new Date();
  const proximo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const fimAno = new Date(now.getFullYear(), 11, 1); // dezembro do ano corrente
  const limite = proximo > fimAno ? proximo : fimAno;
  const endY = limite.getFullYear();
  const endM = limite.getMonth() + 1; // 1..12
  let y = 2026;
  let m = 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out.reverse();
}


export function UploadArquivoDialog({ open, onOpenChange, defaultEmpresaId, defaultCompetencia }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);

  const [empresaId, setEmpresaId] = useState<string>("");
  const [competencia, setCompetencia] = useState<string>(mesAtual());
  const [categoria, setCategoria] = useState<string>("Mensalidade");
  const [aporteValor, setAporteValor] = useState("");
  const [aporteParcelas, setAporteParcelas] = useState("");
  const isAporte = categoria === "Aporte";
  const aporteValorNum = Number(aporteValor.replace(/\./g, "").replace(",", ".")) || 0;
  const aporteParcelasNum = Math.floor(Number(aporteParcelas) || 0);
  const aporteValido = aporteValorNum > 0 && aporteParcelasNum >= 1 && aporteParcelasNum <= 24;
  const parcelasAporte = useMemo(() => {
    if (!aporteValido || !competencia) return [];
    const totalC = Math.round(aporteValorNum * 100);
    const base = Math.floor(totalC / aporteParcelasNum);
    const [y0, m0] = competencia.split("-").map(Number);
    return Array.from({ length: aporteParcelasNum }, (_, i) => {
      const d = new Date(y0, m0 - 1 + i, 1);
      const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const c = i === aporteParcelasNum - 1 ? totalC - base * (aporteParcelasNum - 1) : base;
      return { numero: i + 1, competencia: comp, valor: c / 100 };
    });
  }, [aporteValido, aporteValorNum, aporteParcelasNum, competencia]);
  const [observacao, setObservacao] = useState<string>("");
  const [arquivos, setArquivos] = useState<FileItem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcItens, setCalcItens] = useState<CalcItem[]>([]);

  useEffect(() => {
    if (open) {
      setEmpresaId(defaultEmpresaId ?? "");
      setCompetencia(defaultCompetencia ?? mesAtual());
      setCategoria("Mensalidade");
    } else {
      setEmpresaId("");
      setCompetencia(mesAtual());
      setCategoria("Mensalidade");
      setObservacao("");
      setArquivos([]);
      setEnviando(false);
      setCalcItens([]);
      setCalcOpen(false);
    }
  }, [open, defaultEmpresaId, defaultCompetencia]);

  const { data: empresas = [] } = useQuery({
    queryKey: ["arquivos-upload-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_contrato")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
    enabled: open,
  });

  const empresaSel = useMemo(
    () => empresas.find((e) => e.id === empresaId) ?? null,
    [empresas, empresaId],
  );

  const { data: profile } = useQuery({
    queryKey: ["upload-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  function addFiles(list: FileList | File[]) {
    const novos: FileItem[] = [];
    for (const f of Array.from(list)) {
      const v = validarArquivo(f);
      if (!v.ok) {
        toast.error(`${f.name}: ${v.motivo}`);
        continue;
      }
      novos.push({
        file: f,
        id: crypto.randomUUID(),
        status: "pendente",
        progresso: 0,
      });
    }
    if (novos.length) setArquivos((prev) => [...prev, ...novos]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (enviando) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function removeItem(id: string) {
    setArquivos((prev) => prev.filter((a) => a.id !== id));
  }

  async function uploadAll() {
    if (!empresaId) {
      toast.error("Selecione a empresa");
      return;
    }
    if (!competencia) {
      toast.error("Selecione a competência");
      return;
    }
    if (!arquivos.length) {
      toast.error("Adicione ao menos um arquivo");
      return;
    }
    if (isAporte && !aporteValido) {
      toast.error("Informe o valor total do aporte e a quantidade de parcelas (1 a 24)");
      return;
    }

    setEnviando(true);
    let okCount = 0;

    for (const item of arquivos) {
      if (item.status === "ok" || item.status === "duplicado") continue;

      setArquivos((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: "enviando", progresso: 10 } : a)),
      );

      try {
        const buffer = await item.file.arrayBuffer();
        const hash = await sha256Hex(buffer);

        // Verifica duplicidade ativa: mesmo hash OU mesmo nome no contrato/competência
        const { data: dupHash } = await supabase
          .from("financeiro_arquivos")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("competencia", competencia)
          .eq("hash_arquivo", hash)
          .eq("status", "ativo")
          .maybeSingle();
        const { data: dupNome } = dupHash ? { data: null } : await supabase
          .from("financeiro_arquivos")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("competencia", competencia)
          .eq("nome_original", item.file.name)
          .eq("status", "ativo")
          .maybeSingle();
        const dup = dupHash ?? dupNome;

        if (dup) {
          setArquivos((prev) =>
            prev.map((a) =>
              a.id === item.id
                ? { ...a, status: "duplicado", progresso: 100, mensagem: "Já existe arquivo idêntico" }
                : a,
            ),
          );
          continue;
        }

        setArquivos((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, progresso: 40 } : a)),
        );

        const ext = (item.file.name.split(".").pop() ?? "bin").toLowerCase();
        const armazenado = `${crypto.randomUUID()}.${ext}`;
        const path = `${empresaId}/${competencia}/${armazenado}`;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, item.file, {
            contentType: item.file.type || undefined,
            upsert: false,
          });
        if (upErr) throw upErr;

        setArquivos((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, progresso: 80 } : a)),
        );

        const { data: insData, error: insErr } = await supabase.from("financeiro_arquivos").insert({
          empresa_id: empresaId,
          competencia,
          categoria,
          nome_original: item.file.name,
          nome_armazenado: armazenado,
          extensao: ext,
          mime_type: item.file.type || null,
          tamanho_bytes: item.file.size,
          hash_arquivo: hash,
          observacao: observacao || null,
          uploaded_by: user?.id ?? null,
          uploaded_by_nome: profile?.display_name ?? null,
          storage_path: path,
          status: "ativo",
          versao: 1,
        }).select("id").single();
        if (insErr) {
          // tenta limpar o objeto já enviado
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr;
        }

        if (isAporte && insData) {
          const { data: ap, error: apErr } = await supabase
            .from("financeiro_aportes")
            .insert({
              empresa_id: empresaId,
              arquivo_id: insData.id,
              valor_total: aporteValorNum,
              parcelas: aporteParcelasNum,
              competencia_inicial: competencia,
              created_by: user?.id ?? null,
            })
            .select("id")
            .single();
          if (apErr) throw apErr;
          const { error: pErr } = await supabase.from("financeiro_aporte_parcelas").insert(
            parcelasAporte.map((p) => ({ aporte_id: ap.id, empresa_id: empresaId, ...p })),
          );
          if (pErr) throw pErr;
        }

        okCount += 1;
        setArquivos((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, status: "ok", progresso: 100 } : a)),
        );
      } catch (e: any) {
        setArquivos((prev) =>
          prev.map((a) =>
            a.id === item.id
              ? { ...a, status: "erro", progresso: 100, mensagem: e?.message ?? "Erro" }
              : a,
          ),
        );
      }
    }

    setEnviando(false);
    if (okCount > 0) {
      toast.success(`${okCount} arquivo${okCount === 1 ? "" : "s"} enviado${okCount === 1 ? "" : "s"} com sucesso`);
      queryClient.invalidateQueries({ queryKey: ["financeiro-arquivos"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-aportes"] });
    }
  }

  const meses = useMemo(() => getMesesOptions(), []);

  return (
    <Dialog open={open} onOpenChange={(v) => (!enviando ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Enviar arquivos financeiros
          </DialogTitle>
          <DialogDescription>
            Vincule os documentos a uma empresa, competência e categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} {e.codigo_contrato ? `· ${e.codigo_contrato}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Contrato</Label>
            <Input value={empresaSel?.codigo_contrato ?? ""} readOnly placeholder="—" />
          </div>

          <div className="space-y-1.5">
            <Label>Competência *</Label>
            <Select value={competencia} onValueChange={setCompetencia}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => {
                  const [y, mm] = m.split("-");
                  return (
                    <SelectItem key={m} value={m}>
                      {mm}/{y}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Tipo *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mensalidade">Mensalidade</SelectItem>
                <SelectItem value="Reajuste">Reajuste</SelectItem>
                <SelectItem value="Implantação">Implantação (empresa nova)</SelectItem>
                <SelectItem value="Retroativo">Retroativo</SelectItem>
                <SelectItem value="Retorno Reaj.">Retorno Reaj.</SelectItem>
                <SelectItem value="Fluxo">Fluxo</SelectItem>
                <SelectItem value="Aporte">Aporte</SelectItem>
              </SelectContent>
            </Select>
            {(categoria === "Retroativo" || isAporte) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-fit gap-1.5"
                onClick={() => setCalcOpen(true)}
              >
                <Calculator className="h-3.5 w-3.5" />
                Abrir calculadora de cobrança
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Selecione "Implantação" para anexos de implementação de empresas novas.
            </p>
          </div>

          {isAporte && (
            <>
              <div className="space-y-1.5">
                <Label>Valor total do aporte (R$) *</Label>
                <Input
                  inputMode="decimal"
                  value={aporteValor}
                  onChange={(e) => setAporteValor(e.target.value)}
                  placeholder="Ex: 100,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade de parcelas *</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={aporteParcelas}
                  onChange={(e) => setAporteParcelas(e.target.value)}
                  placeholder="Ex: 6"
                />
              </div>
              {aporteValido && (
                <p className="text-xs text-muted-foreground md:col-span-2">
                  {aporteParcelasNum}x de {brl(parcelasAporte[0].valor)} —{" "}
                  {compCurta(parcelasAporte[0].competencia)} a {compCurta(parcelasAporte[parcelasAporte.length - 1].competencia)}
                  {parcelasAporte[parcelasAporte.length - 1].valor !== parcelasAporte[0].valor &&
                    ` (última: ${brl(parcelasAporte[parcelasAporte.length - 1].valor)})`}
                </p>
              )}
            </>
          )}



          <div className="space-y-1.5 md:col-span-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex: Boleto referente ao 1º pagador..."
            />
          </div>
        </div>

        <div
          ref={dropRef}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={onDrop}
          className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("file-input-arq")?.click()}
        >
          <FileUp className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium mt-2">Arraste arquivos aqui ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, XLSX, XLS, CSV, DOCX, PNG, JPG · até 25 MB cada
          </p>
          <input
            id="file-input-arq"
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.xlsx,.xls,.csv,.docx,.png,.jpg,.jpeg"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {arquivos.length > 0 && (
          <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
            {arquivos.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium" title={a.file.name}>
                      {a.file.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatBytes(a.file.size)}
                    </span>
                    {a.status === "ok" && (
                      <Badge className="bg-success text-success-foreground gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Enviado
                      </Badge>
                    )}
                    {a.status === "duplicado" && (
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Duplicado
                      </Badge>
                    )}
                    {a.status === "erro" && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Erro
                      </Badge>
                    )}
                  </div>
                  {(a.status === "enviando" || a.progresso > 0) && (
                    <Progress value={a.progresso} className="h-1 mt-1" />
                  )}
                  {a.mensagem && (
                    <p className="text-xs text-muted-foreground mt-0.5">{a.mensagem}</p>
                  )}
                </div>
                {!enviando && a.status !== "ok" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeItem(a.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={enviando}
          >
            Fechar
          </Button>
          <Button onClick={uploadAll} disabled={enviando || !arquivos.length}>
            {enviando ? "Enviando..." : `Enviar ${arquivos.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>

      <CalculadoraRetroativaDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        itensIniciais={calcItens}
        onItensChange={setCalcItens}
        onAplicar={(totalCentavos, resumo) => {
          const totalStr = (totalCentavos / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          });
          if (isAporte) {
            setAporteValor(totalStr);
            toast.success("Valor total do aporte preenchido pela calculadora.");
          } else {
            setObservacao((prev) => (prev ? `${prev}\n` : "") + `${resumo} — Total: ${totalStr}`));
            toast.success("Total e resumo adicionados à Observação.");
          }
        }}
      />
    </Dialog>
  );
}
