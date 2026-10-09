// Identificação automática do contrato a partir do NOME do arquivo anexado.
//
// O Cadastro costuma anexar, em um único contrato, todos os arquivos de um
// Grupo Financeiro (ex.: "LSL 2086 - agosto.xlsx", "Relatorio Sumare.pdf").
// Esta função "lê" o nome do anexo e devolve a qual contrato do grupo ele
// pertence, para que a aba Faturamento exiba o anexo no contrato correto.

import { empresaTokens, normalizeEmpresaNome } from "@/lib/empresa-nome-similar";

export interface ContratoAlvo {
  empresaId: string;
  nome?: string | null;
  codigo?: string | null;
  cnpj?: string | null;
}

const soDigitos = (v: string) => (v ?? "").replace(/\D/g, "");

function baseDoArquivo(nomeArquivo: string): string {
  const semExt = (nomeArquivo ?? "").replace(/\.[a-z0-9]{2,5}$/i, "");
  return normalizeEmpresaNome(semExt);
}

export interface MatchAnexo {
  empresaId: string;
  /** "cnpj" | "codigo" | "nome" */
  criterio: "cnpj" | "codigo" | "nome";
  score: number;
}

/**
 * Retorna o contrato mais provável para o anexo, ou null quando o nome do
 * arquivo não permite identificar um contrato específico (anexo genérico,
 * que continua compartilhado entre todos os contratos do grupo).
 */
export function identificarContratoDoAnexo(
  nomeArquivo: string,
  alvos: ContratoAlvo[],
): MatchAnexo | null {
  if (!nomeArquivo || alvos.length === 0) return null;
  const base = baseDoArquivo(nomeArquivo);
  if (!base) return null;
  const tokensArquivo = new Set(base.split(" ").filter(Boolean));
  const digitosArquivo = soDigitos(base);

  const resultados: MatchAnexo[] = [];

  for (const alvo of alvos) {
    // 1) CNPJ completo no nome do arquivo
    const cnpj = soDigitos(alvo.cnpj ?? "");
    if (cnpj.length === 14 && digitosArquivo.includes(cnpj)) {
      resultados.push({ empresaId: alvo.empresaId, criterio: "cnpj", score: 100 });
      continue;
    }

    // 2) Código do contrato como token isolado (ex.: "2086")
    const codigo = soDigitos(String(alvo.codigo ?? ""));
    if (codigo.length >= 3 && tokensArquivo.has(codigo)) {
      resultados.push({ empresaId: alvo.empresaId, criterio: "codigo", score: 80 });
      continue;
    }

    // 3) Nome da empresa (tokens distintivos presentes no nome do arquivo)
    const tks = empresaTokens(alvo.nome ?? "");
    if (tks.length) {
      const encontrados = tks.filter((t) => tokensArquivo.has(t)).length;
      const proporcao = encontrados / tks.length;
      if (encontrados > 0 && proporcao >= 0.5) {
        resultados.push({
          empresaId: alvo.empresaId,
          criterio: "nome",
          score: 10 + proporcao * 10 + encontrados,
        });
      }
    }
  }

  if (!resultados.length) return null;
  resultados.sort((a, b) => b.score - a.score);
  const melhor = resultados[0];
  const segundo = resultados[1];
  // Empate => não é possível afirmar a qual contrato pertence.
  if (segundo && segundo.score === melhor.score) return null;
  return melhor;
}

/**
 * Em Grupo Financeiro: mantém o anexo de outro contrato do grupo somente
 * quando ele não foi identificado (CNPJ e depois código) como sendo de
 * um contrato específico diferente do contrato atual.
 */
export async function filtrarAnexosDoGrupoParaContrato<T extends { empresa_id: string; nome_arquivo: string; movimentacao_id: string }>(
  anexos: T[],
  movimentacaoAtualId: string,
  empresaAtualId: string | null | undefined,
  empresasGrupoIds: string[],
): Promise<T[]> {
  if (!empresaAtualId || !anexos.some((a) => a.movimentacao_id !== movimentacaoAtualId)) return anexos;
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("empresas")
    .select("id, codigo_contrato, cnpj")
    .in("id", Array.from(new Set([empresaAtualId, ...empresasGrupoIds])));
  const alvos: ContratoAlvo[] = ((data as any[]) ?? []).map((e) => ({
    empresaId: e.id,
    codigo: e.codigo_contrato,
    cnpj: e.cnpj,
  }));
  return anexos.filter((a) => {
    if (a.movimentacao_id === movimentacaoAtualId) return true;
    const m = identificarContratoDoAnexo(a.nome_arquivo, alvos);
    return !m || m.empresaId === empresaAtualId;
  });
}
