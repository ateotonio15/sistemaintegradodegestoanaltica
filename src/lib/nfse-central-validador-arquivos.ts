/**
 * Validação dos arquivos de uma nota da Central (PDF × faturamento anexado),
 * usando exatamente os parsers e o cálculo central do SIGA.
 * Este módulo é empacotado para o servidor (supabase/functions/_shared/siga-validador.generated.js).
 *
 * Composição com vários arquivos (nunca soma só por estarem anexados juntos):
 * - sem bloco do CNPJ do tomador → "nao_pertinente" (ignorado);
 * - conteúdo idêntico (hash) → "duplicado" (contado uma vez); valores iguais em arquivos distintos = ambíguo;
 * - com mensalidade → "principal" (no máximo um; sem mensalidade, a primeira planilha pertinente é a base);
 * - retroativo com mesma competência, quantidade e valor do já contido → "retroativo_incluido" (não soma);
 *   de outra competência → soma; sem detalhamento por competência → ambíguo;
 * - só categorias ausentes no principal → "complementar" (soma).
 * Qualquer outro caso fica "Validação inconclusiva" com a ambiguidade descrita.
 */
import { analisarExcelFinanceiroPorCnpj, compararExcelComPdf, type AnalisePorCnpj } from "./excel-analysis-utils";
import { analisarPdfFinanceiro, extrairTextoPdf } from "./pdf-analysis-utils";
import { conferirIdentidadeFiscal, type IdentidadeEsperada, type IdentidadeFiscal } from "./nfse-identidade-fiscal";
export { conferirIdentidadeFiscal };
import { somarTotalFaturamento } from "./faturamento-totais";
import { sumPdfTotal } from "./pdf-total";

export type PapelArquivo = "principal" | "complementar" | "retroativo_incluido" | "duplicado" | "nao_pertinente" | "ilegivel";
export interface ArquivoComposicao { id: string; nome: string; papel: PapelArquivo; valor: number | null; duplicadoDe?: string; observacao?: string }
export interface PlanilhaEntrada { id: string; nome: string; dados: ArrayBuffer }

export interface ResultadoArquivosCentral {
  leituraOk: boolean;
  motivo: string | null;
  valorExcel: number | null;
  valorPdf: number | null;
  /** Valor fiscal bruto do serviço lido na NFS-e (nunca o líquido). */
  valorServico: number | null;
  comparacao: ReturnType<typeof compararExcelComPdf> | null;
  tomadorPdf: string | null;
  arquivos: ArquivoComposicao[];
  /** Identidade fiscal lida do próprio PDF (null quando não solicitada). */
  identidade: IdentidadeFiscal | null;
  contextoDocumento?: { competenciaDescricao: string | null; competenciaMovimentacao: string | null; impedimento: string | null } | null;
}

const c = (v: unknown) => Math.round((Number(v) || 0) * 100);
const CATS_EXTRA = ["exclusoes", "devolucoes", "permuta", "taxaAdesao", "coparticipacao", "complemento"] as const;

function temMensalidade(b: AnalisePorCnpj) {
  return c(b.enfermaria?.total) !== 0 || c(b.apartamento?.total) !== 0
    || (b.enfermaria?.beneficiarios ?? 0) > 0 || (b.apartamento?.beneficiarios ?? 0) > 0;
}
const retro = (b: AnalisePorCnpj) => c(b.retroativas?.total);
/** Bloco cujo único conteúdo é cobrança retroativa (inclusões = retroativos). */
function soRetroativo(b: AnalisePorCnpj) {
  return !temMensalidade(b) && retro(b) !== 0 && c(b.inclusoes?.total) === retro(b)
    && CATS_EXTRA.every((k) => c((b as any)[k]?.total) === 0);
}
function impressao(b: AnalisePorCnpj) {
  return JSON.stringify([b.enfermaria, b.apartamento, b.inclusoes?.total, b.inclusoes?.quantidade, retro(b),
    ...CATS_EXTRA.map((k) => [(b as any)[k]?.total ?? null, (b as any)[k]?.quantidade ?? null])]);
}
async function sha(buf: ArrayBuffer) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join("");
}
const brl = (n: number) => n.toFixed(2).replace(".", ",");

/** Detalhe por mês de um retroativo: "MÊS|qtd|centavos". Vazio = sem evidência de lançamentos. */
function detalheRetro(b: AnalisePorCnpj): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of b.retroativas?.mesesDetalhe ?? []) m.set(d.mes, `${d.quantidade}|${c(d.total)}`);
  return m;
}
/** Categorias que o SIGA não lê na NFS-e: sem elas o valor fiscal comparado seria parcial. */
const SEM_LEITURA_FISCAL: Record<string, string> = {
  coparticipacao: "Coparticipação", complemento: "Complemento", permuta: "Permuta",
};

