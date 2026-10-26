import { describe, expect, it } from "vitest";
import { RELATORIO_VAZIO, STATUS_RELATORIO, validarRegistroRelatorio } from "@/lib/movimentacao-relatorio";
describe("controle manual independente do relatório", () => {
  it("começa Não gerado sem envio nem confirmação", () => {
    expect(RELATORIO_VAZIO).toMatchObject({ status: "Não gerado", data_envio: null, confirmacao: "Aguardando" });
    expect(validarRegistroRelatorio(RELATORIO_VAZIO)).toBeNull();
  });
  it("aceita todos os nove estados solicitados", () => {
    expect(STATUS_RELATORIO).toHaveLength(9);
    for (const status of STATUS_RELATORIO) {
      const confirmacao = ["Conferido pela empresa", "Divergência informada"].includes(status) ? status : "Aguardando";
      expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status, destinatarios: "rh@empresa.com.br", data_envio: "2026-10-26", confirmacao })).toBeNull();
    }
  });
  it("não registra Enviado sem destinatários", () => {
    expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status: "Enviado", data_envio: "2026-10-26" })).not.toBeNull();
  });
  it("não registra Enviado sem data", () => {
    expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status: "Enviado", destinatarios: "RH" })).not.toBeNull();
  });
  it("confirmação divergente não pode ser registrada como conferida", () => {
    expect(validarRegistroRelatorio({ ...RELATORIO_VAZIO, status: "Conferido pela empresa", destinatarios: "RH", data_envio: "2026-10-26", confirmacao: "Divergência informada" })).not.toBeNull();
  });
});