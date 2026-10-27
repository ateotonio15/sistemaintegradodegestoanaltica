import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), storageFrom: vi.fn(), upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, storage: { from: mocks.storageFrom } } }));
import { anexarArquivoRelatorio } from "@/lib/relatorio-arquivos";

describe("arquivos exclusivos do relatório", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.single.mockResolvedValue({ data: { id: "arquivo" }, error: null });
    mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.storageFrom.mockReturnValue({ upload: mocks.upload, remove: mocks.remove });
  });
  it("anexa o PDF somente ao relatório, sem inserir em anexos operacionais", async () => {
    await anexarArquivoRelatorio("mov", "usuario", new File(["pdf"], "relatorio.pdf"));
    expect(mocks.from.mock.calls).toEqual([["movimentacao_relatorio_arquivos"]]);
    expect(mocks.storageFrom).toHaveBeenCalledWith("relatorios-movimentacoes");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ movimentacao_id: "mov", nome_arquivo: "relatorio.pdf", uploaded_by: "usuario" }));
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^mov\/usuario\/.+\.pdf$/);
  });
  it("não grava nem envia formato diferente de PDF ou Excel", async () => {
    await expect(anexarArquivoRelatorio("mov", "usuario", new File(["image"], "assinatura.png"))).rejects.toThrow("PDF ou Excel");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("remove o arquivo enviado quando o registro falha", async () => {
    mocks.single.mockResolvedValue({ data: null, error: new Error("negado") });
    await expect(anexarArquivoRelatorio("mov", "usuario", new File(["xlsx"], "vidas.xlsx"))).rejects.toThrow("negado");
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]]);
  });
});