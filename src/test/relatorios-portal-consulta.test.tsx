import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { RelatoriosPortal } from "@/components/movimentacoes/RelatoriosPortal";
import { gerarRelatorioPortal, gerarRelatoriosPortal } from "@/services/portalEmpresaRelatorios";

vi.mock("@/services/portalEmpresaRelatorios", () => ({ gerarRelatorioPortal: vi.fn(), gerarRelatoriosPortal: vi.fn(), validarArquivoContrato: vi.fn() }));
vi.mock("@/components/movimentacoes/PortalPdfPreview", () => ({ PortalPdfPreview: () => null }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("consulta de relatório pela integração existente", () => {
  it("busca somente o PDF do contrato selecionado, sem depender do Excel", async () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:relatorio"), revokeObjectURL: vi.fn() });
    const pdf = { job_id: "job-2171", nr_contrato: 2171, tipo: "pdf" as const, nome_arquivo: "Vidas_Contrato_2171_20261029.pdf", blob: new Blob(["%PDF-1.7"]) };
    vi.mocked(gerarRelatorioPortal).mockResolvedValue(pdf);
    const onArquivos = vi.fn();
    render(<RelatoriosPortal contrato="2171" nome="Empresa" somenteConsulta onArquivos={onArquivos} onBusy={vi.fn()} />);
    await waitFor(() => expect(onArquivos).toHaveBeenLastCalledWith([pdf]));
    expect(gerarRelatorioPortal).toHaveBeenCalledWith("2171", "pdf", expect.any(AbortSignal));
    expect(gerarRelatoriosPortal).not.toHaveBeenCalled();
  });

  it("não disponibiliza arquivo inventado quando a API não retorna relatório", async () => {
    vi.mocked(gerarRelatorioPortal).mockRejectedValue(new Error("Arquivo não encontrado"));
    const onArquivos = vi.fn();
    const onBusy = vi.fn();
    render(<RelatoriosPortal contrato="2171" nome="Empresa" somenteConsulta onArquivos={onArquivos} onBusy={onBusy} />);
    await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(false));
    expect(onArquivos.mock.calls).toEqual([[[]]]);
  });
});