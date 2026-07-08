import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";

type EmpresaData = {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  data_corte: number | null;
  responsavel_contrato: string | null;
  status_empresa: string | null;
  data_implantacao?: string | null;
  tipo_contrato?: string | null;
};

type MovimentacaoRow = {
  id: string;
  mes_referencia: string;
  periodo: string;
  tipo_movimentacao: string | null;
  responsavel_movimentacao: string | null;
  empresa_id: string | null;
  empresas?: EmpresaData | null;
};

type Divergencia = {
  campo: string;
  esperado: string;
  atual: string;
};

type LinhaVerificacao = {
  mov: MovimentacaoRow;
  divergencias: Divergencia[];
};

function calcularEsperado(empresa: EmpresaData) {
  const tipo = empresa.tipo_movimentacao ?? "Fechada";
  let periodo: string | null = null;
  if (empresa.tipo_contrato === "ADMINISTRADORA" && empresa.data_corte) {
    periodo = periodoDaDataCorte(empresa.data_corte);
  } else if (tipo === "Fechada" && empresa.periodo_movimentacao) {
    periodo = empresa.periodo_movimentacao;
  } else if (tipo === "Diária" && empresa.data_corte) {
    periodo = periodoDaDataCorte(empresa.data_corte);
  }
  return { tipo, periodo };
}

interface Props {
  movimentacoes: MovimentacaoRow[];
  triggerLabel?: string;
}

export function VerificacaoDadosDialog({ movimentacoes, triggerLabel = "Verificar" }: Props) {
  const [open, setOpen] = useState(false);

  const resultado = useMemo(() => {
    const linhas: LinhaVerificacao[] = [];
    const semEmpresa: MovimentacaoRow[] = [];

    for (const mov of movimentacoes) {
      const emp = mov.empresas;
      if (!emp) {
        semEmpresa.push(mov);
        continue;
      }
      const divs: Divergencia[] = [];

      // Vigência / status
      if (emp.status_empresa && emp.status_empresa !== "Ativa") {
        divs.push({
          campo: "Vigência",
          esperado: "Ativa",
          atual: emp.status_empresa,
        });
      }

      const esperado = calcularEsperado(emp);

      // Tipo movimentação
      if (esperado.tipo && mov.tipo_movimentacao && esperado.tipo !== mov.tipo_movimentacao) {
        divs.push({
          campo: "Tipo de movimentação",
          esperado: esperado.tipo,
          atual: mov.tipo_movimentacao,
        });
      }

      // Período
      if (esperado.periodo && esperado.periodo !== mov.periodo) {
        divs.push({
          campo: "Período",
          esperado: esperado.periodo,
          atual: mov.periodo,
        });
      }

      // Responsável
      const respEmp = (emp.responsavel_contrato ?? "").trim();
      const respMov = (mov.responsavel_movimentacao ?? "").trim();
      if (respEmp && respMov && respEmp.toLowerCase() !== respMov.toLowerCase()) {
        divs.push({
          campo: "Responsável",
          esperado: respEmp,
          atual: respMov,
        });
      } else if (respEmp && !respMov) {
        divs.push({
          campo: "Responsável",
          esperado: respEmp,
          atual: "— (vazio)",
        });
      }

      if (divs.length) linhas.push({ mov, divergencias: divs });
    }

    return { linhas, semEmpresa, total: movimentacoes.length };
  }, [movimentacoes]);

  const totalDiv = resultado.linhas.length + resultado.semEmpresa.length;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="rounded-lg"
        title="Verificar dados das empresas nas movimentações"
      >
        <ShieldCheck className="mr-2 h-4 w-4" />
        {triggerLabel}
        {totalDiv > 0 && (
          <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
            {totalDiv}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verificação de dados das empresas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Movimentações analisadas</div>
                <div className="text-2xl font-bold">{resultado.total}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Com divergência</div>
                <div className="text-2xl font-bold text-amber-600">{resultado.linhas.length}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Sem empresa vinculada</div>
                <div className="text-2xl font-bold text-rose-600">{resultado.semEmpresa.length}</div>
              </div>
            </div>

            <ScrollArea className="max-h-[55vh] pr-2">
              {totalDiv === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <div className="font-medium">Tudo certo</div>
                  <div className="text-sm text-muted-foreground">
                    Nenhuma divergência entre as movimentações e o cadastro das empresas.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {resultado.linhas.map(({ mov, divergencias }) => (
                    <div key={mov.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="font-medium">
                            {mov.empresas?.nome}
                            {mov.empresas?.codigo_contrato && (
                              <span className="text-muted-foreground font-normal">
                                {" · "}Contrato {mov.empresas.codigo_contrato}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {mov.mes_referencia} · Período {mov.periodo}
                          </div>
                        </div>
                        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {divergencias.length} divergência{divergencias.length > 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        {divergencias.map((d, i) => (
                          <div key={i} className="rounded border bg-muted/40 p-2">
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {d.campo}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Cadastro:</span>{" "}
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">{d.esperado}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Movimentação:</span>{" "}
                              <span className="font-medium text-rose-600">{d.atual}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {resultado.semEmpresa.length > 0 && (
                    <div className="rounded-lg border border-rose-500/40 p-3">
                      <div className="font-medium text-rose-600 mb-1">
                        {resultado.semEmpresa.length} movimentação(ões) sem empresa vinculada
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Estas movimentações apontam para um cadastro que não existe mais. Reatribua ou remova.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
