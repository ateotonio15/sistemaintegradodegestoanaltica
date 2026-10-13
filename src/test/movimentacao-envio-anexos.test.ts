import { beforeEach, describe, expect, it, vi } from "vitest";
import { sincronizarEnvioDosAnexos } from "@/lib/movimentacao-envio-anexos";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
beforeEach(() => vi.clearAllMocks());

describe("envio financeiro dos anexos direcionados", () => {
  it("repete somente nos destinos com data vazia e mesma competência", async () => {
    const consulta = { select: vi.fn(), like: vi.fn(), neq: vi.fn() };
    consulta.select.mockReturnValue(consulta);
    consulta.like.mockReturnValue(consulta);
    consulta.neq.mockResolvedValue({ data: [{ movimentacao_id: "destino" }, { movimentacao_id: "destino" }], error: null });
    const atualizacao = { update: vi.fn(), in: vi.fn(), eq: vi.fn(), is: vi.fn() };
    atualizacao.update.mockReturnValue(atualizacao);
    atualizacao.in.mockReturnValue(atualizacao);
    atualizacao.eq.mockReturnValue(atualizacao);
    atualizacao.is.mockResolvedValue({ error: null });
    mocks.from.mockReturnValueOnce(consulta).mockReturnValueOnce(atualizacao);
    await sincronizarEnvioDosAnexos("origem", "2026-10-13", "2026-10");
    expect(consulta.like).toHaveBeenCalledWith("storage_path", "%/origem/%");
    expect(consulta.neq).toHaveBeenCalledWith("movimentacao_id", "origem");
    expect(atualizacao.in).toHaveBeenCalledWith("id", ["destino"]);
    expect(atualizacao.eq).toHaveBeenCalledWith("mes_referencia", "2026-10");
    expect(atualizacao.is).toHaveBeenCalledWith("data_envio_financeiro", null);
  });
  it("não mascara erros ao consultar os destinos", async () => {
    const consulta = { select: vi.fn(), like: vi.fn(), neq: vi.fn() };
    consulta.select.mockReturnValue(consulta);
    consulta.like.mockReturnValue(consulta);
    consulta.neq.mockResolvedValue({ error: new Error("Falha de consulta") });
    mocks.from.mockReturnValue(consulta);
    await expect(sincronizarEnvioDosAnexos("origem", "2026-10-13", "2026-10")).rejects.toThrow("Falha de consulta");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});