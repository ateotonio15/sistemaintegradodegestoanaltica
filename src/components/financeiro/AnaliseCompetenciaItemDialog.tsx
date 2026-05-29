import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/excel-analysis-utils";
import type { ItemLoteRow, StatusItem } from "@/lib/financeiro-analise-lote";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: ItemLoteRow | null;
  competencia: string;
  usuario: string | null;
  data: string | null;
}

function statusBadgeClass(s: StatusItem): string {
  if (s === "OK") return "bg-success/15 text-success border border-success/30";
  if (s === "Divergente" || s === "Erro ao ler Excel" || s === "Erro ao ler PDF")
    return "bg-destructive/15 text-destructive border border-destructive/30";
  return "bg-warning/15 text-warning border border-warning/30";
}

export function AnaliseCompetenciaItemDialog({ open, onOpenChange, item, competencia, usuario, data }: Props) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            Detalhamento — {item.empresa_nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge className={statusBadgeClass(item.status)}>{item.status}</Badge>
            <span className="text-muted-foreground text-xs">{item.proxima_acao}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Empresa" value={item.empresa_nome} />
            <Field label="CNPJ Empresa" value={item.empresa_cnpj} />
            <Field label="Contrato" value={item.empresa_codigo} />
            <Field label="Competência" value={competencia} />
            <Field label="Período" value={item.periodo} />
            <Field label="Pagador" value={item.pagador_nome} />
            <Field label="CNPJ Pagador" value={item.pagador_cnpj} />
            <Field label="Excel" value={item.nome_arquivo_excel || "—"} />
            <Field label="PDF" value={item.nome_arquivo_pdf || "—"} />
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">Métrica</th>
                  <th className="text-right px-3 py-2">Excel</th>
                  <th className="text-right px-3 py-2">PDF/NF</th>
                  <th className="text-right px-3 py-2">Diferença</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-medium">Total</td>
                  <td className="px-3 py-2 text-right">{item.valor_excel == null ? "—" : formatBRL(item.valor_excel)}</td>
                  <td className="px-3 py-2 text-right">{item.valor_pdf == null ? "—" : formatBRL(item.valor_pdf)}</td>
                  <td className={`px-3 py-2 text-right ${item.diferenca && Math.abs(item.diferenca) > 0.01 ? "text-destructive font-semibold" : ""}`}>
                    {item.diferenca == null ? "—" : formatBRL(item.diferenca)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {item.divergencias && item.divergencias.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <div className="font-semibold text-destructive mb-2">
                Divergências ({item.divergencias.length})
              </div>
              <ul className="space-y-1 text-xs">
                {item.divergencias.map((d: any, i: number) => (
                  <li key={i}>
                    <strong>{d.campo}:</strong> Excel {d.valor_excel ?? "—"} × PDF {d.valor_pdf ?? "—"}
                    {d.diferenca != null && <span className="text-muted-foreground"> (Δ {d.diferenca})</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : item.status === "OK" ? (
            <div className="rounded-md border border-success/40 bg-success/5 p-3 text-success text-sm">
              Todos os valores conferem com a nota fiscal.
            </div>
          ) : null}

          {item.erros && item.erros.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
              <div className="font-semibold text-warning mb-2">Erros identificados</div>
              <ul className="space-y-1 text-xs">
                {item.erros.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Analisado em {data ? new Date(data).toLocaleString("pt-BR") : "—"} por {usuario || "—"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="truncate">{value || "—"}</div>
    </div>
  );
}
