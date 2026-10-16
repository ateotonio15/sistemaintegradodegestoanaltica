/**
 * Análise em lote por Competência + Período.
 *
 * Reaproveita os mesmos parsers usados pela análise individual em
 * src/pages/Financeiro.tsx (excel-analysis-utils + pdf-analysis-utils +
 * excel-analysis-moto-honda). NÃO duplica lógica de parsing/comparação.
 *
 * Persiste resultados nas tabelas `financeiro_analise_execucoes` (cabeçalho)
 * e `financeiro_analise_execucao_itens` (1 linha por contrato/pagador).
 */

import { supabase } from "@/integrations/supabase/client";
import { isPdfAnexo, isXlsAnexo, expandirAnexosPorGrupo, fetchEmpresaGrupoMap } from "@/lib/financeiro-utils";
import { identificarContratoDoAnexo } from "@/lib/anexo-contrato-match";
import { periodoDaDataCorte } from "@/lib/movimentacao-utils";
import { sha256Hex, extrairDivergencias } from "@/lib/financeiro-analise-cache";
import type {
  AnaliseResultado,
  ComparacaoResultado,
  ComparacaoSimplificada,
} from "@/lib/excel-analysis-utils";

export type StatusItem =
  | "OK"
  | "Divergente"
  | "Sem Excel"
  | "Sem PDF"
  | "Sem Excel e sem PDF"
  | "Erro ao ler Excel"
  | "Erro ao ler PDF"
  | "Contrato sem movimentação"
  | "Aguardando faturamento";

export interface ExecucaoLoteRow {
  id: string;
  mes_referencia: string;
  periodo: string;
  executado_por: string | null;
  executado_por_nome: string | null;
  iniciada_em: string;
  finalizada_em: string | null;
  status: string;
  total: number;
  ok: number;
  divergentes: number;
  sem_excel: number;
  sem_pdf: number;
  sem_ambos: number;
  erro_leitura: number;
  aguardando_faturamento: number;
  sem_movimentacao: number;
  valor_total_analisado: number;
  valor_total_divergente: number;
}

export interface ItemLoteRow {
  id: string;
  execucao_id: string;
  empresa_id: string;
  financeiro_movimentacao_id: string | null;
  pagador_id: string | null;
  pagador_nome: string | null;
  pagador_cnpj: string | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  empresa_codigo: string | null;
  mes_referencia: string;
  periodo: string;
  status: StatusItem;
  excel_encontrado: boolean;
  pdf_encontrado: boolean;
  comparado: boolean;
  valor_excel: number | null;
  valor_pdf: number | null;
  diferenca: number | null;
  divergencias: any[];
  erros: string[];
  proxima_acao: string | null;
  nome_arquivo_excel: string | null;
  nome_arquivo_pdf: string | null;
  hash_excel: string | null;
  hash_pdf: string | null;
  resultado_completo: any;
  created_at: string;
}

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

function proximaAcao(s: StatusItem): string {
  switch (s) {
    case "OK": return "Nenhuma ação necessária";
    case "Divergente": return "Verificar divergência entre Excel e nota fiscal";
    case "Sem Excel": return "Anexar Excel/relatório de faturamento";
    case "Sem PDF": return "Anexar PDF da nota fiscal";
    case "Sem Excel e sem PDF": return "Anexar documentos obrigatórios";
    case "Erro ao ler Excel": return "Verificar formato ou conteúdo do Excel";
    case "Erro ao ler PDF": return "Verificar formato ou conteúdo do PDF";
    case "Contrato sem movimentação": return "Verificar se o contrato deveria ser faturado";
    case "Aguardando faturamento": return "Iniciar faturamento";
  }
}

function sumExcelTotal(r: AnaliseResultado): number {
  // Cálculo centralizado (F1): inclui todas as categorias com sinais
  // preservados; retroativos não entram (subconjunto de inclusões).
  return somarTotalFaturamento(r as any);
}

