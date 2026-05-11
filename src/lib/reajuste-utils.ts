// Utils para reajustes anuais

export function calcularValorReajustadoCentavos(valorAntigoCentavos: number, percentual: number): number {
  if (!valorAntigoCentavos || isNaN(percentual)) return valorAntigoCentavos || 0;
  return Math.round(valorAntigoCentavos + (valorAntigoCentavos * percentual) / 100);
}

export function reaisToCentavos(valor: string | number): number {
  if (typeof valor === "number") return Math.round(valor * 100);
  if (!valor) return 0;
  const clean = String(valor).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export function centavosToReais(centavos: number | null | undefined): number {
  if (!centavos) return 0;
  return centavos / 100;
}

export function formatCentavosBRL(centavos: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavosToReais(centavos));
}

// === Mês de reajuste oficial: derivado SEMPRE da data de implantação ===
export function getMesReajuste(dataImplantacao: string | null | undefined): number | null {
  if (!dataImplantacao) return null;
  const m = String(dataImplantacao).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const mes = parseInt(m[2], 10);
  return mes >= 1 && mes <= 12 ? mes : null;
}

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export function nomeMes(mes: number | null | undefined): string {
  if (!mes || mes < 1 || mes > 12) return "—";
  return MESES_PT[mes - 1];
}

// Diferença em meses dentro do mesmo ano (mínimo 0)
export function calcularMesesRetroativos(mesReajuste: number | null, dataAplicacao: string | null): number {
  if (!mesReajuste || !dataAplicacao) return 0;
  const m = String(dataAplicacao).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const mesAplic = parseInt(m[2], 10);
  const diff = mesAplic - mesReajuste;
  return diff > 0 ? diff : 0;
}

export function calcularRetroativoCentavos(
  valorAntigoCent: number,
  valorReajustadoCent: number,
  mesesAtrasados: number,
): number {
  if (!mesesAtrasados || mesesAtrasados <= 0) return 0;
  return Math.max(0, valorReajustadoCent - valorAntigoCent) * mesesAtrasados;
}

export function calcularValorFinalCentavos(valorReajustadoCent: number, retroativoCent: number): number {
  return (valorReajustadoCent || 0) + (retroativoCent || 0);
}

export type StatusReajuste = "Reajustado" | "Pendente" | "Atrasado";

export function getStatusReajusteEmpresa(
  empresa: { data_implantacao: string | null; status_empresa: string | null },
  reajustes: Array<{ ano: number }>,
  anoReferencia: number,
): StatusReajuste {
  const tem = reajustes.some((r) => r.ano === anoReferencia);
  if (tem) return "Reajustado";
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const mesReajuste = getMesReajuste(empresa.data_implantacao);
  if (mesReajuste && empresa.data_implantacao) {
    const anoImpl = parseInt(empresa.data_implantacao.slice(0, 4), 10);
    // Se já passou o mês oficial de reajuste no ano de referência → Atrasado
    if (anoImpl < anoReferencia && mesAtual > mesReajuste) return "Atrasado";
    if (anoImpl < anoReferencia && mesAtual >= mesReajuste) return "Pendente";
  }
  return "Pendente";
}

export function statusReajusteColor(status: StatusReajuste): string {
  switch (status) {
    case "Reajustado":
      return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    case "Atrasado":
      return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    default:
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
  }
}

// === Fluxo de aprovação / liberação ===
export type StatusReajusteFluxo =
  | "pendente_confirmacao"
  | "reajustado"
  | "liberado"
  | "retroativo_aplicado";

export function labelStatusReajusteFluxo(s: StatusReajusteFluxo | string | null | undefined): string {
  if (s === "reajustado") return "Reajustado";
  if (s === "liberado") return "Liberado";
  if (s === "retroativo_aplicado") return "Retroativo Aplicado";
  return "Enviado para Cadastro";
}

export function corStatusReajusteFluxo(s: StatusReajusteFluxo | string | null | undefined): string {
  if (s === "reajustado") return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
  if (s === "liberado") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  if (s === "retroativo_aplicado") return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
  return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
}
