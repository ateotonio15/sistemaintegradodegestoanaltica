import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { fetchReajustesOperadora, modalidadePlano, type ReajusteContratoApi } from "@/lib/reajustesOperadoraApi";
import { formatCentavosBRL } from "@/lib/reajuste-utils";

interface EmpresaMin {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  tipo_contrato: string | null;
  valor_enfermaria_centavos: number | null;
  valor_apartamento_centavos: number | null;
  faixas_etarias: unknown;
}

interface ItemPreview {
  empresa: EmpresaMin;
  status: "ok" | "sem_valores" | "nao_encontrado";
  reajuste?: ReajusteContratoApi;
  porFaixa?: boolean;
  enfermaria?: { ini: number; fim: number; centavos: number }[];
  apartamento?: { ini: number; fim: number; centavos: number }[];
}

const normNum = (s: unknown) => String(s ?? "").replace(/\D/g, "").replace(/^0+/, "");

function extrairValores(c: ReajusteContratoApi) {
  const out = {
    porFaixa: false,
    enfermaria: [] as { ini: number; fim: number; centavos: number }[],
    apartamento: [] as { ini: number; fim: number; centavos: number }[],
  };
  for (const p of c.PLANOS ?? []) {
    const mod = modalidadePlano(p.NM_FANTASIA);
    if (!mod || out[mod].length) continue;
    out[mod] = (p.FAIXAS_ETARIAS ?? []).map((f) => ({
      ini: f.QT_IDADE_INICIAL,
      fim: f.QT_IDADE_FINAL,
      centavos: Math.round(Number(f.VL_PRECO_ATUAL || 0) * 100),
    }));
  }
  out.porFaixa = out.enfermaria.length > 1 || out.apartamento.length > 1;
  return out;
}