/** Decide a composição do faturamento do CNPJ a partir de todos os arquivos. Não lê o PDF. */
export async function comporFaturamento(planilhas: PlanilhaEntrada[], cnpjTomador: string): Promise<{
  bloco: AnalisePorCnpj | null; arquivos: ArquivoComposicao[]; ambiguidade: string | null;
}> {
  const arquivos: ArquivoComposicao[] = [];
  const unicos: { a: ArquivoComposicao; b: AnalisePorCnpj }[] = [];
  const hashes = new Map<string, string>();
  const falha = (m: string) => ({ bloco: null, arquivos, ambiguidade: m });

  for (const p of planilhas) {
    const h = await sha(p.dados);
    // Duplicidade só por conteúdo idêntico (hash). Valores iguais não bastam.
    if (hashes.has(h)) { arquivos.push({ id: p.id, nome: p.nome, papel: "duplicado", valor: null, duplicadoDe: hashes.get(h), observacao: "Arquivo idêntico (mesmo hash)." }); continue; }
    hashes.set(h, p.id);
    let blocos: AnalisePorCnpj[];
    try { blocos = await analisarExcelFinanceiroPorCnpj(p.dados); }
    catch { arquivos.push({ id: p.id, nome: p.nome, papel: "ilegivel", valor: null }); return falha(`Planilha “${p.nome}” ilegível; não é possível saber se compõe o faturamento.`); }
    const doPagador = blocos.filter((b) => (b.cnpj ?? "").replace(/\D/g, "") === cnpjTomador);
    if (!doPagador.length) { arquivos.push({ id: p.id, nome: p.nome, papel: "nao_pertinente", valor: null, observacao: "Sem bloco do CNPJ do tomador." }); continue; }
    if (doPagador.length > 1) { arquivos.push({ id: p.id, nome: p.nome, papel: "ilegivel", valor: null }); return falha(`Mais de um bloco do mesmo CNPJ na planilha “${p.nome}”.`); }
    const b = doPagador[0];
    const a: ArquivoComposicao = { id: p.id, nome: p.nome, papel: "complementar", valor: somarTotalFaturamento(b as any) };
    arquivos.push(a);
    const igual = unicos.find((u) => impressao(u.b) === impressao(b));
    if (igual) return falha(`“${p.nome}” e “${igual.a.nome}” são arquivos diferentes com os mesmos valores (${brl(a.valor!)}); sem evidência de que sejam os mesmos lançamentos, não é possível decidir entre duplicidade e duas cobranças.`);
    unicos.push({ a, b });
  }

  if (!unicos.length) return falha(planilhas.length ? "Nenhuma planilha anexada contém o CNPJ do tomador." : "Faturamento não anexado.");
  const principais = unicos.filter((u) => temMensalidade(u.b));
  if (principais.length > 1) return falha(`Planilhas com mensalidade para o mesmo CNPJ: ${principais.map((u) => `“${u.a.nome}” (${brl(u.a.valor!)})`).join(", ")}; não é possível saber se substituem ou complementam.`);
  // Sem mensalidade: cobranças só de outras categorias (inclusões, retroativos, exclusões…) são aceitas;
  // a base passa a ser a primeira planilha pertinente e as demais precisam ter categorias distintas.
  const pr = principais[0] ?? unicos[0]; pr.a.papel = "principal";
  if (!principais.length) pr.a.observacao = "Faturamento sem mensalidade.";
  const comp: any = structuredClone(pr.b);

  for (const u of unicos) {
    if (u === pr) continue;
    if (soRetroativo(u.b)) {
      if (retro(comp) === 0) {
        comp.inclusoes = { ...comp.inclusoes, quantidade: (comp.inclusoes?.quantidade ?? 0) + (u.b.inclusoes?.quantidade ?? 0), total: (c(comp.inclusoes?.total) + c(u.b.inclusoes.total)) / 100 };
        comp.retroativas = structuredClone(u.b.retroativas);
        u.a.observacao = "Retroativo ausente da planilha principal; somado às inclusões.";
        continue;
      }
      // Já existe retroativo na base: exige correspondência por competência, quantidade e valor.
      const base = detalheRetro(comp), arq = detalheRetro(u.b);
      if (!base.size || !arq.size)
        return falha(`Retroativo de “${u.a.nome}” (${brl(retro(u.b) / 100)}) e retroativo já presente (${brl(retro(comp) / 100)}) sem detalhamento por competência; não é possível comprovar se é o mesmo lançamento ou outra cobrança.`);
      const meses = [...arq.keys()];
      if (meses.every((m) => base.get(m) === arq.get(m))) {
        u.a.papel = "retroativo_incluido";
        u.a.observacao = `Retroativo de ${meses.join(", ")} com mesma quantidade e valor já contido nas inclusões da planilha principal; não somado.`;
        continue;
      }
      if (meses.every((m) => !base.has(m))) {
        comp.inclusoes = { ...comp.inclusoes, quantidade: (comp.inclusoes?.quantidade ?? 0) + (u.b.inclusoes?.quantidade ?? 0), total: (c(comp.inclusoes?.total) + c(u.b.inclusoes.total)) / 100 };
        comp.retroativas = { ...comp.retroativas, quantidade: (comp.retroativas.quantidade ?? 0) + (u.b.retroativas!.quantidade ?? 0), total: (retro(comp) + retro(u.b)) / 100,
          mesesDetalhe: [...(comp.retroativas.mesesDetalhe ?? []), ...(u.b.retroativas!.mesesDetalhe ?? [])] };
        u.a.observacao = `Retroativo de outra competência (${meses.join(", ")}); cobrança distinta, somada.`;
        continue;
      }
      return falha(`Retroativo de “${u.a.nome}” coincide parcialmente com o da planilha principal (${meses.join(", ")}); não é possível separar o que já está incluído.`);
    }
    const cats = ["inclusoes", ...CATS_EXTRA].filter((k) => c((u.b as any)[k]?.total) !== 0);
    const sobrepostas = cats.filter((k) => c(comp[k]?.total) !== 0);
    if (temMensalidade(u.b) || sobrepostas.length || !cats.length) return falha(sobrepostas.length || temMensalidade(u.b)
      ? `“${u.a.nome}” repete categorias já presentes (${sobrepostas.join(", ") || "mensalidade"}); não é possível saber se é complemento ou substituição.`
      : `“${u.a.nome}” não tem valores identificáveis para o CNPJ.`);
    for (const k of cats) comp[k] = { ...(u.b as any)[k] };
    if (retro(u.b) !== 0) comp.retroativas = { ...u.b.retroativas };
  }
  delete comp.totalDeclaradoExcel; // total declarado de um único arquivo não vale para a composição
  return { bloco: comp as AnalisePorCnpj, arquivos, ambiguidade: null };
}