function sumPdfTotal(c: ComparacaoResultado | ComparacaoSimplificada | null): number | null {
  if (!c) return null;
  if ("beneficiarios" in c && !("enfermaria" in (c as any))) {
    // simplificada
    const s = c as ComparacaoSimplificada;
    const ai = s.inclusoes?.pdf ?? 0;
    const ax = s.exclusoes?.pdf ?? 0;
    return Number((ai + ax).toFixed(2));
  }
  const cr = c as ComparacaoResultado;
  const e = cr.enfermaria?.total?.pdf ?? 0;
  const a = cr.apartamento?.total?.pdf ?? 0;
  const i = cr.inclusoes?.total?.pdf ?? 0;
  const x = (cr as any).exclusoes?.total?.pdf ?? 0;
  const d = (cr as any).devolucoes?.total?.pdf ?? 0;
  return Number((e + a + i + x + d).toFixed(2));
}

/** Empresa simplificada usada no batch. */
interface EmpresaInfo {
  id: string;
  nome: string;
  cnpj: string | null;
  codigo_contrato: string | null;
  tipo_movimentacao: string | null;
  periodo_movimentacao: string | null;
  data_corte: number | null;
  status_empresa: string | null;
  data_rescisao: string | null;
  contrato_suspenso: boolean;
  nao_faturado_financeiro: boolean;
  tipo_analise?: string | null;
}

function empresaPertenceAoPeriodo(emp: EmpresaInfo, periodo: string): boolean {
  if (emp.tipo_movimentacao === "Diária" && emp.data_corte != null) {
    return periodoDaDataCorte(emp.data_corte) === periodo;
  }
  if (emp.periodo_movimentacao) return emp.periodo_movimentacao === periodo;
  return false;
}

function empresaAtiva(emp: EmpresaInfo): boolean {
  const statusOk = (emp.status_empresa ?? "Ativa") === "Ativa";
  return statusOk && !emp.data_rescisao && !emp.contrato_suspenso && !emp.nao_faturado_financeiro;
}

export interface ProgressInfo { done: number; total: number; current?: string }

/**
 * Roda toda a análise para (mes, periodo). Cria a execução, persiste cada item e
 * fecha a execução com totais. Devolve a execução final.
 */
