import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentavosBRL, labelFaixa, nomeMes } from "@/lib/reajuste-utils";
import { formatDateBR } from "@/lib/date-utils";
import { Wallet, BedDouble, Hotel, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

type Empresa = Tables<"empresas">;
type Reajuste = Tables<"reajustes_anuais">;
type ReajusteFaixa = Tables<"reajuste_faixas">;

interface Props {
  empresa: Empresa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ValoresFaixaEtariaDialog({ empresa, open, onOpenChange }: Props) {
  const empresaId = empresa?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-valores", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data: reajustes, error } = await supabase
        .from("reajustes_anuais")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const reajuste = (reajustes?.[0] ?? null) as Reajuste | null;

      let faixas: ReajusteFaixa[] = [];
      if (reajuste) {
        const { data: f, error: errF } = await supabase
          .from("reajuste_faixas")
          .select("*")
          .eq("reajuste_id", reajuste.id)
          .order("idade_inicial", { ascending: true });
        if (errF) throw errF;
        faixas = (f ?? []) as ReajusteFaixa[];
      }

      const { data: impl } = await supabase
        .from("implantacoes_contratos")
        .select("valor_enfermaria_centavos, valor_apartamento_centavos, faixas_etarias, modalidade, acomodacao, data_vigencia")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return { reajuste, faixas, implantacao: impl ?? null };
    },
  });

  const reajuste = data?.reajuste ?? null;
  const faixas = data?.faixas ?? [];
  const implantacao = data?.implantacao ?? null;

  const possuiEnf = reajuste
    ? (reajuste.possui_enfermaria ?? false)
    : (implantacao?.valor_enfermaria_centavos ?? 0) > 0;
  const possuiApt = reajuste
    ? (reajuste.possui_apartamento ?? false)
    : (implantacao?.valor_apartamento_centavos ?? 0) > 0;

  // Pivot faixas por (idade_inicial, idade_final)
  const faixasPivot = (() => {
    const map = new Map<
      string,
      { ini: number; fim: number; enf?: ReajusteFaixa; apt?: ReajusteFaixa }
    >();
    for (const f of faixas) {
      const key = `${f.idade_inicial}-${f.idade_final}`;
      const row = map.get(key) ?? {
        ini: f.idade_inicial,
        fim: f.idade_final,
      };
      if (f.modalidade === "enfermaria") row.enf = f;
      if (f.modalidade === "apartamento") row.apt = f;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => a.ini - b.ini);
  })();

  const faixasObservacao =
    !reajuste && implantacao?.faixas_etarias && typeof implantacao.faixas_etarias === "object" && !Array.isArray(implantacao.faixas_etarias)
      ? ((implantacao.faixas_etarias as { observacao?: string }).observacao ?? "")
      : "";

  const semDados = !reajuste && !implantacao;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl animate-fade-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Valores e Faixa Etária
          </DialogTitle>
          <DialogDescription>
            {empresa?.nome ?? "—"} {empresa?.codigo_contrato ? `· ${empresa.codigo_contrato}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : semDados ? (
          <EmptyState empresa={empresa} />
        ) : (
          <Tabs defaultValue="resumo" className="w-full animate-fade-in">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="enfermaria" disabled={!possuiEnf}>
                Enfermaria
              </TabsTrigger>
              <TabsTrigger value="apartamento" disabled={!possuiApt}>
                Apartamento
              </TabsTrigger>
              <TabsTrigger value="faixa">Faixa Etária</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="mt-4 animate-fade-in">
              <ResumoContrato
                empresa={empresa}
                reajuste={reajuste}
                possuiEnf={possuiEnf}
                possuiApt={possuiApt}
              />
              {!reajuste && (
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Contrato ainda não reajustado — exibindo valores originais da implantação.
                </p>
              )}
            </TabsContent>

            <TabsContent value="enfermaria" className="mt-4 animate-fade-in">
              {possuiEnf ? (
                <ValoresCard
                  titulo="Enfermaria"
                  icon={<BedDouble className="h-4 w-4" />}
                  atual={reajuste?.valor_antigo_enfermaria_centavos ?? implantacao?.valor_enfermaria_centavos ?? 0}
                  percentual={reajuste?.percentual ?? 0}
                  reajustado={reajuste?.valor_reajustado_enfermaria_centavos ?? 0}
                  retroativo={reajuste?.valor_retroativo_enfermaria_centavos ?? 0}
                  final={reajuste?.valor_final_enfermaria_centavos ?? implantacao?.valor_enfermaria_centavos ?? 0}
                  semReajuste={!reajuste}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Modalidade não contratada.</p>
              )}
            </TabsContent>

            <TabsContent value="apartamento" className="mt-4 animate-fade-in">
              {possuiApt ? (
                <ValoresCard
                  titulo="Apartamento"
                  icon={<Hotel className="h-4 w-4" />}
                  atual={reajuste?.valor_antigo_apartamento_centavos ?? implantacao?.valor_apartamento_centavos ?? 0}
                  percentual={reajuste?.percentual ?? 0}
                  reajustado={reajuste?.valor_reajustado_apartamento_centavos ?? 0}
                  retroativo={reajuste?.valor_retroativo_apartamento_centavos ?? 0}
                  final={reajuste?.valor_final_apartamento_centavos ?? implantacao?.valor_apartamento_centavos ?? 0}
                  semReajuste={!reajuste}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Modalidade não contratada.</p>
              )}
            </TabsContent>

            <TabsContent value="faixa" className="mt-4 animate-fade-in">
              {faixasPivot.length === 0 ? (
                <div className="text-sm text-muted-foreground p-6 text-center rounded-lg border border-dashed whitespace-pre-wrap">
                  {faixasObservacao
                    ? faixasObservacao
                    : !reajuste
                    ? "Contrato ainda não reajustado — nenhuma tabela de faixa etária registrada."
                    : "Reajuste por valor único — sem faixa etária."}
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-accent/30">
                        <TableHead className="font-semibold">Faixa</TableHead>
                        {possuiEnf && (
                          <TableHead className="font-semibold text-right">Enfermaria</TableHead>
                        )}
                        {possuiApt && (
                          <TableHead className="font-semibold text-right">Apartamento</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faixasPivot.map((row) => (
                        <TableRow key={`${row.ini}-${row.fim}`} className="hover:bg-accent/40 transition-colors">
                          <TableCell className="font-medium">{labelFaixa(row.ini, row.fim)}</TableCell>
                          {possuiEnf && (
                            <TableCell className="text-right tabular-nums">
                              {row.enf ? formatCentavosBRL(row.enf.valor_final_centavos) : "—"}
                            </TableCell>
                          )}
                          {possuiApt && (
                            <TableCell className="text-right tabular-nums">
                              {row.apt ? formatCentavosBRL(row.apt.valor_final_centavos) : "—"}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ empresa }: { empresa: Empresa | null }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="p-6 text-center rounded-lg border border-dashed text-muted-foreground">
        Esta empresa ainda não possui reajuste registrado.
      </div>
      {empresa && (
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label="Empresa" value={empresa.nome} />
          <InfoCard label="Código do Contrato" value={empresa.codigo_contrato || "—"} />
          <InfoCard label="Tipo de Contrato" value={empresa.tipo_contrato || "—"} />
          <InfoCard label="Data de Implantação" value={formatDateBR(empresa.data_implantacao) || "—"} />
        </div>
      )}
    </div>
  );
}

function ResumoContrato({
  empresa,
  reajuste,
  possuiEnf,
  possuiApt,
}: {
  empresa: Empresa | null;
  reajuste: Reajuste;
  possuiEnf: boolean;
  possuiApt: boolean;
}) {
  const modalidade =
    possuiEnf && possuiApt ? "Enfermaria + Apartamento" : possuiEnf ? "Enfermaria" : possuiApt ? "Apartamento" : "—";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoCard label="Empresa" value={empresa?.nome || "—"} />
      <InfoCard label="Código do Contrato" value={empresa?.codigo_contrato || "—"} />
      <InfoCard label="Tipo de Contrato" value={empresa?.tipo_contrato || "—"} />
      <InfoCard
        label="Modalidade"
        value={
          <span className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-primary" />
            {modalidade}
          </span>
        }
      />
      <InfoCard label="Ano do Reajuste" value={String(reajuste.ano)} />
      <InfoCard label="Mês do Reajuste" value={nomeMes(reajuste.mes_reajuste) || "—"} />
      <InfoCard label="Data de Aplicação" value={formatDateBR(reajuste.data_aplicacao) || "—"} />
      <InfoCard
        label="Percentual"
        value={
          <Badge variant="outline" className="rounded-md">
            {Number(reajuste.percentual ?? 0).toFixed(2)}%
          </Badge>
        }
      />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-accent/30 transition-colors hover:bg-accent/50">
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}

function ValoresCard({
  titulo,
  icon,
  atual,
  percentual,
  reajustado,
  retroativo,
  final,
}: {
  titulo: string;
  icon: React.ReactNode;
  atual: number;
  percentual: number;
  reajustado: number;
  retroativo: number;
  final: number;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden animate-scale-in">
      <div className="px-4 py-3 bg-accent/30 border-b border-border flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{titulo}</h3>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <ValorLinha label="Valor Atual" value={formatCentavosBRL(atual)} />
        <ValorLinha label="Percentual" value={`${Number(percentual).toFixed(2)}%`} />
        <ValorLinha label="Valor Reajustado" value={formatCentavosBRL(reajustado)} />
        <ValorLinha label="Retroativo" value={formatCentavosBRL(retroativo)} />
        <div className="sm:col-span-2">
          <ValorLinha label="Valor Final" value={formatCentavosBRL(final)} destaque />
        </div>
      </div>
    </div>
  );
}

function ValorLinha({
  label,
  value,
  destaque,
}: {
  label: string;
  value: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg flex items-center justify-between transition-colors",
        destaque ? "bg-primary/10 border border-primary/20" : "bg-accent/20 hover:bg-accent/40"
      )}
    >
      <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      <span className={cn("font-semibold tabular-nums", destaque && "text-primary")}>{value}</span>
    </div>
  );
}
