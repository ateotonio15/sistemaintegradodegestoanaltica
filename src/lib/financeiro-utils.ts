import type { Tables } from "@/integrations/supabase/types";

export type FinanceiroMovimentacao = Tables<"financeiro_movimentacoes">;
export type Cobranca = Tables<"cobrancas">;
export type AnexoFinanceiro = Tables<"anexos_financeiro">;

export const PERIODOS_FIN = ["01-05", "05-10", "10-15", "15-20", "20-25", "25-30"] as const;

/** Tipos de cobrança usados exclusivamente no setor Financeiro */
export const TIPOS_FINANCEIRO = [
  "NÃO-PRORATA",
  "INCLUSÃO",
  "INCLUSÃO/EXCLUSÃO",
  "INCLUSÃO/EXCLUSÃO/COPAR",
  "TAXA ADESÃO",
] as const;
export type TipoFinanceiro = (typeof TIPOS_FINANCEIRO)[number];

export type StatusFinanceiro =
  | "Nota emitida"
  | "Faturado"
  | "Aguardando validação"
  | "Enviada"
  | "Em faturamento"
  | "Aguardando nota"
  | "Pendente"
  | "Fora do prazo";

/** Detecta se um anexo é PDF (por mime_type ou extensão do nome). */
export function isPdfAnexo(a: { mime_type?: string | null; nome_arquivo?: string | null }): boolean {
  const mime = (a.mime_type || "").toLowerCase();
  const nome = (a.nome_arquivo || "").toLowerCase();
  return mime.includes("pdf") || nome.endsWith(".pdf");
}

/** Detecta se um anexo é XLS/XLSX/CSV (planilha). */
export function isXlsAnexo(a: { mime_type?: string | null; nome_arquivo?: string | null }): boolean {
  const mime = (a.mime_type || "").toLowerCase();
  const nome = (a.nome_arquivo || "").toLowerCase();
  return (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    nome.endsWith(".xlsx") ||
    nome.endsWith(".xls") ||
    nome.endsWith(".csv")
  );
}

/**
 * Calcula o status financeiro de uma movimentação (NÃO persistido no banco).
 * Prioridade (do mais alto para o mais baixo):
 * 1. **Enviada** — `data_envio_nota` preenchida (estágio final do Financeiro)
 * 2. **Nota emitida** — existe ao menos um anexo PDF
 * 3. **Aguardando validação** — empresa exige PO/PC e há anexo XLS/planilha (e nenhum PDF)
 * 4. **Faturado** — existe ao menos um anexo XLS/planilha (e nenhum PDF)
 * 5. **Em faturamento** — usuário iniciou o faturamento (faturamento_iniciado_em)
 * 6. **Fora do prazo** — `dentro_prazo === false` e sem anexo/nota
 * 7. **Aguardando nota** — operacional já enviou ao financeiro mas ainda sem anexo/nota
 * 8. **Pendente** — nada ainda
 */
export function calcularStatusFinanceiro(
  mov: Pick<FinanceiroMovimentacao, "data_envio_nota" | "dentro_prazo"> & {
    faturamento_iniciado_em?: string | null;
  },
  envioOperacionalFeito: boolean,
  anexos: Array<{ mime_type?: string | null; nome_arquivo?: string | null }> = [],
  exigePoPc: boolean = false,
): StatusFinanceiro {
  if (mov.data_envio_nota) return "Enviada";
  const temPdf = anexos.some(isPdfAnexo);
  if (temPdf) return "Nota emitida";
  const temXls = anexos.some(isXlsAnexo);
  if (temXls) return exigePoPc ? "Aguardando validação" : "Faturado";
  if (mov.faturamento_iniciado_em) return "Em faturamento";
  if (mov.dentro_prazo === false) return "Fora do prazo";
  if (envioOperacionalFeito) return "Aguardando nota";
  return "Pendente";
}

export function statusFinanceiroColor(status: StatusFinanceiro): string {
  switch (status) {
    case "Nota emitida":
      return "bg-success text-success-foreground";
    case "Faturado":
      return "bg-info text-info-foreground";
    case "Aguardando validação":
      return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-300/60 dark:border-purple-400/30";
    case "Enviada":
      return "bg-success/80 text-success-foreground";
    case "Em faturamento":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300/60 dark:border-blue-400/30";
    case "Aguardando nota":
      return "bg-warning text-warning-foreground";
    case "Fora do prazo":
      return "bg-destructive text-destructive-foreground";
    case "Pendente":
    default:
      return "bg-muted text-muted-foreground";
  }
}