export async function executarAnaliseCompetencia(
  mes: string,
  periodo: string,
  onProgress?: (p: ProgressInfo) => void,
): Promise<ExecucaoLoteRow | null> {
  // Usuário logado
  const { data: auth } = await supabase.auth.getUser();
  let executado_por_nome: string | null = null;
  if (auth?.user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    executado_por_nome = prof?.display_name || null;
  }

  // 1) Cria a execução
  const { data: exec, error: execErr } = await supabase
    .from("financeiro_analise_execucoes" as any)
    .insert({
      mes_referencia: mes,
      periodo,
      executado_por: auth?.user?.id ?? null,
      executado_por_nome,
      status: "em_andamento",
    } as any)
    .select("*")
    .single();
  if (execErr || !exec) {
    console.error("[lote] erro criando execução", execErr);
    return null;
  }
  const execucao = exec as unknown as ExecucaoLoteRow;

  // 2) Busca movimentações do mês/período + empresas + anexos + pagadores
  const { data: movs } = await supabase
    .from("financeiro_movimentacoes")
    .select("id, empresa_id, mes_referencia, periodo, faturamento_iniciado_em, tipo_analise")
    .eq("mes_referencia", mes)
    .eq("periodo", periodo);
  const movimentacoes = (movs || []) as Array<{
    id: string; empresa_id: string; mes_referencia: string; periodo: string;
    faturamento_iniciado_em: string | null; tipo_analise: string | null;
  }>;
  const empresaIdsMov = Array.from(new Set(movimentacoes.map((m) => m.empresa_id)));

  // Buscar TODAS as empresas ativas (para detectar "Aguardando faturamento")
  const { data: empresasAll } = await supabase
    .from("empresas")
    .select("id, nome, cnpj, codigo_contrato, tipo_movimentacao, periodo_movimentacao, data_corte, status_empresa, data_rescisao, contrato_suspenso, nao_faturado_financeiro");
  const empresas = (empresasAll || []) as EmpresaInfo[];
  const empresasMap = new Map(empresas.map((e) => [e.id, e]));

  // Empresas ativas que pertencem ao período mas SEM movimentação no mês
  const empresasDoPeriodoSemMov = empresas.filter(
    (e) =>
      empresaAtiva(e) &&
      empresaPertenceAoPeriodo(e, periodo) &&
      !empresaIdsMov.includes(e.id),
  );

  // Anexos por movimentação
  const movIds = movimentacoes.map((m) => m.id);
  let anexosPorMov: Record<string, Array<{ mime_type: string | null; nome_arquivo: string | null; storage_path: string | null; origem: string | null }>> = {};
  if (movIds.length > 0) {
    const { data: anexos } = await supabase
      .from("anexos_financeiro")
      .select("financeiro_movimentacao_id, mime_type, nome_arquivo, storage_path, origem, created_at")
      .in("financeiro_movimentacao_id", movIds)
      .order("created_at", { ascending: false });
    // Anexos compartilhados pelo Grupo Financeiro (mesma competência/período),
    // igual à aba Faturamento. Arquivos cujo nome identifica OUTRO contrato do
    // grupo não são atribuídos a este contrato.
    const empresaGrupo = await fetchEmpresaGrupoMap(supabase as any);
    const expandidos = expandirAnexosPorGrupo(movimentacoes, (anexos || []) as any[], empresaGrupo);
    const movPorId = new Map(movimentacoes.map((m) => [m.id, m]));
    expandidos.forEach((lista, movId) => {
      const mov = movPorId.get(movId);
      if (!mov) return;
      const grupoId = empresaGrupo.get(mov.empresa_id);
      const alvos = grupoId
        ? movimentacoes
            .filter((m) => empresaGrupo.get(m.empresa_id) === grupoId)
            .map((m) => {
              const e = empresasMap.get(m.empresa_id);
              return { empresaId: m.empresa_id, nome: e?.nome, codigo: e?.codigo_contrato, cnpj: e?.cnpj };
            })
        : [];
      anexosPorMov[movId] = lista.filter((a: any) => {
        if (a.financeiro_movimentacao_id === movId || alvos.length < 2) return true;
        const match = identificarContratoDoAnexo(a.nome_arquivo || "", alvos);
        return !match || match.empresaId === mov.empresa_id;
      });
    });
  }

  // Lazy imports dos parsers (mesma estratégia do Financeiro.tsx)
  const xls = await import("@/lib/excel-analysis-utils");
  const moto = await import("@/lib/excel-analysis-moto-honda");
  const pdfLib = await import("@/lib/pdf-analysis-utils");

  const itensParaInserir: any[] = [];
  const totaisCount: Record<StatusItem, number> = {
    "OK": 0, "Divergente": 0, "Sem Excel": 0, "Sem PDF": 0, "Sem Excel e sem PDF": 0,
    "Erro ao ler Excel": 0, "Erro ao ler PDF": 0, "Contrato sem movimentação": 0, "Aguardando faturamento": 0,
  };
  let valorTotalAnalisado = 0;
  let valorTotalDivergente = 0;

  const totalAprox = movimentacoes.length + empresasDoPeriodoSemMov.length;
  let done = 0;

  const pushItem = (it: any) => {
    itensParaInserir.push(it);
    const s = it.status as StatusItem;
    totaisCount[s] = (totaisCount[s] || 0) + 1;
    if (typeof it.valor_excel === "number") valorTotalAnalisado += it.valor_excel || 0;
    if (s === "Divergente" && typeof it.diferenca === "number") valorTotalDivergente += Math.abs(it.diferenca || 0);
  };

  // 3) Itera movimentações
  for (const mov of movimentacoes) {
    const emp = empresasMap.get(mov.empresa_id);
    done++;
    onProgress?.({ done, total: totalAprox, current: emp?.nome || mov.empresa_id });
    if (!emp || emp.nao_faturado_financeiro) continue;

    const empCommon = {
      execucao_id: execucao.id,
      empresa_id: mov.empresa_id,
      financeiro_movimentacao_id: mov.id,
      empresa_nome: emp.nome,
      empresa_cnpj: emp.cnpj,
      empresa_codigo: emp.codigo_contrato,
      mes_referencia: mes,
      periodo,
    };

    const anexos = anexosPorMov[mov.id] || [];
    const xlsAnexos = anexos.filter((a) => isXlsAnexo(a) && a.storage_path);
    const pdfAnexos = anexos.filter((a) => isPdfAnexo(a) && a.storage_path);
    const temXls = xlsAnexos.length > 0;
    const temPdf = pdfAnexos.length > 0;

    // Caso: sem nenhum anexo → status depende se faturamento iniciou
    if (!temXls && !temPdf) {
      const status: StatusItem = mov.faturamento_iniciado_em
        ? "Contrato sem movimentação"
        : "Aguardando faturamento";
      pushItem({
        ...empCommon,
        pagador_nome: emp.nome,
        pagador_cnpj: emp.cnpj,
        status,
        excel_encontrado: false,
        pdf_encontrado: false,
        comparado: false,
        valor_excel: null,
        valor_pdf: null,
        diferenca: null,
        divergencias: [],
        erros: [],
        proxima_acao: proximaAcao(status),
        nome_arquivo_excel: null,
        nome_arquivo_pdf: null,
        hash_excel: null,
        hash_pdf: null,
        resultado_completo: null,
      });
      continue;
    }

    // Caso: só PDF
    if (!temXls && temPdf) {
      pushItem({
        ...empCommon,
        pagador_nome: emp.nome,
        pagador_cnpj: emp.cnpj,
        status: "Sem Excel" as StatusItem,
        excel_encontrado: false,
        pdf_encontrado: true,
        comparado: false,
        valor_excel: null,
        valor_pdf: null,
        diferenca: null,
        divergencias: [],
        erros: [],
        proxima_acao: proximaAcao("Sem Excel"),
        nome_arquivo_excel: null,
        nome_arquivo_pdf: pdfAnexos[0]?.nome_arquivo ?? null,
        hash_excel: null,
        hash_pdf: null,
        resultado_completo: null,
      });
      continue;
    }

    // A partir daqui temXls === true. Baixa PDFs (se houver) e Excels.
    const erros: string[] = [];
    const pdfsValidos: Array<any> = [];
    for (const a of pdfAnexos) {
      try {
        const { data, error } = await supabase.storage.from("anexos-financeiro").download(a.storage_path!);
        if (error) throw error;
        const buf = await data.arrayBuffer();
        const hash = await sha256Hex(buf);
        const r = await pdfLib.analisarPdfFinanceiro(buf);
        pdfsValidos.push({ arquivo: a.nome_arquivo || "PDF", buf, hash, ...r });
      } catch (err: any) {
        erros.push(`PDF ${a.nome_arquivo}: ${err?.message || err}`);
      }
    }

    const tipoAnalise = (mov.tipo_analise as string) || "normal";

    // ===== MOTO HONDA =====
    if (tipoAnalise === "moto_honda") {
      try {
        const a = xlsAnexos[0];
        const { data, error } = await supabase.storage.from("anexos-financeiro").download(a.storage_path!);
        if (error) throw error;
        const buf = await data.arrayBuffer();
        const hash = await sha256Hex(buf);
        const r = await moto.analisarExcelMotoHonda(buf);
        const excelRes: AnaliseResultado = { pagador: emp.nome, ...r } as AnaliseResultado;
        const valorExcel = sumExcelTotal(excelRes);

        if (pdfsValidos.length === 0 && erros.length === 0) {
          const status: StatusItem = "Sem PDF";
          pushItem({
            ...empCommon, pagador_nome: emp.nome, pagador_cnpj: emp.cnpj,
            status, excel_encontrado: true, pdf_encontrado: false, comparado: false,
            valor_excel: valorExcel, valor_pdf: null, diferenca: null,
            divergencias: [], erros: [], proxima_acao: proximaAcao(status),
            nome_arquivo_excel: a.nome_arquivo, nome_arquivo_pdf: null,
            hash_excel: hash, hash_pdf: null, resultado_completo: { resultados: [excelRes], comparacoes: [] },
          });
          continue;
        }
        if (erros.length > 0 && pdfsValidos.length === 0) {
          pushItem({
            ...empCommon, pagador_nome: emp.nome, pagador_cnpj: emp.cnpj,
            status: "Erro ao ler PDF", excel_encontrado: true, pdf_encontrado: true, comparado: false,
            valor_excel: valorExcel, valor_pdf: null, diferenca: null,
            divergencias: [], erros, proxima_acao: proximaAcao("Erro ao ler PDF"),
            nome_arquivo_excel: a.nome_arquivo, nome_arquivo_pdf: pdfAnexos[0]?.nome_arquivo ?? null,
            hash_excel: hash, hash_pdf: null, resultado_completo: { resultados: [excelRes], comparacoes: [] },
          });
          continue;
        }

        const p = pdfsValidos[0];
        const semDetalhes =
          (!p.enfermaria || (p.enfermaria.total === 0 && p.enfermaria.beneficiarios === null)) &&
          (!p.apartamento || (p.apartamento.total === 0 && p.apartamento.beneficiarios === null));
        const cmp = semDetalhes
          ? xls.compararExcelComPdfSimplificado(excelRes, await pdfLib.analisarPdfFinanceiroSimplificado(p.buf) as any)
          : xls.compararExcelComPdf(excelRes, p, tipoAnalise);
        const divs = extrairDivergencias(cmp);
        const valorPdf = sumPdfTotal(cmp);
        const status: StatusItem = divs.length === 0 ? "OK" : "Divergente";
        pushItem({
          ...empCommon, pagador_nome: emp.nome, pagador_cnpj: emp.cnpj,
          status, excel_encontrado: true, pdf_encontrado: true, comparado: true,
          valor_excel: valorExcel, valor_pdf: valorPdf,
          diferenca: valorPdf != null ? Number((valorExcel - valorPdf).toFixed(2)) : null,
          divergencias: divs, erros, proxima_acao: proximaAcao(status),
          nome_arquivo_excel: a.nome_arquivo, nome_arquivo_pdf: p.arquivo,
          hash_excel: hash, hash_pdf: p.hash, resultado_completo: { resultados: [excelRes], comparacoes: [cmp] },
        });
      } catch (err: any) {
        pushItem({
          ...empCommon, pagador_nome: emp.nome, pagador_cnpj: emp.cnpj,
          status: "Erro ao ler Excel", excel_encontrado: true, pdf_encontrado: temPdf, comparado: false,
          valor_excel: null, valor_pdf: null, diferenca: null,
          divergencias: [], erros: [`Excel: ${err?.message || err}`], proxima_acao: proximaAcao("Erro ao ler Excel"),
          nome_arquivo_excel: xlsAnexos[0]?.nome_arquivo ?? null,
          nome_arquivo_pdf: pdfAnexos[0]?.nome_arquivo ?? null,
          hash_excel: null, hash_pdf: null, resultado_completo: null,
        });
      }
      continue;
    }

    // ===== FLUXO NORMAL: 1 item por CNPJ encontrado nos Excels =====
    const blocosTotais: import("@/lib/excel-analysis-utils").AnalisePorCnpj[] = [];
    const metaByCnpj = new Map<string, { hashExcel: string | null; arquivo: string | null }>();
    let erroParseExcel = false;
    for (const a of xlsAnexos) {
      try {
        const { data, error } = await supabase.storage.from("anexos-financeiro").download(a.storage_path!);
        if (error) throw error;
        const buf = await data.arrayBuffer();
        const hash = await sha256Hex(buf);
        const blocos = await xls.analisarExcelFinanceiroPorCnpj(buf);
        blocos.forEach((b) => {
          blocosTotais.push(b);
          const key = b.cnpj || `__nome::${b.nome}`;
          if (!metaByCnpj.has(key)) metaByCnpj.set(key, { hashExcel: hash, arquivo: a.nome_arquivo ?? null });
        });
      } catch (err: any) {
        erroParseExcel = true;
        erros.push(`Excel ${a.nome_arquivo}: ${err?.message || err}`);
      }
    }

    if (blocosTotais.length === 0) {
      // Falha total no parsing
      pushItem({
        ...empCommon, pagador_nome: emp.nome, pagador_cnpj: emp.cnpj,
        status: erroParseExcel ? "Erro ao ler Excel" : "Erro ao ler Excel",
        excel_encontrado: true, pdf_encontrado: temPdf, comparado: false,
        valor_excel: null, valor_pdf: null, diferenca: null,
        divergencias: [], erros: erros.length ? erros : ["Excel sem blocos identificáveis (CNPJ não localizado)."],
        proxima_acao: proximaAcao("Erro ao ler Excel"),
        nome_arquivo_excel: xlsAnexos[0]?.nome_arquivo ?? null,
        nome_arquivo_pdf: pdfAnexos[0]?.nome_arquivo ?? null,
        hash_excel: null, hash_pdf: null, resultado_completo: null,
      });
      continue;
    }

    const { comparacoes } = xls.cruzarExcelComPdfs(blocosTotais, pdfsValidos, tipoAnalise);

    blocosTotais.forEach((b, i) => {
      const cmp = comparacoes[i] ?? null;
      const cmpAny = cmp as any;
      const meta = metaByCnpj.get(b.cnpj || `__nome::${b.nome}`);
      const excelRes: AnaliseResultado = {
        pagador: b.nomeExibicao,
        cnpj: b.cnpj,
        nomeExibicao: b.nomeExibicao,
        enfermaria: b.enfermaria,
        apartamento: b.apartamento,
        inclusoes: b.inclusoes,
        exclusoes: b.exclusoes,
        devolucoes: (b as any).devolucoes,
        avisos: b.avisos,
      } as AnaliseResultado;
      const valorExcel = sumExcelTotal(excelRes);
      const temPdfCasado = !!cmpAny?.arquivoPdf;
      let status: StatusItem;
      let valorPdf: number | null = null;
      let divs: any[] = [];
      if (!temPdfCasado) {
        status = "Sem PDF";
      } else {
        divs = extrairDivergencias(cmp);
        valorPdf = sumPdfTotal(cmp);
        status = divs.length === 0 ? "OK" : "Divergente";
      }
      pushItem({
        ...empCommon,
        pagador_nome: b.nomeExibicao || emp.nome,
        pagador_cnpj: b.cnpj || null,
        status,
        excel_encontrado: true,
        pdf_encontrado: temPdfCasado,
        comparado: temPdfCasado,
        valor_excel: valorExcel,
        valor_pdf: valorPdf,
        diferenca: valorPdf != null ? Number((valorExcel - valorPdf).toFixed(2)) : null,
        divergencias: divs,
        erros,
        proxima_acao: proximaAcao(status),
        nome_arquivo_excel: meta?.arquivo ?? null,
        nome_arquivo_pdf: cmpAny?.arquivoPdf ?? null,
        hash_excel: meta?.hashExcel ?? null,
        hash_pdf: null,
        resultado_completo: { resultados: [excelRes], comparacoes: cmp ? [cmp] : [] },
      });
    });
  }

  // 4) Empresas elegíveis ao período sem movimentação
  for (const emp of empresasDoPeriodoSemMov) {
    done++;
    onProgress?.({ done, total: totalAprox, current: emp.nome });
    const status: StatusItem = "Aguardando faturamento";
    pushItem({
      execucao_id: execucao.id,
      empresa_id: emp.id,
      financeiro_movimentacao_id: null,
      pagador_nome: emp.nome,
      pagador_cnpj: emp.cnpj,
      empresa_nome: emp.nome,
      empresa_cnpj: emp.cnpj,
      empresa_codigo: emp.codigo_contrato,
      mes_referencia: mes,
      periodo,
      status,
      excel_encontrado: false,
      pdf_encontrado: false,
      comparado: false,
      valor_excel: null,
      valor_pdf: null,
      diferenca: null,
      divergencias: [],
      erros: [],
      proxima_acao: proximaAcao(status),
      nome_arquivo_excel: null,
      nome_arquivo_pdf: null,
      hash_excel: null,
      hash_pdf: null,
      resultado_completo: null,
    });
  }

  // 5) Persiste itens em blocos de 200
  for (let i = 0; i < itensParaInserir.length; i += 200) {
    const slice = itensParaInserir.slice(i, i + 200);
    const { error } = await supabase
      .from("financeiro_analise_execucao_itens" as any)
      .insert(slice as any);
    if (error) console.error("[lote] erro insert itens", error);
  }

  // 6) Atualiza cabeçalho com totais
  const totals = {
    status: "concluida",
    finalizada_em: new Date().toISOString(),
    total: itensParaInserir.length,
    ok: totaisCount["OK"],
    divergentes: totaisCount["Divergente"],
    sem_excel: totaisCount["Sem Excel"],
    sem_pdf: totaisCount["Sem PDF"],
    sem_ambos: totaisCount["Sem Excel e sem PDF"],
    erro_leitura: totaisCount["Erro ao ler Excel"] + totaisCount["Erro ao ler PDF"],
    aguardando_faturamento: totaisCount["Aguardando faturamento"],
    sem_movimentacao: totaisCount["Contrato sem movimentação"],
    valor_total_analisado: Number(valorTotalAnalisado.toFixed(2)),
    valor_total_divergente: Number(valorTotalDivergente.toFixed(2)),
  };
  const { data: updated } = await supabase
    .from("financeiro_analise_execucoes" as any)
    .update(totals as any)
    .eq("id", execucao.id)
    .select("*")
    .single();
  return (updated as unknown as ExecucaoLoteRow) ?? execucao;
}

