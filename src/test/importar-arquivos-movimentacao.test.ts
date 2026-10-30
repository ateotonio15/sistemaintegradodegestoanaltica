import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importarArquivosMovimentacao } from "@/services/importarArquivosMovimentacao";
import { gerarRelatorioPortal, type ArquivoPortal } from "@/services/portalEmpresaRelatorios";

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
  it("busca PDF e Excel do contrato e anexa ambos sem download no computador", async () => {
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => arquivo(tipo));
    const anexar = vi.fn().mockResolvedValue(undefined);
    const encontrados = vi.fn();
    const resultado = await importarArquivosMovimentacao(contexto, new AbortController().signal, anexar, encontrados);
    expect(gerarRelatorioPortal).toHaveBeenCalledWith(2171, "pdf", expect.any(AbortSignal));
    expect(gerarRelatorioPortal).toHaveBeenCalledWith(2171, "xlsx", expect.any(AbortSignal));
    expect(anexar).toHaveBeenCalledTimes(2);
    expect(encontrados).toHaveBeenCalledWith(2);
    expect(resultado).toEqual({ encontrados: 2, anexados: 2, ignorados: 0, falhas: 0 });
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
    expect(resultado).toEqual({ encontrados: 1, anexados: 1, ignorados: 0, falhas: 1 });
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
    expect(resultado).toEqual({ encontrados: 2, anexados: 1, ignorados: 1, falhas: 0 });
  });
});