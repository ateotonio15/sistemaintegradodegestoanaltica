import { format } from "date-fns";
import type { Demanda } from "./demandas-utils";
import { getReclamacoesDisponiveis, normalizarReclamacao } from "./constants";

export function atualizarClassificacaoManual(form: Partial<Demanda>, campo: "setor_responsavel" | "tipo_reclamacao", valor: string): Partial<Demanda> {
  if (form[campo] === valor) return form;
  return campo === "setor_responsavel"
    ? { ...form, setor_responsavel: valor, tipo_reclamacao: "", reclamacao: "" }
    : { ...form, tipo_reclamacao: valor, reclamacao: "" };
}

export function classificacaoCompativel(form: Partial<Demanda>) {
  return getReclamacoesDisponiveis(form.setor_responsavel, form.tipo_reclamacao).includes(normalizarReclamacao(form.reclamacao));
}

/** Copy only editable data; never carry record IDs, ownership or shift links. */
export function duplicarDemanda(d: Demanda, hoje = new Date()): Partial<Demanda> {
  return {
    data_reclamacao: format(hoje, "yyyy-MM-dd"),
    nome_cliente: d.nome_cliente, cpf: d.cpf, empresa: d.empresa,
    setor_responsavel: d.setor_responsavel, executiva: d.executiva,
    tipo_reclamacao: d.tipo_reclamacao, reclamacao: d.reclamacao,
    detalhamento: d.detalhamento, observacao: d.observacao,
    nome_medico: d.nome_medico, nome_procedimento: d.nome_procedimento,
    data_entrada: d.data_entrada, encaminhado_setor: true,
    resolvido_setor: false, resolvido_executiva: false,
    data_resolucao_setor: null, data_resolucao_executiva: null,
  };
}

export function preservarCpf(form: Partial<Demanda>): string | null {
  return form.cpf?.trim() || null;
}