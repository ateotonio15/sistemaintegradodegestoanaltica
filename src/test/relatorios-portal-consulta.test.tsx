import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { RelatoriosPortal } from "@/components/movimentacoes/RelatoriosPortal";
import { gerarRelatorioPortal, gerarRelatoriosPortal } from "@/services/portalEmpresaRelatorios";

vi.mock("@/services/portalEmpresaRelatorios", async importOriginal => ({ ...await importOriginal<typeof import("@/services/portalEmpresaRelatorios")>(), gerarRelatorioPortal: vi.fn(), gerarRelatoriosPortal: vi.fn(), validarArquivoContrato: vi.fn() }));
vi.mock("@/components/movimentacoes/PortalPdfPreview", () => ({ PortalPdfPreview: () => null }));
beforeEach(() => { vi.stubGlobal("AbortController", class extends AbortController {
  constructor() { super(); this.signal.throwIfAborted = () => { if (this.signal.aborted) throw new Error("Abortado"); }; }
}); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("consulta de relatório pela integração existente", () => {
  it("preserva o PDF do contrato selecionado quando o Excel não está disponível", async () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:relatorio"), revokeObjectURL: vi.fn() });
    const pdf = { job_id: "job-2171", nr_contrato: 2171, tipo: "pdf" as const, nome_arquivo: "Vidas_Contrato_2171_20261029.pdf", blob: new Blob(["%PDF-1.7"]) };
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => { if (tipo === "pdf") return pdf; throw new Error("Excel ausente"); });
    const onArquivos = vi.fn();
    render(<RelatoriosPortal contrato="2171" nome="Empresa" somenteConsulta onArquivos={onArquivos} onBusy={vi.fn()} />);
    await waitFor(() => expect(onArquivos).toHaveBeenLastCalledWith([pdf]));
    expect(gerarRelatorioPortal).toHaveBeenCalledWith("2171", "pdf", expect.any(AbortSignal));
    expect(gerarRelatorioPortal).toHaveBeenCalledWith("2171", "xlsx", expect.any(AbortSignal));
    expect(gerarRelatoriosPortal).not.toHaveBeenCalled();
  });

  it("não disponibiliza arquivo inventado quando a API não retorna relatório", async () => {
    vi.mocked(gerarRelatorioPortal).mockRejectedValue(new Error("Arquivo não encontrado"));
    const onArquivos = vi.fn();
    const onBusy = vi.fn();
    render(<RelatoriosPortal contrato="2171" nome="Empresa" somenteConsulta onArquivos={onArquivos} onBusy={onBusy} />);
    await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(false));
    expect(onArquivos).toHaveBeenLastCalledWith([]);
  });
  it("mantém todos os arquivos disponíveis, incluindo Excel quando o PDF falha", async () => {
    const excel = { job_id: "job-excel", nr_contrato: 2171, tipo: "xlsx" as const, nome_arquivo: "OPS_Contrato_2171_20261029.xlsx", blob: new Blob(["PK"]) };
    vi.mocked(gerarRelatorioPortal).mockImplementation(async (_, tipo) => { if (tipo === "xlsx") return excel; throw new Error("PDF ausente"); });
    const onArquivos = vi.fn();
    render(<RelatoriosPortal contrato="2171" nome="Empresa" somenteConsulta onArquivos={onArquivos} onBusy={vi.fn()} />);
    await waitFor(() => expect(onArquivos).toHaveBeenLastCalledWith([excel]));
  });
});