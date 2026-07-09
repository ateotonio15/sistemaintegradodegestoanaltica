import { useState } from "react";
import { BarChart3, Loader2, FileSpreadsheet, FileType, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useEmpresasAtivas, useExecutivas } from "../hooks/useAcoesPreventivas";
import { MESES_PT } from "../lib/palestras-calendario";
import { gerarRelatorioMensal, type FiltrosRelatorio, type TipoAcaoFiltro } from "../lib/relatorio-mensal-export";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: Date;
}

const TIPOS: Array<{ v: TipoAcaoFiltro; label: string }> = [
  { v: "todos", label: "Todos" },
  { v: "palestras", label: "Palestras" },
  { v: "sinais_vitais", label: "Sinais Vitais" },
  { v: "psa", label: "PSA" },
  { v: "preventivo", label: "Coleta Preventiva" },
  { v: "outros", label: "Outros" },
];

export function RelatorioMensalDialog({ open, onOpenChange, defaultDate }: Props) {
  const now = defaultDate ?? new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [executiva, setExecutiva] = useState<string>("all");
  const [enfermeira, setEnfermeira] = useState<string>("");
  const [tipo, setTipo] = useState<TipoAcaoFiltro>("todos");
  const [fmtPptx, setFmtPptx] = useState(true);
  const [fmtPdf, setFmtPdf] = useState(true);
  const [fmtXlsx, setFmtXlsx] = useState(true);
  const [loading, setLoading] = useState(false);

  const { data: empresas = [] } = useEmpresasAtivas();
  const { data: executivas = [] } = useExecutivas();

  const anos = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

  const onSubmit = async () => {
    const formatos: Array<"pptx" | "pdf" | "xlsx"> = [];
    if (fmtPptx) formatos.push("pptx");
    if (fmtPdf) formatos.push("pdf");
    if (fmtXlsx) formatos.push("xlsx");
    if (!formatos.length) {
      toast.error("Selecione ao menos um formato de exportação");
      return;
    }

    const empresa = empresas.find((e) => e.id === empresaId);
    const filtros: FiltrosRelatorio = {
      mes, ano,
      empresaId: empresaId !== "all" ? empresaId : null,
      empresaNome: empresa?.nome ?? null,
      executiva: executiva !== "all" ? executiva : null,
      enfermeira: enfermeira.trim() || null,
      tipo,
    };

    setLoading(true);
    try {
      const { totalAcoes } = await gerarRelatorioMensal(filtros, formatos);
      toast.success(`Relatório gerado — ${totalAcoes} ação(ões) no período.`);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Gerar Relatório Mensal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mês</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_PT.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Empresa (opcional)</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Executiva (opcional)</Label>
              <Select value={executiva} onValueChange={setExecutiva}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {executivas.map((e) => (
                    <SelectItem key={e.user_id} value={e.display_name}>{e.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Enfermeira / Responsável (opcional)</Label>
              <Input value={enfermeira} onChange={(e) => setEnfermeira(e.target.value)} placeholder="Nome" />
            </div>
          </div>

          <div>
            <Label>Tipo de ação</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAcaoFiltro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label>Formatos de exportação</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={fmtPptx} onCheckedChange={(v) => setFmtPptx(!!v)} />
                <FileType className="h-4 w-4 text-orange-500" /> PowerPoint
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={fmtPdf} onCheckedChange={(v) => setFmtPdf(!!v)} />
                <FileText className="h-4 w-4 text-red-500" /> PDF
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={fmtXlsx} onCheckedChange={(v) => setFmtXlsx(!!v)} />
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Excel
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : "Gerar Relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
