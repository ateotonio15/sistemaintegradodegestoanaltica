import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReincidenciaPanel } from "@/components/plantoes/ReincidenciaPanel";

const mocks = vi.hoisted(() => ({ from: vi.fn(), inCpf: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/components/plantoes/AtendimentoDialog", () => ({
  parseAssunto: () => ({ tipo: "Consulta", canal: "Presencial", status: "Pendente" }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("histórico global de reincidência", () => {
  it("busca todas as páginas por CPF, sem filtro de empresa, e ordena pela data e hora do plantão", async () => {
    const antigos = Array.from({ length: 500 }, (_, i) => ({
      id: `antigo-${i}`, plantao: { data: "2026-09-01" }, hora: "08:00",
      created_at: "2026-10-13", assunto: "Consulta", observacao: "Anterior",
    }));
    const recente = { id: "recente", plantao: { data: "2026-10-13" }, hora: "14:10", created_at: "2026-10-01" };
    const builder = { select: vi.fn(), in: mocks.inCpf, order: vi.fn(), range: mocks.range };
    builder.select.mockReturnValue(builder);
    mocks.inCpf.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder);
    mocks.range.mockResolvedValueOnce({ data: antigos }).mockResolvedValueOnce({ data: [recente] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ReincidenciaPanel cpf="123.456.789-01" fillHeight /></QueryClientProvider>);
    await waitFor(() => expect(client.getQueryData<any[]>(["plantoes-reincidencia", "12345678901"])?.length).toBe(501));
    expect(mocks.from).toHaveBeenCalledWith("plantoes_atendimentos");
    expect(mocks.inCpf.mock.calls).toEqual([
      ["cpf", ["12345678901", "123.456.789-01"]],
      ["cpf", ["12345678901", "123.456.789-01"]],
    ]);
    expect(mocks.range.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect(client.getQueryData<any[]>(["plantoes-reincidencia", "12345678901"])?.[0].id).toBe("recente");
  });

  it("não consulta histórico antes de completar os 11 dígitos do CPF", () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ReincidenciaPanel cpf="1234567890" /></QueryClientProvider>);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});