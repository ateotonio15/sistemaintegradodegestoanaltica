import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BedDouble, Hotel } from "lucide-react";
import {
  calcularValorReajustadoCentavos, reaisToCentavos, centavosToReais, formatCentavosBRL,
  getMesReajuste, nomeMes, calcularMesesRetroativos, calcularRetroativoCentavos, calcularValorFinalCentavos,
} from "@/lib/reajuste-utils";

interface Empresa { id: string; nome: string; codigo_contrato: string | null; data_implantacao?: string | null }

interface ReajusteRow {
  id: string;
  empresa_id: string;
  ano: number;
  valor_antigo_centavos: number;
  percentual: number;
  data_aplicacao: string;
  observacao: string | null;
  valor_antigo_enfermaria_centavos?: number | null;
  valor_antigo_apartamento_centavos?: number | null;
  possui_enfermaria?: boolean | null;
  possui_apartamento?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresas: Empresa[];
  editing?: ReajusteRow | null;
  defaultEmpresaId?: string;
}

export function ReajusteDialog({ open, onOpenChange, empresas, editing, defaultEmpresaId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const anoAtual = new Date().getFullYear();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [ano, setAno] = useState<string>(String(anoAtual));
  const [possuiEnf, setPossuiEnf] = useState<boolean>(true);
  const [possuiApt, setPossuiApt] = useState<boolean>(true);
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
      const enfCent = editing.valor_antigo_enfermaria_centavos || 0;
      const aptCent = editing.valor_antigo_apartamento_centavos || 0;
      const hasEnfFlag = typeof editing.possui_enfermaria === "boolean" ? editing.possui_enfermaria : enfCent > 0 || (enfCent === 0 && aptCent === 0);
      const hasAptFlag = typeof editing.possui_apartamento === "boolean" ? editing.possui_apartamento : aptCent > 0;
      setPossuiEnf(hasEnfFlag);
      setPossuiApt(hasAptFlag);
      setValorEnf(enfCent > 0 ? centavosToReais(enfCent).toFixed(2).replace(".", ",") : "");
      setValorApt(aptCent > 0 ? centavosToReais(aptCent).toFixed(2).replace(".", ",") : "");
      setPercentual(editing.percentual > 0 ? String(editing.percentual).replace(".", ",") : "");
      setDataAplicacao(editing.data_aplicacao || new Date().toISOString().slice(0, 10));
      setObservacao(editing.observacao || "");
    } else {
      setEmpresaId(defaultEmpresaId || "");
      setAno(String(anoAtual));
      setPossuiEnf(true);
      setPossuiApt(true);
      setValorEnf("");
      setValorApt("");
      setPercentual("");
      setDataAplicacao(new Date().toISOString().slice(0, 10));
      setObservacao("");
    }
  }, [open, editing, defaultEmpresaId, anoAtual]);

  const enfCent = useMemo(() => (possuiEnf ? reaisToCentavos(valorEnf) : 0), [possuiEnf, valorEnf]);
  const aptCent = useMemo(() => (possuiApt ? reaisToCentavos(valorApt) : 0), [possuiApt, valorApt]);
  const valorAntigoCent = enfCent + aptCent;
  const pctNum = useMemo(() => {
    const n = parseFloat(String(percentual).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [percentual]);
  const valorReajustadoCent = useMemo(
    () => calcularValorReajustadoCentavos(valorAntigoCent, pctNum),
    [valorAntigoCent, pctNum],
  );

  const empresaSel = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  const mesReajuste = useMemo(() => getMesReajuste(empresaSel?.data_implantacao || null), [empresaSel]);
  const mesesRetro = useMemo(() => calcularMesesRetroativos(mesReajuste, dataAplicacao), [mesReajuste, dataAplicacao]);
  const retroativoCent = useMemo(
    () => calcularRetroativoCentavos(valorAntigoCent, valorReajustadoCent, mesesRetro),
    [valorAntigoCent, valorReajustadoCent, mesesRetro],
  );
  const valorFinalCent = useMemo(
    () => calcularValorFinalCentavos(valorReajustadoCent, retroativoCent),
    [valorReajustadoCent, retroativoCent],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione um contrato");
      if (!ano) throw new Error("Informe o ano");
      if (!possuiEnf && !possuiApt) throw new Error("Selecione ao menos uma modalidade (Enfermaria ou Apartamento)");
      if (possuiEnf && enfCent <= 0) throw new Error("Informe o Valor Atual da Enfermaria");
      if (possuiApt && aptCent <= 0) throw new Error("Informe o Valor Atual do Apartamento");
      if (!dataAplicacao) throw new Error("Informe a data de aplicação");

      let usuario_nome: string | null = null;
      if (user?.id) {
        const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
        usuario_nome = data?.display_name || null;
      }

      const basePayload: any = {
        empresa_id: empresaId,
        ano: parseInt(ano, 10),
        possui_enfermaria: possuiEnf,
        possui_apartamento: possuiApt,
        valor_antigo_enfermaria_centavos: possuiEnf ? enfCent : 0,
        valor_antigo_apartamento_centavos: possuiApt ? aptCent : 0,
        valor_antigo_centavos: valorAntigoCent,
        percentual: pctNum,
        valor_reajustado_centavos: valorReajustadoCent,
        data_aplicacao: dataAplicacao,
        observacao: observacao || null,
        status: "Reajustado",
        usuario_id: user?.id || null,
        usuario_nome,
      };

      if (editing) {
        const updatePayload: any = { ...basePayload };
        if ((editing as any).status_reajuste === "solicitado" && valorAntigoCent > 0 && pctNum > 0) {
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Ano do Reajuste</Label>
              <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} disabled={!!editing} />
            </div>
            <div className="grid gap-2">
              <Label>Data de Aplicação</Label>
              <Input type="date" value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
            </div>
          </div>

          <ModalidadesPicker
            possuiEnf={possuiEnf}
            possuiApt={possuiApt}
            onEnf={setPossuiEnf}
            onApt={setPossuiApt}
          />

          <div className="grid gap-3">
            {possuiEnf && (
              <div className="grid gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 transition-all animate-fade-in">
                <Label className="flex items-center gap-2 text-sm">
                  <BedDouble className="h-4 w-4 text-emerald-600" />
                  Valor Atual Enfermaria (R$) <span className="text-destructive">*</span>
                </Label>
                <Input inputMode="decimal" placeholder="0,00" value={valorEnf} onChange={(e) => setValorEnf(e.target.value)} />
              </div>
            )}
            {possuiApt && (
              <div className="grid gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 transition-all animate-fade-in">
                <Label className="flex items-center gap-2 text-sm">
                  <Hotel className="h-4 w-4 text-blue-600" />
                  Valor Atual Apartamento (R$) <span className="text-destructive">*</span>
                </Label>
                <Input inputMode="decimal" placeholder="0,00" value={valorApt} onChange={(e) => setValorApt(e.target.value)} />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Percentual (%) <span className="text-destructive">*</span></Label>
              <Input inputMode="decimal" placeholder="0,00" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Mês oficial de reajuste</div>
                <div className="font-medium">{mesReajuste ? `${nomeMes(mesReajuste)} (mês ${String(mesReajuste).padStart(2, "0")})` : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Meses retroativos</div>
                <div className="font-medium">{mesesRetro}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor reajustado (total)</div>
                <div className="font-semibold text-primary">{formatCentavosBRL(valorReajustadoCent)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor retroativo (total)</div>
                <div className="font-semibold">{formatCentavosBRL(retroativoCent)}</div>
              </div>
            </div>
            <div className="border-t pt-2">
              <div className="text-xs text-muted-foreground">Valor final cobrança (total)</div>
              <div className="text-2xl font-bold text-primary">{formatCentavosBRL(valorFinalCent)}</div>
            </div>
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

export function ModalidadesPicker({
  possuiEnf, possuiApt, onEnf, onApt,
}: { possuiEnf: boolean; possuiApt: boolean; onEnf: (v: boolean) => void; onApt: (v: boolean) => void }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm">Modalidades do Contrato <span className="text-destructive">*</span></Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label
          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
            possuiEnf ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:bg-muted/40"
          }`}
        >
          <Checkbox checked={possuiEnf} onCheckedChange={(v) => onEnf(!!v)} />
          <BedDouble className="h-4 w-4 text-emerald-600" />
          <div className="flex-1">
            <div className="text-sm font-medium">Enfermaria</div>
            <div className="text-[11px] text-muted-foreground">Modalidade Enfermaria</div>
          </div>
          {possuiEnf && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">Selecionada</Badge>}
        </label>
        <label
          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
            possuiApt ? "border-blue-500/50 bg-blue-500/5" : "border-border hover:bg-muted/40"
          }`}
        >
          <Checkbox checked={possuiApt} onCheckedChange={(v) => onApt(!!v)} />
          <Hotel className="h-4 w-4 text-blue-600" />
          <div className="flex-1">
            <div className="text-sm font-medium">Apartamento</div>
            <div className="text-[11px] text-muted-foreground">Modalidade Apartamento</div>
          </div>
          {possuiApt && <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30 text-[10px]">Selecionada</Badge>}
        </label>
      </div>
    </div>
  );
}
