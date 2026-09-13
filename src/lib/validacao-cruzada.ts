// ============================================================
// Etapa interna "Validação Cruzada"
// Compara automaticamente os dados obtidos nas análises já existentes
// do mesmo contrato (análise do contrato x extração do Anexo I) sem
// alterar nenhum dos processos originais.
// ============================================================

import type { ProcessoSetor } from "@/lib/contrato-processo";

export type ValidacaoResultado = "compativel" | "divergente" | "nao_encontrado" | "necessita_validacao";

export interface ValidacaoItem {
  campo: string;
  rotulo: string;
  valor_contrato: string | null;
  valor_anexo: string | null;
  resultado: ValidacaoResultado;
  criticidade: "Baixa" | "Média" | "Alta" | "Crítica";
  setor_destino: ProcessoSetor;
  justificativa: string;
  categoria?: string;
  titulo_pendencia?: string;
}

export interface ValidacaoCruzadaRow extends ValidacaoItem {
  id: string;
  processo_id: string;
  implantacao_id: string | null;
  pendencia_id: string | null;
  executado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export const RESULTADO_LABEL: Record<ValidacaoResultado, string> = {
  compativel: "Compatível",
  divergente: "Divergente",
  nao_encontrado: "Não encontrado",
  necessita_validacao: "Necessita validação",
};

export const RESULTADO_BADGE_VALIDACAO: Record<ValidacaoResultado, string> = {
  compativel: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  divergente: "bg-red-500/15 text-red-600 border-red-500/30",
  nao_encontrado: "bg-muted text-muted-foreground border-border",
  necessita_validacao: "bg-amber-500/15 text-amber-600 border-amber-500/30",
};

// ---------------- normalizadores ----------------

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D+/g, "");

function normTexto(v: unknown) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|s\/?a|me|epp|eireli|mei)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Converte valores monetários variados ("R$ 389,00", "389.00", 38900 centavos) em centavos. */
export function paraCentavos(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.round(v);
  const bruto = String(v).replace(/[^\d,.-]/g, "");
  if (!bruto) return null;
  let num: number;
  if (bruto.includes(",")) num = Number(bruto.replace(/\./g, "").replace(",", "."));
  else num = Number(bruto);
  if (!isFinite(num)) return null;
  return Math.round(num * 100);
}