export function getCurrentMesReferencia(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Rótulo de exibição para o setor Financeiro (renomeia "Aguardando nota" → "Aguardando Emissão"). */
export function labelStatusFinanceiro(status: StatusFinanceiro): string {
  return status === "Aguardando nota" ? "Aguardando Emissão" : status;
}

export function formatMesReferencia(mes: string): string {
  const [year, month] = mes.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year}`;
}

export function buildStoragePath(
  empresaId: string,
  movimentacaoId: string,
  fileName: string,
): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const uuid = crypto.randomUUID();
  return `${empresaId}/${movimentacaoId}/${uuid}.${ext}`;
}

export const ACCEPTED_FILE_TYPES = ".pdf,.xlsx,.xls,.csv";
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─────────────────────────────────────────────────────────────
 * Controle de prazo do Financeiro (24h / 48h / regra dia 01)
 * ────────────────────────────────────────────────────────── */

export type PrazoCategoria = "Dentro do prazo" | "Fora do prazo" | "Em andamento" | "Sem base";

export interface CalcPrazoInput {
  aguardando_nota_em: string | null | undefined;
  data_envio_nota: string | null | undefined;
  dia_emissao: number | null | undefined;
}

export interface CalcPrazoResult {
  categoria: PrazoCategoria;
  inicio: Date | null;
  limite: Date | null;
  janelaHoras: 24 | 48 | null;
}

/**
 * Calcula prazo do Financeiro para uma movimentação:
 * - Início = aguardando_nota_em; se dia_emissao=1, início = 1º do mês seguinte (00:00 local).
 * - Janela: 48h se início.getDate() <= 10; 24h se >= 11.
 * - Compara com data_envio_nota (ou agora se ainda pendente).
 */
export function calcularPrazoFinanceiro(input: CalcPrazoInput): CalcPrazoResult {
  if (!input.aguardando_nota_em) {
    return { categoria: "Sem base", inicio: null, limite: null, janelaHoras: null };
  }

  const base = new Date(input.aguardando_nota_em);
  if (isNaN(base.getTime())) {
    return { categoria: "Sem base", inicio: null, limite: null, janelaHoras: null };
  }

  let inicio: Date;
  if (input.dia_emissao === 1) {
    // Primeiro dia do mês seguinte ao "aguardando", 00:00 local
    inicio = new Date(base.getFullYear(), base.getMonth() + 1, 1, 0, 0, 0, 0);
  } else {
    inicio = base;
  }

  const janelaHoras: 24 | 48 = inicio.getDate() <= 10 ? 48 : 24;
  const limite = new Date(inicio.getTime() + janelaHoras * 60 * 60 * 1000);

  // Data de envio (parse local YYYY-MM-DD → fim do dia para ser justo)
  let envio: Date | null = null;
  if (input.data_envio_nota) {
    const m = input.data_envio_nota.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      envio = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
    } else {
      const d = new Date(input.data_envio_nota);
      envio = isNaN(d.getTime()) ? null : d;
    }
  }

  const agora = new Date();

  if (envio) {
    return {
      categoria: envio.getTime() <= limite.getTime() ? "Dentro do prazo" : "Fora do prazo",
      inicio,
      limite,
      janelaHoras,
    };
  }

  // Sem envio ainda
  if (agora.getTime() > limite.getTime()) {
    return { categoria: "Fora do prazo", inicio, limite, janelaHoras };
  }
  return { categoria: "Em andamento", inicio, limite, janelaHoras };
}

/** Lista os meses dos últimos 12 + próximos 3 para o filtro */
export function getMesesOptions(): string[] {
  const now = new Date();
  const meses: string[] = [];
  for (let i = -3; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

/**
 * Calcula o dia de emissão padrão a partir do período (último dia + 2).
 * Aplica somente aos períodos 01-05, 05-10, 10-15 e 15-20.
 * Para 20-25 e 25-30 retorna null (mantém comportamento manual atual).
 */
export function calcularDiaEmissaoPadrao(periodo: string | null | undefined): number | null {
  if (!periodo) return null;
  const map: Record<string, number> = {
    "01-05": 7,
    "05-10": 12,
    "10-15": 17,
    "15-20": 22,
  };
  return map[periodo] ?? null;
}
