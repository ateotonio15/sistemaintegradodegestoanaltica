import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, FileWarning, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_FINANCEIRO } from "@/lib/financeiro-utils";
import {
  configFinanceiraSchema,
  type ConfigFinanceiraFormValues,
} from "@/lib/empresa-financeiro-config";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  empresaNome: string;
  /** Disparado após salvar com sucesso — usado para retomar o fluxo de iniciar faturamento. */
  onSaved?: () => void;
  /** Rótulo do botão de salvar (default: "Salvar e iniciar faturamento") */
  submitLabel?: string;
}

type Errors = Partial<Record<keyof ConfigFinanceiraFormValues, string>>;

export function ConfigFinanceiraEmpresaDialog({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  onSaved,
  submitLabel = "Salvar e iniciar faturamento",
}: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const { data: empresa, isLoading } = useQuery({
    queryKey: ["empresa-config-financeira", empresaId],
    enabled: open && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select(
          "id, nome, data_emissao_fatura, data_vencimento_fatura, pagamento_via_deposito, tipo_financeiro, exige_po_pc, email_financeiro_cliente, observacao_padrao_financeiro, regra_prorrogacao, exige_relatorio_antes_nota, config_financeira_confirmada",
        )
        .eq("id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<ConfigFinanceiraFormValues>({
    data_emissao_fatura: 0,
    forma_pagamento: "DDA",
    data_vencimento_fatura: 0,
    exige_po_pc: false,
    tipo_financeiro: TIPOS_FINANCEIRO[0],
    email_financeiro_cliente: "",
    observacao_padrao_financeiro: "",
    regra_prorrogacao: "",
    exige_relatorio_antes_nota: false,
  });

  useEffect(() => {
    if (!empresa) return;
    const e = empresa as any;
    setForm({
      data_emissao_fatura: e.data_emissao_fatura ?? 0,
      forma_pagamento: e.pagamento_via_deposito ? "Depósito" : "DDA",
      data_vencimento_fatura: e.data_vencimento_fatura ?? 0,
      exige_po_pc: !!e.exige_po_pc,
      tipo_financeiro: e.tipo_financeiro || TIPOS_FINANCEIRO[0],
      email_financeiro_cliente: e.email_financeiro_cliente ?? "",
      observacao_padrao_financeiro: e.observacao_padrao_financeiro ?? "",
      regra_prorrogacao: e.regra_prorrogacao ?? "",
      exige_relatorio_antes_nota: !!e.exige_relatorio_antes_nota,
    });
    setErrors({});
  }, [empresa]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!empresaId) return;
    const parsed = configFinanceiraSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ConfigFinanceiraFormValues;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const v = parsed.data;
      const { error } = await supabase
        .from("empresas")
        .update({
          data_emissao_fatura: v.data_emissao_fatura,
          data_vencimento_fatura: v.data_vencimento_fatura,
          pagamento_via_deposito: v.forma_pagamento === "Depósito",
          tipo_financeiro: v.tipo_financeiro,
          exige_po_pc: v.exige_po_pc,
          email_financeiro_cliente: v.email_financeiro_cliente || null,
          observacao_padrao_financeiro: v.observacao_padrao_financeiro || null,
          regra_prorrogacao: v.regra_prorrogacao || null,
          exige_relatorio_antes_nota: v.exige_relatorio_antes_nota,
          config_financeira_confirmada: true,
        } as any)
        .eq("id", empresaId);
      if (error) throw error;

      toast.success("Configurações financeiras salvas");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["empresa-config-financeira", empresaId] });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Configurações Financeiras da Empresa
          </DialogTitle>
          <DialogDescription>
            Antes de iniciar o faturamento, confirme os dados financeiros obrigatórios desta empresa.
            <span className="block mt-1 font-medium text-foreground">{empresaNome}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Bloco 1: obrigatórios */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Dados obrigatórios</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    Data de emissão <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.data_emissao_fatura || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, data_emissao_fatura: Number(e.target.value) || 0 }))
                    }
                    placeholder="Dia (1-31)"
                  />
                  {errors.data_emissao_fatura && (
                    <p className="text-xs text-destructive">{errors.data_emissao_fatura}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Forma de pagamento <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.forma_pagamento}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, forma_pagamento: v as "DDA" | "Depósito" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DDA">DDA</SelectItem>
                      <SelectItem value="Depósito">Depósito</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.forma_pagamento && (
                    <p className="text-xs text-destructive">{errors.forma_pagamento}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Dia padrão de vencimento <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.data_vencimento_fatura || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, data_vencimento_fatura: Number(e.target.value) || 0 }))
                    }
                    placeholder="Dia (1-31)"
                  />
                  {errors.data_vencimento_fatura && (
                    <p className="text-xs text-destructive">{errors.data_vencimento_fatura}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Exige PO/PC? <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.exige_po_pc ? "sim" : "nao"}
                    onValueChange={(v) => setForm((f) => ({ ...f, exige_po_pc: v === "sim" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    Tipo <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.tipo_financeiro}
                    onValueChange={(v) => setForm((f) => ({ ...f, tipo_financeiro: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_FINANCEIRO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tipo_financeiro && (
                    <p className="text-xs text-destructive">{errors.tipo_financeiro}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Bloco 2: complementares */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Dados complementares</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>E-mail financeiro do cliente</Label>
                  <Input
                    type="email"
                    value={form.email_financeiro_cliente ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email_financeiro_cliente: e.target.value }))
                    }
                    placeholder="financeiro@empresa.com"
                  />
                  {errors.email_financeiro_cliente && (
                    <p className="text-xs text-destructive">{errors.email_financeiro_cliente}</p>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observação padrão</Label>
                  <Textarea
                    value={form.observacao_padrao_financeiro ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, observacao_padrao_financeiro: e.target.value }))
                    }
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Regra de prorrogação</Label>
                  <Textarea
                    value={form.regra_prorrogacao ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, regra_prorrogacao: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Exige relatório antes da nota?</Label>
                  <Select
                    value={form.exige_relatorio_antes_nota ? "sim" : "nao"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, exige_relatorio_antes_nota: v === "sim" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Pagadores vinculados</Label>
                  <p className="text-xs text-muted-foreground">
                    Pagadores são gerenciados na tela do Financeiro pelo botão "Pagadores" da empresa.
                  </p>
                </div>
              </div>
            </section>

            {form.exige_po_pc && (
              <Alert variant="default" className="border-warning/50 text-warning-foreground bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle>Atenção: PO/PC obrigatório</AlertTitle>
                <AlertDescription>
                  Esta empresa exige PO/PC. O faturamento deve ser enviado para validação da
                  empresa antes da emissão da nota.
                </AlertDescription>
              </Alert>
            )}

            {form.exige_relatorio_antes_nota && (
              <Alert variant="default" className="border-info/50 bg-info/10">
                <FileWarning className="h-4 w-4 text-info" />
                <AlertTitle>Relatório prévio obrigatório</AlertTitle>
                <AlertDescription>
                  Esta empresa exige envio de relatório antes da emissão da nota.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
