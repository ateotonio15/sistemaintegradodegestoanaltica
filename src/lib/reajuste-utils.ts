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
  const anoAplic = parseInt(m[1], 10);
  const mesAplic = parseInt(m[2], 10);
  // Regra: se a aplicação cai no mesmo mês do reajuste oficial,
  // cobra-se o retroativo do mês de reajuste até hoje (mês atual).
  if (mesAplic === mesReajuste) {
    const hoje = new Date();
    const mesHoje = hoje.getMonth() + 1;
    const anoHoje = hoje.getFullYear();
    const diffHoje = (anoHoje - anoAplic) * 12 + (mesHoje - mesReajuste);
    return diffHoje > 0 ? diffHoje : 0;
  }
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

// === Faixas etárias do reajuste (10 faixas fixas) ===
export const FAIXAS_ETARIAS: Array<{ idade_inicial: number; idade_final: number }> = [
  { idade_inicial: 0, idade_final: 18 },
  { idade_inicial: 19, idade_final: 23 },
  { idade_inicial: 24, idade_final: 28 },
  { idade_inicial: 29, idade_final: 33 },
  { idade_inicial: 34, idade_final: 38 },
  { idade_inicial: 39, idade_final: 43 },
  { idade_inicial: 44, idade_final: 48 },
  { idade_inicial: 49, idade_final: 53 },
  { idade_inicial: 54, idade_final: 58 },
  { idade_inicial: 59, idade_final: 999 },
];

export function labelFaixa(ini: number, fim: number): string {
  return fim >= 999 ? `${ini}+ anos` : `${ini} - ${fim} anos`;
}

export type FaixaEtariaItem = {
  idade_inicial: number;
  idade_final: number;
  valor_atual_centavos: number;
  percentual: number;
  valor_reajustado_centavos: number;
  valor_retroativo_centavos: number;
  valor_final_centavos: number;
};

export function criarFaixasIniciais(): FaixaEtariaItem[] {
  return FAIXAS_ETARIAS.map((f) => ({
    idade_inicial: f.idade_inicial,
    idade_final: f.idade_final,
    valor_atual_centavos: 0,
    percentual: 0,
    valor_reajustado_centavos: 0,
    valor_retroativo_centavos: 0,
    valor_final_centavos: 0,
  }));
}

export function somarFaixas(faixas: FaixaEtariaItem[]): {
  valor_atual_centavos: number;
  valor_reajustado_centavos: number;
  valor_retroativo_centavos: number;
  valor_final_centavos: number;
} {
  return faixas.reduce(
    (acc, f) => ({
      valor_atual_centavos: acc.valor_atual_centavos + (f.valor_atual_centavos || 0),
      valor_reajustado_centavos: acc.valor_reajustado_centavos + (f.valor_reajustado_centavos || 0),
      valor_retroativo_centavos: acc.valor_retroativo_centavos + (f.valor_retroativo_centavos || 0),
      valor_final_centavos: acc.valor_final_centavos + (f.valor_final_centavos || 0),
    }),
    { valor_atual_centavos: 0, valor_reajustado_centavos: 0, valor_retroativo_centavos: 0, valor_final_centavos: 0 },
  );
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
  | "solicitado"
  | "pendente_confirmacao"
  | "aguardando_aprovacao"
  | "aprovado"
  | "rejeitado"
  | "liberado_financeiro"
  | "reajustado"
  | "liberado"
  | "retroativo_aplicado";

export function labelStatusReajusteFluxo(s: StatusReajusteFluxo | string | null | undefined): string {
  if (s === "reajustado") return "Reajustado";
  if (s === "liberado") return "Liberado";
  if (s === "liberado_financeiro") return "Liberado p/ Financeiro";
  if (s === "retroativo_aplicado") return "Retroativo Aplicado";
  if (s === "solicitado") return "Solicitado";
  if (s === "pendente_confirmacao") return "Aguardando Diretora";
  if (s === "aguardando_aprovacao") return "Aguardando Cadastro";
  if (s === "aprovado") return "Aprovado";
  if (s === "rejeitado") return "Rejeitado";
  return "Pendente";
}

export function corStatusReajusteFluxo(s: StatusReajusteFluxo | string | null | undefined): string {
  if (s === "reajustado" || s === "aprovado") return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
  if (s === "liberado" || s === "liberado_financeiro") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  if (s === "retroativo_aplicado") return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
  if (s === "rejeitado") return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
  if (s === "aguardando_aprovacao" || s === "pendente_confirmacao" || s === "solicitado") {
    return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
  }
  return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
}

