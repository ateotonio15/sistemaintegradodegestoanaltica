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
  "TAXA ADESÃO",
] as const;
export type TipoFinanceiro = (typeof TIPOS_FINANCEIRO)[number];

export type StatusFinanceiro =
  | "Nota emitida"
  | "Faturado"
  | "Enviada"
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
 * 1. **Nota emitida** — existe ao menos um anexo PDF (prioridade máxima, ignora XLS)
 * 2. **Faturado** — existe ao menos um anexo XLS/planilha (e nenhum PDF)
 * 3. **Enviada** — possui `data_envio_nota` registrada
 * 4. **Fora do prazo** — `dentro_prazo === false` e sem anexo/nota
 * 5. **Aguardando nota** — operacional já enviou ao financeiro mas ainda sem anexo/nota
 * 6. **Pendente** — nada ainda
 */
export function calcularStatusFinanceiro(
  mov: Pick<FinanceiroMovimentacao, "data_envio_nota" | "dentro_prazo">,
  envioOperacionalFeito: boolean,
  anexos: Array<{ mime_type?: string | null; nome_arquivo?: string | null }> = [],
): StatusFinanceiro {
  const temPdf = anexos.some(isPdfAnexo);
  if (temPdf) return "Nota emitida";
  const temXls = anexos.some(isXlsAnexo);
  if (temXls) return "Faturado";
  if (mov.data_envio_nota) return "Enviada";
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
    case "Enviada":
      return "bg-success/80 text-success-foreground";
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

/** Lista os meses dos últimos 12 + próximos 1 para o filtro */
export function getMesesOptions(): string[] {
  const now = new Date();
  const meses: string[] = [];
  for (let i = -1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}
