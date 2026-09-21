// Relatórios do módulo Dependentes UEA (apresentação apenas: usa os cálculos já existentes).
import * as XLSX from "xlsx";
import { formatCPF, formatDataBR, type TitularCalculado } from "@/lib/dependentes-uea";

function salvar(rows: Record<string, unknown>[], aba: string, arquivo: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba);
  XLSX.writeFile(wb, arquivo);
}

function hojeArquivo(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Relatório de titulares com margem, total dos dependentes e situação. */
export function exportarRelatorioTitularesUea(titulares: TitularCalculado[]) {
  const rows = titulares.map((t) => ({
    Titular: t.nome_completo,
    CPF: formatCPF(t.cpf),
    Matrícula: t.matricula ?? "",
    Contrato: t.contrato ?? "",
    Plano: t.plano ?? "",
    "Margem do titular": Number(t.valor_margem || 0),
    "Dependentes ativos": t.quantidade_dependentes_ativos,
    "Dependentes desligados": t.quantidade_dependentes_desligados,
    "Valor total dos dependentes": t.valor_total_dependentes_ativos,
    "Margem restante": t.margem_restante,
    "Status da margem": t.status_exibicao,
    Cobrança:
      t.cobranca_status === "validado"
        ? "Validado"
        : t.cobranca_status === "revalidar"
          ? "Revalidar"
          : t.cobranca_status === "pendente"
            ? "Validar cobrança"
            : "Não aplicável",
    "Próxima mudança de faixa": t.proxima_mudanca_faixa
      ? `${formatDataBR(t.proxima_mudanca_faixa.data)} • ${t.proxima_mudanca_faixa.label}`
      : "",
  }));
  salvar(rows, "Titulares", `titulares-uea-${hojeArquivo()}.xlsx`);
}

/** Relatório de dependentes e suas mensalidades, com o nome do titular. */
export function exportarRelatorioDependentesUea(titulares: TitularCalculado[]) {
  const rows = titulares.flatMap((t) =>
    t.dependentes_calculados.map((d) => ({
      Titular: t.nome_completo,
      "CPF do titular": formatCPF(t.cpf),
      "Matrícula do titular": t.matricula ?? "",
      Dependente: d.nome_completo,
      Parentesco: d.parentesco ?? "",
      CPF: formatCPF(d.cpf),
      Carteirinha: d.carteirinha ?? "",
      "Data de nascimento": formatDataBR(d.data_nascimento),
      Idade: d.idade_atual ?? "",
      "Data de adesão": formatDataBR(d.data_adesao),
      Plano: d.plano ?? "",
      "Faixa etária": d.faixa_atual_label,
      Mensalidade: Number(d.valor_mensal || 0),
      Situação: d.status_label,
    })),
  );
  salvar(rows, "Dependentes", `dependentes-uea-${hojeArquivo()}.xlsx`);
}
