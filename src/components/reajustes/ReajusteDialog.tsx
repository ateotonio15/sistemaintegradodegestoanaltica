import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  calcularValorReajustadoCentavos, reaisToCentavos, centavosToReais, formatCentavosBRL,
  getMesReajuste, nomeMes, calcularMesesRetroativos, calcularRetroativoCentavos, calcularValorFinalCentavos,
} from "@/lib/reajuste-utils";
import { BedDouble, Building2 } from "lucide-react";

interface Empresa { id: string; nome: string; codigo_contrato: string | null; data_implantacao?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: Empresa[];
  editing?: any | null;
  defaultEmpresaId?: string;
}

export function ReajusteDialog({ open, onOpenChange, empresas, editing, defaultEmpresaId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const anoAtual = new Date().getFullYear();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [ano, setAno] = useState<string>(String(anoAtual));
  const [valorEnf, setValorEnf] = useState<string>("");
  const [valorApt, setValorApt] = useState<string>("");
  const [percentual, setPercentual] = useState<string>("");
  const [dataAplicacao, setDataAplicacao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpresaId(editing.empresa_id);
      setAno(String(editing.ano));
      const enf = editing.valor_antigo_enfermaria_centavos || 0;
      const apt = editing.valor_antigo_apartamento_centavos || 0;
      // Fallback: se não tem Enf/Apt mas tem valor antigo legado, joga em enfermaria
      if (enf === 0 && apt === 0 && (editing.valor_antigo_centavos || 0) > 0) {
        setValorEnf(centavosToReais(editing.valor_antigo_centavos).toFixed(2).replace(".", ","));
        setValorApt("");
      } else {
        setValorEnf(enf > 0 ? centavosToReais(enf).toFixed(2).replace(".", ",") : "");
        setValorApt(apt > 0 ? centavosToReais(apt).toFixed(2).replace(".", ",") : "");
      }
      setPercentual(editing.percentual > 0 ? String(editing.percentual).replace(".", ",") : "");
      setDataAplicacao(editing.data_aplicacao || new Date().toISOString().slice(0, 10));
      setObservacao(editing.observacao || "");
    } else {
      setEmpresaId(defaultEmpresaId || "");
      setAno(String(anoAtual));
      setValorEnf("");
      setValorApt("");
      setPercentual("");
      setDataAplicacao(new Date().toISOString().slice(0, 10));
      setObservacao("");
    }
  }, [open, editing, defaultEmpresaId, anoAtual]);

  const enfAntigoCent = useMemo(() => reaisToCentavos(valorEnf), [valorEnf]);
  const aptAntigoCent = useMemo(() => reaisToCentavos(valorApt), [valorApt]);
  const pctNum = useMemo(() => {
    const n = parseFloat(String(percentual).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [percentual]);

  const empresaSel = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  const mesReajuste = useMemo(() => getMesReajuste(empresaSel?.data_implantacao || null), [empresaSel]);
  const mesesRetro = useMemo(() => calcularMesesRetroativos(mesReajuste, dataAplicacao), [mesReajuste, dataAplicacao]);

  const enfReaj = useMemo(() => calcularValorReajustadoCentavos(enfAntigoCent, pctNum), [enfAntigoCent, pctNum]);
  const aptReaj = useMemo(() => calcularValorReajustadoCentavos(aptAntigoCent, pctNum), [aptAntigoCent, pctNum]);
  const enfRetro = useMemo(() => calcularRetroativoCentavos(enfAntigoCent, enfReaj, mesesRetro), [enfAntigoCent, enfReaj, mesesRetro]);
  const aptRetro = useMemo(() => calcularRetroativoCentavos(aptAntigoCent, aptReaj, mesesRetro), [aptAntigoCent, aptReaj, mesesRetro]);
  const enfFinal = useMemo(() => calcularValorFinalCentavos(enfReaj, enfRetro), [enfReaj, enfRetro]);
  const aptFinal = useMemo(() => calcularValorFinalCentavos(aptReaj, aptRetro), [aptReaj, aptRetro]);

  const totalAntigo = enfAntigoCent + aptAntigoCent;
  const totalReaj = enfReaj + aptReaj;
  const totalFinal = enfFinal + aptFinal;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione um contrato");
      if (!ano) throw new Error("Informe o ano");
      if (totalAntigo <= 0) throw new Error("Informe ao menos um valor (Enfermaria ou Apartamento)");
      if (!dataAplicacao) throw new Error("Informe a data de aplicação");

      let usuario_nome: string | null = null;
      if (user?.id) {
        const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
        usuario_nome = data?.display_name || null;
      }

      const basePayload: any = {
        empresa_id: empresaId,
        ano: parseInt(ano, 10),
        // Campos novos por categoria
        valor_antigo_enfermaria_centavos: enfAntigoCent || null,
        valor_antigo_apartamento_centavos: aptAntigoCent || null,
        // Campos legados (somatório, retrocompat)
        valor_antigo_centavos: totalAntigo,
        percentual: pctNum,
        data_aplicacao: dataAplicacao,
        observacao: observacao || null,
        status: "Reajustado",
        usuario_id: user?.id || null,
        usuario_nome,
      };

      if (editing) {
        const updatePayload: any = { ...basePayload };
        if ((editing as any).status_reajuste === "solicitado" && totalAntigo > 0 && pctNum > 0) {
          updatePayload.status_reajuste = "pendente_confirmacao";
        }
        const { error } = await supabase.from("reajustes_anuais").update(updatePayload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reajustes_anuais").insert({
          ...basePayload,
          status_reajuste: "pendente_confirmacao",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editing ? "Reajuste atualizado" : "Reajuste criado",
        description: editing ? undefined : "Cadastro foi notificado para confirmar.",
      });
      qc.invalidateQueries({ queryKey: ["reajustes-anuais"] });
      qc.invalidateQueries({ queryKey: ["reajustes-pendentes-count"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.message?.includes("duplicate") ? "Já existe um reajuste para este contrato neste ano" : (e?.message || "Erro ao salvar");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Reajuste" : "Novo Reajuste"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Contrato</Label>
            <Select value={empresaId} onValueChange={setEmpresaId} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}{e.codigo_contrato ? ` — ${e.codigo_contrato}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Ano do Reajuste</Label>
              <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} disabled={!!editing} />
            </div>
            <div className="grid gap-2">
              <Label>Data de Aplicação</Label>
              <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Percentual único (%)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Mês oficial de reajuste</div>
              <div className="font-medium">{mesReajuste ? `${nomeMes(mesReajuste)} (mês ${String(mesReajuste).padStart(2, "0")})` : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Meses retroativos</div>
              <div className="font-medium">{mesesRetro}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {/* Card Enfermaria */}
            <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Enfermaria</Badge>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Valor Atual (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={valorEnf} onChange={(e) => setValorEnf(e.target.value)} />
              </div>
              <div className="space-y-1.5 pt-2 border-t border-blue-500/20">
                <Row label="Reajustado" value={formatCentavosBRL(enfReaj)} />
                <Row label={`Retroativo${mesesRetro > 0 ? ` (${mesesRetro}m)` : ""}`} value={formatCentavosBRL(enfRetro)} />
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-blue-500/20">
                  <span className="text-xs text-muted-foreground">Valor Final</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCentavosBRL(enfFinal)}</span>
                </div>
              </div>
            </div>

            {/* Card Apartamento */}
            <div className="rounded-xl border-2 border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <Badge variant="outline" className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">Apartamento</Badge>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Valor Atual (R$)</Label>
                <Input inputMode="decimal" placeholder="0,00" value={valorApt} onChange={(e) => setValorApt(e.target.value)} />
              </div>
              <div className="space-y-1.5 pt-2 border-t border-purple-500/20">
                <Row label="Reajustado" value={formatCentavosBRL(aptReaj)} />
                <Row label={`Retroativo${mesesRetro > 0 ? ` (${mesesRetro}m)` : ""}`} value={formatCentavosBRL(aptRetro)} />
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-purple-500/20">
                  <span className="text-xs text-muted-foreground">Valor Final</span>
                  <span className="text-lg font-bold text-purple-700 dark:text-purple-400">{formatCentavosBRL(aptFinal)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-primary/5 p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Total Final (Enfermaria + Apartamento)</div>
              <div className="text-xs text-muted-foreground mt-0.5">Atual: {formatCentavosBRL(totalAntigo)} → Reajustado: {formatCentavosBRL(totalReaj)}</div>
            </div>
            <div className="text-2xl font-bold text-primary">{formatCentavosBRL(totalFinal)}</div>
          </div>

          <div className="grid gap-2">
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
