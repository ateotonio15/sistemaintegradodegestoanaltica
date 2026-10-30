import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImportarArquivosButton } from "@/components/movimentacoes/ImportarArquivosButton";
import { importarArquivosMovimentacao } from "@/services/importarArquivosMovimentacao";
const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/services/importarArquivosMovimentacao", () => ({ importarArquivosMovimentacao: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => ({
  insert, select: () => ({ eq: () => ({ single: async () => ({ data: table === "movimentacoes"
    ? { empresa_id: "empresa", mes_referencia: "2026-10", periodo: "05-10" }
    : { codigo_contrato: "2487", nome: "SABIN" }, error: null }) }) }),
}) } }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("permite continuar sem Excel e registra a pendência antes do salvamento existente", async () => {
  vi.mocked(importarArquivosMovimentacao).mockResolvedValue({ encontrados: 1, anexados: 1, ignorados: 0, falhas: 1, documentos: [{ tipo: "pdf", disponivel: true }, { tipo: "xlsx", disponivel: false }] });
  insert.mockResolvedValue({ error: null });
  const concluir = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><ImportarArquivosButton movimentacaoId="mov" empresaId="empresa" mes="2026-10" periodo="05-10" disabled={false} onBusy={vi.fn()} onImportar={vi.fn()} onConcluir={concluir} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Preparar fechamento" }));
  fireEvent.click(await screen.findByRole("button", { name: "Continuar mesmo assim" }));
  await waitFor(() => expect(concluir).toHaveBeenCalledTimes(1));
  expect(insert).toHaveBeenCalledWith({ movimentacao_id: "mov", evento: "continuacao_pendente", pendencias: ["OPS Mensalidades - Excel"] });
  expect(insert.mock.invocationCallOrder[0]).toBeLessThan(concluir.mock.invocationCallOrder[0]);
});
it("conclui com os dois documentos sem inventar evento de pendência", async () => {
  vi.mocked(importarArquivosMovimentacao).mockResolvedValue({ encontrados: 2, anexados: 2, ignorados: 0, falhas: 0, documentos: [{ tipo: "pdf", disponivel: true }, { tipo: "xlsx", disponivel: true }] });
  const concluir = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><ImportarArquivosButton movimentacaoId="mov" empresaId="empresa" disabled={false} onBusy={vi.fn()} onImportar={vi.fn()} onConcluir={concluir} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Preparar fechamento" }));
  fireEvent.click(await screen.findByRole("button", { name: "Concluir", exact: true }));
  expect(concluir).toHaveBeenCalledTimes(1);
  expect(insert).not.toHaveBeenCalled();
});