import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportarDoRepositorioButton } from "@/components/movimentacoes/ImportarDoRepositorioButton";
import { buscarArquivosRepositorio, carregarArquivoRepositorio, conferirContextoRepositorio } from "@/services/importarDoRepositorio";
vi.mock("@/services/importarDoRepositorio", () => ({ buscarArquivosRepositorio: vi.fn(), carregarArquivoRepositorio: vi.fn(), conferirContextoRepositorio: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ single: async () => ({ data: { codigo_contrato: "2171" }, error: null }) }) }) }) }) } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("AbortController", class extends AbortController {
    constructor() { super(); this.signal.throwIfAborted = () => { if (this.signal.aborted) throw new Error("Cancelado"); }; }
  });
  vi.mocked(conferirContextoRepositorio).mockResolvedValue("IMPERIO");
  vi.mocked(buscarArquivosRepositorio).mockResolvedValue([{ id: "atual", tipo_relatorio: "Relatório de Vidas", nome_arquivo: "Vidas_Contrato_2171_20261030.pdf", versao: 2 } as Awaited<ReturnType<typeof buscarArquivosRepositorio>>[number]]);
  vi.mocked(carregarArquivoRepositorio).mockResolvedValue({ job_id: "atual", nr_contrato: 2171, tipo: "pdf", nome_arquivo: "Vidas_Contrato_2171_20261030.pdf", blob: new Blob(["%PDF-"]) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const abrir = (onImportar: ReturnType<typeof vi.fn>) => {
  render(<ImportarDoRepositorioButton movimentacaoId="mov" empresaId="empresa" mes="2026-10" periodo="20-25" disabled={false} onBusy={vi.fn()} onImportar={onImportar} />);
  fireEvent.click(screen.getByRole("button", { name: "Importar do Repositório" }));
};
it("consultar e cancelar não carrega nem anexa arquivos", async () => {
  const anexar = vi.fn(); abrir(anexar);
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
  expect(carregarArquivoRepositorio).not.toHaveBeenCalled();
  expect(anexar).not.toHaveBeenCalled();
});
it("anexa somente depois de confirmar e reconferir as versões atuais", async () => {
  const anexar = vi.fn(); abrir(anexar);
  fireEvent.click(await screen.findByRole("button", { name: "Importar arquivos", exact: true }));
  await waitFor(() => expect(anexar).toHaveBeenCalledTimes(1));
  expect(buscarArquivosRepositorio).toHaveBeenCalledTimes(2);
  expect(conferirContextoRepositorio).toHaveBeenCalledTimes(2);
});
it("versão trocada entre consulta e confirmação impede anexação", async () => {
  const anexar = vi.fn(); abrir(anexar);
  const confirmar = await screen.findByRole("button", { name: "Importar arquivos", exact: true });
  vi.mocked(buscarArquivosRepositorio).mockResolvedValue([]);
  fireEvent.click(confirmar);
  await waitFor(() => expect(buscarArquivosRepositorio).toHaveBeenCalledTimes(2));
  expect(anexar).not.toHaveBeenCalled();
  expect(carregarArquivoRepositorio).not.toHaveBeenCalled();
});