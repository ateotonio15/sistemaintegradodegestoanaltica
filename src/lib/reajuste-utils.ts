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

export type StatusReajuste = "Reajustado" | "Pendente" | "Atrasado";

export function getStatusReajusteEmpresa(
  empresa: { data_implantacao: string | null; status_empresa: string | null },
  reajustes: Array<{ ano: number }>,
  anoReferencia: number,
): StatusReajuste {
  const tem = reajustes.some((r) => r.ano === anoReferencia);
  if (tem) return "Reajustado";
  // Se a empresa foi implantada antes do ano de referência, e ainda não foi reajustada -> Atrasado se já passou meio do ano
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  if (empresa.data_implantacao) {
    const anoImpl = parseInt(empresa.data_implantacao.slice(0, 4), 10);
    if (anoImpl < anoReferencia && mesAtual >= 4) return "Atrasado";
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