export function centavosBR(c: number | null) {
  if (c == null) return null;
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Aceita dd/mm/aaaa, aaaa-mm-dd e retorna aaaa-mm-dd. */
export function paraISO(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function dataBR(iso: string | null) {
  if (!iso) return null;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Última data encontrada em um texto de vigência (fim da vigência). */
export function fimVigencia(texto: unknown): string | null {
  const s = String(texto ?? "");
  const datas = [...s.matchAll(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/g)].map((m) => paraISO(m[0]));
  const validas = datas.filter(Boolean) as string[];
  if (!validas.length) return null;
  return validas.sort()[validas.length - 1];
}

// ---------------- comparadores ----------------

type Tipo = "texto" | "documento" | "dinheiro" | "data" | "numero" | "booleano";

function comparar(tipo: Tipo, a: unknown, b: unknown): ValidacaoResultado {
  const vazioA = a == null || String(a).trim() === "";
  const vazioB = b == null || String(b).trim() === "";
  if (vazioA && vazioB) return "nao_encontrado";
  if (vazioA || vazioB) return "necessita_validacao";

  switch (tipo) {
    case "documento":
      return soDigitos(a) === soDigitos(b) ? "compativel" : "divergente";
    case "dinheiro": {
      const ca = paraCentavos(a);
      const cb = paraCentavos(b);
      if (ca == null || cb == null) return "necessita_validacao";
      return ca === cb ? "compativel" : "divergente";
    }
    case "data": {
      const da = paraISO(a);
      const db = paraISO(b);
      if (!da || !db) return "necessita_validacao";
      return da === db ? "compativel" : "divergente";
    }
    case "numero": {
      const na = Number(soDigitos(a));
      const nb = Number(soDigitos(b));
      if (!isFinite(na) || !isFinite(nb)) return "necessita_validacao";
      return na === nb ? "compativel" : "divergente";
    }
    case "booleano": {
      const ba = a === true || /sim|true|valida/i.test(String(a));
      const bb = b === true || /sim|true|valida/i.test(String(b));
      return ba === bb ? "compativel" : "divergente";
    }
    default: {
      const ta = normTexto(a);
      const tb = normTexto(b);
      if (!ta || !tb) return "necessita_validacao";
      if (ta === tb) return "compativel";
      // nomes parecidos (um contém o outro) contam como compatíveis
      if (ta.includes(tb) || tb.includes(ta)) return "compativel";
      return "divergente";
    }
  }
}

function exibir(tipo: Tipo, v: unknown): string | null {
  if (v == null || String(v).trim() === "") return null;
  if (tipo === "dinheiro") return centavosBR(paraCentavos(v)) ?? String(v);
  if (tipo === "data") return dataBR(paraISO(v)) ?? String(v);
  if (tipo === "booleano") return v === true || /sim|true/i.test(String(v)) ? "Sim" : "Não";
  return String(v).trim();
}

interface CampoSpec {
  campo: string;
  rotulo: string;
  tipo: Tipo;
  criticidade: ValidacaoItem["criticidade"];
  setor: ProcessoSetor;
  categoria: string;
  contrato: (c: any) => unknown;
  anexo: (a: any) => unknown;
}

const CAMPOS: CampoSpec[] = [
  { campo: "nome_empresa", rotulo: "Nome da empresa", tipo: "texto", criticidade: "Alta", setor: "cadastro", categoria: "Divergência de dados",
    contrato: (c) => c?.contratante?.nome, anexo: (a) => a?.nome_empresa },
  { campo: "cnpj", rotulo: "CNPJ", tipo: "documento", criticidade: "Crítica", setor: "cadastro", categoria: "Cadastral",
    contrato: (c) => c?.contratante?.cnpj, anexo: (a) => a?.cnpj },
  { campo: "contratado", rotulo: "Contratado", tipo: "texto", criticidade: "Média", setor: "juridico", categoria: "Jurídica",
    contrato: (c) => c?.contratado?.nome, anexo: (a) => a?.contratado },
  { campo: "documento_contratado", rotulo: "CPF/CNPJ do contratado", tipo: "documento", criticidade: "Alta", setor: "juridico", categoria: "Jurídica",
    contrato: (c) => c?.contratado?.documento, anexo: (a) => a?.documento_contratado },
  { campo: "modalidade", rotulo: "Modalidade", tipo: "texto", criticidade: "Média", setor: "cadastro", categoria: "Cadastral",
    contrato: (c) => c?.tipo_vinculo, anexo: (a) => a?.modalidade },
  { campo: "vigencia", rotulo: "Vigência", tipo: "data", criticidade: "Alta", setor: "juridico", categoria: "Vigência",
    contrato: (c) => c?.vigencia, anexo: (a) => a?.data_vigencia },
  { campo: "data_implantacao", rotulo: "Data de implantação", tipo: "data", criticidade: "Alta", setor: "cadastro", categoria: "Cadastral",
    contrato: (c) => c?.data_implantacao, anexo: (a) => a?.data_implantacao },
  { campo: "inicio_atendimento", rotulo: "Início de atendimento", tipo: "data", criticidade: "Média", setor: "cadastro", categoria: "Cadastral",
    contrato: (c) => c?.inicio_atendimento, anexo: (a) => a?.inicio_atendimento },
  { campo: "grupo_contrato", rotulo: "Grupo / contrato", tipo: "texto", criticidade: "Média", setor: "cadastro", categoria: "Cadastral",
    contrato: (c) => c?.grupo_contrato, anexo: (a) => a?.grupo_contrato },
  { campo: "valor_enfermaria", rotulo: "Valor enfermaria", tipo: "dinheiro", criticidade: "Alta", setor: "financeiro", categoria: "Financeira",
    contrato: (c) => c?.valor_enfermaria, anexo: (a) => a?.valor_enfermaria_centavos },
  { campo: "valor_apartamento", rotulo: "Valor apartamento", tipo: "dinheiro", criticidade: "Alta", setor: "financeiro", categoria: "Financeira",
    contrato: (c) => c?.valor_apartamento, anexo: (a) => a?.valor_apartamento_centavos },
  { campo: "honorarios", rotulo: "Honorários", tipo: "dinheiro", criticidade: "Alta", setor: "financeiro", categoria: "Financeira",
    contrato: (c) => c?.valor_honorarios, anexo: (a) => a?.honorarios },
  { campo: "quantidade_vidas", rotulo: "Quantidade de vidas", tipo: "numero", criticidade: "Média", setor: "cadastro", categoria: "Cadastral",
    contrato: (c) => c?.quantidade_vidas ?? c?.vidas, anexo: (a) => a?.total_vidas },
  { campo: "assinaturas", rotulo: "Assinaturas", tipo: "booleano", criticidade: "Crítica", setor: "juridico", categoria: "Assinatura",
    contrato: (c) => c?.assinado_por_ambas_partes, anexo: (a) => a?.assinaturas },
];

export interface FontesValidacao {
  /** Resultado da análise do contrato (analisar-contrato). */
  contrato: any;
  /** Dados do Anexo I (extração por PDF/imagem, por texto e cadastro da proposta). */
  anexo: any;
}

/**
 * Monta as fontes de comparação a partir da proposta de implantação.
 * O Anexo I usa, na ordem: extração por arquivo, extração por texto e os
 * dados já gravados na proposta.
 */
export function montarFontes(impl: any): FontesValidacao {
  const ex1 = impl?.extracao_anexo1 || {};
  const ex2 = impl?.extracao_anexo1_texto || {};
  const pick = (...vs: unknown[]) => vs.find((v) => v != null && String(v).trim() !== "") ?? null;
  return {
    contrato: impl?.analise_contrato || null,
    anexo: {
      nome_empresa: pick(ex1.nome_empresa, ex2.nome, impl?.nome_empresa),
      cnpj: pick(ex1.cnpj, ex2.cnpj, impl?.cnpj),
      contratado: pick(ex1.contratado, impl?.nome_empresa),
      documento_contratado: pick(ex1.documento_contratado, ex1.cpf_contratado),
      modalidade: pick(ex1.modalidade, impl?.modalidade, impl?.tipo_contrato),
      data_vigencia: pick(ex1.data_vigencia, impl?.data_vigencia),
      data_implantacao: pick(ex1.data_implantacao, ex2.data_implantacao, impl?.inicio_atendimento),
      inicio_atendimento: pick(ex1.inicio_atendimento, impl?.inicio_atendimento),
      grupo_contrato: pick(ex1.grupo_contrato, impl?.grupo_contrato),
      valor_enfermaria_centavos: pick(
        ex1.valor_enfermaria_centavos,
        ex2.valor_enfermaria_reais != null ? Math.round(Number(ex2.valor_enfermaria_reais) * 100) : null,
        impl?.valor_enfermaria_centavos,
      ),
      valor_apartamento_centavos: pick(
        ex1.valor_apartamento_centavos,
        ex2.valor_apartamento_reais != null ? Math.round(Number(ex2.valor_apartamento_reais) * 100) : null,
        impl?.valor_apartamento_centavos,
      ),
      honorarios: pick(ex1.honorarios, ex1.valor_honorarios),
      total_vidas: pick(ex1.total_vidas, ex2.vidas, impl?.total_vidas),
      assinaturas: ex1.assinaturas ?? null,
    },
  };
}

/** Executa a comparação campo a campo e devolve os itens a registrar. */
export function validarCruzado(impl: any): ValidacaoItem[] {
  const { contrato, anexo } = montarFontes(impl);
  const itens: ValidacaoItem[] = [];

  for (const spec of CAMPOS) {
    const vc = spec.contrato(contrato);
    const va = spec.anexo(anexo);
    const resultado = comparar(spec.tipo, vc, va);
    const justificativa =
      resultado === "compativel"
        ? "Informação idêntica nas duas análises."
        : resultado === "divergente"
        ? `Contrato informa "${exibir(spec.tipo, vc)}" e o Anexo I informa "${exibir(spec.tipo, va)}".`
        : resultado === "nao_encontrado"
        ? "Informação não localizada em nenhuma das análises."
        : "Informação disponível em apenas uma das análises — necessita validação manual.";

    itens.push({
      campo: spec.campo,
      rotulo: spec.rotulo,
      valor_contrato: exibir(spec.tipo, vc),
      valor_anexo: exibir(spec.tipo, va),
      resultado,
      criticidade: spec.criticidade,
      setor_destino: spec.setor,
      categoria: spec.categoria,
      justificativa,
      titulo_pendencia: `Divergência: ${spec.rotulo}`,
    });
  }

  // Regra especial: fim da vigência anterior à data de implantação = divergência crítica (Jurídico)
  const fim = fimVigencia(contrato?.vigencia) || paraISO(impl?.data_vigencia);
  const implDate = paraISO(anexo.data_implantacao) || paraISO(impl?.inicio_atendimento);
  if (fim && implDate) {
    const divergente = fim < implDate;
    itens.push({
      campo: "vigencia_vs_implantacao",
      rotulo: "Vigência x data de implantação",
      valor_contrato: `Fim da vigência ${dataBR(fim)}`,
      valor_anexo: `Implantação ${dataBR(implDate)}`,
      resultado: divergente ? "divergente" : "compativel",
      criticidade: "Crítica",
      setor_destino: "juridico",
      categoria: "Vigência",
      justificativa: divergente
        ? `O contrato encerra em ${dataBR(fim)}, antes da implantação prevista para ${dataBR(implDate)}.`
        : "A implantação ocorre dentro do prazo de vigência do contrato.",
      titulo_pendencia: "Vigência incompatível com a data de implantação",
    });
  }

  return itens;
}

export function resumoValidacao(itens: { resultado: string; criticidade: string }[]) {
  const divergentes = itens.filter((i) => i.resultado === "divergente");
  return {
    total: itens.length,
    compativeis: itens.filter((i) => i.resultado === "compativel").length,
    divergentes: divergentes.length,
    criticas: divergentes.filter((i) => i.criticidade === "Crítica").length,
    necessitaValidacao: itens.filter((i) => i.resultado === "necessita_validacao").length,
    naoEncontrados: itens.filter((i) => i.resultado === "nao_encontrado").length,
  };
}
