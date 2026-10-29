// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { baixarRelatorioPortal, ErroCarregarArquivoPortal, validarArquivoContrato } from "../../supabase/functions/_shared/portal-empresa-relatorios";
const job = { job_id: "job-excel", nr_contrato: 2171, tipo: "xlsx" as const };
afterEach(() => vi.unstubAllGlobals());
describe("formatos disponíveis da integração", () => {
  it.each([
    ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [0x50, 0x4b, 3, 4]],
    ["xls", "application/vnd.ms-excel", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  ])("aceita %s com conteúdo e MIME próprios", async (extensao, mime, bytes) => {
    const nome = `OPS_Contrato_2171_20261029.${extensao}`;
    expect(() => validarArquivoContrato(2171, job, nome)).not.toThrow();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/download")
      ? new Response(new Uint8Array(bytes as number[]), { headers: { "Content-Type": String(mime) } })
      : new Response(JSON.stringify({ success: true, job_id: job.job_id, status: "concluido", nome_arquivo: nome }))));
    const arquivo = await baixarRelatorioPortal(2171, job);
    expect(arquivo.nome_arquivo).toBe(nome);
    expect(arquivo.blob.type).toBe(mime);
  });
  it("preserva a identificação do arquivo existente quando o download falha", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/download") ? new Response("", { status: 500 })
      : new Response(JSON.stringify({ success: true, job_id: job.job_id, status: "concluido", nome_arquivo: "OPS_Contrato_2171_20261029.xlsx" }))));
    const erro = await baixarRelatorioPortal(2171, job).catch(e => e);
    expect(erro).toBeInstanceOf(ErroCarregarArquivoPortal);
    expect(erro.arquivo.nome_arquivo).toBe("OPS_Contrato_2171_20261029.xlsx");
    expect(erro.message).toBe("Arquivo disponível, mas ocorreu erro ao carregar.");
  });
});