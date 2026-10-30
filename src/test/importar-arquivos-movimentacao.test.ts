import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importarArquivosMovimentacao } from "@/services/importarArquivosMovimentacao";
import { gerarRelatorioPortal, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";
import { consultarDocumentoFechamento } from "@/services/documentosFechamento";

vi.mock("@/services/documentosFechamento", () => ({ consultarDocumentoFechamento: vi.fn() }));

vi.mock("@/services/portalEmpresaRelatorios", async original => ({
  ...await original<typeof import("@/services/portalEmpresaRelatorios")>(), gerarRelatorioPortal: vi.fn(),
}));
const contexto = { movimentacaoId: "mov", empresaId: "empresa", contrato: "2171", mes: "2026-10", periodo: "05-10" };
const arquivo = (tipo: "pdf" | "xlsx", contrato = 2171): ArquivoPortal => ({
  job_id: `job-${tipo}`, nr_contrato: contrato, tipo, nome_arquivo: `OPS_Contrato_${contrato}_20261030.${tipo}`,
  blob: new Blob([tipo === "pdf" ? "%PDF-1.7" : "PK"]),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("AbortController", class extends AbortController {
    constructor() { super(); this.signal.throwIfAborted = () => { if (this.signal.aborted) throw new DOMException("Cancelado", "AbortError"); }; }
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("importação de arquivos na movimentação", () => {
  it("no fechamento usa a versão atual v2 do repositório sem gerar relatórios", async () => {
    vi.mocked(consultarDocumentoFechamento).mockImplementation(async (_, tipo) => ({ ...arquivo(tipo), repositorio_envio_id: `atual-${tipo}`, versao_repositorio: 2 }));
    const anexar = vi.fn();
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, vi.fn(), true);
    expect(gerarRelatorioPortal).not.toHaveBeenCalled();
    expect(anexar.mock.calls.map(([a]) => a.versao_repositorio)).toEqual([2, 2]);
    expect(resultado.anexados).toBe(2);
    expect(consultarDocumentoFechamento).toHaveBeenCalledWith(contexto, "pdf", expect.any(AbortSignal));
  });
  it("busca somente o Excel ausente e registra antes de anexar", async () => {
    vi.mocked(consultarDocumentoFechamento).mockImplementation(async (_, tipo, __, job) => tipo === "pdf" || job ? arquivo(tipo) : null);
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => arquivo(tipo));
    const anexar = vi.fn();
    await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, vi.fn(), true);
    expect(gerarRelatorioPortal).toHaveBeenCalledTimes(1);
    expect(gerarRelatorioPortal).toHaveBeenCalledWith(2171, "xlsx", expect.any(AbortSignal));
    expect(consultarDocumentoFechamento).toHaveBeenCalledWith(contexto, "xlsx", expect.any(AbortSignal), "job-xlsx");
    expect(vi.mocked(consultarDocumentoFechamento).mock.invocationCallOrder[2]).toBeLessThan(anexar.mock.invocationCallOrder[0]);
  });
  it("erro no repositório não dispara nova geração", async () => {
    vi.mocked(consultarDocumentoFechamento).mockRejectedValue(new Error("Sem acesso"));
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, vi.fn(), vi.fn(), true);
    expect(gerarRelatorioPortal).not.toHaveBeenCalled();
    expect(resultado.falhas).toBe(2);
  });
  it("documento obtido mas não registrado fica pendente e não é anexado", async () => {
    vi.mocked(consultarDocumentoFechamento).mockImplementation(async (_, __, ___, job) => { if (job) throw new Error("Falha ao registrar"); return null; });
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => arquivo(tipo));
    const anexar = vi.fn();
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, vi.fn(), true);
    expect(anexar).not.toHaveBeenCalled();
    expect(resultado.documentos.every(d => !d.disponivel)).toBe(true);
  });
  it("busca PDF e Excel do contrato e anexa ambos sem download no computador", async () => {
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => arquivo(tipo));
    const anexar = vi.fn().mockResolvedValue(undefined);
    const encontrados = vi.fn();
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, encontrados);
    expect(gerarRelatorioPortal).toHaveBeenCalledWith(2171, "pdf", expect.any(AbortSignal));
    expect(gerarRelatorioPortal).toHaveBeenCalledWith(2171, "xlsx", expect.any(AbortSignal));
    expect(anexar).toHaveBeenCalledTimes(2);
    expect(encontrados).toHaveBeenCalledWith(2);
    expect(resultado).toMatchObject({ encontrados: 2, anexados: 2, ignorados: 0, falhas: 0 });
    expect(resultado.documentos).toEqual([{ tipo: "pdf", disponivel: true }, { tipo: "xlsx", disponivel: true }]);
  });
  it("não cria anexos quando nenhum relatório é retornado", async () => {
    vi.mocked(gerarRelatorioPortal).mockRejectedValue(new Error("Indisponível"));
    const anexar = vi.fn();
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, vi.fn());
    expect(anexar).not.toHaveBeenCalled();
    expect(resultado.encontrados).toBe(0);
  });
  it("anexa o PDF disponível mesmo se o Excel falhar", async () => {
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => { if (tipo === "xlsx") throw new Error("Ausente"); return arquivo(tipo); });
    const anexar = vi.fn().mockResolvedValue(undefined);
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, vi.fn());
    expect(anexar).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ encontrados: 1, anexados: 1, ignorados: 0, falhas: 1 });
    expect(resultado.documentos).toEqual([{ tipo: "pdf", disponivel: true }, { tipo: "xlsx", disponivel: false }]);
  });
  it("bloqueia todos os anexos quando um arquivo pertence a outro contrato", async () => {
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => arquivo(tipo, tipo === "pdf" ? 2171 : 2490));
    const anexar = vi.fn();
    await expect(importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, vi.fn())).rejects.toThrow("não pertence");
    expect(anexar).not.toHaveBeenCalled();
  });
  it("descarta resultados quando a janela muda durante a busca", async () => {
    const controller = new AbortController();
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => { controller.abort(); return arquivo(tipo); });
    const anexar = vi.fn();
    await expect(importarArquivosMovimentacao(contexto, controller.signal, anexar, vi.fn())).rejects.toThrow();
    expect(anexar).not.toHaveBeenCalled();
  });
  it("contabiliza um arquivo ignorado sem afirmar que foi anexado", async () => {
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => arquivo(tipo));
    const anexar = vi.fn().mockResolvedValueOnce("ignorado").mockResolvedValueOnce(undefined);
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, vi.fn());
    expect(resultado).toMatchObject({ encontrados: 2, anexados: 1, ignorados: 1, falhas: 0 });
    expect(resultado.documentos.every(item => item.disponivel)).toBe(true);
  });
  it("mantém pendência quando o arquivo é encontrado mas a anexação falha", async () => {
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => arquivo(tipo));
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, vi.fn().mockRejectedValue(new Error("Falha ao gravar")), vi.fn());
    expect(resultado.documentos).toEqual([{ tipo: "pdf", disponivel: false }, { tipo: "xlsx", disponivel: false }]);
    expect(resultado.anexados).toBe(0);
  });
});