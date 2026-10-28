// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), resumo: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/lib/relatorio-resumo-pdf", () => ({ gerarResumoUltimaPaginaPdf: mocks.resumo }));
import { enviarRelatoriosPortal } from "@/services/enviarRelatoriosPortal";
const arquivos = [
  { job_id: "pdf-2490", nr_contrato: 2490, tipo: "pdf" as const, nome_arquivo: "Vidas_Contrato_2490_20261028.pdf", blob: new Blob(["%PDF-"]) },
  { job_id: "excel-2490", nr_contrato: 2490, tipo: "xlsx" as const, nome_arquivo: "Mensalidades_Contrato_2490_20261028.xlsx", blob: new Blob(["PK"]) },
];
beforeEach(() => { vi.clearAllMocks(); mocks.resumo.mockResolvedValue(null); mocks.invoke.mockResolvedValue({ data: { ok: true, registro_salvo: true }, error: null }); });
it("envia somente referências dos dois trabalhos de 2490 para nova validação no servidor", async () => {
  await enviarRelatoriosPortal({ movimentacaoId: "mov-adata", contrato: "2490", destinatarios: ["rh@example.com"], arquivos, lote: true });
  expect(mocks.invoke).toHaveBeenCalledWith("enviar-relatorio-email", { body: { movimentacao_id: "mov-adata", destinatarios: ["rh@example.com"], cc: [], lote: true, portal_jobs: [{ job_id: "pdf-2490", nr_contrato: 2490, tipo: "pdf" }, { job_id: "excel-2490", nr_contrato: 2490, tipo: "xlsx" }] } });
});
it("não invoca envio quando arquivo do contrato 2490 é apresentado na linha 2192", async () => {
  await expect(enviarRelatoriosPortal({ movimentacaoId: "mov-2192", contrato: "2192", destinatarios: ["rh@example.com"], arquivos })).rejects.toThrow("bloqueado");
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it("exige PDF e Excel e não aceita somente um relatório", async () => {
  await expect(enviarRelatoriosPortal({ movimentacaoId: "mov-adata", contrato: "2490", destinatarios: ["rh@example.com"], arquivos: [arquivos[0]] })).rejects.toThrow("PDF e o Excel");
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it("falha de SMTP não é tratada como envio concluído", async () => {
  mocks.invoke.mockResolvedValue({ data: { error: "Servidor de e-mail indisponível", falha_envio: true }, error: null });
  await expect(enviarRelatoriosPortal({ movimentacaoId: "mov-adata", contrato: "2490", destinatarios: ["rh@example.com"], arquivos })).rejects.toThrow("indisponível");
});