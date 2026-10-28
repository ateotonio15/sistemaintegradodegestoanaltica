// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { validarArquivoContrato, validarContratoPortal, baixarRelatorioPortal } from "../../supabase/functions/_shared/portal-empresa-relatorios";
import { gerarRelatorioPortal, gerarRelatoriosPortal } from "@/services/portalEmpresaRelatorios";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const job = { job_id: "job-2192", nr_contrato: 2192, tipo: "xlsx" as const };
const resposta = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
describe("relatórios vinculados exclusivamente ao contrato da linha", () => {
  it("aceita somente inteiro positivo de CÓD. CONTRATO", () => {
    expect(validarContratoPortal("2490")).toBe(2490);
    for (const valor of [null, "", 0, -1, "2192abc", 2.5, "2e3", true]) expect(() => validarContratoPortal(valor)).toThrow();
  });
  it("confere exatamente o marcador _Contrato_2192_", () => {
    expect(() => validarArquivoContrato(2192, job, "Mensalidades_Contrato_2192_20261028_0850.xlsx")).not.toThrow();
    for (const nome of ["Mensalidades_Contrato_2194_20261028.xlsx", "Mensalidades_Contrato_21920_20261028.xlsx", "Mensalidades_Contrato_02192_20261028.xlsx", "Mensalidades.xlsx", "Mensalidades_Contrato_2192_a_Contrato_2194_b.xlsx"]) expect(() => validarArquivoContrato(2192, job, nome)).toThrow();
  });
  it("bloqueia um trabalho de 2192 quando a linha é 2490", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(baixarRelatorioPortal(2490, job)).rejects.toThrow("divergente");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("não baixa arquivo retornado para outro contrato", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta({ success: true, job_id: job.job_id, status: "concluido", nome_arquivo: "Mensalidades_Contrato_2194_20261028.xlsx" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(baixarRelatorioPortal(2192, job)).rejects.toThrow("bloqueado");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("gera os dois relatórios com payload exclusivo da linha 2490", async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        const body = JSON.parse(String(options.body));
        const tipo = body.path.includes("excel") ? "xlsx" : "pdf";
        return resposta({ success: true, job_id: `job-${tipo}`, status: "processando" });
      }
      const tipo = url.includes("job-xlsx") ? "xlsx" : "pdf";
      if (url.endsWith("/download")) return new Response(tipo === "pdf" ? "%PDF-1.7\n" : new Uint8Array([0x50, 0x4b, 3, 4, 0]));
      return resposta({ success: true, job_id: `job-${tipo}`, status: "concluido", nome_arquivo: `Relatorio_Contrato_2490_20261028.${tipo}` });
    });
    vi.stubGlobal("fetch", fetchMock);
    const arquivos = await gerarRelatoriosPortal("2490", new AbortController().signal);
    expect(arquivos.map(a => [a.nr_contrato, a.tipo])).toEqual([[2490, "pdf"], [2490, "xlsx"]]);
    const posts = fetchMock.mock.calls.filter(([, o]) => o?.method === "POST");
    expect(posts).toHaveLength(2);
    for (const [, options] of posts) expect(JSON.parse(String(options?.body)).payload).toEqual({ nr_contrato: 2490 });
  });
  it("cancela polling anterior antes de qualquer download", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async () => resposta({ success: true, job_id: "job-antigo", status: "processando" }));
    vi.stubGlobal("fetch", fetchMock);
    const promise = gerarRelatorioPortal("2192", "pdf", controller.signal);
    const rejeicao = expect(promise).rejects.toThrow();
    await new Promise(resolve => setTimeout(resolve, 20));
    controller.abort();
    await rejeicao;
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/download"))).toBe(false);
  });
  it("rejeita resposta de outro job mesmo com contrato igual", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta({ success: true, job_id: "outro-job", status: "concluido", nome_arquivo: "Mensalidades_Contrato_2192_20261028.xlsx" })));
    await expect(baixarRelatorioPortal(2192, job)).rejects.toThrow("outra geração");
  });
});
import { ultimaPaginaDoContrato } from "@/lib/relatorio-resumo-contrato";
describe("resumo da última página", () => {
  it("aceita só o contrato da linha", () => {
    expect(ultimaPaginaDoContrato("CONTRATANTE : AMAZONAS CONTRATO : 2192", "2192")).toBe(true);
    expect(ultimaPaginaDoContrato("CONTRATANTE : ADATA CONTRATO : 2490", "2192")).toBe(false);
  });
});
