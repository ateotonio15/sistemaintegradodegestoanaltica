import { describe, expect, it, vi } from "vitest";
import { selecionarArquivosRepositorio } from "@/services/importarDoRepositorio";
import type { ArquivoEnvio } from "@/lib/repositorio-envios";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const contexto = { movimentacaoId: "mov", empresaId: "empresa", contrato: "2171", mes: "2026-10", periodo: "20-25" };
const arquivo = (parte: Partial<ArquivoEnvio> = {}): ArquivoEnvio => ({
  id: "v2", envio_id: "envio", movimentacao_id: "mov", empresa_id: "empresa", contrato: "2171", competencia: "2026-10", periodo: "20-25",
  nome_arquivo: "Vidas_Contrato_2171_20261030.pdf", bucket: "arquivos-envios", storage_path: "arquivo", mime_type: "application/pdf", tamanho_bytes: 100,
  tipo_relatorio: "Relatório de Vidas", enviado_por: "usuario", enviado_nome: "Usuário", enviado_em: "2026-10-30T13:00:00Z", origem: "Envio automático por e-mail", versao: 2, status: "Atual", ...parte,
});
describe("importar do repositório", () => {
  it("usa v2 atual, nunca substituído, removido ou anterior", () => {
    const rows = [arquivo({ id: "v1", versao: 1, status: "Substituído" }), arquivo(), arquivo({ id: "removido", status: "removido", versao: 3 }), arquivo({ id: "anterior", status: "anterior", versao: 4 })];
    expect(selecionarArquivosRepositorio(rows, contexto).map(a => a.id)).toEqual(["v2"]);
    expect(rows).toHaveLength(4);
  });
  it.each([
    { empresa_id: "outra" }, { contrato: "2490" }, { competencia: "2026-11" }, { periodo: "15-20" }, { periodo: null },
  ])("exclui contexto divergente %j", parte => {
    expect(selecionarArquivosRepositorio([arquivo(parte)], contexto)).toEqual([]);
  });
  it("período sem valor corresponde somente a período sem valor", () => {
    expect(selecionarArquivosRepositorio([arquivo(), arquivo({ id: "sem", periodo: null })], { ...contexto, periodo: null }).map(a => a.id)).toEqual(["sem"]);
  });
  it("prioriza Vidas PDF e OPS Excel, incluindo outros arquivos atuais", () => {
    expect(selecionarArquivosRepositorio([arquivo({ id: "outro", tipo_relatorio: "Comprovante", nome_arquivo: "Comprovante_Contrato_2171_20261030.png" }), arquivo({ id: "excel", tipo_relatorio: "OPS Mensalidades", nome_arquivo: "OPS_Contrato_2171_20261030.xlsx" }), arquivo()], contexto).map(a => a.id)).toEqual(["v2", "excel", "outro"]);
  });
  it("evita duplicar o mesmo documento e usa a maior versão atual", () => {
    expect(selecionarArquivosRepositorio([arquivo({ id: "v1", versao: 1, status: "atual" }), arquivo()], contexto).map(a => a.id)).toEqual(["v2"]);
  });
});