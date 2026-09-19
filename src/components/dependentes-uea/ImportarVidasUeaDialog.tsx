import { useMemo, useRef, useState } from "react";
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
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCPF, formatDataBR, type FaixaUea } from "@/lib/dependentes-uea";
import {
  lerLayoutVidasUea,
  resumoImportacao,
  type ResultadoLeituraVidas,
} from "@/lib/vidas-layout-uea-import";
import { useImportarVidasUea } from "@/hooks/useDependentesUea";

function Resumo({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="rounded-xl border-border/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${tone ?? ""}`}>{value.toLocaleString("pt-BR")}</p>
    </Card>
  );
}

export function ImportarVidasUeaDialog({
  open,
  onOpenChange,
  faixas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  faixas: FaixaUea[];
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLeituraVidas | null>(null);
  const importar = useImportarVidasUea();

  const resumo = useMemo(() => (resultado ? resumoImportacao(resultado) : null), [resultado]);

  function reset() {
    setResultado(null);
    setArquivo(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLendo(true);
    try {
      const r = await lerLayoutVidasUea(file);
      setArquivo(file.name);
      setResultado(r);
      if (r.totalLinhas === 0) {
        toast({
          title: "Nada encontrado no arquivo",
          description: "Não foi possível localizar a coluna de carteirinha e nome do beneficiário.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro ao ler o arquivo", description: e.message, variant: "destructive" });
    } finally {
      setLendo(false);
    }
  }

  async function confirmar() {
    if (!resultado || resultado.familias.length === 0) return;
    await importar.mutateAsync({ familias: resultado.familias, faixas });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Layout de Vidas</DialogTitle>
          <DialogDescription>
            Somente titulares que possuem pelo menos um dependente são importados. A relação familiar é
            identificada pela carteirinha (final 0 = titular, 1, 2, 3… = dependentes).
          </DialogDescription>
        </DialogHeader>

        {!resultado ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecione o arquivo do Layout de Vidas (Excel ou CSV). O arquivo original não é alterado.
            </p>
            <Button onClick={() => inputRef.current?.click()} disabled={lendo}>
              {lendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Escolher arquivo
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Arquivo: {arquivo}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Resumo label="Famílias encontradas" value={resumo?.familias ?? 0} />
              <Resumo label="Titulares com dependentes" value={resumo?.titulares ?? 0} />
              <Resumo label="Dependentes encontrados" value={resumo?.dependentes ?? 0} />
              <Resumo
                label="Ignorados sem dependentes"
                value={resumo?.ignorados ?? 0}
                tone="text-muted-foreground"
              />
              <Resumo
                label="Registros com inconsistência"
                value={resumo?.inconsistencias ?? 0}
                tone={(resumo?.inconsistencias ?? 0) > 0 ? "text-destructive" : undefined}
              />
            </div>

            <ScrollArea className="h-[320px] rounded-xl border border-border/60 p-3">
              <div className="space-y-3">
                {resultado.familias.map((f) => (
                  <div key={f.base} className="rounded-xl border border-border/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" /> Titular
                      </Badge>
                      <span className="font-semibold">{f.titular.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        Carteirinha: {f.titular.carteirinha}
                      </span>
                      {f.titular.cpf && (
                        <span className="text-xs text-muted-foreground">
                          CPF: {formatCPF(f.titular.cpf)}
                        </span>
                      )}
                      {f.titular.contrato && (
                        <span className="text-xs text-muted-foreground">
                          Contrato: {f.titular.contrato}
                        </span>
                      )}
                      <Badge className="ml-auto bg-primary/10 text-primary">
                        {f.dependentes.length} dependente{f.dependentes.length > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1 border-l-2 border-border/60 pl-3">
                      {f.dependentes.map((d) => (
                        <div key={d.carteirinha} className="flex flex-wrap items-center gap-2 text-sm">
                          <span>{d.nome}</span>
                          <span className="text-xs text-muted-foreground">{d.carteirinha}</span>
                          {d.data_nascimento && (
                            <span className="text-xs text-muted-foreground">
                              Nasc. {formatDataBR(d.data_nascimento)}
                              {d.idade !== null ? ` · ${d.idade} anos` : ""}
                            </span>
                          )}
                          {d.data_adesao && (
                            <span className="text-xs text-muted-foreground">
                              Adesão {formatDataBR(d.data_adesao)}
                            </span>
                          )}
                          {d.parentesco && (
                            <span className="text-xs text-muted-foreground">{d.parentesco}</span>
                          )}
                          {d.situacao && (
                            <span className="text-xs text-muted-foreground">{d.situacao}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {resultado.inconsistencias.length > 0 && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <AlertTriangle className="h-4 w-4" /> Registros com inconsistência (não importados)
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {resultado.inconsistencias.map((i, idx) => (
                        <li key={`${i.carteirinha}-${idx}`}>
                          Linha {i.linha} · {i.nome} · {i.carteirinha} — {i.motivo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {resultado.titularesSemDependentes.length > 0 && (
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-sm font-semibold">
                      Titulares ignorados por não possuir dependentes (
                      {resultado.titularesSemDependentes.length})
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {resultado.titularesSemDependentes.map((t) => (
                        <li key={t.carteirinha}>
                          {t.nome} · {t.carteirinha}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar importação
          </Button>
          <Button
            onClick={confirmar}
            disabled={!resultado || resultado.familias.length === 0 || importar.isPending}
          >
            {importar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
