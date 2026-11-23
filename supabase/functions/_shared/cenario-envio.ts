/**
 * Motor de Cenários de Envio (Movimentações).
 * Arquivo puro (sem Deno/Node): usado pela tela e pelo servidor, que recalcula a sugestão.
 * O texto de "Dentro do período" é o mesmo e-mail de conferência já usado pelo SIGA.
 */
export type CenarioEnvio = "dentro_periodo" | "fora_periodo" | "financeiro";

export const CENARIOS_ENVIO: Record<CenarioEnvio, { rotulo: string; modelo: string; destino: "Empresa" | "Financeiro" }> = {
  dentro_periodo: { rotulo: "Dentro do período", modelo: "Validação de vidas — período vigente", destino: "Empresa" },
  fora_periodo: { rotulo: "Fora do período", modelo: "Validação de vidas — prazo encerrado", destino: "Empresa" },
  financeiro: { rotulo: "Envio direto ao Financeiro", modelo: "Encaminhamento ao Financeiro sem retorno da empresa", destino: "Financeiro" },
};

export const LISTA_CENARIOS = Object.keys(CENARIOS_ENVIO) as CenarioEnvio[];

/** "DD/MM/AAAA" → "AAAA-MM-DD"; inválido → null. */
function corteISO(corte: string | null): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(corte ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Sugere o cenário pela data de corte já existente (fim do período na competência).
 * Depois do corte → Fora do período. Envio ao Financeiro nunca é sugerido: é escolha com justificativa.
 */
export function sugerirCenario(hojeISO: string, corte: string | null): CenarioEnvio {
  const c = corteISO(corte);
  if (c && hojeISO > c) return "fora_periodo";
  return "dentro_periodo";
}

export interface DadosModelo { codigo: string | number; nome: string; corte: string | null; justificativa?: string | null }

export function montarEmailCenario(cenario: CenarioEnvio, d: DadosModelo): { assunto: string; texto: string } {
  const nome = String(d.nome ?? "").toUpperCase();
  const prazo = d.corte ? `até o dia ${d.corte}` : "até a data de corte";
  const limpar = (s: string) => s.replace(/\s+/g, " ").trim();
  if (cenario === "fora_periodo") {
    return {
      assunto: limpar(`RELATORIOS PARA CONFERENCIA - PRAZO ENCERRADO EMPRESA ${d.codigo} - ${nome}`),
      texto: [
        "Prezados!",
        "",
        `Segue, em anexo, o relatório atualizado de beneficiários referente ao faturamento. Informamos que o prazo para conferência e validação encerrou ${d.corte ? `no dia ${d.corte}` : "na data de corte"}.`,
        "",
        "Como o período de movimentação já foi encerrado, o faturamento seguirá com base no relatório encaminhado. Eventuais divergências identificadas serão analisadas e, se procedentes, ajustadas na próxima competência.",
        "",
        "Peço, por gentileza, que confirmem o recebimento deste relatório.",
      ].join("\n"),
    };
  }
  if (cenario === "financeiro") {
    return {
      assunto: limpar(`ENCAMINHAMENTO AO FINANCEIRO EMPRESA ${d.codigo} - ${nome}`),
      texto: [
        "Prezados!",
        "",
        `Segue, em anexo, o relatório atualizado de beneficiários da empresa ${nome} (contrato ${d.codigo}) para seguimento do faturamento.`,
        "",
        `Este encaminhamento foi realizado sem autorização/confirmação da empresa. Justificativa: ${String(d.justificativa ?? "").trim()}`,
      ].join("\n"),
    };
  }
  return {
    assunto: limpar(`RELATORIOS PARA CONFERENCIA EMPRESA ${d.codigo} - ${nome}`),
    texto: [
      "Prezados!",
      "",
      "Segue, em anexo, o relatório atualizado de beneficiários para conferência e validação do faturamento.",
      "",
      `Caso identifiquem alguma divergência, solicito que nos informem ${prazo}, para que possamos realizar os ajustes necessários antes da emissão da Nota Fiscal.`,
      "",
      "Ressalto que a conferência dentro do prazo é fundamental para evitar cobranças indevidas. Após a data de corte, a Nota Fiscal será emitida automaticamente com base no relatório encaminhado.",
      "",
      "Peço, por gentileza, que confirmem o recebimento e a validação do relatório. Na ausência de manifestação até o prazo informado, o faturamento seguirá normalmente.",
    ].join("\n"),
  };
}

/** Regras de envio: devolve a mensagem de bloqueio ou null. */
export function validarEscolhaCenario(p: { sugerido: CenarioEnvio; escolhido: CenarioEnvio; justificativa?: string | null; motivoAlteracao?: string | null }): string | null {
  if (p.escolhido === "financeiro" && (p.justificativa ?? "").trim().length < 5) return "Informe o motivo/justificativa do envio direto ao Financeiro.";
  if (p.escolhido !== p.sugerido && p.escolhido !== "financeiro" && (p.motivoAlteracao ?? "").trim().length < 5) return "Informe o motivo da alteração do cenário sugerido.";
  return null;
}