export function AtualizarValoresOperadoraDialog({
  open,
  onOpenChange,
  empresas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: EmpresaMin[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [itens, setItens] = useState<ItemPreview[] | null>(null);

  const elegiveis = empresas.filter(
    (e) => e.codigo_contrato && String(e.tipo_contrato ?? "").toUpperCase() !== "ADMINISTRADORA",
  );

  async function carregarPrevia() {
    setCarregando(true);
    try {
      const api = await fetchReajustesOperadora();
      // mais recente por contrato
      const porContrato = new Map<string, ReajusteContratoApi>();
      for (const c of api) {
        const k = normNum(c.NR_CONTRATO);
        if (!k) continue;
        const atual = porContrato.get(k);
        if (!atual || String(c.DT_REAJUSTE) > String(atual.DT_REAJUSTE)) porContrato.set(k, c);
      }
      const lista: ItemPreview[] = elegiveis.map((empresa) => {
        const c = porContrato.get(normNum(empresa.codigo_contrato));
        if (!c) return { empresa, status: "nao_encontrado" };
        const v = extrairValores(c);
        const temValor = v.enfermaria.some((f) => f.centavos > 0) || v.apartamento.some((f) => f.centavos > 0);
        if (!temValor) return { empresa, status: "sem_valores", reajuste: c };
        return { empresa, status: "ok", reajuste: c, ...v };
      });
      lista.sort((a, b) => {
        const ord = { ok: 0, sem_valores: 1, nao_encontrado: 2 } as const;
        return ord[a.status] - ord[b.status] || a.empresa.nome.localeCompare(b.empresa.nome);
      });
      setItens(lista);
    } catch (e: any) {
      toast({ title: "Erro ao consultar a operadora", description: e?.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  async function aplicar() {
    if (!itens) return;
    const ok = itens.filter((i) => i.status === "ok");
    setAplicando(true);
    let sucesso = 0;
    let falhas = 0;
    try {
      for (const item of ok) {
        // Só sobrescreve o que a operadora realmente retornou; preserva valores já salvos.
        const payload: Record<string, unknown> = {};
        const enf = item.enfermaria?.[0]?.centavos;
        const apt = item.apartamento?.[0]?.centavos;
        if (enf && enf > 0) payload.valor_enfermaria_centavos = enf;
        if (apt && apt > 0) payload.valor_apartamento_centavos = apt;
        if (item.porFaixa) {
          payload.contrato_faixa_etaria = true;
          payload.faixas_etarias = { enfermaria: item.enfermaria, apartamento: item.apartamento };
        }
        if (Object.keys(payload).length === 0) continue;
        const { error } = await supabase.from("empresas").update(payload as any).eq("id", item.empresa.id);
        if (error) falhas++;
        else sucesso++;
      }
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      toast({
        title: `Valores atualizados em ${sucesso} contrato(s)`,
        description: falhas ? `${falhas} contrato(s) falharam.` : undefined,
        variant: falhas ? "destructive" : "default",
      });
      if (!falhas) {
        setItens(null);
        onOpenChange(false);
      }
    } finally {
      setAplicando(false);
    }
  }

  const totais = itens
    ? {
        ok: itens.filter((i) => i.status === "ok").length,
        semValores: itens.filter((i) => i.status === "sem_valores").length,
        naoEncontrado: itens.filter((i) => i.status === "nao_encontrado").length,
      }
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setItens(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Atualizar valores de todos os contratos</DialogTitle>
          <DialogDescription>
            Busca na operadora o valor atual (Enfermaria/Apartamento ou faixas etárias) de todos os contratos
            cadastrados e atualiza o cadastro de cada empresa de uma vez.
          </DialogDescription>
        </DialogHeader>

        {!itens && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-muted-foreground text-center">
              {elegiveis.length} contrato(s) com código serão consultados. Nada é gravado antes da sua confirmação.
            </p>
            <Button onClick={carregarPrevia} disabled={carregando} className="rounded-lg">
              {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {carregando ? "Consultando operadora..." : "Buscar valores de todos os contratos"}
            </Button>
          </div>
        )}

        {itens && totais && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                <CheckCircle2 className="mr-1 h-3 w-3" />{totais.ok} com valores
              </Badge>
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                <AlertTriangle className="mr-1 h-3 w-3" />{totais.semValores} sem valores na API
              </Badge>
              <Badge className="bg-muted text-muted-foreground border-border">
                <XCircle className="mr-1 h-3 w-3" />{totais.naoEncontrado} não encontrados
              </Badge>
            </div>
            <div className="flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Reajuste</TableHead>
                    <TableHead className="text-right">Enfermaria</TableHead>
                    <TableHead className="text-right">Apartamento</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.empresa.id}>
                      <TableCell className="max-w-[260px] truncate" title={i.empresa.nome}>{i.empresa.nome}</TableCell>
                      <TableCell>{i.empresa.codigo_contrato}</TableCell>
                      <TableCell>
                        {i.reajuste ? `${i.reajuste.TX_REAJUSTE}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {i.status === "ok"
                          ? i.porFaixa
                            ? `${i.enfermaria?.length ?? 0} faixa(s)`
                            : i.enfermaria?.[0]
                              ? formatCentavosBRL(i.enfermaria[0].centavos)
                              : "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {i.status === "ok"
                          ? i.porFaixa
                            ? `${i.apartamento?.length ?? 0} faixa(s)`
                            : i.apartamento?.[0]
                              ? formatCentavosBRL(i.apartamento[0].centavos)
                              : "—"
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {i.status === "ok" && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Atualizar</Badge>}
                        {i.status === "sem_valores" && <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">Sem valores</Badge>}
                        {i.status === "nao_encontrado" && <Badge variant="outline" className="text-muted-foreground">Não encontrado</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setItens(null)} disabled={aplicando} className="rounded-lg">
                Voltar
              </Button>
              <Button onClick={aplicar} disabled={aplicando || totais.ok === 0} className="rounded-lg">
                {aplicando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {aplicando ? "Atualizando..." : `Atualizar ${totais.ok} contrato(s)`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
