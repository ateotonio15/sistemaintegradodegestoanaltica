export type ModalidadeReajuste = "enfermaria" | "apartamento";

export type FaixaReajusteSalva = {
  reajuste_id: string;
  modalidade: string;
  idade_inicial: number;
  idade_final: number;
  valor_atual_centavos: number | null;
  valor_reajustado_centavos: number | null;
  valor_retroativo_centavos: number | null;
  valor_final_centavos: number | null;
  percentual: number | null;
};

// Apenas apresentação: não recalcula nem modifica valores armazenados.
export function valoresModalidadeReajuste(
  reajuste: Record<string, unknown>,
  modalidade: ModalidadeReajuste,
  faixas: FaixaReajusteSalva[],
) {
  const lista = faixas.filter((f) => f.modalidade === modalidade)
    .sort((a, b) => a.idade_inicial - b.idade_inicial || a.idade_final - b.idade_final);
  const porFaixa = reajuste[`usa_faixa_etaria_${modalidade}`] === true || lista.length > 0;
  const primeira = porFaixa ? lista[0] : undefined;
  const numero = (valor: unknown): number | null => valor == null ? null : Number(valor);
  return {
    porFaixa,
    primeira,
    faixas: lista,
    antigo: porFaixa ? primeira?.valor_atual_centavos ?? null : numero(reajuste[`valor_antigo_${modalidade}_centavos`]),
    reajustado: porFaixa ? primeira?.valor_reajustado_centavos ?? null : numero(reajuste[`valor_reajustado_${modalidade}_centavos`]),
    retro: porFaixa ? primeira?.valor_retroativo_centavos ?? null : numero(reajuste[`valor_retroativo_${modalidade}_centavos`]),
    final: porFaixa ? primeira?.valor_final_centavos ?? null : numero(reajuste[`valor_final_${modalidade}_centavos`]),
    pct: primeira?.percentual ?? numero(reajuste.percentual) ?? 0,
  };
}