// ---------------- Consultas ----------------

export async function listarExecucoes(opts?: { mes?: string; periodo?: string; limit?: number }): Promise<ExecucaoLoteRow[]> {
  let q = supabase
    .from("financeiro_analise_execucoes" as any)
    .select("*")
    .order("iniciada_em", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.mes) q = q.eq("mes_referencia", opts.mes);
  if (opts?.periodo) q = q.eq("periodo", opts.periodo);
  const { data, error } = await q;
  if (error) {
    console.warn("[lote] listar execucoes", error);
    return [];
  }
  return (data as unknown as ExecucaoLoteRow[]) ?? [];
}

export async function listarItensExecucao(execucaoId: string): Promise<ItemLoteRow[]> {
  const { data, error } = await supabase
    .from("financeiro_analise_execucao_itens" as any)
    .select("*")
    .eq("execucao_id", execucaoId)
    .order("status", { ascending: true })
    .order("empresa_nome", { ascending: true });
  if (error) {
    console.warn("[lote] listar itens", error);
    return [];
  }
  return (data as unknown as ItemLoteRow[]) ?? [];
}

export async function deletarExecucao(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("financeiro_analise_execucoes" as any)
    .delete()
    .eq("id", id);
  if (error) {
    console.warn("[lote] delete execucao", error);
    return false;
  }
  return true;
}

