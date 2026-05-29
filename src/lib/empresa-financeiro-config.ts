import { z } from "zod";
import { TIPOS_FINANCEIRO } from "@/lib/financeiro-utils";

export type FormaPagamento = "DDA" | "Depósito";

export interface EmpresaFinanceiroConfig {
  data_emissao_fatura: number | null;
  data_vencimento_fatura: number | null;
  pagamento_via_deposito: boolean;
  tipo_financeiro: string | null;
  exige_po_pc: boolean;
  email_financeiro_cliente: string | null;
  observacao_padrao_financeiro: string | null;
  regra_prorrogacao: string | null;
  exige_relatorio_antes_nota: boolean;
  config_financeira_confirmada: boolean;
}

export interface ValidacaoConfigResult {
  ok: boolean;
  faltantes: string[];
}

/**
 * Valida se todos os campos obrigatórios estão preenchidos e a configuração
 * foi confirmada explicitamente pelo usuário ao menos uma vez.
 */
export function validarConfigFinanceira(
  empresa: Partial<EmpresaFinanceiroConfig> | null | undefined,
): ValidacaoConfigResult {
  const faltantes: string[] = [];
  if (!empresa) {
    return { ok: false, faltantes: ["Configurações não encontradas"] };
  }
  if (empresa.data_emissao_fatura == null) faltantes.push("Data de emissão");
  if (empresa.data_vencimento_fatura == null) faltantes.push("Dia padrão de vencimento");
  if (!empresa.tipo_financeiro) faltantes.push("Tipo");
  if (!empresa.config_financeira_confirmada) {
    // Forma de pagamento e Exige PO/PC têm default no banco — exigimos confirmação explícita.
    if (!faltantes.includes("Forma de pagamento")) faltantes.push("Forma de pagamento");
    if (!faltantes.includes("Exige PO/PC?")) faltantes.push("Exige PO/PC?");
  }
  return { ok: faltantes.length === 0, faltantes };
}

export const configFinanceiraSchema = z.object({
  data_emissao_fatura: z
    .number({ invalid_type_error: "Informe um número entre 1 e 31" })
    .int()
    .min(1, "Mínimo 1")
    .max(31, "Máximo 31"),
  forma_pagamento: z.enum(["DDA", "Depósito"], {
    errorMap: () => ({ message: "Selecione a forma de pagamento" }),
  }),
  data_vencimento_fatura: z
    .number({ invalid_type_error: "Informe um número entre 1 e 31" })
    .int()
    .min(1, "Mínimo 1")
    .max(31, "Máximo 31"),
  exige_po_pc: z.boolean(),
  tipo_financeiro: z.enum(TIPOS_FINANCEIRO as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Selecione o tipo" }),
  }),
  email_financeiro_cliente: z.string().trim().max(255).email("E-mail inválido").or(z.literal("")).nullable().optional(),
  observacao_padrao_financeiro: z.string().trim().max(2000).nullable().optional(),
  regra_prorrogacao: z.string().trim().max(2000).nullable().optional(),
  exige_relatorio_antes_nota: z.boolean(),
});

export type ConfigFinanceiraFormValues = z.infer<typeof configFinanceiraSchema>;
