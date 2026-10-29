import { supabase } from "@/integrations/supabase/client";
import { gerarResumoUltimaPaginaPdf } from "@/lib/relatorio-resumo-pdf";
import { contratosAnexosDoGrupo, papelGrupoRelatorio, type PapelGrupoRelatorio } from "@/lib/relatorio-grupo";
import { gerarRelatoriosPortal, validarArquivoContrato, type ArquivoPortal } from "./portalEmpresaRelatorios";

/** Lê do banco o papel do contrato no grupo financeiro e, se for o principal, os contratos que vão junto. */
export async function buscarGrupoRelatorio(empresaId: string | null | undefined, contratoPrincipal: string | null): Promise<{ papel: PapelGrupoRelatorio; nomeGrupo: string | null; contratos: number[] }> {
  if (!empresaId) return { papel: "sem_grupo", nomeGrupo: null, contratos: [] };
  const { data: vinculo, error } = await supabase.from("grupos_financeiros_contratos" as any)
    .select("grupo_id, grupos_financeiros(nome_grupo, status, contrato_principal_empresa_id)")
    .eq("empresa_id", empresaId).eq("ativo", true).maybeSingle();
  if (error) throw error;
  const g = (vinculo as any)?.grupos_financeiros;
  if (!g || g.status !== "Ativo") return { papel: "sem_grupo", nomeGrupo: null, contratos: [] };
  const papel = papelGrupoRelatorio(empresaId, { principal_empresa_id: g.contrato_principal_empresa_id ?? null });
  if (papel !== "principal") return { papel, nomeGrupo: g.nome_grupo, contratos: [] };
  const { data: membros, error: e2 } = await supabase.from("grupos_financeiros_contratos" as any)
    .select("empresa_id, empresas(codigo_contrato)").eq("grupo_id", (vinculo as any).grupo_id).eq("ativo", true);
  if (e2) throw e2;
  const contratos = contratosAnexosDoGrupo(contratoPrincipal, ((membros as any[]) ?? []).map(m => ({ contrato: m?.empresas?.codigo_contrato })));
  return { papel, nomeGrupo: g.nome_grupo, contratos };
}

export async function enviarRelatoriosPortal({ movimentacaoId, empresaId, contrato, destinatarios, cc = [], arquivos, lote = false, onProgresso }: {
  movimentacaoId: string; empresaId?: string | null; contrato: string | null; destinatarios: string[]; cc?: string[]; arquivos: ArquivoPortal[]; lote?: boolean; onProgresso?: (msg: string) => void;
}) {
  if (arquivos.length !== 2 || !arquivos.some(a => a.tipo === "pdf") || !arquivos.some(a => a.tipo === "xlsx")) throw new Error("Aguarde o PDF e o Excel da empresa selecionada.");
  arquivos.forEach(a => validarArquivoContrato(contrato, a, a.nome_arquivo));
  const grupo = await buscarGrupoRelatorio(empresaId, contrato);
  if (grupo.papel === "membro") throw new Error(`Este contrato faz parte do grupo "${grupo.nomeGrupo}". O relatório vai no e-mail do contrato principal.`);
  // Relatórios dos outros contratos do grupo: cada um gerado e conferido pelo próprio número.
  const grupoArquivos: ArquivoPortal[] = [];
  for (const c of grupo.contratos) {
    onProgresso?.(`Gerando relatório do contrato #${c} do grupo...`);
    const docs = await gerarRelatoriosPortal(String(c), new AbortController().signal);
    docs.forEach(a => validarArquivoContrato(String(c), a, a.nome_arquivo));
    grupoArquivos.push(...docs);
  }
  onProgresso?.("Enviando e-mail...");
  let resumo_png_base64: string | null = null;
  const pdf = arquivos.find(a => a.tipo === "pdf");
  // Resumo gerado do PDF desta empresa; se a última página for de outro contrato, o envio é bloqueado.
  if (pdf) resumo_png_base64 = await gerarResumoUltimaPaginaPdf(new Uint8Array(await pdf.blob.arrayBuffer()), contrato);
  // Apenas referências de trabalhos: o servidor consulta o contrato cadastrado e baixa os arquivos novamente.
  const { data, error } = await supabase.functions.invoke("enviar-relatorio-email", { body: {
    movimentacao_id: movimentacaoId, destinatarios, cc, lote,
    portal_jobs: arquivos.map(({ job_id, nr_contrato, tipo }) => ({ job_id, nr_contrato, tipo })),
    grupo_jobs: grupoArquivos.map(({ job_id, nr_contrato, tipo }) => ({ job_id, nr_contrato, tipo })),
    ...(resumo_png_base64 ? { resumo_png_base64 } : {}),
  } });
  if (error) {
    const response = (error as { context?: Response }).context;
    const msg = response ? (await response.json().catch(() => null))?.error : null;
    throw new Error(msg || error.message);
  }
  if (!data?.ok) throw new Error(data?.error || "Não foi possível enviar o e-mail.");
  if (!data.registro_salvo) throw new Error(data.aviso || "E-mail enviado, mas o registro não foi salvo. Confira antes de reenviar.");
  return data;
}