// ---------------- Exportação Excel ----------------

export async function exportarExecucaoExcel(execucao: ExecucaoLoteRow, itens: ItemLoteRow[]): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Análise Competência");
  ws.columns = [
    { header: "Empresa", key: "empresa", width: 36 },
    { header: "CNPJ", key: "cnpj", width: 20 },
    { header: "Contrato", key: "contrato", width: 14 },
    { header: "Pagador", key: "pagador", width: 36 },
    { header: "CNPJ Pagador", key: "pagcnpj", width: 20 },
    { header: "Competência", key: "comp", width: 12 },
    { header: "Período", key: "per", width: 10 },
    { header: "Status", key: "status", width: 22 },
    { header: "Excel encontrado", key: "x", width: 16 },
    { header: "PDF encontrado", key: "p", width: 16 },
    { header: "Valor Excel", key: "ve", width: 14 },
    { header: "Valor PDF/NF", key: "vp", width: 14 },
    { header: "Diferença", key: "df", width: 14 },
    { header: "Divergências", key: "dv", width: 60 },
    { header: "Erros", key: "er", width: 60 },
    { header: "Próxima ação", key: "pa", width: 40 },
    { header: "Data/hora análise", key: "dt", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };
  itens.forEach((i) => {
    ws.addRow({
      empresa: i.empresa_nome || "",
      cnpj: i.empresa_cnpj || "",
      contrato: i.empresa_codigo || "",
      pagador: i.pagador_nome || "",
      pagcnpj: i.pagador_cnpj || "",
      comp: execucao.mes_referencia,
      per: i.periodo,
      status: i.status,
      x: i.excel_encontrado ? "Sim" : "Não",
      p: i.pdf_encontrado ? "Sim" : "Não",
      ve: i.valor_excel ?? "",
      vp: i.valor_pdf ?? "",
      df: i.diferenca ?? "",
      dv: (i.divergencias || []).map((d: any) => `${d.campo}: Excel ${d.valor_excel ?? "—"} × PDF ${d.valor_pdf ?? "—"}`).join(" | "),
      er: (i.erros || []).join(" | "),
      pa: i.proxima_acao || "",
      dt: new Date(i.created_at).toLocaleString("pt-BR"),
    });
  });
  ["K", "L", "M"].forEach((c) => (ws.getColumn(c).numFmt = '"R$ "#,##0.00'));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analise-competencia-${execucao.mes_referencia}-${execucao.periodo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