export async function validarArquivosCentral(i: {
  pdf: ArrayBuffer; planilhas: PlanilhaEntrada[]; cnpjTomador: string; tipoAnalise?: string | null; identidade?: IdentidadeEsperada;
  contexto?: { competencia: string | null; periodo: string | null };
}): Promise<ResultadoArquivosCentral> {
  let identidade: IdentidadeFiscal | null = null;
  if (i.identidade) {
    let texto = "";
    try { texto = await extrairTextoPdf(i.pdf); } catch { texto = ""; }
    identidade = conferirIdentidadeFiscal(texto, i.identidade);
  }
  const { bloco, arquivos, ambiguidade } = await comporFaturamento(i.planilhas, i.cnpjTomador);
  const vazio = (motivo: string): ResultadoArquivosCentral => ({ leituraOk: false, motivo, valorExcel: null, valorPdf: null, valorServico: null, comparacao: null, tomadorPdf: null, arquivos, identidade, contextoDocumento: null });
  if (!bloco) return vazio(ambiguidade ?? "Composição indeterminada.");
  const naoLidas = Object.entries(SEM_LEITURA_FISCAL).filter(([k]) => c((bloco as any)[k]?.total) !== 0)
    .map(([k, r]) => `${r} ${brl((bloco as any)[k].total)}`);
  if (naoLidas.length)
    return vazio(`Faturamento com ${naoLidas.join(", ")}: o SIGA não lê esse valor na NFS-e, então o total fiscal seria parcial; não comparado (nem com o valor líquido).`);

  const pdf = await analisarPdfFinanceiro(i.pdf);
  if (pdf.avisos.some((a) => /falha ao abrir/i.test(a))) return vazio("PDF ilegível.");
  const cmp = compararExcelComPdf(bloco as any, { ...pdf, arquivo: "central.pdf" } as any, i.tipoAnalise);
  cmp.tomadorCnpj = pdf.tomadorCnpj ?? null;
  const valorPdf = sumPdfTotal(cmp);
  const valorExcel = somarTotalFaturamento(bloco as any);
  const valorServico = pdf.tributos?.valorServico ?? null;
  const leituraOk = valorPdf != null && valorServico != null && !!pdf.tomadorCnpj;
  const competenciaDescricao = pdf.competenciaDescricao ?? null;
  const competenciaMovimentacao = i.contexto?.competencia ?? null;
  // Regra do Financeiro: a movimentação pode ser feita no mês anterior ao faturamento/nota.
  // A diferença é apenas registrada (sem deslocamento automático e sem bloquear a aprovação).
  const impedimento: string | null = null;
  return {
    contextoDocumento: { competenciaDescricao, competenciaMovimentacao, impedimento },
    leituraOk, motivo: leituraOk ? null : valorServico == null && valorPdf != null && pdf.tomadorCnpj
      ? "Valor do serviço (bruto) não encontrado na NFS-e; o descritivo sozinho não é aceito."
      : "PDF incompleto: tomador ou valores não encontrados.",
    valorExcel, valorPdf, valorServico, comparacao: cmp, tomadorPdf: pdf.tomadorCnpj ?? null, arquivos, identidade,
  };
}
