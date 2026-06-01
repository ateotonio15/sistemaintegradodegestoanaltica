import { z } from "zod";

export type FormaPagamento = "DDA" | "Depósito";

export interface EmpresaFinanceiroConfig {
  data_emissao_fatura: number | null;
  data_vencimento_fatura: number | null;
  pagamento_via_deposito: boolean;
  tipo_financeiro: string | null;
  exige_po_pc: boolean;
  email_financeiro_cliente: string | null;
  observacao_padrao_financeiro: string | null;
  envio_boleto_com_nota: boolean;
  tem_coparticipacao: boolean;
  config_financeira_confirmada: boolean;
  periodo_especifico_cobranca: boolean;
  periodo_cobranca_inicio: string | null;
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
  if (empresa.data_vencimento_fatura == null) faltantes.push("Data vencimento");
  if (!empresa.config_financeira_confirmada) {
    // Forma de pagamento e Exige PO/PC têm default no banco — exigimos confirmação explícita uma vez.
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
  tipo_financeiro: z
    .string()
    .nullable()
    .optional(),
  email_financeiro_cliente: z
    .string()
    .trim()
    .max(255)
    .email("E-mail inválido")
    .or(z.literal(""))
    .nullable()
    .optional(),
  observacao_padrao_financeiro: z.string().trim().max(2000).nullable().optional(),
  envio_boleto_com_nota: z.boolean(),
  tem_coparticipacao: z.boolean(),
  periodo_especifico_cobranca: z.boolean(),
  periodo_cobranca_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .nullable()
    .optional(),
}).superRefine((v, ctx) => {
  if (v.periodo_especifico_cobranca && !v.periodo_cobranca_inicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["periodo_cobranca_inicio"],
      message: "Informe a data inicial do período",
    });
  }
});

export type ConfigFinanceiraFormValues = z.infer<typeof configFinanceiraSchema>;
