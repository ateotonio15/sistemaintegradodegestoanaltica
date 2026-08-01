import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CSV_MODELO,
  META_PADRAO,
  calcular,
  fmtMoeda,
  fmtPct,
  fmtPctSinal,
  labelPeriodo,
  parseCsvLancamentos,
  type LinhaCsv,
} from "../lib/evolucao-mensal";
import {
  useCarteiraConfig,
  useEvolucaoMensal,
  useUpsertLancamento,
} from "../hooks/useEvolucaoMensal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: { id: string; nome: string }[];
}

export function ImportarCsvDialog({ open, onOpenChange, empresas }: Props) {
  const { data: lancamentos = [] } = useEvolucaoMensal();
  const { data: config = {} } = useCarteiraConfig();
  const upsert = useUpsertLancamento();
  const inputRef = useRef<HTMLInputElement>(null);

  const [nomeArquivo, setNomeArquivo] = useState("");
  const [linhas, setLinhas] = useState<LinhaCsv[]>([]);
  const [sobrescrever, setSobrescrever] = useState(true);
  const [puladas, setPuladas] = useState<Record<number, boolean>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) {
      setNomeArquivo("");
      setLinhas([]);
      setPuladas({});
      setSobrescrever(true);
      setSalvando(false);
    }
  }, [open]);

  const metaDe = (l: LinhaCsv) =>
    l.meta ?? (l.empresaId ? config[l.empresaId]?.meta_sinistralidade : undefined) ?? META_PADRAO;

  const lerArquivo = async (file: File) => {
    const texto = await file.text();
    const parsed = parseCsvLancamentos(
      texto,
      empresas,
      lancamentos.map((l) => ({ empresa_id: l.empresa_id, periodo: l.periodo })),
    );
    setNomeArquivo(file.name);
    setLinhas(parsed);
    setPuladas({});
    if (!parsed.length) toast.error("Nenhuma linha encontrada no arquivo.");
  };

  const resumo = useMemo(() => {
    const comErro = linhas.filter((l) => l.erros.length).length;
    const dup = linhas.filter((l) => l.duplicada && !l.erros.length).length;
    const semSinistro = linhas.filter((l) => l.sinistro == null && !l.erros.length).length;
    return { total: linhas.length, comErro, dup, semSinistro };
  }, [linhas]);

  const podeConfirmar = linhas.length > 0 && resumo.comErro === 0 && !salvando;

  const baixarModelo = () => {
    const blob = new Blob([CSV_MODELO], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-lancamentos-mensais.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmar = async () => {
    const alvo = linhas.filter((l, i) => {
      if (l.erros.length) return false;
      if (puladas[l.indice]) return false;
      if (l.duplicada && !sobrescrever) return false;
      return true;
    });
    if (!alvo.length) {
      toast.error("Nenhuma linha para importar.");
      return;
    }
    setSalvando(true);
    try {
      const payload = alvo.map((l) => ({
        empresa_id: l.empresaId!,
        empresa_nome: l.empresaNome,
        periodo: l.periodo,
        premio_empresa: l.premioEmpresa,
        premio_continuidade: l.premioContinuidade,
        sinistro: l.sinistro as any,
        meta_sinistralidade: metaDe(l),
        fisioterapia_in_company: l.fisio,
      }));
      await upsert.mutateAsync(payload as any);
      const sobrescritos = alvo.filter((l) => l.duplicada).length;
      const pulados = linhas.length - alvo.length;
      const pendentes = alvo.filter((l) => l.sinistro == null).length;
      toast.success(
        `${alvo.length - sobrescritos} lançamentos importados, ${sobrescritos} sobrescritos, ${pulados} pulados, ${pendentes} com sinistro pendente.`,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao importar lançamentos.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-6xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Importar lançamentos via CSV
          </DialogTitle>
          <DialogDescription>
            Colunas: empresa, periodo (AAAA-MM), premio_empresa, premio_continuidade, premio_total,
            fisioterapia_in_company, sinistro, meta_sinistralidade.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lerArquivo(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Selecionar arquivo
          </Button>
          <Button size="sm" variant="ghost" onClick={baixarModelo}>
            <Download className="h-3.5 w-3.5 mr-1" /> Baixar modelo CSV
          </Button>
          {nomeArquivo && (
            <span className="text-xs text-muted-foreground truncate">{nomeArquivo}</span>
          )}
        </div>

        {linhas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{resumo.total} linhas</Badge>
            {resumo.comErro > 0 && (
              <Badge variant="destructive">{resumo.comErro} com erro</Badge>
            )}
            {resumo.dup > 0 && (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">
                {resumo.dup} já existentes
              </Badge>
            )}
            {resumo.semSinistro > 0 && (
              <Badge className="bg-sky-500/15 text-sky-600 border-sky-500/30" variant="outline">
                {resumo.semSinistro} sem sinistro
              </Badge>
            )}
            {resumo.dup > 0 && (
              <label className="ml-auto flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sobrescrever}
                  onCheckedChange={(v) => setSobrescrever(!!v)}
                />
                <span>Sobrescrever lançamentos já existentes</span>
              </label>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto rounded-md border">
          {linhas.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Selecione um arquivo .csv para visualizar a prévia dos lançamentos.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/60 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2">Empresa</th>
                  <th className="px-2 py-2">Período</th>
                  <th className="px-2 py-2 text-right">Prêmio empresa</th>
                  <th className="px-2 py-2 text-right">Continuidade</th>
                  <th className="px-2 py-2 text-right">Prêmio total</th>
                  <th className="px-2 py-2 text-right">Fisio in company</th>
                  <th className="px-2 py-2 text-right">Sinistro total</th>
                  <th className="px-2 py-2 text-right">Sinistralidade</th>
                  <th className="px-2 py-2 text-right">BE meta</th>
                  <th className="px-2 py-2 text-right">Distorção</th>
                  <th className="px-2 py-2 text-right">Aporte</th>
                  <th className="px-2 py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const meta = metaDe(l);
                  const c = calcular(l.premioEmpresa, l.premioContinuidade, l.sinistro ?? 0, meta, {
                    fisio: l.fisio,
                  });
                  const pendente = l.sinistro == null;
                  const erro = l.erros.length > 0;
                  const pular = !!puladas[l.indice] || (l.duplicada && !sobrescrever);
                  return (
                    <tr
                      key={l.indice}
                      className={cn(
                        "border-t",
                        erro && "bg-destructive/10",
                        !erro && pular && "opacity-50",
                      )}
                    >
                      <td className="px-2 py-1.5">
                        {!erro && (
                          <Checkbox
                            checked={!puladas[l.indice]}
                            onCheckedChange={(v) =>
                              setPuladas((p) => ({ ...p, [l.indice]: !v }))
                            }
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-medium">{l.empresaTexto || "—"}</td>
                      <td className="px-2 py-1.5">
                        {l.periodo ? labelPeriodo(l.periodo) : l.periodoTexto || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoeda(l.premioEmpresa)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoeda(l.premioContinuidade)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoeda(c.premioTotal)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoeda(l.fisio)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {pendente ? "—" : fmtMoeda(c.sinistroTotal)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {pendente ? "—" : fmtPct(c.sinistralidade)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoeda(c.beMeta)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {pendente ? "—" : fmtPctSinal(c.distorcao)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {pendente ? "—" : fmtMoeda(c.aporte)}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          {l.erros.map((e, i) => (
                            <span key={i} className="text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {e}
                            </span>
                          ))}
                          {l.duplicada && !erro && (
                            <span className="text-amber-600">
                              Já existe — {sobrescrever ? "será sobrescrito" : "será pulado"}
                            </span>
                          )}
                          {l.avisos.map((a, i) => (
                            <span key={i} className="text-muted-foreground">
                              {a}
                            </span>
                          ))}
                          {!erro && !l.duplicada && !l.avisos.length && (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="gap-2">
          {resumo.comErro > 0 && (
            <span className="text-xs text-destructive mr-auto">
              Corrija as linhas com erro (empresa ou período inválido) antes de importar.
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!podeConfirmar} onClick={confirmar}>
            {salvando ? "Importando..." : "Confirmar importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
